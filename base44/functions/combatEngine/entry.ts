import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { inferArchetype, chooseTactic } from '../../shared/monsterAI.ts';

/**
 * Combat Engine — initiative, turns, damage, conditions. Server-side math.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, session_id, combat_id, character_id, payload } = await req.json();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: SHARED HELPERS — dice rolling, damage modifiers, condition logic,
  // and turn advancement. Used by every action handler below.
  // ═══════════════════════════════════════════════════════════════════════════
  const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
  const rollD20 = () => Math.floor(Math.random() * 20) + 1;
  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  // Cantrip damage scaling: doubles at char levels 5, 11, 17 (PHB p.205)
  const scaleCantripDice = (damageDice, characterLevel) => {
    if (!damageDice || damageDice === '0') return damageDice;
    const m = damageDice.match(/^(\d+)d(\d+)$/);
    if (!m) return damageDice;
    const baseDice = parseInt(m[1]);
    const sides = parseInt(m[2]);
    const mult = characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
    return `${baseDice * mult}d${sides}`;
  };

  // Spellcasting ability by class (server-side authoritative copy)
  const SPELL_ABILITY_MAP = {
    wizard: 'intelligence', artificer: 'intelligence',
    eldritch_knight: 'intelligence', arcane_trickster: 'intelligence',
    cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
    bard: 'charisma', paladin: 'charisma', sorcerer: 'charisma', warlock: 'charisma'
  };

  // Roll dice string (e.g. "3d6") and return total
  const rollDiceStr = (diceStr) => {
    const m = (diceStr || '').match(/^(\d+)d(\d+)$/);
    if (!m) return 0;
    let total = 0;
    for (let i = 0; i < parseInt(m[1]); i++) total += rollDice(parseInt(m[2]));
    return total;
  };

  // Damage Resistance/Vulnerability/Immunity (PHB p.197): immunity → 0,
  // resistance → halved (rounded down), vulnerability → doubled.
  const normList = (l) => Array.isArray(l) ? l.map(d => String(d || '').toLowerCase().trim()).filter(Boolean) : [];
  const applyDamageModifiers = (damage, damageType, target = {}) => {
    const type = String(damageType || '').toLowerCase().trim();
    if (!type || damage <= 0) return { amount: Math.max(0, damage), applied: null };
    const immunities = normList(target.immunities);
    const resistances = normList(target.resistances);
    const vulnerabilities = normList(target.vulnerabilities);
    if (immunities.includes(type)) return { amount: 0, applied: 'immunity' };
    if (resistances.includes(type)) return { amount: Math.floor(damage / 2), applied: 'resistance' };
    if (vulnerabilities.includes(type)) return { amount: damage * 2, applied: 'vulnerability' };
    return { amount: Math.max(0, damage), applied: null };
  };

  // Centralized condition mechanics (PHB p.290-292). Mirrors components/game/conditionEffects.js.
  const CONDITION_FLAGS = {
    blinded:     { no_actions: false, incoming_attack_advantage: true },
    paralyzed:   { no_actions: true, incoming_attack_advantage: true, melee_auto_crit: true },
    stunned:     { no_actions: true, incoming_attack_advantage: true },
    unconscious: { no_actions: true, incoming_attack_advantage: true, melee_auto_crit: true },
    petrified:   { no_actions: true, incoming_attack_advantage: true, resist_all: true },
    incapacitated:{ no_actions: true },
    grappled:    { speed_zero: true },
    restrained:  { speed_zero: true, incoming_attack_advantage: true },
    banished:    { no_actions: true, removed_from_combat: true },
    polymorphed: { no_actions: false },
    turned:      { no_actions: true, removed_from_combat: true },
    prone:       {},
    invisible:   { incoming_attack_disadvantage: true },
  };
  const condNames = (arr) => (arr || []).map(c => String(typeof c === 'string' ? c : c?.name || '').toLowerCase().trim());
  const hasNoActions = (arr) => condNames(arr).some(n => CONDITION_FLAGS[n]?.no_actions);
  // Conditions that get a save at the end of each turn to shake off (engine handles at turn start).
  const SAVEABLE_CONDITIONS = {
    paralyzed: 'wisdom', // Hold Person / Hold Monster — WIS save
    banished: 'charisma',
    charmed: 'wisdom',
    frightened: 'wisdom',
    polymorphed: 'wisdom',
    stunned: 'constitution',
    turned: 'wisdom',
  };

  // Data-driven monster AI (AI_ARCHETYPES / inferArchetype / chooseTactic) lives in
  // base44/shared/monsterAI.ts — extracted to keep this file within size limits.

  // Advance initiative tracker past current combatant, skipping unconscious
  const advanceTurn = (currentIndex, currentRound, combatantsArr) => {
    let nextIndex = (currentIndex + 1) % combatantsArr.length;
    let nextRound = currentRound;
    if (nextIndex === 0) nextRound++;
    let safety = 0;
    while (!combatantsArr[nextIndex]?.is_conscious && safety < combatantsArr.length) {
      nextIndex = (nextIndex + 1) % combatantsArr.length;
      if (nextIndex === 0) nextRound++;
      safety++;
    }
    return { nextIndex, nextRound };
  };

  // ─── CENTRALIZED ATTACK ROLL (PHB p.173) ────────────────────────────────────
  const resolveAttackRoll = ({ advSources = [], disSources = [], forceCrit = false, rerollOnes = false } = {}) => {
    const hasAdv = advSources.some(Boolean);
    const hasDis = disSources.some(Boolean);
    // PHB p.173: if both advantage and disadvantage are present, they cancel —
    // regardless of how many of each — and you roll a single straight d20.
    const netAdvantage = hasAdv && !hasDis;
    const netDisadvantage = hasDis && !hasAdv;
    const r1 = rollD20();
    const r2 = (netAdvantage || netDisadvantage) ? rollD20() : r1;
    let roll = netAdvantage ? Math.max(r1, r2) : netDisadvantage ? Math.min(r1, r2) : r1;
    // Halfling Lucky (PHB p.28): reroll natural 1s
    if (rerollOnes && roll === 1) roll = rollD20();
    return {
      roll,
      rolls: [r1, r2],
      advantage: netAdvantage,
      disadvantage: netDisadvantage,
      isCritical: forceCrit || roll === 20,
      isMiss: roll === 1,
    };
  };

  // ─── CONCENTRATION SAVE (PHB p.203) ──────────────────────────────────────────
  const rollConcentrationSave = (charFull, damage) => {
    const dc = Math.max(10, Math.floor(damage / 2));
    const hasWarCaster = (charFull?.feats || []).includes('War Caster') ||
      (charFull?._feat_flags || []).includes('war_caster');
    const conProf = charFull?.saving_throws?.constitution ? (charFull?.proficiency_bonus || 2) : 0;
    const auraBonus = (charFull?.class === 'Paladin' && (charFull?.level || 1) >= 6)
      ? Math.max(1, statMod(charFull?.charisma || 10)) : 0;
    const cr1 = rollD20();
    const cr2 = hasWarCaster ? rollD20() : cr1;
    const save = Math.max(cr1, cr2) + statMod(charFull?.constitution || 10) + conProf + auraBonus;
    return { broken: save < dc, save, dc };
  };

  const awardVictoryXP = async (cid, combatantsArr, cid_char) => {
    const freshLog = await base44.entities.CombatLog.get(cid);
    if (freshLog.xp_awarded) return;
    const totalXP = combatantsArr.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
    const ch = await base44.entities.Character.get(cid_char);
    await base44.entities.Character.update(cid_char, { xp: (ch.xp || 0) + totalXP });
    await base44.entities.CombatLog.update(cid, { xp_awarded: true });
  };

  const resolveActionAndAdvance = (combatLog, combatants, character, opts = {}) => {
    const { isQuickened = false, isBonusAction = false } = opts;
    const apt = getActionsPerTurn(character);
    const acu = (isQuickened || isBonusAction)
      ? (combatLog.world_state?.actions_used_this_turn || 0)
      : (combatLog.world_state?.actions_used_this_turn || 0) + 1;
    const ar = apt - acu;
    let ni = combatLog.current_turn_index;
    let nr = combatLog.round;
    let ws = { ...(combatLog.world_state || {}), actions_used_this_turn: acu };
    if (isBonusAction) ws.bonus_action_used = true;
    if (ar <= 0) {
      const adv = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
      ni = adv.nextIndex; nr = adv.nextRound;
      ws = { ...ws, actions_used_this_turn: 0, bonus_action_used: false,
             sneak_attack_used: false, loading_weapon_fired: false, colossus_slayer_used: false,
             aasimar_rider_used: false, draconic_cry_active: false, divine_strike_used: false,
             divine_fury_used: false };
    }
    return { nextIndex: ni, nextRound: nr, actionsRemaining: Math.max(0, ar), worldState: ws };
  };

  const resetTurnWorldState = (combatLog, extra = {}) => ({
    ...(combatLog.world_state || {}),
    actions_used_this_turn: 0,
    bonus_action_used: false,
    reaction_used: false,
    sneak_attack_used: false,
    loading_weapon_fired: false,
    colossus_slayer_used: false,
    aasimar_rider_used: false,
    draconic_cry_active: false,
    divine_strike_used: false,
    divine_fury_used: false,
    ...extra,
  });

  const finalizeAndPersistCombat = async (cid, sid, updatedCombatants, updatedLog,
    nextIndex, nextRound, worldState, extraFields = {}) => {
    const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
    const result = allDead ? 'victory' : playerDead ? 'defeat' : 'ongoing';
    await base44.entities.CombatLog.update(cid, {
      combatants: updatedCombatants, log_entries: updatedLog,
      current_turn_index: nextIndex, round: nextRound,
      world_state: worldState, is_active: result === 'ongoing', result, ...extraFields
    });
    if (result !== 'ongoing') {
      await base44.entities.GameSession.update(sid, { in_combat: false });
      if (result === 'victory') await awardVictoryXP(cid, updatedCombatants, character_id);
    }
    return result;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: start_combat — roll initiative for player + enemies, sort the order,
  // and create the CombatLog record that drives the whole encounter.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'start_combat') {
    let { enemies } = payload;
    const session = await base44.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const character = await base44.entities.Character.get(session.character_id);

    // ─── DYNAMIC ENCOUNTER SCALING ──────────────────────────────────────────
    // Keep solo-player encounters balanced and challenging by scaling enemy HP,
    // attack bonus, and participant count to the player's level and current HP.
    //  • Level scaling: enemies grow tougher as the hero levels up.
    //  • HP scaling: if the hero is wounded (< 50% HP), ease off slightly so a
    //    fresh encounter isn't an instant death spiral; if at full HP, push harder.
    //  • Count scaling: higher-level heroes face more foes (more action economy).
    const scaleEnemies = (rawEnemies, char) => {
      const level = char?.level || 1;
      const hpPct = (char?.hp_max ? (char.hp_current || 0) / char.hp_max : 1);
      // Per-enemy stat multipliers driven by level (≈ +6% per level over 1).
      const levelFactor = 1 + Math.max(0, level - 1) * 0.06;
      // Difficulty trim when the hero is hurt, boost when topped off.
      const hpFactor = hpPct < 0.35 ? 0.8 : hpPct < 0.5 ? 0.9 : hpPct >= 0.95 ? 1.1 : 1;
      const statMult = levelFactor * hpFactor;

      const scaled = rawEnemies.map(e => {
        const baseHp = parseInt(e.hp) || e.hp_current || 10;
        const baseAtk = e.attack_bonus ?? 3;
        const baseDmgBonus = e.damage_bonus ?? 2;
        const scaledMaxHp = Math.max(1, Math.round(baseHp * statMult));
        const woundedPct = (e.current_hp != null && Number(e.current_hp) < baseHp) ? Math.max(0, Number(e.current_hp)) / baseHp : 1;
        return {
          ...e,
          hp: scaledMaxHp,
          current_hp: Math.max(1, Math.round(scaledMaxHp * woundedPct)),
          attack_bonus: Math.round(baseAtk + Math.max(0, level - 1) * 0.25),
          damage_bonus: Math.round(baseDmgBonus + Math.max(0, level - 4) * 0.2),
        };
      });

      // Add extra reinforcements for higher-level, healthy heroes (action economy).
      // +1 enemy at L5, +2 at L11 — but never reinforce a wounded hero.
      let reinforcements = 0;
      if (hpPct >= 0.5) {
        if (level >= 11) reinforcements = 2;
        else if (level >= 5) reinforcements = 1;
      }
      if (reinforcements > 0 && scaled.length > 0) {
        // Clone the weakest existing enemy as the reinforcement template.
        const template = [...scaled].sort((a, b) => (parseInt(a.hp) || 0) - (parseInt(b.hp) || 0))[0];
        for (let i = 0; i < reinforcements; i++) {
          scaled.push({ ...template, name: `${template.name} Reinforcement` });
        }
      }
      return scaled;
    };

    enemies = scaleEnemies(enemies, character);

    // Roll initiative for all combatants
    const combatants = [];

    // Check feat flags (Alert: +5 init, cannot be surprised)
    const playerFeatFlags = character._feat_flags || [];
    const hasAlert = (character.feats || []).includes('Alert') || playerFeatFlags.includes('alert');
    // Harengon: Hare-Trigger — add proficiency bonus to Initiative rolls (Wilds Beyond the Witchlight)
    const isHarengon = (character.race || '') === 'Harengon';
    const harengonInitBonus = isHarengon ? (character.proficiency_bonus || 2) : 0;

    // Player initiative
    const playerInitRoll = rollD20();
    const alertBonus = hasAlert ? 5 : 0;
    const playerInitMod = statMod(character.dexterity) + (character.initiative || 0) + alertBonus + harengonInitBonus;
    // Heavy armor STR requirement speed penalty (PHB p.144): -10 ft if STR < armor minimum
    let playerSpeed = character.speed || 30;
    const equippedArmor = character.equipped?.armor;
    // Dwarves ignore the heavy-armor STR speed penalty (PHB p.20)
    if (equippedArmor?.armor_type?.toLowerCase() === 'heavy' && (character.race || '') !== 'Dwarf') {
      const strReq = equippedArmor.str_requirement || 13;
      if ((character.strength || 10) < strReq) playerSpeed = Math.max(0, playerSpeed - 10);
    }
    // Monk Unarmored Movement (PHB p.78): +10/15/20/25/30 at L2/6/10/14/18 (unarmored only)
    if ((character.class || '') === 'Monk' && !equippedArmor) {
      const monkLevel = character.level || 1;
      const umBonus = monkLevel >= 18 ? 30 : monkLevel >= 14 ? 25 : monkLevel >= 10 ? 20 : monkLevel >= 6 ? 15 : monkLevel >= 2 ? 10 : 0;
      playerSpeed += umBonus;
    }
    // Barbarian Fast Movement (PHB p.48): +10 ft at L5 (not wearing heavy armor)
    if ((character.class || '') === 'Barbarian' && (character.level || 1) >= 5) {
      const armorType = (equippedArmor?.armor_type || '').toLowerCase();
      if (armorType !== 'heavy') playerSpeed += 10;
    }

    combatants.push({
      id: character.id,
      name: character.name,
      type: 'player',
      initiative_roll: playerInitRoll,
      initiative_mod: playerInitMod,
      initiative_total: playerInitRoll + playerInitMod,
      hp_current: character.hp_current,
      hp_max: character.hp_max,
      ac: character.armor_class,
      speed: playerSpeed,
      conditions: character.conditions || [],
      // Rogue defensive passives (surfaced for condition/save checks in the engine)
      has_evasion: (character.class === 'Rogue' && (character.level || 1) >= 7),
      has_uncanny_dodge: (character.class === 'Rogue' && (character.level || 1) >= 5),
      is_conscious: true
    });

    // Beast Master Ranger: add summoned companions to initiative (PHB p.93)
    try {
      const companions = await base44.entities.Companion.filter({ character_id: character.id, is_summoned: true });
      for (const comp of (companions || [])) {
        if (!comp.is_active) continue;
        const compInitRoll = rollD20();
        const compDexMod = statMod(comp.dexterity || 10);
        combatants.push({
          id: comp.id,
          name: comp.name,
          type: 'companion',
          initiative_roll: compInitRoll,
          initiative_mod: compDexMod,
          initiative_total: compInitRoll + compDexMod,
          hp_current: comp.hp_current || 1,
          hp_max: comp.hp_max || 1,
          ac: comp.armor_class || 10,
          speed: comp.speed || 30,
          conditions: [],
          is_conscious: true,
          attacks: comp.attacks || [],
          attack_bonus: comp.proficiency_bonus || character.proficiency_bonus || 2,
          owner_id: character.id,
          portrait_emoji: comp.portrait_emoji || '🐾',
        });
      }
    } catch { /* Companion entity may not exist */ }

    // Enemy initiatives
    for (const enemy of enemies) {
      const initRoll = rollD20();
      const initMod = statMod(enemy.dexterity || 10);
      const enemyHP = parseInt(enemy.hp) || enemy.hp_current || 10;
      // Legendary creatures (CR 10+ or explicitly flagged) get Legendary Actions (3/round)
      // and Legendary Resistance (3/day) per the Monster Manual.
      const cr = enemy.cr || 1;
      const isLegendary = enemy.is_legendary || cr >= 10;
      combatants.push({
        id: `enemy_${Math.random().toString(36).substr(2, 9)}`,
        name: enemy.name || enemy.monster_name || `Enemy`,
        type: 'enemy',
        initiative_roll: initRoll,
        initiative_mod: initMod,
        initiative_total: initRoll + initMod,
        hp_current: enemy.current_hp != null ? Math.max(1, Math.min(enemyHP, Number(enemy.current_hp))) : enemyHP,
        hp_max: enemyHP,
        ac: enemy.ac || 12,
        attack_bonus: enemy.attack_bonus || 3,
        damage_dice: enemy.damage_dice || '1d6',
        damage_bonus: enemy.damage_bonus || 2,
        conditions: Array.isArray(enemy.starting_conditions) ? enemy.starting_conditions.map(n => ({ name: String(n).toLowerCase().trim(), source: 'story' })) : [],
        is_conscious: true,
        cr,
        xp: enemy.xp || 100,
        is_legendary: isLegendary,
        legendary_resistance_remaining: isLegendary ? 3 : 0,
        // Data-driven AI: explicit archetype if provided, else inferred from meta/CR.
        archetype: inferArchetype(enemy),
        attack_type: enemy.attack_type || 'melee'
      });
    }

    // Sort by initiative (ties broken by dex mod)
    combatants.sort((a, b) => {
      if (b.initiative_total !== a.initiative_total) return b.initiative_total - a.initiative_total;
      return b.initiative_mod - a.initiative_mod;
    });

    const combatLog = await base44.entities.CombatLog.create({
      session_id,
      round: 1,
      combatants,
      initiative_order: combatants.map(c => ({ id: c.id, name: c.name, initiative_value: c.initiative_total, initiative: c.initiative_total })),
      current_turn_index: 0,
      log_entries: [{ round: 1, text: `⚔️ Combat begins! Initiative: ${combatants.map(c => `${c.name} (${c.initiative_total})`).join(' → ')}` }],
      is_active: true,
      result: 'ongoing',
      world_state: { actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false }
    });

    await base44.entities.GameSession.update(session_id, { in_combat: true, combat_state: { combat_id: combatLog.id } });

    return Response.json({ combat_id: combatLog.id, combatants, initiative_order: combatants });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: getActionsPerTurn — action economy (Extra Attack and class overrides).
  // ═══════════════════════════════════════════════════════════════════════════
  const getActionsPerTurn = (character) => {
    const features = (character.features || []).map(f => (typeof f === 'string' ? f : f.name || '').toLowerCase());
    const charClass = (character.class || '').toLowerCase();
    const subclass  = (character.subclass || '').toLowerCase();
    const level = character.level || 1;
    let actions = 1;
    // Extra Attack: Fighter 5+, Ranger 5+, Paladin 5+, Barbarian 5+, Monk 5+
    if (['fighter','ranger','paladin','barbarian','monk'].includes(charClass) && level >= 5) actions = 2;
    if (charClass === 'fighter' && level >= 11) actions = 3;
    if (charClass === 'fighter' && level >= 20) actions = 4;
    // Artificer Battle Smith / Armorer get Extra Attack at level 5 (Tasha's p.17)
    if (charClass === 'artificer' && level >= 5 && (subclass.includes('battle smith') || subclass.includes('armorer'))) actions = Math.max(actions, 2);
    // Bard College of Valor: Extra Attack at level 6 (PHB p.55)
    if (charClass === 'bard' && level >= 6 && subclass.includes('valor')) actions = Math.max(actions, 2);
    // Warlock Thirsting Blade invocation: Extra Attack at level 5 (PHB p.111)
    if (charClass === 'warlock' && level >= 5 && features.some(f => f.includes('thirsting blade'))) actions = Math.max(actions, 2);
    // Feature-based overrides (catches any class with explicit 'extra attack' in features list)
    if (features.some(f => f.includes('extra attack'))) actions = Math.max(actions, 2);
    return actions;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: player_attack — the largest handler. Resolves weapon AND spell
  // attacks (utility, healing, saving-throw, auto-hit/Magic Missile, Eldritch
  // Blast, then generic attack-roll), applies feats, conditions, damage mods,
  // smite/sneak/rage, and advances the turn. Sub-branches are marked with === ===.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'player_attack') {
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
    // roll exactly once at the end (see resolveAttackRoll in SHARED HELPERS). The
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

        const dmg2 = rollDiceStr(damageDice) + spellDamageRider; // riders apply to save spells too (Sacred Flame, Fireball)
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
        // Track concentration spell in world_state
        if (spell.requires_concentration) {
          ws.concentration_spell = spell.name;
          ws.concentration_caster = character.name;
        }
        const result2 = await finalizeAndPersistCombat(combat_id, session_id, updatedC,
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
        const resultMM = await finalizeAndPersistCombat(combat_id, session_id, updatedCMM,
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
        const resultEB = await finalizeAndPersistCombat(combat_id, session_id, updatedCEB,
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

    const result = await finalizeAndPersistCombat(combat_id, session_id, updatedCombatants,
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
  if (action === 'offhand_attack') {
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

    const result = await finalizeAndPersistCombat(combat_id, session_id, updatedCombatants,
      [...(combatLog.log_entries || []), logEntry],
      combatLog.current_turn_index, combatLog.round, newWorldState);

    return Response.json({
      hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
      target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
      bonus_action_used: true, two_weapon_style: hasTWFStyle
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: enemy_turn — resolves the active enemy's turn: end-of-turn saves,
  // attacking a downed player (death-save failures), DATA-DRIVEN AI tactic selection
  // (see AI_ARCHETYPES in SHARED HELPERS), multiattack resolution, damage mitigation,
  // and concentration checks.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'enemy_turn') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];

    // Find current enemy turn
    const currentCombatant = combatants[combatLog.current_turn_index];
    if (!currentCombatant || currentCombatant.type !== 'enemy' || !currentCombatant.is_conscious) {
      return Response.json({ skipped: true });
    }

    // Legendary creature: refresh its 3 legendary actions at the start of its turn (MM).
    if (currentCombatant.is_legendary) {
      await base44.entities.CombatLog.update(combat_id, {
        world_state: { ...(combatLog.world_state || {}), legendary_actions_remaining: 3 }
      });
      combatLog.world_state = { ...(combatLog.world_state || {}), legendary_actions_remaining: 3 };
    }

    // === AUTO-SAVE: shake off saveable conditions at the start of the turn ===
    // Hold Person/Monster, Banishment, etc. grant a save at the end of each turn;
    // we resolve it here at the start of the affected creature's turn for simplicity.
    let conditionCleared = null;
    let stillIncapacitated = false;
    if ((currentCombatant.conditions || []).length > 0) {
      const remaining = [];
      for (const cond of currentCombatant.conditions) {
        const cName = (typeof cond === 'string' ? cond : cond?.name || '').toLowerCase();
        const saveAbility = SAVEABLE_CONDITIONS[cName];
        if (saveAbility && typeof cond === 'object' && cond.save_dc) {
          const saveStat = currentCombatant[saveAbility] || currentCombatant.save_stats?.[saveAbility] || 10;
          const roll = rollD20() + statMod(saveStat);
          if (roll >= cond.save_dc) {
            conditionCleared = cName; // saved — drop the condition
            continue;
          }
        }
        remaining.push(cond);
      }
      currentCombatant.conditions = remaining;
      stillIncapacitated = hasNoActions(remaining);
    }

    // If still incapacitated (paralyzed/stunned/banished, etc.), the enemy loses its turn.
    if (stillIncapacitated) {
      const updatedSkip = combatants.map(c => c.id === currentCombatant.id ? currentCombatant : c);
      const { nextIndex: niSk, nextRound: nrSk } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedSkip);
      const skipText = conditionCleared
        ? `${currentCombatant.name} shakes off ${conditionCleared}, but is still incapacitated and loses its turn!`
        : `${currentCombatant.name} is incapacitated and can take no actions!`;
      await base44.entities.CombatLog.update(combat_id, {
        combatants: updatedSkip,
        log_entries: [...(combatLog.log_entries || []), { round: combatLog.round, actor: currentCombatant.name, action: 'incapacitated', text: skipText }],
        current_turn_index: niSk, round: nrSk,
        world_state: resetTurnWorldState(combatLog),
      });
      return Response.json({ skipped_incapacitated: true, log_entry: { text: skipText }, next_turn_index: niSk, round: nrSk });
    }

    // Enemy attacks player
    const player = combatants.find(c => c.type === 'player');
    if (!player) {
      return Response.json({ no_target: true });
    }

    // SYNC PLAYER HP FROM LIVE CHARACTER RECORD (fixes Second Wind / potion heals being
    // wiped). The combatant snapshot can go stale when HP changes outside the engine
    // (Second Wind, healing potions, etc.). Re-read the authoritative Character HP so
    // enemy damage is subtracted from the player's ACTUAL current HP, not the snapshot.
    let liveChar = null;
    {
      const livePlayer = await base44.entities.Character.get(player.id);
      if (livePlayer) {
        liveChar = livePlayer;
        player.hp_current = Math.min(livePlayer.hp_max ?? player.hp_max, livePlayer.hp_current ?? player.hp_current);
        player.hp_max = livePlayer.hp_max ?? player.hp_max;
        player.is_conscious = player.hp_current > 0;
      }
    }
    // Rune Knight: invoked runes on the DEFENDER (attacker-side runes live in player_attack).
    const playerRunes = new Set((liveChar?.active_modifiers || []).map(m => m.effect).filter(Boolean));

    // Player is at 0 HP (downed): an attack that hits causes a death save failure (PHB p.197).
    // A melee hit from within 5 ft is an automatic critical → 2 failures.
    if (!player.is_conscious || player.hp_current === 0) {
      const downedChar = await base44.entities.Character.get(player.id);
      const atkRoll = rollD20();
      const atkBonus = currentCombatant.attack_bonus || 3;
      const isCrit = atkRoll === 20;
      const hitDowned = !(atkRoll === 1) && (isCrit || (atkRoll + atkBonus) >= player.ac);

      let downedLog = `${currentCombatant.name} strikes at the fallen ${player.name}`;
      const ws0 = resetTurnWorldState(combatLog);

      if (hitDowned) {
        // Melee hit at 0 HP = auto-crit = 2 failures; ranged/normal hit = 1 failure
        const isMeleeEnemy = (currentCombatant.attack_type || 'melee') !== 'ranged';
        const failuresToAdd = (isCrit || isMeleeEnemy) ? 2 : 1;
        const newFailures = Math.min(3, (downedChar.death_saves_failure || 0) + failuresToAdd);
        await base44.entities.Character.update(player.id, { death_saves_failure: newFailures });
        downedLog += ` — a brutal blow lands! +${failuresToAdd} death save failure${failuresToAdd > 1 ? 's' : ''} (${newFailures}/3).`;
        if (newFailures >= 3) downedLog += ` ${player.name} has died.`;
      } else {
        downedLog += ` but misses (${atkRoll}+${atkBonus} vs AC ${player.ac}).`;
      }

      const { nextIndex: ni0, nextRound: nr0 } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
      await base44.entities.CombatLog.update(combat_id, {
        log_entries: [...(combatLog.log_entries || []), { round: combatLog.round, actor: currentCombatant.name, action: 'attack_downed', target: player.name, hit: hitDowned, text: downedLog }],
        current_turn_index: ni0,
        round: nr0,
        world_state: ws0,
      });
      return Response.json({ no_target: false, player_unconscious: true, attacked_downed: true, hit: hitDowned, log_entry: { text: downedLog, hit: hitDowned }, next_turn_index: ni0, round: nr0 });
    }

    // === DATA-DRIVEN AI: pick a tactic from the enemy's archetype preset ===
    const enemyHpPct = currentCombatant.hp_max ? currentCombatant.hp_current / currentCombatant.hp_max : 1;
    const playerHpPct = player.hp_max ? player.hp_current / player.hp_max : 1;
    // Older combats may predate the `archetype` field — infer on the fly as a fallback.
    const archetypeKey = currentCombatant.archetype || inferArchetype(currentCombatant);
    const tactic = chooseTactic(archetypeKey, {
      selfHpPct: enemyHpPct,
      playerHpPct,
      round: combatLog.round,
    });
    const strategy = `${archetypeKey}:${tactic.id}`;
    const strategyDesc = tactic.desc;

    let attackBonus = (currentCombatant.attack_bonus || 3) + tactic.attackBonus;
    let targetAC = player.ac;
    let numAttacks = tactic.numAttacks;
    let bonusDamage = tactic.bonusDamage;

    // Dodge action (PHB p.192): attacks against a dodging player roll with disadvantage.
    const playerDodging = !!combatLog.world_state?.player_dodging;
    // Invisible player (Firbolg Hidden Step): attacks against have disadvantage (PHB p.291)
    const playerInvisible = (player.conditions || []).map(c => (typeof c === 'string' ? c : c?.name)).includes('invisible');
    // Reckless Attack drawback (PHB p.48): enemies have advantage vs the barbarian
    // until the start of the barbarian's next turn.
    const playerReckless = !!combatLog.world_state?.player_reckless;

    // ── RUNE KNIGHT (defender) reactions — one reaction per turn ────────────
    // Stone Rune: the attacker must make a WIS save vs the rune DC or be charmed
    // and unable to attack. Cloud Rune: redirect the first hit to another creature.
    // Each is a single-use invocation, consumed when it triggers.
    const runesConsumed = [];
    let reactionAvailable = !combatLog.world_state?.reaction_used;
    let stoneText = '';
    const defRuneDC = 8 + (liveChar?.proficiency_bonus || 2) + statMod(liveChar?.constitution || 10);
    if (playerRunes.has('stone_charm') && reactionAvailable) {
      reactionAvailable = false;
      runesConsumed.push('stone_charm');
      const wisSave = rollD20() + statMod(currentCombatant.wisdom || 10);
      if (wisSave < defRuneDC) {
        numAttacks = 0;
        const existingConds = (currentCombatant.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
        if (!existingConds.includes('charmed')) {
          currentCombatant.conditions = [...(currentCombatant.conditions || []), { name: 'charmed', source: 'Stone Rune', save_dc: defRuneDC, save_ability: 'wisdom', caster: player.name }];
        }
        stoneText = `🗿 STONE RUNE! ${currentCombatant.name} fails a WIS save (${wisSave} vs DC ${defRuneDC}) and is CHARMED — it cannot bring itself to attack! `;
      } else {
        stoneText = `🗿 Stone Rune: ${currentCombatant.name} resists the charm. (WIS save ${wisSave} vs DC ${defRuneDC}) `;
      }
    }
    let cloudRedirectAvailable = playerRunes.has('redirect_attack') && reactionAvailable;

    let totalDamage = 0;
    let anyHit = false;
    let isCritical = false;
    const attackLogs = [];

    for (let atk = 0; atk < numAttacks; atk++) {
      if (!currentCombatant.is_conscious) break; // felled mid-turn (Cloud Rune self-redirect)
      const roll1 = rollD20();
      // Advantage (reckless barbarian) and disadvantage (dodging) cancel per PHB p.173
      const hasAdv = playerReckless && !(playerDodging || playerInvisible);
      const hasDis = (playerDodging || playerInvisible) && !playerReckless;
      const attackRoll = hasAdv ? Math.max(roll1, rollD20()) : hasDis ? Math.min(roll1, rollD20()) : roll1;
      const totalAttack = attackRoll + attackBonus;
      const isCrit = attackRoll === 20;
      const isFumble = attackRoll === 1;
      const hit = !isFumble && (isCrit || totalAttack >= targetAC);

      if (isCrit) isCritical = true;

      if (hit) {
        anyHit = true;
        const dMatch = (currentCombatant.damage_dice || '1d6').match(/^(\d+)d(\d+)$/);
        if (dMatch) {
          const numDice = isCrit ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
          const sides = parseInt(dMatch[2]);
          let dmg = 0;
          for (let i = 0; i < numDice; i++) dmg += rollDice(sides);
          dmg += (currentCombatant.damage_bonus || 0) + bonusDamage;
          dmg = Math.max(1, dmg);
          // Cloud Rune (reaction): redirect the first attack that hits to another
          // creature — another enemy if present, otherwise the attacker itself.
          if (cloudRedirectAvailable) {
            cloudRedirectAvailable = false;
            runesConsumed.push('redirect_attack');
            const redirectTarget = combatants.find(c => c.type === 'enemy' && c.is_conscious && c.id !== currentCombatant.id) || currentCombatant;
            redirectTarget.hp_current = Math.max(0, redirectTarget.hp_current - dmg);
            if (redirectTarget.hp_current === 0) redirectTarget.is_conscious = false;
            attackLogs.push(`☁️ CLOUD RUNE! ${player.name} redirects the blow — ${redirectTarget.name} takes ${dmg} damage instead!${redirectTarget.hp_current === 0 ? ` ${redirectTarget.name} falls!` : ''}`);
            continue;
          }
          totalDamage += dmg;
          attackLogs.push(`${isCrit ? '💥 CRITICAL! ' : ''}${currentCombatant.name} hits for ${dmg} dmg (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
        }
      } else {
        attackLogs.push(`${currentCombatant.name} misses (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
      }
    }

    // === DAMAGE MITIGATION (applied in priority order) ===
    let usedReaction = false;
    const playerConditions = (player.conditions || []).map(c => c.name || c);
    const isRaging = playerConditions.includes('raging');
    const enemyDamageType = (currentCombatant.damage_type || 'bludgeoning').toLowerCase();
    const physicalTypes = ['bludgeoning', 'piercing', 'slashing'];
    // PERFORMANCE: only fetch the full character record when an attack actually landed —
    // all mitigation, temp-HP, and concentration logic below depends on a hit.
    const charFull = anyHit ? await base44.entities.Character.get(player.id) : null;
    const charFeats = charFull?.feats || [];
    const charFeatFlags = charFull?._feat_flags || [];
    const playerHasFeat = (name) => charFeats.includes(name) || charFeatFlags.includes(name.toLowerCase().replace(/\s+/g,'_'));

    let finalDamage = totalDamage;

    // Heavy Armor Master: -3 nonmagical B/P/S damage (PHB p.167)
    // Only applies in heavy armor; enemies at CR<5 treated as nonmagical
    const wearingHeavyArmor = (charFull?.equipped?.armor?.armor_type || '').toLowerCase() === 'heavy';
    const attackIsNonmagical = (currentCombatant.cr || 1) < 5; // heuristic: low-CR enemies lack magical weapons
    if (playerHasFeat('Heavy Armor Master') && wearingHeavyArmor && physicalTypes.includes(enemyDamageType) && attackIsNonmagical) {
      const reduced = Math.max(0, finalDamage - 3);
      if (reduced < finalDamage) {
        attackLogs.push(`[Heavy Armor Master: ${finalDamage} → ${reduced} ${enemyDamageType}]`);
        finalDamage = reduced;
      }
    }

    // Barbarian Rage Resistance (PHB p.48): halve B/P/S while raging.
    // Bear Totem (Totem Warrior L3, PHB p.49): resistance to ALL damage except psychic.
    const isBarbarianRaging = isRaging && (charFull?.class === 'Barbarian' || charFull?.class === 'barbarian');
    const isBearTotem = (charFull?.class_choices?.totem_spirit || '').toLowerCase() === 'bear';
    let alreadyResisted = false;
    const rageApplies = isBarbarianRaging && (isBearTotem ? enemyDamageType !== 'psychic' : physicalTypes.includes(enemyDamageType));
    if (rageApplies) {
      const halved = Math.floor(finalDamage / 2);
      attackLogs.push(`[Rage${isBearTotem ? ' (Bear Totem)' : ''} Resistance: ${finalDamage} → ${halved} ${enemyDamageType}]`);
      finalDamage = halved;
      alreadyResisted = true;
    }

    // General Resistance/Vulnerability/Immunity from character fields (PHB p.197).
    // Resistance doesn't stack (a damage type can only be halved once), so skip
    // resistance if Rage already halved this same physical damage.
    // Hill Rune (invoked): resistance to poison damage while active.
    // Racial damage traits (applied even if not on the character's arrays)
    const racialRes = [];
    const racialImm = [];
    if ((charFull?.race || '') === 'Yuan-ti Pureblood') { racialImm.push('poison'); }
    if ((charFull?.race || '') === 'Dragonborn') {
      const anc = (charFull?.class_choices?.dragon_ancestry || 'red').toLowerCase();
      const DR = { black:'acid', copper:'acid', blue:'lightning', bronze:'lightning', brass:'fire', gold:'fire', red:'fire', green:'poison', silver:'cold', white:'cold' };
      if (DR[anc]) racialRes.push(DR[anc]);
    }
    const dmgMod = applyDamageModifiers(finalDamage, enemyDamageType, {
      resistances: [...(charFull?.resistances || []), ...racialRes, ...(playerRunes.has('hill_resilience') ? ['poison'] : [])],
      vulnerabilities: charFull?.vulnerabilities,
      immunities: [...(charFull?.immunities || []), ...racialImm],
    });
    if (dmgMod.applied === 'immunity') {
      attackLogs.push(`[Immune to ${enemyDamageType}: ${finalDamage} → 0]`);
      finalDamage = 0;
    } else if (dmgMod.applied === 'resistance' && !alreadyResisted) {
      attackLogs.push(`[Resist ${enemyDamageType}: ${finalDamage} → ${dmgMod.amount}]`);
      finalDamage = dmgMod.amount;
    } else if (dmgMod.applied === 'vulnerability') {
      attackLogs.push(`[Vulnerable to ${enemyDamageType}: ${finalDamage} → ${dmgMod.amount}]`);
      finalDamage = dmgMod.amount;
    }

    // === REACTION-BASED DAMAGE MITIGATION ===
    // Goliath Stone's Endurance (reaction): 1d12 + CON reduction, once per short rest (PHB p.X)
    // Rogue Uncanny Dodge (reaction): halve damage from one attacker, L5+ (PHB p.96)
    // Both consume the player's one reaction per round.
    const playerReactionUsed = !!combatLog.world_state?.player_reaction_used;
    if (finalDamage > 0 && !playerReactionUsed) {
      const isRangedAttack = (currentCombatant.attack_type || 'melee') === 'ranged';
      // Monk Deflect Missiles (PHB p.78): reaction vs a ranged weapon attack —
      // reduce damage by 1d10 + DEX + monk level (M-C2 fix). Automatic.
      if (charFull?.class === 'Monk' && (charFull?.level || 1) >= 3 && isRangedAttack) {
        const deflect = rollDice(10) + statMod(charFull.dexterity || 10) + (charFull.level || 1);
        const reduced = Math.max(0, finalDamage - deflect);
        attackLogs.push(`[Deflect Missiles: -${deflect} → ${reduced}${reduced === 0 ? ' — missile caught!' : ''}]`);
        finalDamage = reduced;
        usedReaction = true;
      // Stone's Endurance takes priority over Uncanny Dodge (bigger reduction on average)
      } else if ((charFull?.race === 'Goliath') && !(charFull?.short_rest_abilities?.stones_endurance_used)) {
        const stoneRed = rollDice(12) + statMod(charFull.constitution || 10);
        finalDamage = Math.max(0, finalDamage - stoneRed);
        attackLogs.push(`[Stone's Endurance: -${stoneRed} → ${finalDamage}]`);
        await base44.entities.Character.update(player.id, {
          short_rest_abilities: { ...(charFull.short_rest_abilities || {}), stones_endurance_used: true },
        });
        usedReaction = true;
      } else if (charFull?.class === 'Rogue' && (charFull?.level || 1) >= 5) {
        finalDamage = Math.floor(finalDamage / 2);
        attackLogs.push(`[Uncanny Dodge: halved → ${finalDamage}]`);
        usedReaction = true;
      }
    }

    // Apply total damage to player — temp HP absorbs first (PHB p.198)
    let instantDeath = false;
    if (finalDamage > 0) {
      // Temporary HP acts as a buffer: absorbed before real HP, never stacks
      const currentTempHP = charFull.temp_hp || 0;
      let remainingDamage = finalDamage;
      if (currentTempHP > 0) {
        const tempAbsorbed = Math.min(currentTempHP, remainingDamage);
        remainingDamage -= tempAbsorbed;
        const newTempHP = currentTempHP - tempAbsorbed;
        await base44.entities.Character.update(player.id, { temp_hp: newTempHP });
        if (tempAbsorbed > 0) {
          attackLogs.push(`[Temp HP absorbed ${tempAbsorbed} damage (${newTempHP} temp HP remaining)]`);
        }
      }
      if (remainingDamage > 0) {
        const hpBefore = player.hp_current;
        const overkill = remainingDamage - hpBefore; // damage remaining after reaching 0 HP
        player.hp_current = Math.max(0, hpBefore - remainingDamage);
        if (player.hp_current === 0) {
          player.is_conscious = false;
          // Instant Death (PHB p.197): if remaining damage >= max HP, the creature dies instantly
          if (overkill >= (player.hp_max || 0)) {
            instantDeath = true;
            await base44.entities.Character.update(player.id, {
              hp_current: 0,
              death_saves_failure: 3,
              death_saves_success: 0,
            });
          }
        }
        // Half-Orc Relentless Endurance (PHB p.41): drop to 1 HP instead of 0, once per long rest
        if (player.hp_current === 0 && !instantDeath && (charFull?.race === 'Half-Orc')
            && !(charFull?.long_rest_abilities?.relentless_endurance_used)) {
          player.hp_current = 1;
          player.is_conscious = true;
          await base44.entities.Character.update(player.id, {
            hp_current: 1,
            long_rest_abilities: { ...(charFull.long_rest_abilities || {}), relentless_endurance_used: true },
          });
          attackLogs.push(`[Relentless Endurance: dropped to 1 HP instead of 0!]`);
        }
        if (!instantDeath) {
          await base44.entities.Character.update(player.id, { hp_current: player.hp_current });
        }
      }
      totalDamage = finalDamage; // reflects actual damage after temp HP absorption
    }

    // Build log entry
    let logText = '';
    if (conditionCleared) logText += `${currentCombatant.name} breaks free of ${conditionCleared}! `;
    if (stoneText) logText += stoneText;
    if (strategyDesc && numAttacks > 0) logText += `[${currentCombatant.name} ${strategyDesc}] `;
    if (anyHit) {
      logText += attackLogs.join('; ') + (totalDamage > 0 ? `. ${player.name} takes ${totalDamage} total damage! (${player.hp_current}/${player.hp_max} HP)` : `. ${player.name} takes no damage!`);
      if (instantDeath) logText += ` 💀 The blow is so massive that ${player.name} dies instantly!`;
      else if (!player.is_conscious) logText += ` ${player.name} falls!`;
    } else if (numAttacks === 0) {
      logText += `${currentCombatant.name} takes no hostile action this turn.`;
    } else {
      logText += `${currentCombatant.name} attacks but misses ${player.name}! (${attackLogs.join('; ')})`;
    }

    // Build updated combatants with player HP changes BEFORE advancing turn
    const updatedCombatants = combatants.map(c => c.id === player.id ? player : c);

    const { nextIndex, nextRound: round } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);

    // Carry over world_state, clear concentration if broken.
    // player_dodging expires once enemies have acted (it only lasts until the player's next turn).
    const newWS = resetTurnWorldState(combatLog, { player_dodging: false, player_reaction_used: usedReaction || !!combatLog.world_state?.player_reaction_used });
    if (updatedCombatants[nextIndex]?.type === 'player') {
      newWS.player_reckless = false;
      newWS.player_reaction_used = false;
    }
    const concentrationSpellCheck = combatLog.world_state?.concentration_spell;
    if (concentrationSpellCheck && finalDamage > 0) {
      const conc = rollConcentrationSave(charFull, finalDamage);
      if (conc.broken) {
        newWS.concentration_spell = null;
        newWS.concentration_caster = null;
        logText += ` ⚠️ Concentration on ${concentrationSpellCheck} broken! (CON save: ${conc.save} vs DC ${conc.dc})`;
      }
    }

    const logEntry = {
      round: combatLog.round,
      actor: currentCombatant.name,
      action: strategy,
      target: player.name,
      hit: anyHit,
      critical: isCritical,
      damage: totalDamage,
      ai_strategy: strategyDesc,
      text: logText
    };

    // Persist consumed rune invocations (Cloud/Stone are single-use reactions).
    if (runesConsumed.length > 0 && liveChar) {
      await base44.entities.Character.update(player.id, {
        active_modifiers: (liveChar.active_modifiers || []).filter(m => !runesConsumed.includes(m.effect)),
      });
    }

    // A Cloud Rune redirect can fell an enemy on its own turn — check for victory.
    const allEnemiesDown = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round,
      world_state: newWS,
      ...(allEnemiesDown ? { is_active: false, result: 'victory' } : {}),
    });
    if (allEnemiesDown) {
      await base44.entities.GameSession.update(session_id, { in_combat: false });
      await awardVictoryXP(combat_id, updatedCombatants, player.id);
    }

    const playerAtZero = !player.is_conscious;
    if (playerAtZero && player.hp_current === 0) {
      // Don't end combat immediately - let death saves play out
      // Only mark as defeat if death saves are failed (handled elsewhere)
    }

    return Response.json({ log_entry: logEntry, player_hp: player.hp_current, player_at_zero_hp: playerAtZero, next_turn_index: nextIndex, round, ai_strategy: strategy, result: allEnemiesDown ? 'victory' : 'ongoing', combat_ended: allEnemiesDown });
  }

  // ─── ACTION SURGE (Fighter, PHB p.72) ───────────────────────────────────────
  // Grants one extra action this turn. Once per short rest (twice at L17+).
  // Server-authoritative: tracked in character.short_rest_abilities.action_surge_used.
  if (action === 'action_surge') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    const charClass = (character.class || '').toLowerCase();
    const level = character.level || 1;

    if (charClass !== 'fighter' || level < 2) {
      return Response.json({ error: 'Action Surge requires Fighter level 2+.', invalid: true }, { status: 400 });
    }

    const maxUses = level >= 17 ? 2 : 1;
    const sra = character.short_rest_abilities || {};
    const used = sra.action_surge_used || 0;
    if (used >= maxUses) {
      return Response.json({ error: 'Action Surge already used — recover it on a short or long rest.', invalid: true }, { status: 400 });
    }

    // Consume one use (persist to character)
    await base44.entities.Character.update(character_id, {
      short_rest_abilities: { ...sra, action_surge_used: used + 1 }
    });

    // Grant an extra action this turn by giving back one action's worth of budget
    const ws = combatLog.world_state || {};
    const newUsed = Math.max(0, (ws.actions_used_this_turn || 0) - 1);
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'action_surge',
      text: `⚡ ${character.name} uses Action Surge — gaining an extra action this turn! (${used + 1}/${maxUses} used)`
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...ws, actions_used_this_turn: newUsed },
    });
    return Response.json({ success: true, log_entry: logEntry, uses_remaining: maxUses - (used + 1) });
  }

  // ─── LEGENDARY ACTION (Monster Manual) ──────────────────────────────────────
  // A legendary creature can spend legendary actions at the end of another
  // creature's turn. Budget = 3 per round, refreshed at the start of its own turn
  // (handled in enemy_turn via world_state reset). Here we resolve one LA: a melee
  // attack against the player.
  if (action === 'legendary_action') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];

    // Find the legendary enemy (first conscious enemy flagged legendary with budget left)
    const ws = combatLog.world_state || {};
    const budget = ws.legendary_actions_remaining ?? 3;
    const legendary = combatants.find(c => c.type === 'enemy' && c.is_conscious && c.is_legendary);
    const player = combatants.find(c => c.type === 'player');

    if (!legendary || !player || !player.is_conscious || budget <= 0) {
      return Response.json({ skipped: true, legendary_actions_remaining: Math.max(0, budget) });
    }

    // Resolve a single legendary melee attack
    const atkRoll = rollD20();
    const atkBonus = legendary.attack_bonus || 5;
    const isCrit = atkRoll === 20;
    const hit = !(atkRoll === 1) && (isCrit || (atkRoll + atkBonus) >= player.ac);
    let dmg = 0;
    if (hit) {
      const dMatch = (legendary.damage_dice || '2d6').match(/^(\d+)d(\d+)$/);
      const numDice = dMatch ? (isCrit ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1])) : (isCrit ? 4 : 2);
      const sides = dMatch ? parseInt(dMatch[2]) : 6;
      for (let i = 0; i < numDice; i++) dmg += rollDice(sides);
      dmg = Math.max(1, dmg + (legendary.damage_bonus || 0));
      // Temp HP absorbs legendary action damage first (PHB p.198)
      const laCharFull = await base44.entities.Character.get(player.id);
      const laTempHP = laCharFull.temp_hp || 0;
      let laRemainingDmg = dmg;
      if (laTempHP > 0) {
        const absorbed = Math.min(laTempHP, laRemainingDmg);
        laRemainingDmg -= absorbed;
        await base44.entities.Character.update(player.id, { temp_hp: laTempHP - absorbed });
      }
      if (laRemainingDmg > 0) { // legendary damage is only computed inside `if (hit)`, so dmg>0 here
        player.hp_current = Math.max(0, player.hp_current - laRemainingDmg);
        if (player.hp_current === 0) player.is_conscious = false;
        await base44.entities.Character.update(player.id, { hp_current: player.hp_current });
      }
    }

    const newBudget = budget - 1;
    const logEntry = {
      round: combatLog.round, actor: legendary.name, action: 'legendary_action', target: player.name,
      hit, critical: isCrit, damage: dmg,
      text: hit
        ? `✨ LEGENDARY ACTION — ${legendary.name} strikes ${player.name}${isCrit ? ' (CRIT!)' : ''} for ${dmg} damage! (${newBudget} legendary actions left)${player.hp_current === 0 ? ` ${player.name} falls!` : ''}`
        : `✨ LEGENDARY ACTION — ${legendary.name} strikes at ${player.name} but misses. (${newBudget} legendary actions left)`
    };

    await base44.entities.CombatLog.update(combat_id, {
      combatants: combatants.map(c => c.id === player.id ? player : c),
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...ws, legendary_actions_remaining: newBudget },
    });

    return Response.json({ log_entry: logEntry, player_hp: player.hp_current, legendary_actions_remaining: newBudget });
  }

  // ─── GRAPPLE ACTION (PHB p.195) ─────────────────────────────────────────────
  // Replaces one attack: opposed Strength (Athletics) check vs the target's best of
  // Strength (Athletics) or Dexterity (Acrobatics). On success, the target is Grappled
  // (speed 0 until the grapple ends). Uses one attack/action and may end the turn.
  if (action === 'grapple') {
    const { target_id } = payload || {};
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    const profBonus = character.proficiency_bonus || 2;
    // Attacker: Strength (Athletics). Add proficiency if proficient in Athletics.
    const athleticsProf = character.skills?.athletics ? profBonus : 0;
    // Frost Rune (invoked): advantage on Strength (Athletics) checks.
    const frostActive = (character.active_modifiers || []).some(m => m.effect === 'frost_advantage');
    const gRoll1 = rollD20();
    const attackerCheck = (frostActive ? Math.max(gRoll1, rollD20()) : gRoll1) + statMod(character.strength) + athleticsProf;

    // Defender: best of Athletics (STR) or Acrobatics (DEX). Monster stats are on the combatant.
    const defStr = target.strength || (target.str ? parseInt(target.str) : 10);
    const defDex = target.dexterity || (target.dex ? parseInt(target.dex) : 10);
    const defenderCheck = rollD20() + Math.max(statMod(defStr), statMod(defDex));

    const success = attackerCheck >= defenderCheck;
    let logText;
    if (success) {
      const existing = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
      if (!existing.includes('grappled')) {
        target.conditions = [...(target.conditions || []), { name: 'grappled', source: character.name, escape_dc: 8 + statMod(character.strength) + athleticsProf }];
      }
      logText = `🤼 ${character.name} GRAPPLES ${target.name}! (Athletics ${attackerCheck} vs ${defenderCheck}) — ${target.name}'s speed is reduced to 0 until they break free.`;
    } else {
      logText = `${character.name} tries to grapple ${target.name} but fails! (Athletics ${attackerCheck} vs ${defenderCheck})`;
    }

    const logEntry = { round: combatLog.round, actor: character.name, action: 'grapple', target: target.name, hit: success, text: logText };
    const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);

    // Grapple replaces one attack — consume one action from the turn budget.
    const { nextIndex, nextRound, actionsRemaining, worldState: newWorldState } =
      resolveActionAndAdvance(combatLog, updatedCombatants, character);

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: newWorldState,
    });

    return Response.json({ success, log_entry: logEntry, actions_remaining: Math.max(0, actionsRemaining), next_turn_index: nextIndex });
  }

  // ─── DODGE ACTION (PHB p.192) ───────────────────────────────────────────────
  // Until the start of your next turn, attack rolls against you have disadvantage
  // (if you can see the attacker) and you make DEX saves with advantage. Uses your
  // action and ends the turn. Server marks player_dodging in world_state; enemy_turn
  // applies disadvantage to attacks against the player.
  if (action === 'dodge') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = combatLog.combatants;
    const character = await base44.entities.Character.get(character_id);
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'dodge',
      text: `🛡️ ${character.name} takes the Dodge action — attacks against them have disadvantage until their next turn.`
    };
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: resetTurnWorldState(combatLog, { player_dodging: true })
    });
    return Response.json({ success: true, log_entry: logEntry, next_turn_index: nextIndex, round: nextRound });
  }

  // ─── FLURRY OF BLOWS (Monk L2, PHB p.78) ───────────────────────────────────
  // Bonus action: spend 1 Ki to make 2 unarmed strikes after taking the Attack action.
  // Uses Martial Arts die (scales with level) and DEX for attack/damage.
  if (action === 'flurry_of_blows') {
    const { target_id } = payload || {};
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const level = character.level || 1;
    if ((character.class || '').toLowerCase() !== 'monk' || level < 2) {
      return Response.json({ error: 'Flurry of Blows requires Monk level 2+.', invalid: true }, { status: 400 });
    }
    const kiRemaining = character.ki_points_remaining ?? 0;
    if (kiRemaining <= 0) {
      return Response.json({ error: 'No Ki points remaining.', invalid: true }, { status: 400 });
    }
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }

    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    // Martial Arts die + DEX-based attack (PHB p.76)
    const maDie = level >= 17 ? 10 : level >= 11 ? 8 : level >= 5 ? 6 : 4;
    const dexMod = statMod(character.dexterity || 10);
    const profBonus = character.proficiency_bonus || 2;
    const attackMod = dexMod + profBonus;

    let totalDamage = 0;
    let anyHit = false;
    const strikeLogs = [];

    for (let s = 0; s < 2; s++) {
      if (!target.is_conscious) break;
      const roll1 = rollD20();
      const isCrit = roll1 === 20;
      const isFumble = roll1 === 1;
      const totalAttack = roll1 + attackMod;
      const hit = !isFumble && (isCrit || totalAttack >= target.ac);
      if (hit) {
        anyHit = true;
        const numDice = isCrit ? 2 : 1;
        let dmg = 0;
        for (let i = 0; i < numDice; i++) dmg += rollDice(maDie);
        dmg += dexMod;
        dmg = Math.max(1, dmg);
        const dmgMod = applyDamageModifiers(dmg, 'bludgeoning', {
          resistances: target.resistances, vulnerabilities: target.vulnerabilities, immunities: target.immunities,
        });
        dmg = dmgMod.applied === 'immunity' ? 0 : dmgMod.amount;
        totalDamage += dmg;
        target.hp_current = Math.max(0, target.hp_current - dmg);
        if (target.hp_current === 0) target.is_conscious = false;
        strikeLogs.push(`Strike ${s + 1}: ${isCrit ? 'CRIT! ' : ''}${dmg} dmg (${roll1}+${attackMod}=${totalAttack} vs AC ${target.ac})`);
      } else {
        strikeLogs.push(`Strike ${s + 1}: miss (${roll1}+${attackMod}=${totalAttack} vs AC ${target.ac})`);
      }
    }

    // Spend 1 Ki
    await base44.entities.Character.update(character_id, {
      ki_points_remaining: Math.max(0, kiRemaining - 1),
    });

    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'flurry_of_blows', target: target.name,
      hit: anyHit, damage: totalDamage,
      text: `${character.name} uses Flurry of Blows! ${strikeLogs.join(' | ')}${totalDamage > 0 ? ` — ${totalDamage} total bludgeoning damage.` : ''}${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`,
    };

    const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
    const { nextIndex: fIndex, nextRound: fRound, worldState: fWS } =
      resolveActionAndAdvance(combatLog, updatedCombatants, character, { isBonusAction: true });

    const result = await finalizeAndPersistCombat(combat_id, session_id, updatedCombatants,
      [...(combatLog.log_entries || []), logEntry], fIndex, fRound, fWS);

    return Response.json({
      hit: anyHit, damage: totalDamage, log_entry: logEntry, result,
      combat_ended: result !== 'ongoing', ki_remaining: Math.max(0, kiRemaining - 1),
      next_turn_index: fIndex,
    });
  }

  // Monk Patient Defense / Step of the Wind / Stunning Strike were extracted to
  // base44/functions/monkActions/entry.ts to keep this file within size limits.
  // Flurry of Blows remains above (it needs the turn-advancement helpers).

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: next_turn — simply advance the initiative tracker (used when the
  // player ends their turn early or to step a non-acting combatant).
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'next_turn') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    const nextWS = resetTurnWorldState(combatLog);
    let condLog = null;
    // Player turn-start: resolve saveable conditions with racial advantages and Paladin auras.
    // Halfling Brave (PHB p.28): advantage on frightened saves.
    // Gnome Cunning (PHB p.37): advantage on INT/WIS/CHA saves vs magic.
    // Aura of Protection (Paladin L6, PHB p.85): +CHA mod to all saves.
    // Aura of Devotion (Paladin L10, PHB p.86): immune to charm.
    if (combatants[nextIndex]?.type === 'player') {
      nextWS.player_reckless = false; nextWS.player_reaction_used = false;
      const pc = combatants[nextIndex];
      if ((pc.conditions || []).some(c => SAVEABLE_CONDITIONS[(typeof c === 'string' ? c : c?.name || '').toLowerCase()])) {
        const ch = await base44.entities.Character.get(pc.id);
        if (ch) {
          const race = (ch.race || '').toLowerCase();
          const auraBonus = ((ch.class || '') === 'Paladin' && (ch.level || 1) >= 6) ? Math.max(1, statMod(ch.charisma || 10)) : 0;
          const devotionImmune = (ch.class || '') === 'Paladin' && (ch.subclass || '').toLowerCase().includes('devotion') && (ch.level || 1) >= 10;
          // Mindless Rage (Berserker 6+, PHB p.49): can't be charmed or frightened while raging (H-S1 fix)
          const mindlessRage = (ch.class || '') === 'Barbarian' && (ch.subclass || '').toLowerCase().includes('berserker') && (ch.level || 1) >= 6
            && (pc.conditions || []).some(c => (typeof c === 'string' ? c : c?.name) === 'raging');
          const remaining = []; let cleared = null;
          for (const cond of pc.conditions) {
            const cN = (typeof cond === 'string' ? cond : cond?.name || '').toLowerCase();
            if (cN === 'charmed' && devotionImmune) { cleared = cN; continue; }
            if ((cN === 'charmed' || cN === 'frightened') && mindlessRage) { cleared = cN; continue; }
            const saveAb = SAVEABLE_CONDITIONS[cN];
            if (saveAb && typeof cond === 'object' && cond.save_dc) {
              const hasAdv = (cN === 'frightened' && race === 'halfling') || (['intelligence','wisdom','charisma'].includes(saveAb) && race === 'gnome');
              // Halfling Lucky (PHB p.28): reroll natural 1s on saving throws
              const luckyD20 = () => { let r = rollD20(); if (race === 'halfling' && r === 1) r = rollD20(); return r; };
              const r1 = luckyD20(), r2 = hasAdv ? luckyD20() : r1;
              if (Math.max(r1, r2) + statMod(ch[saveAb] || 10) + auraBonus >= cond.save_dc) { cleared = cN; continue; }
            }
            remaining.push(cond);
          }
          pc.conditions = remaining;
          if (cleared) condLog = { round: nextRound, actor: pc.name, action: 'condition_save', text: `${pc.name} shakes off ${cleared}!` };
        }
      }
    }
    await base44.entities.CombatLog.update(combat_id, {
      current_turn_index: nextIndex, round: nextRound, world_state: nextWS,
      ...(condLog ? { log_entries: [...(combatLog.log_entries || []), condLog], combatants } : {}),
    });
    return Response.json({ next_turn_index: nextIndex, round: nextRound, current_combatant: combatants[nextIndex], condition_cleared: condLog?.text || null });
  }

  // ─── DEATH SAVE (PHB p.197) ─────────────────────────────────────────────────
  // Player rolls a d20 on their turn while at 0 HP.
  // 10+  = success. 3 successes = stabilized.
  // 9-   = failure. 3 failures  = dead.
  // Nat 20 = regain 1 HP and stand up immediately.
  // Nat 1  = counts as 2 failures.
  if (action === 'death_save') {
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];
    const playerCombatant = combatants.find(c => c.type === 'player');

    // Only roll if actually at 0 HP
    if ((character.hp_current || 0) > 0) {
      return Response.json({ error: 'Character is not at 0 HP — no death save needed.', invalid: true }, { status: 400 });
    }

    let roll = rollD20();
    // Halfling Lucky (PHB p.28): death saves are saving throws — reroll natural 1s
    if ((character.race || '') === 'Halfling' && roll === 1) roll = rollD20();
    let successDelta = 0;
    let failureDelta = 0;
    let logText = `💀 ${character.name} rolls a Death Saving Throw: ${roll}`;
    let stabilized = false;
    let regainedHP = false;

    if (roll === 20) {
      // Nat 20: regain 1 HP, stand up (PHB p.197)
      await base44.entities.Character.update(character_id, {
        hp_current: 1,
        death_saves_success: 0,
        death_saves_failure: 0,
      });
      if (playerCombatant) {
        playerCombatant.hp_current = 1;
        playerCombatant.is_conscious = true;
      }
      logText += ` — NATURAL 20! ${character.name} regains 1 HP and stands back up! 🌟`;
      regainedHP = true;
    } else if (roll === 1) {
      // Nat 1: 2 failures
      failureDelta = 2;
      logText += ` — Natural 1! Two death save failures!`;
    } else if (roll >= 10) {
      successDelta = 1;
      logText += ` — Success! (${roll} ≥ 10)`;
    } else {
      failureDelta = 1;
      logText += ` — Failure. (${roll} < 10)`;
    }

    const newSuccesses = Math.min(3, (character.death_saves_success || 0) + successDelta);
    const newFailures = Math.min(3, (character.death_saves_failure || 0) + failureDelta);

    if (!regainedHP) {
      if (newSuccesses >= 3) {
        // Stabilized: unconscious but no longer dying (PHB p.197)
        stabilized = true;
        logText += ` — ${character.name} is STABILIZED and no longer dying!`;
        await base44.entities.Character.update(character_id, {
          death_saves_success: newSuccesses,
          death_saves_failure: newFailures,
        });
      } else if (newFailures >= 3) {
        logText += ` — ${character.name} has DIED. ☠️`;
        await base44.entities.Character.update(character_id, {
          death_saves_success: newSuccesses,
          death_saves_failure: 3,
        });
      } else {
        await base44.entities.Character.update(character_id, {
          death_saves_success: newSuccesses,
          death_saves_failure: newFailures,
        });
      }
    }

    const logEntry = {
      round: combatLog.round,
      actor: character.name,
      action: 'death_save',
      roll,
      text: logText + ` (${newSuccesses}/3 successes, ${newFailures}/3 failures)`,
    };

    // Advance turn after death save (it consumes the player's turn)
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    const updatedCombatants = playerCombatant ? combatants.map(c => c.type === 'player' ? playerCombatant : c) : combatants;

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: resetTurnWorldState(combatLog),
    });

    return Response.json({
      roll,
      success: successDelta > 0,
      nat20: roll === 20,
      nat1: roll === 1,
      stabilized,
      regained_hp: regainedHP,
      death_saves_success: newSuccesses,
      death_saves_failure: newFailures,
      character_dead: newFailures >= 3 && !regainedHP,
      log_entry: logEntry,
      next_turn_index: nextIndex,
    });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});