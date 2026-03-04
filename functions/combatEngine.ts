import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
    const session = sessions[0];
    const chars = await base44.asServiceRole.entities.Character.filter({ id: session.character_id });
    const character = chars[0];

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
      combatants.push({
        id: `enemy_${Math.random().toString(36).substr(2, 9)}`,
        name: enemy.name,
        type: 'enemy',
        initiative_roll: initRoll,
        initiative_mod: initMod,
        initiative_total: initRoll + initMod,
        hp_current: enemy.hp,
        hp_max: enemy.hp,
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

    const combatLog = await base44.asServiceRole.entities.CombatLog.create({
      session_id,
      round: 1,
      combatants,
      initiative_order: combatants.map(c => ({ id: c.id, name: c.name, initiative: c.initiative_total })),
      current_turn_index: 0,
      log_entries: [{ round: 1, text: `Combat begins! Initiative order: ${combatants.map(c => `${c.name} (${c.initiative_total})`).join(', ')}` }],
      is_active: true,
      result: 'ongoing'
    });

    await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: true, combat_state: { combat_id: combatLog.id } });

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
    const { target_id, weapon, spell } = payload;
    const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
    const combatLog = logs[0];
    const chars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
    const character = chars[0];

    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    let attackRoll = rollD20();
    let attackMod = 0;
    let damageDice = '1d6';
    let damageBonus = 0;
    let attackType = 'melee';
    let isCritical = attackRoll === 20;
    let isMiss = attackRoll === 1;

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
      damageBonus = 0;
      attackType = spell.attack_type || 'ranged_spell_attack';

      // Handle upcast damage bonus (each slot level above base adds dice)
      const slotLevel = spell.slot_level || spell.base_level || 1;
      const baseLevel = spell.base_level || 1;
      const upcasting = slotLevel > baseLevel;

      // Use slot on cast (track in character spell_slots)
      if (spell.slot_level && spell.slot_level > 0) {
        const slotsKey = `level_${spell.slot_level}`;
        const currentUsed = (character.spell_slots || {})[slotsKey] || 0;
        await base44.asServiceRole.entities.Character.update(character_id, {
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
        await base44.asServiceRole.entities.CombatLog.update(combat_id, {
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
          await base44.asServiceRole.entities.Character.update(character_id, { hp_current: player2.hp_current });
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
        await base44.asServiceRole.entities.CombatLog.update(combat_id, {
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
        await base44.asServiceRole.entities.CombatLog.update(combat_id, {
          combatants: updatedC, log_entries: [...(combatLog.log_entries || []), saveEntry],
          current_turn_index: ni, round: nr, world_state: ws, is_active: result2 === 'ongoing', result: result2
        });
        if (result2 !== 'ongoing') {
          await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false });
          if (result2 === 'victory') {
            const totalXP2 = updatedC.filter(c => c.type === 'enemy').reduce((s2, e) => s2 + (e.xp || 0), 0);
            const ch2 = (await base44.asServiceRole.entities.Character.filter({ id: character_id }))[0];
            await base44.asServiceRole.entities.Character.update(character_id, { xp: (ch2.xp || 0) + totalXP2 });
          }
        }
        return Response.json({ hit: saveFailed, damage: finalDmg, log_entry: saveEntry, result: result2, combat_ended: result2 !== 'ongoing', actions_remaining: Math.max(0, ar2), next_turn_index: ni });
      }

      // Fall through to normal ranged/melee spell attack
    } else if (weapon) {
      const isRanged = weapon.type === 'ranged';
      const isFinesse = (weapon.properties || []).includes('finesse');
      const strMod = statMod(character.strength);
      const dexMod = statMod(character.dexterity);
      // Ranged weapons use DEX; finesse uses best of STR/DEX; melee uses STR
      const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
      const profBonus = character.proficiency_bonus || 2;
      attackMod = abilityMod + profBonus + (weapon.attack_bonus || 0);
      damageBonus = abilityMod + (weapon.damage_bonus || 0);
      damageDice = weapon.damage_dice || '1d8';
      attackType = isRanged ? 'ranged' : 'melee';
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

    const totalAttack = attackRoll + attackMod;
    let hit = !isMiss && (isCritical || totalAttack >= target.ac);

    let damage = 0;
    let damageRolls = [];
    const logEntry = { round: combatLog.round, actor: character.name, action: 'attack', target: target.name };

    if (hit) {
      const dMatch = damageDice.match(/^(\d+)d(\d+)$/);
      const numDice = isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
      const sides = parseInt(dMatch[2]);
      for (let i = 0; i < numDice; i++) {
        const r = rollDice(sides);
        damageRolls.push(r);
        damage += r;
      }
      damage += damageBonus;
      damage = Math.max(0, damage);

      target.hp_current = Math.max(0, target.hp_current - damage);
      if (target.hp_current === 0) target.is_conscious = false;

      logEntry.hit = true;
      logEntry.critical = isCritical;
      logEntry.attack_roll = totalAttack;
      logEntry.damage = damage;
      logEntry.damage_rolls = damageRolls;
      logEntry.text = `${character.name} ${isCritical ? 'CRITICALLY ' : ''}hits ${target.name} for ${damage} damage! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`;
    } else {
      logEntry.hit = false;
      logEntry.attack_roll = totalAttack;
      logEntry.text = `${character.name} misses ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`;
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

    await base44.asServiceRole.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: updatedLog,
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: newWorldState,
      is_active: result === 'ongoing',
      result
    });

    if (result !== 'ongoing') {
      await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false });
      if (result === 'victory') {
        const totalXP = updatedCombatants.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
        const chars2 = await base44.asServiceRole.entities.Character.filter({ id: character_id });
        const ch = chars2[0];
        await base44.asServiceRole.entities.Character.update(character_id, { xp: (ch.xp || 0) + totalXP });
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
    const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
    const combatLog = logs[0];
    const combatants = [...combatLog.combatants];
    const logEntries = [];

    // Find current enemy turn
    const currentCombatant = combatants[combatLog.current_turn_index];
    if (!currentCombatant || currentCombatant.type !== 'enemy' || !currentCombatant.is_conscious) {
      return Response.json({ skipped: true });
    }

    // Enemy attacks player
    const player = combatants.find(c => c.type === 'player' && c.is_conscious);
    if (!player) return Response.json({ no_target: true });

    const attackRoll = rollD20();
    const totalAttack = attackRoll + (currentCombatant.attack_bonus || 3);
    const hit = attackRoll !== 1 && (attackRoll === 20 || totalAttack >= player.ac);
    let damage = 0;

    const logEntry = { round: combatLog.round, actor: currentCombatant.name, action: 'attack', target: player.name };

    if (hit) {
      const dMatch = (currentCombatant.damage_dice || '1d6').match(/^(\d+)d(\d+)$/);
      const numDice = attackRoll === 20 ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
      const sides = parseInt(dMatch[2]);
      for (let i = 0; i < numDice; i++) damage += rollDice(sides);
      damage += (currentCombatant.damage_bonus || 0);
      damage = Math.max(1, damage);
      player.hp_current = Math.max(0, player.hp_current - damage);
      if (player.hp_current === 0) player.is_conscious = false;
      logEntry.hit = true;
      logEntry.damage = damage;
      logEntry.text = `${currentCombatant.name} hits ${player.name} for ${damage} damage! (${player.hp_current}/${player.hp_max} HP)`;

      // Update actual character HP in DB
      await base44.asServiceRole.entities.Character.update(player.id, { hp_current: player.hp_current });
    } else {
      logEntry.hit = false;
      logEntry.text = `${currentCombatant.name} misses ${player.name}!`;
    }

    // Advance turn
    const nextIndex = (combatLog.current_turn_index + 1) % combatants.length;
    let round = combatLog.round;
    if (nextIndex === 0) round += 1;

    const updatedCombatants = combatants.map(c => c.id === player.id ? player : c);
    await base44.asServiceRole.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round
    });

    const playerDead = !player.is_conscious;
    if (playerDead) {
      await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false });
      await base44.asServiceRole.entities.CombatLog.update(combat_id, { is_active: false, result: 'defeat' });
    }

    return Response.json({ log_entry: logEntry, player_hp: player.hp_current, player_dead: playerDead, next_turn_index: nextIndex, round });
  }

  if (action === 'next_turn') {
    const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
    const combatLog = logs[0];
    const nextIndex = (combatLog.current_turn_index + 1) % combatLog.combatants.length;
    let round = combatLog.round;
    if (nextIndex === 0) round += 1;
    await base44.asServiceRole.entities.CombatLog.update(combat_id, { current_turn_index: nextIndex, round });
    return Response.json({ next_turn_index: nextIndex, round, current_combatant: combatLog.combatants[nextIndex] });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});