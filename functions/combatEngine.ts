import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Combat Engine - handles initiative, turns, damage, conditions
 * All math done server-side referencing DB state
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, session_id, combat_id, character_id, payload } = await req.json();

  const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
  const rollD20 = () => Math.floor(Math.random() * 20) + 1;
  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  if (action === 'start_combat') {
    const { enemies } = payload;
    const session = await base44.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const character = await base44.entities.Character.get(session.character_id);

    // Roll initiative for all combatants
    const combatants = [];

    // Player initiative
    const playerInitRoll = rollD20();
    const playerInitMod = statMod(character.dexterity) + (character.initiative || 0);
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
      conditions: character.conditions || [],
      is_conscious: true
    });

    // Enemy initiatives
    for (const enemy of enemies) {
      const initRoll = rollD20();
      const initMod = statMod(enemy.dexterity || 10);
      const enemyHP = parseInt(enemy.hp) || enemy.hp_current || 10;
      combatants.push({
        id: `enemy_${Math.random().toString(36).substr(2, 9)}`,
        name: enemy.name || enemy.monster_name || `Enemy`,
        type: 'enemy',
        initiative_roll: initRoll,
        initiative_mod: initMod,
        initiative_total: initRoll + initMod,
        hp_current: enemyHP,
        hp_max: enemyHP,
        ac: enemy.ac || 12,
        attack_bonus: enemy.attack_bonus || 3,
        damage_dice: enemy.damage_dice || '1d6',
        damage_bonus: enemy.damage_bonus || 2,
        conditions: [],
        is_conscious: true,
        cr: enemy.cr || 1,
        xp: enemy.xp || 100
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

  // Determine how many actions a character gets per turn based on features/level
  const getActionsPerTurn = (character) => {
    const features = (character.features || []).map(f => (typeof f === 'string' ? f : f.name || '').toLowerCase());
    const charClass = (character.class || '').toLowerCase();
    const level = character.level || 1;
    let actions = 1;
    // Extra Attack: Fighter 5+, Ranger 5+, Paladin 5+, Barbarian 5+, Monk 5+
    if (['fighter','ranger','paladin','barbarian','monk'].includes(charClass) && level >= 5) actions = 2;
    if (charClass === 'fighter' && level >= 11) actions = 3;
    if (charClass === 'fighter' && level >= 20) actions = 4;
    // Feature-based overrides
    if (features.some(f => f.includes('extra attack'))) actions = Math.max(actions, 2);
    // Action Surge (Fighter) — handled separately as a bonus action
    return actions;
  };

  if (action === 'player_attack') {
    const { target_id, weapon, spell, modifiers = {} } = payload;
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);

    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    // Handle advantage/disadvantage
    let attackRoll1 = rollD20();
    let attackRoll2 = modifiers.advantage || modifiers.disadvantage ? rollD20() : attackRoll1;
    let attackRoll = attackRoll1;
    if (modifiers.advantage) attackRoll = Math.max(attackRoll1, attackRoll2);
    if (modifiers.disadvantage) attackRoll = Math.min(attackRoll1, attackRoll2);

    let attackMod = 0;
    let damageDice = '1d6';
    let damageBonus = 0;
    let attackType = 'melee';
    let isCritical = attackRoll === 20;
    let isMiss = attackRoll === 1;
    let extraDamageDice = []; // For smite, sneak attack, etc

    if (spell) {
      const spellAbilityMap = {
        wizard: 'intelligence', eldritch_knight: 'intelligence', arcane_trickster: 'intelligence',
        cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
        bard: 'charisma', paladin: 'charisma', sorcerer: 'charisma', warlock: 'charisma'
      };
      const spellAbility = spellAbilityMap[(character.class || '').toLowerCase()] || 'intelligence';
      const spellStatMod = statMod(character[spellAbility]);
      const profBonus = character.proficiency_bonus || 2;
      const spellSaveDC = 8 + spellStatMod + profBonus;
      const spellAttackBonus = spellStatMod + profBonus;

      attackMod = spellAttackBonus;
      damageDice = spell.damage_dice || '2d6';
      damageBonus = 0; // spell damage doesn't add ability mod (unless explicit, like Hex)
      attackType = spell.attack_type || 'ranged_spell_attack';

      // Handle upcast: scale damage dice if upcasting
      const slotLevel = spell.slot_level || spell.base_level || 1;
      const baseLevel = spell.base_level || 1;
      const upcasting = slotLevel > baseLevel;
      if (upcasting && damageDice && damageDice !== '0') {
        const dMatch0 = damageDice.match(/^(\d+)d(\d+)$/);
        if (dMatch0) {
          const extraLevels = slotLevel - baseLevel;
          const newNumDice = parseInt(dMatch0[1]) + extraLevels;
          damageDice = `${newNumDice}d${dMatch0[2]}`;
        }
      }

      // Use slot on cast (track in character spell_slots)
      if (spell.slot_level && spell.slot_level > 0) {
        const slotsKey = `level_${spell.slot_level}`;
        const currentUsed = (character.spell_slots || {})[slotsKey] || 0;
        await base44.entities.Character.update(character_id, {
          spell_slots: { ...(character.spell_slots || {}), [slotsKey]: currentUsed + 1 }
        });
      }

      // === UTILITY / BUFF spells ===
      if (spell.is_utility) {
        const utilEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
          hit: null, text: `${character.name} casts ${spell.name}!`,
          spell_name: spell.name, is_utility: true
        };
        const updatedLog = [...(combatLog.log_entries || []), utilEntry];
        const actionsPerTurn2 = getActionsPerTurn(character);
        const currentActionsUsed2 = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const actionsRemaining2 = actionsPerTurn2 - currentActionsUsed2;
        let nextIndex2 = combatLog.current_turn_index;
        let nextRound2 = combatLog.round;
        let newWorldState2 = { ...(combatLog.world_state || {}), actions_used_this_turn: currentActionsUsed2 };
        if (actionsRemaining2 <= 0) {
          nextIndex2 = (combatLog.current_turn_index + 1) % combatants.length;
          if (nextIndex2 === 0) nextRound2 += 1;
          let safety2 = 0;
          while (!combatants[nextIndex2]?.is_conscious && safety2 < combatants.length) {
            nextIndex2 = (nextIndex2 + 1) % combatants.length;
            if (nextIndex2 === 0) nextRound2 += 1;
            safety2++;
          }
          newWorldState2.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, {
          log_entries: updatedLog, current_turn_index: nextIndex2, round: nextRound2, world_state: newWorldState2
        });
        return Response.json({ hit: null, damage: 0, log_entry: utilEntry, result: 'ongoing', combat_ended: false, actions_remaining: actionsRemaining2, next_turn_index: nextIndex2 });
      }

      // === HEALING spells ===
      if (spell.attack_type === 'healing' && spell.heal_dice) {
        const hdMatch = (spell.heal_dice || '1d8').match(/^(\d+)d(\d+)$/);
        let healAmt = 0;
        if (hdMatch) {
          const numD = parseInt(hdMatch[1]);
          const sides2 = parseInt(hdMatch[2]);
          for (let i = 0; i < numD; i++) healAmt += rollDice(sides2);
        }
        healAmt += spellStatMod;
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
        const actionsPerTurn3 = getActionsPerTurn(character);
        const actionsUsed3 = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const actionsRem3 = actionsPerTurn3 - actionsUsed3;
        let ni3 = combatLog.current_turn_index;
        let nr3 = combatLog.round;
        let ws3 = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed3 };
        if (actionsRem3 <= 0) {
          ni3 = (combatLog.current_turn_index + 1) % updatedCombatants2.length;
          if (ni3 === 0) nr3++;
          ws3.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, {
          combatants: updatedCombatants2, log_entries: [...(combatLog.log_entries || []), healEntry],
          current_turn_index: ni3, round: nr3, world_state: ws3
        });
        return Response.json({ hit: true, damage: 0, heal_amount: healAmt, log_entry: healEntry, result: 'ongoing', combat_ended: false, actions_remaining: actionsRem3, next_turn_index: ni3 });
      }

      // === SAVING THROW spells ===
      if (spell.attack_type === 'saving_throw' && spell.save_type) {
        // Target's save ability — use what we have on the combatant (may have been set at start), else default
        const targetSaveStat = target[spell.save_type] || target.save_stats?.[spell.save_type] || 10;
        const targetSaveMod = statMod(targetSaveStat);
        const saveRoll = Math.floor(Math.random() * 20) + 1;
        const saveTotal = saveRoll + targetSaveMod;
        const saveFailed = saveTotal < spellSaveDC;

        const dMatch2 = (damageDice).match(/^(\d+)d(\d+)$/);
        let dmg2 = 0;
        if (dMatch2) {
          for (let i = 0; i < parseInt(dMatch2[1]); i++) dmg2 += rollDice(parseInt(dMatch2[2]));
        }
        const finalDmg = saveFailed ? dmg2 : Math.floor(dmg2 / 2);
        if (finalDmg > 0) {
          target.hp_current = Math.max(0, target.hp_current - finalDmg);
          if (target.hp_current === 0) target.is_conscious = false;
        }

        const saveEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
          hit: saveFailed, spell_name: spell.name,
          text: `${character.name} casts ${spell.name}! DC${spellSaveDC} ${spell.save_type} save: ${target.name} rolled ${saveTotal} — ${saveFailed ? 'FAILED' : 'success'}. Takes ${finalDmg} ${spell.damage_type || ''} damage.${target.hp_current === 0 ? ` ${target.name} falls!` : ''}`
        };

        const updatedC = combatants.map(c => c.id === target_id ? target : c);
        const allDead = updatedC.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
        const playerDead2 = updatedC.find(c => c.type === 'player')?.is_conscious === false;
        let result2 = 'ongoing';
        if (allDead) result2 = 'victory';
        if (playerDead2) result2 = 'defeat';

        const apt = getActionsPerTurn(character);
        const acu = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const ar2 = apt - acu;
        let ni = combatLog.current_turn_index;
        let nr = combatLog.round;
        let ws = { ...(combatLog.world_state || {}), actions_used_this_turn: acu };
        if (result2 !== 'ongoing' || ar2 <= 0) {
          if (result2 === 'ongoing') {
            ni = (combatLog.current_turn_index + 1) % updatedC.length;
            if (ni === 0) nr++;
            let s = 0;
            while (!updatedC[ni]?.is_conscious && s < updatedC.length) { ni = (ni + 1) % updatedC.length; if (ni === 0) nr++; s++; }
          }
          ws.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, {
          combatants: updatedC, log_entries: [...(combatLog.log_entries || []), saveEntry],
          current_turn_index: ni, round: nr, world_state: ws, is_active: result2 === 'ongoing', result: result2
        });
        if (result2 !== 'ongoing') {
          await base44.entities.GameSession.update(session_id, { in_combat: false });
          if (result2 === 'victory') {
            const totalXP2 = updatedC.filter(c => c.type === 'enemy').reduce((s2, e) => s2 + (e.xp || 0), 0);
            const ch2 = await base44.entities.Character.get(character_id);
            await base44.entities.Character.update(character_id, { xp: (ch2.xp || 0) + totalXP2 });
          }
        }
        return Response.json({ hit: saveFailed, damage: finalDmg, log_entry: saveEntry, result: result2, combat_ended: result2 !== 'ongoing', actions_remaining: Math.max(0, ar2), next_turn_index: ni });
      }

      // Fall through: ranged/melee spell attacks use spellAttackBonus already set above.
      // damageBonus stays 0 for spell attacks (no ability mod added to spell damage by default).
    } else {
      // Resolve weapon: client passes weapon object, fallback to character.equipped.weapon or mainhand
      if (!weapon) {
        weapon = character.equipped?.weapon || character.equipped?.mainhand || null;
      }
      const isRanged = (weapon?.type === 'ranged');
      const isFinesse = (weapon?.properties || []).some(p => typeof p === 'string' && p.toLowerCase() === 'finesse')
        || ['rapier','shortsword','dagger','hand crossbow','whip','scimitar'].includes((weapon?.name || '').toLowerCase());
      const strMod = statMod(character.strength);
      const dexMod = statMod(character.dexterity);
      // Reassign weapon variable stubs for old code below to work
      if (false) {
      // Ranged weapons use DEX; finesse uses best of STR/DEX; melee uses STR
      const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
      const profBonus = character.proficiency_bonus || 2;
      attackMod = abilityMod + profBonus + (weapon.attack_bonus || 0);
      damageBonus = abilityMod + (weapon.damage_bonus || 0);
      damageDice = weapon.damage_dice || '1d8';
      attackType = isRanged ? 'ranged' : 'melee';

      // Apply Fighting Style bonuses
      const fightingStyle = character.fighting_style?.toLowerCase();
      if (fightingStyle === 'archery' && isRanged) attackMod += 2;
      if (fightingStyle === 'dueling' && !character.equipped?.shield) damageBonus += 2;

      // Barbarian Rage
      if (modifiers.rage && !isRanged) {
        const level = character.level || 1;
        const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
        damageBonus += rageDamage;
      }

      // Rogue Sneak Attack (if active and conditions met)
      if (modifiers.sneak_attack_ready && character.class === 'Rogue') {
        const sneakDice = Math.ceil((character.level || 1) / 2);
        extraDamageDice.push({ dice: `${sneakDice}d6`, type: 'sneak', label: 'Sneak Attack' });
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

    // Condition checks
    const conditions = (character.conditions || []).map(c => c.name || c);
    if (conditions.includes('poisoned')) attackMod -= 2;

    // Target modifiers (cover, etc)
    let targetACBonus = 0;
    if (modifiers.half_cover) targetACBonus += 2;
    if (modifiers.three_quarters_cover) targetACBonus += 5;

    const totalAttack = attackRoll + attackMod;
    let hit = !isMiss && (isCritical || totalAttack >= (target.ac + targetACBonus));

    let damage = 0;
    let damageRolls = [];
    const isSpellAttack = !!spell;
    const logEntry = { round: combatLog.round, actor: character.name, action: isSpellAttack ? 'spell' : 'attack', target: target.name, spell_name: spell?.name || null };

    if (hit) {
      const dMatch = damageDice.match(/^(\d+)d(\d+)$/);
      let numDice = isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
      const sides = parseInt(dMatch[2]);

      // Brutal Critical (Barbarian 9+) - add extra crit dice
      if (isCritical && character.class === 'Barbarian') {
        const level = character.level || 1;
        if (level >= 9) numDice += 1;
        if (level >= 13) numDice += 1;
        if (level >= 17) numDice += 1;
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
        const slots = character.spell_slots || {};
        let smiteLevel = 0;
        for (let i = 1; i <= 5; i++) {
          const key = `level_${i}`;
          const used = slots[key] || 0;
          // Available if fewer than 4 used at this level (conservative safe max for half-casters)
          if (used < 4) {
            smiteLevel = i;
            break;
          }
        }
        if (smiteLevel > 0) {
          // Divine Smite: 2d8 + 1d8 per slot level above 1st, max 5d8 total (cap at slot level 4)
          const effectiveLevel = Math.min(smiteLevel, 4);
          const smiteDice = 1 + effectiveLevel; // 2d8 at level 1, up to 5d8 at level 4+
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

      damage = Math.max(0, damage);

      target.hp_current = Math.max(0, target.hp_current - damage);
      if (target.hp_current === 0) target.is_conscious = false;

      logEntry.hit = true;
      logEntry.critical = isCritical;
      logEntry.attack_roll = totalAttack;
      logEntry.damage = damage;
      logEntry.damage_rolls = damageRolls;
      const actionLabel = spell ? `casts ${spell.name} at` : (isCritical ? 'CRITICALLY strikes' : 'hits');
      logEntry.text = `${character.name} ${actionLabel} ${target.name} for ${damage} ${spell?.damage_type || ''} damage! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`;
    } else {
      logEntry.hit = false;
      logEntry.attack_roll = totalAttack;
      const missLabel = spell ? `${spell.name} misses` : 'misses';
      logEntry.text = `${character.name} ${missLabel} ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`;
    }

    const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
    const updatedLog = [...(combatLog.log_entries || []), logEntry];

    // Check combat end
    const allEnemiesDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
    let result = 'ongoing';
    if (allEnemiesDead) result = 'victory';
    if (playerDead) result = 'defeat';

    // Track actions used this turn in the combat log's world_state
    const actionsPerTurn = getActionsPerTurn(character);
    const currentActionsUsed = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
    const actionsRemaining = actionsPerTurn - currentActionsUsed;

    // Advance turn only if all actions for this turn are exhausted
    let nextIndex = combatLog.current_turn_index;
    let nextRound = combatLog.round;
    let newWorldState = { ...(combatLog.world_state || {}), actions_used_this_turn: currentActionsUsed };

    if (result !== 'ongoing' || actionsRemaining <= 0) {
      // Move to next combatant
      if (result === 'ongoing') {
        nextIndex = (combatLog.current_turn_index + 1) % updatedCombatants.length;
        if (nextIndex === 0) nextRound += 1;
        // Skip dead combatants
        let safety = 0;
        while (!updatedCombatants[nextIndex]?.is_conscious && safety < updatedCombatants.length) {
          nextIndex = (nextIndex + 1) % updatedCombatants.length;
          if (nextIndex === 0) nextRound += 1;
          safety++;
        }
      }
      newWorldState.actions_used_this_turn = 0; // reset for next turn
    }

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: updatedLog,
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: newWorldState,
      is_active: result === 'ongoing',
      result
    });

    if (result !== 'ongoing') {
      await base44.entities.GameSession.update(session_id, { in_combat: false });
      if (result === 'victory') {
        const totalXP = updatedCombatants.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
        const ch = await base44.entities.Character.get(character_id);
        await base44.entities.Character.update(character_id, { xp: (ch.xp || 0) + totalXP });
      }
    }

    return Response.json({
      hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
      target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
      next_turn_index: nextIndex,
      actions_remaining: actionsRemaining > 0 ? actionsRemaining : 0,
      actions_per_turn: actionsPerTurn
    });
  }

  if (action === 'enemy_turn') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];

    // Find current enemy turn
    const currentCombatant = combatants[combatLog.current_turn_index];
    if (!currentCombatant || currentCombatant.type !== 'enemy' || !currentCombatant.is_conscious) {
      return Response.json({ skipped: true });
    }

    // Enemy attacks player
    const player = combatants.find(c => c.type === 'player');
    if (!player || !player.is_conscious) {
      // Player is dead/unconscious - skip enemy turn
      return Response.json({ no_target: true, player_unconscious: true });
    }

    // === AI Strategy System ===
    const enemyHpPct = currentCombatant.hp_max ? currentCombatant.hp_current / currentCombatant.hp_max : 1;
    const playerHpPct = player.hp_max ? player.hp_current / player.hp_max : 1;
    const cr = currentCombatant.cr || 1;
    const isBoss = cr >= 5;
    const isElite = cr >= 3;

    // Determine AI strategy based on enemy state
    let strategy = 'attack'; // default
    let strategyDesc = null;

    if (enemyHpPct < 0.25 && !currentCombatant.has_fled_attempt) {
      // Low HP: desperate behavior
      if (isBoss) {
        strategy = 'multiattack'; // bosses fight to the death with fury
        strategyDesc = 'fights with desperate fury!';
      } else if (cr < 2 && Math.random() < 0.4) {
        strategy = 'retreat';
        strategyDesc = 'attempts to retreat!';
      } else {
        strategy = 'reckless_attack';
        strategyDesc = 'attacks recklessly in desperation!';
      }
    } else if (playerHpPct < 0.3) {
      strategy = 'press_advantage';
      strategyDesc = 'presses the advantage against the weakened hero!';
    } else if (isBoss && combatLog.round <= 1) {
      strategy = 'intimidate_then_attack';
      strategyDesc = 'sizes up the hero with cold calculation...';
    } else if (isElite && Math.random() < 0.3) {
      strategy = 'tactical_strike';
      strategyDesc = 'uses a tactical strike!';
    } else if (Math.random() < 0.15) {
      strategy = 'defensive_stance';
      strategyDesc = 'takes a defensive stance before attacking!';
    }

    let attackBonus = currentCombatant.attack_bonus || 3;
    let targetAC = player.ac;
    let numAttacks = 1;
    let bonusDamage = 0;

    // Apply strategy effects
    if (strategy === 'reckless_attack') {
      attackBonus += 3; // advantage-like bonus
      bonusDamage += 2;
    } else if (strategy === 'press_advantage') {
      attackBonus += 2;
      bonusDamage += 1;
    } else if (strategy === 'multiattack') {
      numAttacks = isBoss ? 3 : 2;
    } else if (strategy === 'tactical_strike') {
      attackBonus += 1;
      bonusDamage += Math.floor(cr);
    } else if (strategy === 'defensive_stance') {
      attackBonus -= 2; // trades accuracy for positioning
    }

    let totalDamage = 0;
    let anyHit = false;
    let isCritical = false;
    const attackLogs = [];

    for (let atk = 0; atk < numAttacks; atk++) {
      const attackRoll = rollD20();
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
          totalDamage += dmg;
          attackLogs.push(`${isCrit ? '💥 CRITICAL! ' : ''}${currentCombatant.name} hits for ${dmg} dmg (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
        }
      } else {
        attackLogs.push(`${currentCombatant.name} misses (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
      }
    }

    // Apply total damage to player
    if (totalDamage > 0) {
      player.hp_current = Math.max(0, player.hp_current - totalDamage);
      if (player.hp_current === 0) player.is_conscious = false;
      await base44.entities.Character.update(player.id, { hp_current: player.hp_current });
    }

    // Build log entry
    let logText = '';
    if (strategyDesc) logText += `[${currentCombatant.name} ${strategyDesc}] `;
    if (anyHit) {
      logText += attackLogs.join('; ') + `. ${player.name} takes ${totalDamage} total damage! (${player.hp_current}/${player.hp_max} HP)`;
      if (!player.is_conscious) logText += ` ${player.name} falls!`;
    } else {
      logText = `${strategyDesc ? `[${currentCombatant.name} ${strategyDesc}] ` : ''}${currentCombatant.name} attacks but misses ${player.name}! (${attackLogs.join('; ')})`;
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

    // Advance turn — use UPDATED combatants (player HP may have changed)
    let nextIndex = (combatLog.current_turn_index + 1) % updatedCombatants.length;
    let round = combatLog.round;
    if (nextIndex === 0) round += 1;
    // Skip dead combatants
    let safety = 0;
    while (!updatedCombatants[nextIndex]?.is_conscious && safety < updatedCombatants.length) {
      nextIndex = (nextIndex + 1) % updatedCombatants.length;
      if (nextIndex === 0) round += 1;
      safety++;
    }

    const updatedCombatants = combatants.map(c => c.id === player.id ? player : c);
    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round,
      world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0 }
    });

    const playerAtZero = !player.is_conscious;
    if (playerAtZero && player.hp_current === 0) {
      // Don't end combat immediately - let death saves play out
      // Only mark as defeat if death saves are failed (handled elsewhere)
    }

    return Response.json({ log_entry: logEntry, player_hp: player.hp_current, player_at_zero_hp: playerAtZero, next_turn_index: nextIndex, round, ai_strategy: strategy });
  }

  if (action === 'next_turn') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = combatLog.combatants;
    let nextIndex = (combatLog.current_turn_index + 1) % combatants.length;
    let round = combatLog.round;
    if (nextIndex === 0) round += 1;
    // Skip unconscious/dead combatants
    let safety = 0;
    while (!combatants[nextIndex]?.is_conscious && safety < combatants.length) {
      nextIndex = (nextIndex + 1) % combatants.length;
      if (nextIndex === 0) round += 1;
      safety++;
    }
    await base44.entities.CombatLog.update(combat_id, { current_turn_index: nextIndex, round, world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0 } });
    return Response.json({ next_turn_index: nextIndex, round, current_combatant: combatants[nextIndex] });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});