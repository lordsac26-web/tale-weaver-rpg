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
      attackMod = statMod(character.intelligence) + character.proficiency_bonus;
      damageDice = spell.damage_dice || '2d6';
      damageBonus = statMod(character.intelligence);
      attackType = 'spell';
    } else if (weapon) {
      attackMod = statMod(character.strength) + character.proficiency_bonus + (weapon.attack_bonus || 0);
      damageBonus = statMod(character.strength) + (weapon.damage_bonus || 0);
      damageDice = weapon.damage_dice || '1d8';
      attackType = weapon.type === 'ranged' ? 'ranged' : 'melee';
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

    await base44.asServiceRole.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: updatedLog,
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

    return Response.json({ hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry, target_hp: target.hp_current, result, combat_ended: result !== 'ongoing' });
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