// player_attack + offhand_attack handlers — the largest combat logic. Resolves
// weapon AND spell attacks (utility, healing, saving-throw, auto-hit/Magic Missile,
// Eldritch Blast, then generic attack-roll), applies feats, conditions, damage mods,
// smite/sneak/rage, and advances the turn. Extracted verbatim from combatEngine/entry.ts.
import {
  statMod, rollD20, rollDice, rollDiceStr, scaleCantripDice, SPELL_ABILITY_MAP,
  applyDamageModifiers, resolveAttackRoll, rollConcentrationSave,
  getActionsPerTurn, resolveActionAndAdvance,
} from './helpers.ts';
import { finalizeAndPersistCombat } from './persistence.ts';

export async function handlePlayerAttack(ctx) {
  const { base44, session_id, combat_id, character_id, payload } = ctx;
  const { target_id, weapon, spell, modifiers = {} } = payload;
  const combatLog = await base44.entities.CombatLog.get(combat_id);
  // User-scoped fetch: RLS only returns the record if the user may read (owns) it,
  // so a successful fetch proves ownership. (Manual created_by/email compare was
  // fragile and caused false 403s for the legitimate owner.)
  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const combatants = [...combatLog.combatants];
  const target = combatants.find(c => c.id === target_id);
  if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

  // Centralized attack roll: gather all advantage/disadvantage SOURCES here, then
  // roll exactly once at the end (see resolveAttackRoll in helpers). The
  // initial modifiers.advantage/disadvantage seed the source lists; condition and
  // feat checks below push additional sources instead of re-rolling mid-flight.
  const advSources = [!!modifiers.advantage];
  const disSources = [!!modifiers.disadvantage];
  let forceCrit = false; // condition-driven auto-crit (paralyzed/unconscious melee)
  let useLuckyPoint = false; // Lucky feat: reroll the d20 after the centralized roll

  let attackMod = 0;
  let damageDice = '1d6';
  let damageBonus = 0;
  let attackType = 'melee';
  let extraDamageDice = []; // For smite, sneak attack, etc
  let sneakAttackApplied = false; // tracks if Sneak Attack was used this attack (once-per-turn guard)
  let colossusApplied = false; // Hunter Ranger Colossus Slayer (once-per-turn guard)

  // Register a disadvantage source (deferred — resolved in the single final roll).
  const applyDisadvantage = () => { disSources.push(true); };

  if (spell) {
    // Barbarian Rage (PHB p.48): cannot cast or concentrate on spells while raging.
    const playerConds = (character.conditions || []).map(c => String(typeof c === 'string' ? c : c?.name || '').toLowerCase());
    if (playerConds.includes('raging')) {
      return Response.json({ error: 'You cannot cast spells while raging (PHB p.48).', invalid: true }, { status: 400 });
    }
    const spellAbility = SPELL_ABILITY_MAP[(character.class || '').toLowerCase()] || 'intelligence';
    const spellStatMod = statMod(character[spellAbility]);
    const profBonus = character.proficiency_bonus || 2;
    const spellSaveDC = 8 + spellStatMod + profBonus;
    const spellAttackBonus = spellStatMod + profBonus;

    attackMod = spellAttackBonus;
    // Scale cantrip damage by character level (PHB cantrip scaling rules)
    const isCantrip = (spell.base_level === 0 || spell.slot_level === 0);
    damageDice = isCantrip
      ? scaleCantripDice(spell.damage_dice || '1d6', character.level || 1)
      : (spell.damage_dice || '2d6');
    damageBonus = 0; // spell damage doesn't add ability mod (unless explicit)
    attackType = spell.attack_type || 'ranged_spell_attack';

    // Handle upcast: scale damage dice if upcasting (add 1 die per slot level above base)
    // e.g. Fireball (8d6 base level 3) cast at level 4 → 9d6, level 5 → 10d6
    const slotLevel = spell.slot_level || spell.base_level || 1;
    const baseLevel = spell.base_level || 1;
    const upcasting = slotLevel > baseLevel;
    if (upcasting && damageDice && damageDice !== '0') {
      const dMatch0 = damageDice.match(/^(\d+)d(\d+)$/);
      if (dMatch0) {
        const baseDieCount = parseInt(dMatch0[1]);
        const dieSides = parseInt(dMatch0[2]);
        const extraLevels = slotLevel - baseLevel;
        // Add 1 die per extra slot level, capped so we don't over-scale cantrips
        damageDice = `${baseDieCount + extraLevels}d${dieSides}`;
      }
    }

    // Class spell-damage riders — applied to both attack-roll and save spells.
    let spellDamageRider = 0;
    const casterSub = (character.subclass || '').toLowerCase();
    // Potent Spellcasting (Cleric 8+, Knowledge/Light/Arcana — PHB p.59): +WIS to cantrips (H-C2 fix)
    if (isCantrip && (character.class || '') === 'Cleric' && (character.level || 1) >= 8
        && ['knowledge', 'light', 'arcana'].some(d => casterSub.includes(d))) {
      spellDamageRider += Math.max(0, statMod(character.wisdom || 10));
    }
    // Elemental Affinity (Draconic Sorcerer 6+, PHB p.102): +CHA when the spell's
    // damage type matches your draconic ancestry (M-S fix)
    if ((character.class || '') === 'Sorcerer' && (character.level || 1) >= 6 && casterSub.includes('draconic')) {
      const anc = (character.class_choices?.dragon_ancestry || '').toLowerCase();
      const DRT = { black: 'acid', copper: 'acid', blue: 'lightning', bronze: 'lightning', brass: 'fire', gold: 'fire', red: 'fire', green: 'poison', silver: 'cold', white: 'cold' };
      if (DRT[anc] && (spell.damage_type || '').toLowerCase() === DRT[anc]) {
        spellDamageRider += Math.max(0, statMod(character.charisma || 10));
      }
    }
    // Empowered Evocation (Evocation Wizard 10+, PHB p.117): +INT to evocation spell damage (M-S fix)
    if ((character.class || '') === 'Wizard' && (character.level || 1) >= 10 && casterSub.includes('evocation')
        && (spell.school || '').toLowerCase() === 'evocation') {
      spellDamageRider += Math.max(0, statMod(character.intelligence || 10));
    }
    damageBonus += spellDamageRider;
    // Arcane Ward (Abjuration Wizard 2+, PHB p.115): abjuration casts create/recharge the ward (M-S fix)
    if ((character.class || '') === 'Wizard' && (character.level || 1) >= 2 && casterSub.includes('abjuration')
        && (spell.school || '').toLowerCase() === 'abjuration' && (spell.slot_level || 0) >= 1) {
      const lraW = character.long_rest_abilities || {};
      const wardMax = 2 * (character.level || 1) + statMod(character.intelligence || 10);
      const newWard = lraW.arcane_ward_created ? Math.min(wardMax, (lraW.arcane_ward_hp || 0) + 2 * spell.slot_level) : wardMax;
      await base44.entities.Character.update(character_id, { long_rest_abilities: { ...lraW, arcane_ward_hp: newWard, arcane_ward_created: true } });
    }

    // H1/H5 fix — slot validation uses the same level-indexed tables as handleRest,
    // and ALL validation (slots + metamagic sorcery points) happens BEFORE any
    // deduction is persisted. Deductions are batched into a single update at the end.
    let slotDeduction = null; // { slotsKey, currentUsed }
    let spDeduction = null;   // { spMax, newCurrent }
    if (spell.slot_level && spell.slot_level > 0) {
      const slotsKey = `level_${spell.slot_level}`;
      const currentUsed = (character.spell_slots || {})[slotsKey] || 0;
      // Per-class slot maximums by character level (index 0 = level 1) — matches handleRest.
      const FULL = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
      const HALF = [[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
      const ARTIFICER = [[2],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
      const WARLOCK_PACT = [1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4]; // pact slot COUNT by level
      const SLOT_TABLES = { Wizard: FULL, Sorcerer: FULL, Bard: FULL, Cleric: FULL, Druid: FULL, Paladin: HALF, Ranger: HALF, Artificer: ARTIFICER };
      const charLevel = Math.min(20, character.level || 1);
      const slotIdx = spell.slot_level - 1;
      const subLower = (character.subclass || '').toLowerCase();
      const isThirdCaster = subLower.includes('eldritch knight') || subLower.includes('arcane trickster');
      const isMulticlassed = Array.isArray(character.multiclass) && character.multiclass.length > 0;
      // Combined caster level for multiclass (PHB p.164): full = level,
      // half = level/2 (Paladin/Ranger/Artificer), third = level/3 (EK/AT).
      // Same semantics as handleRest's computeCasterLevel.
      const casterContribution = (cls, sub, lvls) => {
        if (['Wizard','Sorcerer','Bard','Cleric','Druid'].includes(cls)) return lvls;
        if (['Paladin','Ranger','Artificer'].includes(cls)) return Math.floor(lvls / 2);
        const s = (sub || '').toLowerCase();
        if (s.includes('eldritch knight') || s.includes('arcane trickster')) return Math.floor(lvls / 3);
        return 0;
      };
      let maxForLevel = 0;
      if (character.class === 'Warlock' && !isMulticlassed) {
        // Pact Magic (PHB p.107): N slots, all at the pact slot level.
        const pactLevel = Math.min(5, Math.ceil(charLevel / 2));
        maxForLevel = spell.slot_level <= pactLevel ? (WARLOCK_PACT[charLevel - 1] || 0) : 0;
      } else if (isMulticlassed) {
        let casterLevel = casterContribution(character.class, character.subclass, character.level || 1);
        for (const mc of (character.multiclass || [])) {
          if (mc?.class === 'Warlock') continue; // Pact Magic excluded from the shared pool (PHB p.164)
          casterLevel += casterContribution(mc?.class, mc?.subclass, mc?.levels || 0);
        }
        maxForLevel = casterLevel > 0 ? ((FULL[Math.min(20, casterLevel) - 1] || [])[slotIdx] || 0) : 0;
      } else if (isThirdCaster) {
        const casterLevel = Math.floor(charLevel / 3);
        maxForLevel = casterLevel > 0 ? ((FULL[casterLevel - 1] || [])[slotIdx] || 0) : 0;
      } else {
        maxForLevel = (((SLOT_TABLES[character.class] || [])[charLevel - 1]) || [])[slotIdx] || 0;
      }
      if (currentUsed >= maxForLevel) {
        return Response.json({ error: `No ${spell.slot_level === 1 ? '1st' : spell.slot_level + 'th'}-level spell slots remaining.`, invalid: true }, { status: 400 });
      }
      slotDeduction = { slotsKey, currentUsed };
    }

    // === SORCERER METAMAGIC: validate sorcery points (PHB p.101-102) ===
    // Quickened = 2 SP, Heightened = 3 SP, Twinned = spell level (min 1).
    const meta = modifiers.metamagic || {};
    if ((character.class || '').toLowerCase() === 'sorcerer' && (meta.quickened || meta.twinned || meta.heightened)) {
      const lvl = spell.slot_level || 1;
      let spCost = 0;
      if (meta.quickened) spCost += 2;
      if (meta.heightened) spCost += 3;
      if (meta.twinned) spCost += Math.max(1, lvl);
      // Self-heal: initialize SP pool (= sorcerer level from level 2) if not yet set.
      const spMax = character.sorcery_points_max ?? ((character.level || 1) >= 2 ? (character.level || 1) : 0);
      const spAvail = character.sorcery_points_current ?? spMax;
      if (spCost > spAvail) {
        return Response.json({ error: `Not enough sorcery points (need ${spCost}, have ${spAvail}).`, invalid: true }, { status: 400 });
      }
      spDeduction = { spMax, newCurrent: spAvail - spCost };
    }

    // ALL validation passed — persist slot + sorcery point deductions together.
    if (slotDeduction || spDeduction) {
      const deductUpdates = {};
      if (slotDeduction) deductUpdates.spell_slots = { ...(character.spell_slots || {}), [slotDeduction.slotsKey]: slotDeduction.currentUsed + 1 };
      if (spDeduction) { deductUpdates.sorcery_points_max = spDeduction.spMax; deductUpdates.sorcery_points_current = spDeduction.newCurrent; }
      await base44.entities.Character.update(character_id, deductUpdates);
    }

    // === UTILITY / BUFF spells ===
    if (spell.is_utility) {
      const utilEntry = {
        round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
        hit: null, text: `${character.name} casts ${spell.name}!`,
        spell_name: spell.name, is_utility: true
      };
      const updatedLog = [...(combatLog.log_entries || []), utilEntry];
      const { nextIndex: nextIndex2, nextRound: nextRound2, actionsRemaining: actionsRemaining2, worldState: newWorldState2 } =
        resolveActionAndAdvance(combatLog, combatants, character);
      await base44.entities.CombatLog.update(combat_id, {
        log_entries: updatedLog, current_turn_index: nextIndex2, round: nextRound2, world_state: newWorldState2
      });
      return Response.json({ hit: null, damage: 0, log_entry: utilEntry, result: 'ongoing', combat_ended: false, actions_remaining: actionsRemaining2, next_turn_index: nextIndex2 });
    }

    // === HEALING spells ===
    if (spell.attack_type === 'healing' && spell.heal_dice) {
      let healAmt = rollDiceStr(spell.heal_dice || '1d8');
      healAmt += spellStatMod;
      // Life Domain Cleric — Disciple of Life (PHB p.60): healing spells
      // restore an extra 2 + the spell's slot level. Automatic.
      if ((character.class || '') === 'Cleric' && (character.subclass || '').toLowerCase().includes('life')) {
        healAmt += 2 + (spell.slot_level || 1);
      }
      const player2 = combatants.find(c => c.type === 'player');
      if (player2) {
        player2.hp_current = Math.min(player2.hp_max, player2.hp_current + healAmt);
        await base44.entities.Character.update(character_id, { hp_current: player2.hp_current });
      }
      const healEntry = {
        round: combatLog.round, actor: character.name, action: 'spell', target: character.name,
        hit: true, text: `${character.name} casts ${spell.name}! Restores ${healAmt} HP.`,
        spell_name: spell.name, heal_amount: healAmt
      };
      const updatedCombatants2 = combatants.map(c => c.type === 'player' ? player2 : c);
      const { nextIndex: ni3, nextRound: nr3, actionsRemaining: actionsRem3, worldState: ws3 } =
        resolveActionAndAdvance(combatLog, updatedCombatants2, character);
      await base44.entities.CombatLog.update(combat_id, {
        combatants: updatedCombatants2, log_entries: [...(combatLog.log_entries || []), healEntry],
        current_turn_index: ni3, round: nr3, world_state: ws3
      });
      return Response.json({ hit: true, damage: 0, heal_amount: healAmt, log_entry: healEntry, result: 'ongoing', combat_ended: false, actions_remaining: actionsRem3, next_turn_index: ni3 });
    }

    // === SAVING THROW spells ===
    if (spell.attack_type === 'saving_throw' && spell.save_type) {
      // Target's save ability — use what we have on the combatant, else default to 10
      const targetSaveStat = target[spell.save_type] || target.save_stats?.[spell.save_type] || 10;
      const targetSaveMod = statMod(targetSaveStat);
      const saveRoll = rollD20();
      const saveTotal = saveRoll + targetSaveMod;
      const saveFailed = saveTotal < spellSaveDC;

      // Heightened Spell metamagic: target rolls its save with disadvantage (PHB p.102)
      let effectiveSaveTotal = saveTotal;
      let effectiveSaveFailed = saveFailed;
      if (modifiers.metamagic?.heightened) {
        const saveRoll2 = rollD20();
        const saveTotal2 = saveRoll2 + targetSaveMod;
        effectiveSaveTotal = Math.min(saveTotal, saveTotal2);
        effectiveSaveFailed = effectiveSaveTotal < spellSaveDC;
      }

      // Legendary Resistance (MM): a legendary creature can choose to succeed on a
      // failed save, up to legendary_resistance_remaining times per day.
      let usedLegendaryResistance = false;
      if (effectiveSaveFailed && (target.legendary_resistance_remaining || 0) > 0) {
        target.legendary_resistance_remaining -= 1;
        effectiveSaveFailed = false;
        usedLegendaryResistance = true;
      }

      // Destructive Wrath (Tempest Cleric, PHB p.62): maximize armed lightning/thunder damage (M-S fix)
      const wrathArmed = !!combatLog.world_state?.destructive_wrath && ['lightning', 'thunder'].includes((spell.damage_type || '').toLowerCase());
      const maxDice = (ds) => { const mm = (ds || '').match(/^(\d+)d(\d+)$/); return mm ? parseInt(mm[1]) * parseInt(mm[2]) : 0; };
      const dmg2 = (wrathArmed ? maxDice(damageDice) : rollDiceStr(damageDice)) + spellDamageRider; // riders apply to save spells too
      // On save failure: minimum 1 damage. On success: half damage (can be 0 for weak saves)
      let finalDmg = effectiveSaveFailed ? Math.max(1, dmg2) : Math.max(0, Math.floor(dmg2 / 2));
      // Evasion (Rogue L7, PHB p.96): DEX saves → no damage on success, half on failure
      if (spell.save_type === 'dexterity' && target.has_evasion) {
        finalDmg = effectiveSaveFailed ? Math.max(0, Math.floor(dmg2 / 2)) : 0;
      }
      if (finalDmg > 0) {
        target.hp_current = Math.max(0, target.hp_current - finalDmg);
        if (target.hp_current === 0) target.is_conscious = false;
      }

      // === STATUS-EFFECT spells (Hold Person/Monster, Banishment, Polymorph, etc.) ===
      // If the spell inflicts a condition and the save failed, apply it to the target.
      let appliedCondition = null;
      const specialEffects = spell.special_effects || [];
      const CONDITION_EFFECT_NAMES = ['paralyzed','banished','polymorphed','charmed','frightened','stunned','restrained','prone','blinded','incapacitated'];
      const conditionToApply = specialEffects.find(e => CONDITION_EFFECT_NAMES.includes(e));
      if (effectiveSaveFailed && conditionToApply && target.hp_current > 0) {
        const existing = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
        if (!existing.includes(conditionToApply)) {
          // Store the save DC + ability so the affected creature can re-save each turn.
          target.conditions = [
            ...(target.conditions || []),
            { name: conditionToApply, source: spell.name, save_dc: spellSaveDC, save_ability: spell.save_type, caster: character.name }
          ];
          appliedCondition = conditionToApply;
        }
      }

      const saveEntry = {
        round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
        hit: effectiveSaveFailed, spell_name: spell.name,
        text: `${character.name} casts ${spell.name}! DC${spellSaveDC} ${spell.save_type} save: ${target.name} rolled ${effectiveSaveTotal}${modifiers.metamagic?.heightened ? ' (Heightened: disadvantage)' : ''} — ${usedLegendaryResistance ? `FAILED but uses LEGENDARY RESISTANCE (${target.legendary_resistance_remaining} left)` : (effectiveSaveFailed ? 'FAILED' : 'success')}.${finalDmg > 0 ? ` Takes ${finalDmg} ${spell.damage_type || ''} damage.` : ''}${appliedCondition ? ` ${target.name} is ${appliedCondition.toUpperCase()}!` : ''}${target.hp_current === 0 ? ` ${target.name} falls!` : ''}`
      };

      // Twinned Spell: resolve the same spell against a second creature (PHB p.102).
      let twinTarget = null;
      let twinText = '';
      if (modifiers.metamagic?.twinned && payload.twin_target_id && payload.twin_target_id !== target_id) {
        twinTarget = combatants.find(c => c.id === payload.twin_target_id);
        if (twinTarget && twinTarget.is_conscious) {
          const tStat = twinTarget[spell.save_type] || twinTarget.save_stats?.[spell.save_type] || 10;
          const tMod = statMod(tStat);
          const tr1 = rollD20();
          const tr2 = modifiers.metamagic?.heightened ? rollD20() : tr1;
          const tTotal = Math.min(tr1 + tMod, tr2 + tMod);
          const tFailed = tTotal < spellSaveDC;
          const tDmgRaw = rollDiceStr(damageDice);
          const tDmg = tFailed ? Math.max(1, tDmgRaw) : Math.max(0, Math.floor(tDmgRaw / 2));
          if (tDmg > 0) { twinTarget.hp_current = Math.max(0, twinTarget.hp_current - tDmg); if (twinTarget.hp_current === 0) twinTarget.is_conscious = false; }
          if (tFailed && conditionToApply && twinTarget.hp_current > 0) {
            const tExisting = (twinTarget.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
            if (!tExisting.includes(conditionToApply)) {
              twinTarget.conditions = [...(twinTarget.conditions || []), { name: conditionToApply, source: spell.name, save_dc: spellSaveDC, save_ability: spell.save_type, caster: character.name }];
            }
          }
          twinText = ` Twinned → ${twinTarget.name}: rolled ${tTotal}, ${tFailed ? 'FAILED' : 'success'}.${tDmg > 0 ? ` ${tDmg} damage.` : ''}${tFailed && conditionToApply ? ` ${conditionToApply.toUpperCase()}!` : ''}`;
          saveEntry.text += twinText;
        }
      }

      const updatedC = combatants.map(c => {
        if (c.id === target_id) return target;
        if (twinTarget && c.id === twinTarget.id) return twinTarget;
        return c;
      });

      // Quickened Spell: cast as a bonus action — does NOT consume an action.
      const isQuickened = !!modifiers.metamagic?.quickened;
      const { nextIndex: ni, nextRound: nr, actionsRemaining: ar2, worldState: ws } =
        resolveActionAndAdvance(combatLog, updatedC, character, { isQuickened });
      if (wrathArmed) { ws.destructive_wrath = false; saveEntry.text += ' ⚡ DESTRUCTIVE WRATH: damage maximized!'; }
      // Track concentration spell in world_state
      if (spell.requires_concentration) {
        ws.concentration_spell = spell.name;
        ws.concentration_caster = character.name;
      }
      const result2 = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedC,
        [...(combatLog.log_entries || []), saveEntry], ni, nr, ws);
      return Response.json({ hit: saveFailed, damage: finalDmg, log_entry: saveEntry, result: result2, combat_ended: result2 !== 'ongoing', actions_remaining: Math.max(0, ar2), next_turn_index: ni });
    }

    // === MAGIC MISSILE (auto-hit, no attack roll needed) ===
    if (spell.attack_type === 'auto_hit') {
      const numMissiles = (spell.num_missiles || 3) + Math.max(0, (spell.slot_level || 1) - 1);
      let totalMissileDmg = 0;
      for (let m = 0; m < numMissiles; m++) {
        totalMissileDmg += rollDice(4) + 1; // 1d4+1 per missile
      }
      totalMissileDmg = Math.max(1, totalMissileDmg);
      target.hp_current = Math.max(0, target.hp_current - totalMissileDmg);
      if (target.hp_current === 0) target.is_conscious = false;
      const updatedCMM = combatants.map(c => c.id === target_id ? target : c);
      const mmEntry = {
        round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
        hit: true, damage: totalMissileDmg, spell_name: spell.name,
        text: `${character.name} fires ${numMissiles} Magic Missile${numMissiles > 1 ? 's' : ''} at ${target.name} for ${totalMissileDmg} force damage! (auto-hit)${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
      };
      const { nextIndex: niMM, nextRound: nrMM, actionsRemaining: arMM, worldState: wsMM } =
        resolveActionAndAdvance(combatLog, updatedCMM, character);
      const resultMM = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedCMM,
        [...(combatLog.log_entries || []), mmEntry], niMM, nrMM, wsMM);
      return Response.json({ hit: true, damage: totalMissileDmg, log_entry: mmEntry, result: resultMM, combat_ended: resultMM !== 'ongoing', actions_remaining: Math.max(0, arMM), next_turn_index: niMM });
    }

    // === ELDRITCH BLAST multi-beam (Warlock, scales at levels 5/11/17) ===
    if (spell.name === 'Eldritch Blast') {
      // targetACBonus defined here so it is in scope for the beam loop
      const ebTargetACBonus = (modifiers.half_cover ? 2 : 0) + (modifiers.three_quarters_cover ? 5 : 0);
      // Agonizing Blast (PHB p.110): if known, add CHA modifier to each beam's damage.
      const agonizingBonus = (character.features || []).some(f => String(typeof f === 'string' ? f : f?.name || '').toLowerCase().includes('agonizing blast'))
        ? Math.max(0, statMod(character.charisma || 10)) : 0;
      const beams = character.level >= 17 ? 4 : character.level >= 11 ? 3 : character.level >= 5 ? 2 : 1;
      let totalBeamDmg = 0; let anyBeamHit = false; let beamCrit = false;
      const beamLogs = [];
      for (let b = 0; b < beams; b++) {
        const br1 = rollD20(); const br2 = rollD20();
        const br = (modifiers.advantage ? Math.max(br1,br2) : modifiers.disadvantage ? Math.min(br1,br2) : br1);
        const bCrit = br === 20; const bMiss = br === 1;
        const bMod = spellAttackBonus;
        const bHit = !bMiss && (bCrit || (br + bMod) >= (target.ac + ebTargetACBonus));
        if (bCrit) beamCrit = true;
        if (bHit) {
          anyBeamHit = true;
          const numD = bCrit ? 2 : 1;
          let d = 0; for (let i = 0; i < numD; i++) d += rollDice(10);
          d += agonizingBonus;
          totalBeamDmg += d;
          // Repelling Blast (PHB p.110): hit pushes target 10 feet
          const hasRepellingBlast = (character.features || []).some(f => String(typeof f === 'string' ? f : f?.name || '').toLowerCase().includes('repelling blast'));
          const pushText = hasRepellingBlast ? ' [pushed 10ft]' : '';
          beamLogs.push(`Beam ${b+1}: ${bCrit?'CRIT! ':''}${d} force${agonizingBonus ? ' (Agonizing)' : ''}${pushText} (${br}+${bMod}=${br+bMod} vs AC ${target.ac})`);
        } else {
          beamLogs.push(`Beam ${b+1}: miss (${br}+${bMod}=${br+bMod} vs AC ${target.ac})`);
        }
      }
      if (totalBeamDmg > 0) {
        target.hp_current = Math.max(0, target.hp_current - totalBeamDmg);
        if (target.hp_current === 0) target.is_conscious = false;
      }
      const updatedCEB = combatants.map(c => c.id === target_id ? target : c);
      const ebEntry = {
        round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
        hit: anyBeamHit, critical: beamCrit, damage: totalBeamDmg, spell_name: 'Eldritch Blast',
        text: `${character.name} fires ${beams} Eldritch Blast beam${beams>1?'s':''} at ${target.name}! ${beamLogs.join(' | ')} — Total: ${totalBeamDmg} force damage.${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
      };
      const { nextIndex: niEB, nextRound: nrEB, actionsRemaining: arEB, worldState: wsEB } =
        resolveActionAndAdvance(combatLog, updatedCEB, character);
      const resultEB = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedCEB,
        [...(combatLog.log_entries || []), ebEntry], niEB, nrEB, wsEB);
      return Response.json({ hit: anyBeamHit, damage: totalBeamDmg, log_entry: ebEntry, result: resultEB, combat_ended: resultEB !== 'ongoing', actions_remaining: Math.max(0, arEB), next_turn_index: niEB });
    }

    // Fall through: ranged/melee spell attacks use spellAttackBonus already set above.
    // damageBonus stays 0 for spell attacks (no ability mod added to spell damage by default).
  } else if (weapon) {
    const isRanged = weapon.type === 'ranged';
    // Monk Martial Arts (PHB p.76): unarmed strikes scale die by level and can use DEX
    if ((character.class || '') === 'Monk' && weapon.name === 'Unarmed Strike') {
      const monkLevel = character.level || 1;
      const maDie = monkLevel >= 17 ? 10 : monkLevel >= 11 ? 8 : monkLevel >= 5 ? 6 : 4;
      weapon.damage_dice = `1d${maDie}`;
      if (!(weapon.properties || []).includes('finesse')) {
        weapon.properties = [...(weapon.properties || []), 'finesse'];
      }
    }
    // Ammunition (PHB p.146): ranged weapons with the Ammunition property must
    // consume a matching ammo item from inventory. Block the attack if none left.
    const weaponProps = (weapon.properties || []).map(p => p.toLowerCase());
    const usesAmmo = weaponProps.includes('ammunition');
    // Loading (PHB p.147): validated BEFORE ammunition is consumed — a blocked
    // shot must never eat a bolt/arrow (H5 fix: validation before persistence).
    const hasLoading = weaponProps.includes('loading');
    if (isRanged && hasLoading && combatLog.world_state?.loading_weapon_fired) {
      return Response.json({ error: `${weapon.name} has the Loading property — it can only be fired once per turn.`, invalid: true }, { status: 400 });
    }
    if (isRanged && usesAmmo) {
      const AMMO_FOR = {
        'longbow': 'arrow', 'shortbow': 'arrow',
        'light crossbow': 'bolt', 'heavy crossbow': 'bolt', 'hand crossbow': 'bolt',
        'sling': 'bullet',
      };
      const ammoKeyword = AMMO_FOR[(weapon.name || '').toLowerCase()] || 'arrow';
      const inv = character.inventory || [];
      const ammoIdx = inv.findIndex(it =>
        (it.name || '').toLowerCase().includes(ammoKeyword) && (it.quantity ?? 1) > 0
      );
      if (ammoIdx === -1) {
        return Response.json({ error: `Out of ammunition (${ammoKeyword}s). Restock before firing.`, invalid: true }, { status: 400 });
      }
      // Decrement one unit of ammunition
      const newInv = inv.map((it, i) => i === ammoIdx ? { ...it, quantity: Math.max(0, (it.quantity ?? 1) - 1) } : it);
      await base44.entities.Character.update(character_id, { inventory: newInv });
    }
    const isFinesse = (weapon.properties || []).includes('finesse');
    const strMod = statMod(character.strength);
    const dexMod = statMod(character.dexterity);
    // Ranged weapons use DEX; finesse uses best of STR/DEX; melee uses STR
    let abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
    // Hex Warrior (Hexblade Warlock, XGtE p.55): weapon attacks can use CHA (H-S3 fix)
    if ((character.class || '') === 'Warlock' && (character.subclass || '').toLowerCase().includes('hexblade')) {
      abilityMod = Math.max(abilityMod, statMod(character.charisma || 10));
    }
    const profBonus = character.proficiency_bonus || 2;
    attackMod = abilityMod + profBonus + (weapon.attack_bonus || 0);
    damageBonus = abilityMod + (weapon.damage_bonus || 0);
    damageDice = weapon.damage_dice || '1d8';
    attackType = isRanged ? 'ranged' : 'melee';

    // Warlock invocations (PHB p.110-111)
    if ((character.class || '') === 'Warlock') {
      const warlockFeatures = (character.features || []).map(f => String(typeof f === 'string' ? f : f?.name || '').toLowerCase());
      // Improved Pact Weapon: +1 to attack and damage with pact weapon
      if (warlockFeatures.includes('improved pact weapon')) {
        attackMod += 1;
        damageBonus += 1;
      }
      // Lifedrinker (L12): add CHA mod to pact weapon damage
      if ((character.level || 1) >= 12 && warlockFeatures.includes('lifedrinker')) {
        damageBonus += Math.max(0, statMod(character.charisma || 10));
      }
    }

    // Apply Fighting Style bonuses
    const fightingStyle = character.fighting_style?.toLowerCase();
    if (fightingStyle === 'archery' && isRanged) attackMod += 2;
    // Dueling: +2 damage when wielding a single one-handed weapon and no other weapon in offhand
    // Shield occupies 'offhand' slot (not 'shield'), so check both keys
    const hasOffhandItem = !!(character.equipped?.offhand || character.equipped?.shield);
    if (fightingStyle === 'dueling' && !isRanged && !hasOffhandItem) damageBonus += 2;

    // === FEAT EFFECTS on weapon attacks ===
    const featFlags = character._feat_flags || [];
    const hasFeat = (name) => (character.feats || []).includes(name) || featFlags.includes(name.toLowerCase().replace(/\s+/g,'_'));

    // Small creature + Heavy weapon = disadvantage (PHB p.147)
    // Small races: Halfling, Gnome, Goblin, Kobold (Small size)
    const SMALL_RACES = ['Halfling', 'Gnome', 'Goblin', 'Kobold'];
    const isSmallRace = SMALL_RACES.includes(character.race);
    const weapon2H = (weapon.properties || []).map(p => p.toLowerCase());
    const isHeavyWeapon = weapon2H.includes('heavy');
    if (isSmallRace && isHeavyWeapon) applyDisadvantage();

    // Bugbear Surprise Attack (Volo's p.119): +2d6 on the first hit of combat
    // against a creature that hasn't acted yet (round 1, once per combat).
    if ((character.race || '') === 'Bugbear' && combatLog.round === 1 && !combatLog.world_state?.bugbear_surprise_used) {
      extraDamageDice.push({ dice: '2d6', type: 'surprise', label: 'Surprise Attack' });
    }
    // Kobold Pack Tactics (Volo's p.119): advantage on attacks when an ally
    // (summoned companion) is fighting alongside you.
    if ((character.race || '') === 'Kobold' && combatants.some(c => c.type === 'companion' && c.is_conscious)) {
      advSources.push(true);
    }

    // Great Weapon Master: -5/+10 on heavy two-handed weapons (PHB p.167)
    const isHeavyTwoHanded = weapon2H.includes('heavy') && weapon2H.includes('two-handed');
    if (modifiers.great_weapon_master && hasFeat('Great Weapon Master') && isHeavyTwoHanded && !isRanged) {
      attackMod -= 5;
      damageBonus += 10;
    }

    // Sharpshooter: -5/+10 on ranged proficient attacks (PHB p.170)
    if (modifiers.sharpshooter && hasFeat('Sharpshooter') && isRanged) {
      attackMod -= 5;
      damageBonus += 10;
    }

    // Barbarian Rage
    if (modifiers.rage && !isRanged) {
      const level = character.level || 1;
      const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
      damageBonus += rageDamage;
    }

    // Hunter Ranger — Colossus Slayer (PHB p.93): once per turn, +1d8 damage
    // when the target is already below its hit point maximum. Automatic.
    if ((character.class || '') === 'Ranger' && (character.subclass || '').toLowerCase().includes('hunter')
        && target.hp_current < target.hp_max && !combatLog.world_state?.colossus_slayer_used) {
      extraDamageDice.push({ dice: '1d8', type: 'colossus', label: 'Colossus Slayer' });
      colossusApplied = true;
    }
    // Cleric Divine Strike (PHB p.59, weapon-strike domains, level 8+): once per
    // turn, +1d8 on a weapon hit (2d8 at level 14). Automatic (H-C2 fix).
    if ((character.class || '') === 'Cleric' && (character.level || 1) >= 8 && !combatLog.world_state?.divine_strike_used) {
      const dsub = (character.subclass || '').toLowerCase();
      const hasDivineStrike = ['life', 'nature', 'tempest', 'trickery', 'war', 'death', 'forge', 'order'].some(d => dsub.includes(d));
      if (hasDivineStrike) {
        extraDamageDice.push({ dice: (character.level || 1) >= 14 ? '2d8' : '1d8', type: 'divine_strike', label: 'Divine Strike' });
      }
    }
    // Gloom Stalker Dread Ambusher (XGtE p.41): +1d8 on your first-turn attack, once per combat (M-S fix)
    if ((character.class || '') === 'Ranger' && (character.subclass || '').toLowerCase().includes('gloom')
        && combatLog.round === 1 && !combatLog.world_state?.dread_ambusher_used) {
      extraDamageDice.push({ dice: '1d8', type: 'dread_ambusher', label: 'Dread Ambusher' });
    }
    // Horizon Walker — Planar Warrior (XGtE p.42): armed — +1d8 force (2d8 at L11) on this attack (M-S fix)
    if (combatLog.world_state?.planar_warrior_target === target_id) {
      extraDamageDice.push({ dice: (character.level || 1) >= 11 ? '2d8' : '1d8', type: 'planar_warrior', label: 'Planar Warrior' });
    }
    // Reckless Attack (PHB p.48): advantage on melee STR attacks this turn.
    // Register as an advantage source — resolved in the single final roll.
    if (modifiers.reckless_attack && character.class === 'Barbarian' && !isRanged) {
      advSources.push(true);
    }

    // Rogue Sneak Attack (PHB p.96) — server-authoritative validation:
    //  • once per TURN (tracked in world_state.sneak_attack_used)
    //  • requires a finesse or ranged weapon
    //  • requires advantage on the attack OR an ally adjacent to the target (modifiers.ally_adjacent)
    //    (advantage is negated if the attacker has disadvantage — handled by the cancel rule)
    if (modifiers.sneak_attack_ready && character.class === 'Rogue') {
      const alreadyUsed = combatLog.world_state?.sneak_attack_used;
      const weaponProps = (weapon?.properties || []).map(p => p.toLowerCase());
      const isFinesseOrRanged = weaponProps.includes('finesse') || weapon?.type === 'ranged';
      // Rakish Audacity (Swashbuckler, XGtE p.47): Sneak Attack in a 1-on-1 duel
      // without needing advantage or an adjacent ally (M-S fix)
      const isSwashbuckler = (character.subclass || '').toLowerCase().includes('swashbuckler');
      const hasSneakCondition = (modifiers.advantage && !modifiers.disadvantage) || modifiers.ally_adjacent || isSwashbuckler;
      if (!alreadyUsed && isFinesseOrRanged && hasSneakCondition) {
        const sneakDice = Math.ceil((character.level || 1) / 2);
        extraDamageDice.push({ dice: `${sneakDice}d6`, type: 'sneak', label: 'Sneak Attack' });
        sneakAttackApplied = true;
      }
    }

    // Lucky feat (PHB p.167): spend a luck point to reroll one attack d20 and take
    // either result. Flag it here; applied AFTER the centralized roll resolves below.
    if (modifiers.use_lucky_point && hasFeat('Lucky') && (character.luck_points_remaining || 0) > 0) {
      useLuckyPoint = true;
    }

    // Fighter Action Surge — handled by action tracking in world_state; no extra variable needed here
  }

  // Apply active modifiers
  const activeMods = character.active_modifiers || [];
  for (const mod of activeMods) {
    if (mod.applies_to === 'attack' || mod.applies_to === 'all') {
      attackMod += mod.value;
    }
    if (mod.applies_to === 'damage') {
      damageBonus += mod.value;
    }
  }

  // ── RUNE KNIGHT: invoked rune effects (Tasha's p.44-45) ─────────────────
  // Runes are written into active_modifiers by the Rune Knight panel with an
  // `effect` flag. Rune save DC = 8 + proficiency bonus + CON modifier.
  const runeEffects = new Set(activeMods.map(m => m.effect).filter(Boolean));
  const runeDC = 8 + (character.proficiency_bonus || 2) + statMod(character.constitution || 10);
  let stormRuneBonus = 0;
  let fireRuneText = '';
  if (runeEffects.has('storm_prophecy')) {
    // Storm Rune: +1d6 guidance on the attack roll while invoked.
    stormRuneBonus = rollDice(6);
    attackMod += stormRuneBonus;
  }

  // Channel Divinity: Guided Strike (Cleric, PHB p.59) — +10 to next attack roll (consumed)
  if (combatLog.world_state?.guided_strike_bonus) {
    attackMod += combatLog.world_state.guided_strike_bonus;
  }
  // Paladin Aura of Hate (Oathbreaker L7, DMG p.97): +1d6 necrotic on melee weapon attacks
  if (!spell && (character.class || '') === 'Paladin' && (character.subclass || '').toLowerCase().includes('oathbreaker') && (character.level || 1) >= 7) {
    extraDamageDice.push({ dice: '1d6', type: 'aura_hate', label: 'Aura of Hate' });
  }

  // Condition checks — apply RAW condition mechanics (PHB p.290-292)
  const conditions = (character.conditions || []).map(c => c.name || c);

  // INVISIBLE attacker (Firbolg Hidden Step, spells): advantage on the attack;
  // invisibility ends the moment you attack (PHB p.291).
  let attackerWasInvisible = false;
  if (conditions.includes('invisible')) {
    advSources.push(true);
    attackerWasInvisible = true;
  }
  // Kobold Draconic Cry (activated via racialActions): advantage on your attacks this turn
  if (combatLog.world_state?.draconic_cry_active) advSources.push(true);

  // EXHAUSTION level 3+ : disadvantage on attack rolls (PHB p.291)
  if ((character.exhaustion_level || 0) >= 3) applyDisadvantage();

  // POISONED: disadvantage on attack rolls (PHB p.292) — NOT a flat penalty
  if (conditions.includes('poisoned')) applyDisadvantage();

  // BLINDED: disadvantage on attack rolls (PHB p.290)
  if (conditions.includes('blinded')) applyDisadvantage();

  // FRIGHTENED: disadvantage on attack rolls while source visible (PHB p.290)
  if (conditions.includes('frightened')) applyDisadvantage();

  // Target modifiers (cover, etc)
  let targetACBonus = 0;
  if (modifiers.half_cover) targetACBonus += 2;
  if (modifiers.three_quarters_cover) targetACBonus += 5;

  // === TARGET CONDITION MODIFIERS (PHB p.290-292) ===
  // Each condition registers an advantage/disadvantage SOURCE (and forceCrit where
  // applicable). The cancellation rule is applied once by resolveAttackRoll below —
  // no mid-flight re-rolling.
  const targetConditions = (target.conditions || []).map(c => c.name || c);

  // PARALYZED: attacks have advantage; melee hits within 5ft are auto-crits (PHB p.291)
  if (targetConditions.includes('paralyzed')) {
    advSources.push(true);
    if (attackType === 'melee') forceCrit = true;
  }
  // STUNNED: attacks have advantage (PHB p.292)
  if (targetConditions.includes('stunned')) advSources.push(true);
  // UNCONSCIOUS: attacks have advantage; melee hits within 5ft are auto-crits (PHB p.292)
  if (targetConditions.includes('unconscious')) {
    advSources.push(true);
    if (attackType === 'melee') forceCrit = true;
  }
  // PRONE: melee = advantage, ranged = disadvantage (PHB p.292)
  if (targetConditions.includes('prone')) {
    if (attackType === 'melee') advSources.push(true);
    else disSources.push(true);
  }
  // RESTRAINED: attacks against have advantage (PHB p.292)
  if (targetConditions.includes('restrained')) advSources.push(true);
  // INVISIBLE (target): attacks against have disadvantage (PHB p.291)
  if (targetConditions.includes('invisible')) disSources.push(true);
  // BLINDED (target): attacks against have advantage (PHB p.290)
  if (targetConditions.includes('blinded')) advSources.push(true);
  // Assassin Rogue — Assassinate (PHB p.97): advantage vs creatures that haven't
  // acted yet (round 1); hits against SURPRISED creatures are auto-crits (M-S fix)
  if (!spell && (character.class || '') === 'Rogue' && (character.subclass || '').toLowerCase().includes('assassin')) {
    if (combatLog.round === 1) advSources.push(true);
    if (targetConditions.includes('surprised')) forceCrit = true;
  }

  // ── SINGLE CENTRALIZED ROLL: all sources gathered, cancel rule applied once ──
  const isHalfling = (character.race || '') === 'Halfling';
  let attackResult = resolveAttackRoll({ advSources, disSources, forceCrit, rerollOnes: isHalfling });
  // Lucky feat (PHB p.167): reroll the d20 once and keep the better result.
  if (useLuckyPoint) {
    const luckyRoll = rollD20();
    if (luckyRoll > attackResult.roll) {
      attackResult = { ...attackResult, roll: luckyRoll, isCritical: forceCrit || luckyRoll === 20, isMiss: luckyRoll === 1 };
    }
    await base44.entities.Character.update(character_id, {
      luck_points_remaining: Math.max(0, (character.luck_points_remaining || 0) - 1),
    });
  }
  // Portent (Divination Wizard 2+, PHB p.116): an armed portent die replaces the d20 (M-S fix)
  const portentValue = combatLog.world_state?.portent_value;
  if (portentValue != null) {
    attackResult = { ...attackResult, roll: portentValue, isCritical: forceCrit || portentValue === 20, isMiss: portentValue === 1 };
  }
  let attackRoll = attackResult.roll;
  let isCritical = attackResult.isCritical;
  let isMiss = attackResult.isMiss;

  // Champion Fighter — Improved Critical (PHB p.72): weapon attacks crit on
  // 19-20 (Superior Critical: 18-20 at level 15). Applied automatically.
  if (!spell && (character.class || '') === 'Fighter' && (character.subclass || '').toLowerCase().includes('champion')) {
    const critFloor = (character.level || 1) >= 15 ? 18 : 19;
    if (!isMiss && attackRoll >= critFloor) isCritical = true;
  }
  // Hexblade's Curse (XGtE p.55): attacks against the cursed target crit on 19-20 (H-S3 fix)
  if (target.hexblade_cursed_by === character_id && !isMiss && attackRoll >= 19) isCritical = true;

  const totalAttack = attackRoll + attackMod;
  let hit = !isMiss && (isCritical || totalAttack >= (target.ac + targetACBonus));

  let damage = 0;
  let damageRolls = [];
  let concentrationBrokenSelf = null; // set if this attack broke the player's own concentration
  const isSpellAttack = !!spell;
  const logEntry = { round: combatLog.round, actor: character.name, action: isSpellAttack ? 'spell' : 'attack', target: target.name, spell_name: spell?.name || null };

  if (hit) {
    // H5 fix: guard non-NdM dice strings (e.g. "1d8+1", "2d6 fire") — extract the
    // NdM core, else fall back to 1d6 (matches the offhand handler's guard). Never throw.
    let dMatch = damageDice.match(/(\d+)d(\d+)/);
    if (!dMatch) {
      console.warn(`player_attack: unparseable damage dice "${damageDice}" — falling back to 1d6`);
      dMatch = [null, '1', '6'];
    }
    let numDice = isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
    const sides = parseInt(dMatch[2]);

    // Brutal Critical (Barbarian 9+) - add extra crit dice
    if (isCritical && character.class === 'Barbarian') {
      const level = character.level || 1;
      if (level >= 9) numDice += 1;
      if (level >= 13) numDice += 1;
      if (level >= 17) numDice += 1;
    }
    // Half-Orc Savage Attacks (PHB p.41): roll one additional weapon damage die on crits
    if (isCritical && (character.race || '') === 'Half-Orc' && !spell) {
      numDice += 1;
    }

    for (let i = 0; i < numDice; i++) {
      const r = rollDice(sides);
      damageRolls.push(r);
      damage += r;
    }
    damage += damageBonus;

    // Extra damage dice (Sneak Attack, Divine Smite, etc)
    for (const extra of extraDamageDice) {
      const eMatch = extra.dice.match(/^(\d+)d(\d+)$/);
      if (eMatch) {
        const eNum = isCritical ? parseInt(eMatch[1]) * 2 : parseInt(eMatch[1]);
        const eSides = parseInt(eMatch[2]);
        let eDmg = 0;
        for (let i = 0; i < eNum; i++) eDmg += rollDice(eSides);
        damage += eDmg;
      }
    }

    // Paladin Divine Smite (if toggled and spell slots available)
    if (modifiers.divine_smite_ready && character.class === 'Paladin' && attackType === 'melee') {
      // Find LOWEST available spell slot (Paladin should choose lowest to conserve resources)
      // spell_slots tracks USED counts. A slot at level i is available if used < max_slots[i].
      // Paladin half-caster table: level 1-2=0, level 3-4=2/3 slots per level, etc.
      // We compare used vs a safe max of 4 (which covers all Paladin slot maxes at any level).
      // Paladin half-caster max slots per level by character level
      const PALADIN_MAX_SLOTS = {
        2:[2,0,0,0,0], 3:[3,0,0,0,0], 4:[3,0,0,0,0],
        5:[4,2,0,0,0], 6:[4,2,0,0,0], 7:[4,3,0,0,0], 8:[4,3,0,0,0],
        9:[4,3,2,0,0], 10:[4,3,2,0,0], 11:[4,3,3,0,0], 12:[4,3,3,0,0],
        13:[4,3,3,1,0], 14:[4,3,3,1,0], 15:[4,3,3,2,0], 16:[4,3,3,2,0],
        17:[4,3,3,3,1], 18:[4,3,3,3,1], 19:[4,3,3,3,2], 20:[4,3,3,3,2],
      };
      const paladinMaxSlots = PALADIN_MAX_SLOTS[Math.min(20, character.level || 1)] || [0,0,0,0,0];
      const slots = character.spell_slots || {};
      const slotAvailable = (lvl) => {
        const maxAtLevel = paladinMaxSlots[lvl - 1] || 0;
        return maxAtLevel > 0 && (slots[`level_${lvl}`] || 0) < maxAtLevel;
      };
      let smiteLevel = 0;
      // Player (or AI narrator) may request a specific slot via modifiers.smite_slot_level.
      // Honor it only when that slot is actually available; otherwise fall back to lowest.
      const requested = parseInt(modifiers.smite_slot_level);
      if (requested >= 1 && requested <= 5 && slotAvailable(requested)) {
        smiteLevel = requested;
      } else {
        for (let i = 1; i <= 5; i++) {
          if (slotAvailable(i)) { smiteLevel = i; break; }
        }
      }
      if (smiteLevel > 0) {
        // Divine Smite: 2d8 + 1d8 per slot level above 1st, max 5d8 total (cap at slot level 4)
        // +1d8 bonus vs undead or fiends (PHB p.85)
        const effectiveLevel = Math.min(smiteLevel, 4);
        let smiteDice = 1 + effectiveLevel; // 2d8 at level 1, up to 5d8 at level 4+
        const targetType = (target.type_tag || target.meta || target.creature_type || '').toLowerCase();
        const isUndeadOrFiend = /undead|fiend|devil|demon|yugoloth/.test(targetType);
        if (isUndeadOrFiend) smiteDice += 1; // +1d8 vs undead/fiends (PHB p.85)
        smiteDice = Math.min(smiteDice, 6); // hard cap: absolute max is 6d8 (5d8 normal + 1d8 bonus)
        let smiteDmg = 0;
        for (let i = 0; i < smiteDice; i++) smiteDmg += rollDice(8);
        damage += smiteDmg;
        // Consume spell slot (increment used count)
        const slotKey = `level_${smiteLevel}`;
        await base44.entities.Character.update(character_id, {
          spell_slots: { ...slots, [slotKey]: (slots[slotKey] || 0) + 1 }
        });
      }
    }

    // Improved Divine Smite (Paladin 11+) - automatic +1d8 radiant on all melee
    if (character.class === 'Paladin' && (character.level || 1) >= 11 && attackType === 'melee') {
      damage += rollDice(8);
    }

    // Zealot Barbarian — Divine Fury (XGtE p.11): first hit each turn while
    // raging deals +1d6 + half barbarian level radiant/necrotic (H-S2 fix)
    if (modifiers.rage && (character.class || '') === 'Barbarian' && (character.level || 1) >= 3
        && (character.subclass || '').toLowerCase().includes('zealot') && !combatLog.world_state?.divine_fury_used) {
      const fury = rollDice(6) + Math.floor((character.level || 1) / 2);
      damage += fury;
      logEntry.divine_fury = fury;
    }
    // Hexblade's Curse (XGtE p.55): +proficiency bonus damage vs the cursed target (H-S3 fix)
    if (target.hexblade_cursed_by === character_id) {
      damage += (character.proficiency_bonus || 2);
    }

    // Aasimar transformation rider (Volo's p.105): while transformed, once per
    // turn one attack deals +level radiant/necrotic damage.
    const aasimarForm = ['radiant_soul', 'radiant_consumption', 'necrotic_shroud'].find(f => conditions.includes(f));
    if (aasimarForm && !combatLog.world_state?.aasimar_rider_used) {
      damage += (character.level || 1);
      logEntry.aasimar_rider = aasimarForm;
    }
    // Goblin Fury of the Small (primed via racialActions, 1/short rest): +level damage
    if (combatLog.world_state?.fury_primed && (character.race || '') === 'Goblin') {
      damage += (character.level || 1);
      logEntry.fury_of_the_small = true;
    }

    // PHB rule: a hit always deals at least 1 damage
    damage = Math.max(1, damage);

    // Apply target's Resistance/Vulnerability/Immunity (PHB p.197).
    // Damage type: spell uses spell.damage_type; weapon uses its damage_type (default slashing).
    const dmgType = (spell?.damage_type || weapon?.damage_type || 'slashing').toLowerCase();
    const tgtMod = applyDamageModifiers(damage, dmgType, {
      resistances: target.resistances,
      vulnerabilities: target.vulnerabilities,
      immunities: target.immunities,
    });
    if (tgtMod.applied) {
      logEntry.damage_modifier = tgtMod.applied;
      damage = tgtMod.applied === 'immunity' ? 0 : tgtMod.amount;
    }
    // Path to the Grave (Grave Cleric, XGtE p.20): marked target is vulnerable to the next hit (M-S fix)
    if (targetConditions.includes('path_to_grave')) {
      damage *= 2;
      target.conditions = (target.conditions || []).filter(c => (typeof c === 'string' ? c : c?.name) !== 'path_to_grave');
      logEntry.path_to_grave = true;
    }

    // Fire Rune (invoked): on a weapon hit, +2d6 fire damage and the target
    // must make a STR save vs the rune DC or be SHACKLED (restrained). The
    // invocation is consumed by this trigger.
    if (runeEffects.has('fire_shackle') && weapon) {
      const fireRaw = rollDice(6) + rollDice(6);
      const fireMod = applyDamageModifiers(fireRaw, 'fire', target);
      damage += fireMod.amount;
      const fSave = rollD20() + statMod(target.strength || 10);
      let shackleNote;
      if (fSave < runeDC) {
        const existingConds = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
        if (!existingConds.includes('restrained')) {
          target.conditions = [...(target.conditions || []), { name: 'restrained', source: 'Fire Rune', save_dc: runeDC, save_ability: 'strength', caster: character.name }];
        }
        shackleNote = ` and is SHACKLED — restrained! (STR save ${fSave} vs DC ${runeDC})`;
      } else {
        shackleNote = ` but resists the fiery shackles. (STR save ${fSave} vs DC ${runeDC})`;
      }
      fireRuneText = ` 🔥 FIRE RUNE: ${target.name} takes +${fireMod.amount} fire damage${shackleNote}`;
      await base44.entities.Character.update(character_id, {
        active_modifiers: activeMods.filter(m => m.effect !== 'fire_shackle'),
      });
    }

    // Concentration check: if caster is concentrating and takes damage, DC = max(10, half damage) CON save
    // (Enemy triggering concentration check is handled in enemy_turn)

    target.hp_current = Math.max(0, target.hp_current - damage);
    if (target.hp_current === 0) target.is_conscious = false;

    // Hexblade's Curse: when the cursed target dies, the warlock regains
    // HP = warlock level + CHA modifier (XGtE p.55) (H-S3 fix)
    if (target.hp_current === 0 && target.hexblade_cursed_by === character_id) {
      const curseHeal = (character.level || 1) + Math.max(0, statMod(character.charisma || 10));
      const healedTo = Math.min(character.hp_max, (character.hp_current || 0) + curseHeal);
      await base44.entities.Character.update(character_id, { hp_current: healedTo });
      const pcHx = combatants.find(c => c.type === 'player');
      if (pcHx) pcHx.hp_current = healedTo;
      logEntry.curse_heal = curseHeal;
    }

    // === SELF/ALLY CONCENTRATION (PHB p.203) ===
    // If this attack damaged the creature currently concentrating on a spell
    // (e.g. the caster catching themselves or a concentrating ally in an AoE),
    // that creature must make a CON save or lose concentration. We can only roll
    // it for a PLAYER combatant (we have their full sheet); the active caster is
    // tracked by name in world_state.concentration_caster.
    const concSpell = combatLog.world_state?.concentration_spell;
    const concCaster = combatLog.world_state?.concentration_caster;
    if (concSpell && damage > 0 && target.type === 'player' && target.name === concCaster) {
      const concChar = target.id === character_id ? character : await base44.entities.Character.get(target.id);
      const conc = rollConcentrationSave(concChar, damage);
      if (conc.broken) {
        concentrationBrokenSelf = `${concCaster}'s concentration on ${concSpell} is broken! (CON save: ${conc.save} vs DC ${conc.dc})`;
      }
    }

    logEntry.hit = true;
    logEntry.critical = isCritical;
    logEntry.attack_roll = totalAttack;
    logEntry.damage = damage;
    logEntry.damage_rolls = damageRolls;
    const actionLabel = spell ? `casts ${spell.name} at` : (isCritical ? 'CRITICALLY strikes' : 'hits');
    logEntry.text = `${character.name} ${actionLabel} ${target.name} for ${damage} ${spell?.damage_type || ''} damage! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${stormRuneBonus ? ` ⛈️ Storm Rune guided the strike (+${stormRuneBonus} to hit).` : ''}${fireRuneText}${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`;
  } else {
    logEntry.hit = false;
    logEntry.attack_roll = totalAttack;
    const missLabel = spell ? `${spell.name} misses` : 'misses';
    logEntry.text = `${character.name} ${missLabel} ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`;
  }

  // Invisibility ends when you attack — strip it from the character + combatant.
  if (attackerWasInvisible) {
    const stripInvis = (arr) => (arr || []).filter(c => (typeof c === 'string' ? c : c?.name) !== 'invisible');
    await base44.entities.Character.update(character_id, { conditions: stripInvis(character.conditions) });
    const pcInv = combatants.find(c => c.type === 'player');
    if (pcInv) pcInv.conditions = stripInvis(pcInv.conditions);
  }

  const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
  const updatedLog = [...(combatLog.log_entries || []), logEntry];

  // Track actions used this turn in the combat log's world_state.
  // Quickened Spell (Sorcerer): spell costs a bonus action, not an action.
  const isQuickenedMain = !!modifiers.metamagic?.quickened && !!spell;
  const actionsPerTurn = getActionsPerTurn(character);
  const { nextIndex, nextRound, actionsRemaining, worldState: newWorldState } =
    resolveActionAndAdvance(combatLog, updatedCombatants, character, { isQuickened: isQuickenedMain });
  // Mark Sneak Attack consumed for this turn so it can't trigger again until next turn
  if (sneakAttackApplied && newWorldState.actions_used_this_turn !== 0) newWorldState.sneak_attack_used = true;
  // Clear Channel Divinity: Guided Strike bonus (consumed by this attack)
  if (combatLog.world_state?.guided_strike_bonus) newWorldState.guided_strike_bonus = 0;
  // Mark Colossus Slayer consumed for this turn (once-per-turn, PHB p.93)
  if (colossusApplied && newWorldState.actions_used_this_turn !== 0) newWorldState.colossus_slayer_used = true;
  // Bugbear Surprise Attack consumed (once per combat) when its bonus damage lands
  if (hit && extraDamageDice.some(e => e.type === 'surprise')) newWorldState.bugbear_surprise_used = true;
  // Divine Strike is once per turn (PHB p.59) — consumed when its bonus lands
  if (hit && extraDamageDice.some(e => e.type === 'divine_strike')) newWorldState.divine_strike_used = true;
  // Divine Fury is once per turn; Dread Ambusher is once per combat (not reset per turn)
  if (logEntry.divine_fury) newWorldState.divine_fury_used = true;
  if (extraDamageDice.some(e => e.type === 'dread_ambusher')) newWorldState.dread_ambusher_used = true;
  if (logEntry.curse_heal) logEntry.text += ` 🩸 Hexblade's Curse: ${character.name} drains ${logEntry.curse_heal} HP as the cursed foe falls!`;
  if (portentValue != null) { newWorldState.portent_value = null; logEntry.text += ' 🔮 (Portent die used)'; }
  if (hit && extraDamageDice.some(e => e.type === 'planar_warrior')) newWorldState.planar_warrior_target = null;
  if (logEntry.path_to_grave) logEntry.text += ' ⚰️ Path to the Grave: damage DOUBLED!';
  // Aasimar rider is once per turn; Fury of the Small is spent when it lands
  if (logEntry.aasimar_rider) newWorldState.aasimar_rider_used = true;
  if (logEntry.fury_of_the_small) newWorldState.fury_primed = false;
  // Mark a Loading weapon as fired so it can't fire again this turn (PHB p.147)
  if (weapon && (weapon.properties || []).map(p => p.toLowerCase()).includes('loading') && weapon.type === 'ranged' && newWorldState.actions_used_this_turn !== 0) {
    newWorldState.loading_weapon_fired = true;
  }
  // Reckless Attack drawback (PHB p.48): barbarian gains advantage on STR attacks,
  // but enemies have advantage against them until the barbarian's next turn.
  if (modifiers.reckless_attack && !spell && (character.class || '') === 'Barbarian') {
    newWorldState.player_reckless = true;
  }
  // Wolf Totem support: surface rage state so companion attacks can gain advantage (M-S fix)
  if (!spell) newWorldState.player_rage_active = !!modifiers.rage;

  // Track concentration spells
  if (spell?.requires_concentration) {
    newWorldState.concentration_spell = spell.name;
    newWorldState.concentration_caster = character.name;
  }

  // Self/ally concentration break (computed during damage application above).
  // Clears the tracked concentration and annotates the log entry.
  if (concentrationBrokenSelf) {
    newWorldState.concentration_spell = null;
    newWorldState.concentration_caster = null;
    logEntry.text += ` ⚠️ ${concentrationBrokenSelf}`;
    logEntry.concentration_broken = true;
  }

  const result = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedCombatants,
    updatedLog, nextIndex, nextRound, newWorldState);

  return Response.json({
    hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
    target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
    next_turn_index: nextIndex,
    actions_remaining: actionsRemaining > 0 ? actionsRemaining : 0,
    actions_per_turn: actionsPerTurn
  });
}

// ─── OFF-HAND ATTACK (Two-Weapon Fighting, PHB p.195) ───────────────────────
// Bonus action attack with a light weapon in the off-hand. No ability modifier
// added to damage unless the character has the Two-Weapon Fighting fighting style.
export async function handleOffhandAttack(ctx) {
  const { base44, session_id, combat_id, character_id, payload } = ctx;
  const { target_id, modifiers = {} } = payload;
  const combatLog = await base44.entities.CombatLog.get(combat_id);
  const character = await base44.entities.Character.get(character_id);
  const combatants = [...combatLog.combatants];
  const target = combatants.find(c => c.id === target_id);
  if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

  // Off-hand weapon comes from the offhand slot; must be a light melee weapon
  const offhand = character.equipped?.offhand;
  const mainhand = character.equipped?.weapon || character.equipped?.mainhand;
  const isLight = (w) => (w?.properties || []).map(p => p.toLowerCase()).includes('light')
    || ['dagger','shortsword','scimitar','handaxe','light hammer','club','sickle'].includes((w?.name || '').toLowerCase());

  if (!offhand || !isLight(offhand) || !isLight(mainhand)) {
    return Response.json({ error: 'Two-weapon fighting requires a light melee weapon in each hand.', invalid: true }, { status: 400 });
  }

  // Bonus action gating
  if (combatLog.world_state?.bonus_action_used) {
    return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
  }

  const strMod = statMod(character.strength);
  const dexMod = statMod(character.dexterity);
  const isFinesse = (offhand.properties || []).map(p => p.toLowerCase()).includes('finesse');
  const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
  const profBonus = character.proficiency_bonus || 2;

  // H-X1 fix: off-hand swings go through the SAME centralized resolver as
  // main-hand attacks — advantage/disadvantage cancellation, exhaustion,
  // target-condition advantage, auto-crits, and Halfling Lucky all apply.
  const offAdvSources = [!!modifiers.advantage];
  const offDisSources = [!!modifiers.disadvantage, (character.exhaustion_level || 0) >= 3];
  const offTargetConds = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
  if (['paralyzed', 'stunned', 'unconscious', 'restrained', 'prone', 'blinded'].some(cn => offTargetConds.includes(cn))) {
    offAdvSources.push(true); // off-hand is always a melee attack (prone = advantage)
  }
  const offRollResult = resolveAttackRoll({
    advSources: offAdvSources,
    disSources: offDisSources,
    forceCrit: offTargetConds.includes('paralyzed') || offTargetConds.includes('unconscious'),
    rerollOnes: (character.race || '') === 'Halfling',
  });
  const attackRoll = offRollResult.roll;
  const isCritical = offRollResult.isCritical;
  const isMiss = offRollResult.isMiss;
  const attackMod = abilityMod + profBonus + (offhand.attack_bonus || 0);
  const totalAttack = attackRoll + attackMod;
  const hit = !isMiss && (isCritical || totalAttack >= target.ac);

  // Two-Weapon Fighting style: add ability modifier to off-hand damage
  const hasTWFStyle = (character.fighting_style || '').toLowerCase().includes('two-weapon');
  let damage = 0;
  const damageRolls = [];
  if (hit) {
    const dMatch = (offhand.damage_dice || offhand.damage || '1d4').match(/^(\d+)d(\d+)$/);
    const numDice = dMatch ? (isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1])) : (isCritical ? 2 : 1);
    const sides = dMatch ? parseInt(dMatch[2]) : 4;
    for (let i = 0; i < numDice; i++) { const r = rollDice(sides); damageRolls.push(r); damage += r; }
    // Off-hand: NO ability mod to damage unless TWF style (PHB p.195). Negative mod always applies.
    if (hasTWFStyle) damage += abilityMod;
    else if (abilityMod < 0) damage += abilityMod;
    damage += (offhand.damage_bonus || 0);
    damage = Math.max(1, damage);
    target.hp_current = Math.max(0, target.hp_current - damage);
    if (target.hp_current === 0) target.is_conscious = false;
  }

  const logEntry = {
    round: combatLog.round, actor: character.name, action: 'offhand_attack', target: target.name,
    hit, critical: isCritical, attack_roll: totalAttack, damage,
    text: hit
      ? `${character.name} strikes with their off-hand ${offhand.name}${isCritical ? ' (CRIT!)' : ''} for ${damage} damage!${hasTWFStyle ? '' : ' (no ability mod — off-hand)'} (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
      : `${character.name}'s off-hand ${offhand.name} misses ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`
  };

  const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);

  // Off-hand uses the BONUS ACTION, not an action — do not consume an action or advance the turn
  const { worldState: newWorldState } = resolveActionAndAdvance(combatLog, updatedCombatants, character, { isBonusAction: true });

  const result = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedCombatants,
    [...(combatLog.log_entries || []), logEntry],
    combatLog.current_turn_index, combatLog.round, newWorldState);

  return Response.json({
    hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
    target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
    bonus_action_used: true, two_weapon_style: hasTWFStyle
  });
}