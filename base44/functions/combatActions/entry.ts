import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Combat Actions — racial combat abilities and companion turns extracted from
// the main combatEngine to keep file sizes manageable. Each action reads/writes
// the same CombatLog record that combatEngine uses.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, combat_id, session_id, character_id, payload } = await req.json();

  const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
  const rollD20 = () => Math.floor(Math.random() * 20) + 1;
  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;
  const normList = (l) => Array.isArray(l) ? l.map(d => String(d || '').toLowerCase().trim()).filter(Boolean) : [];
  const applyDamageModifiers = (damage, damageType, target = {}) => {
    const type = String(damageType || '').toLowerCase().trim();
    if (!type || damage <= 0) return { amount: Math.max(0, damage), applied: null };
    if (normList(target.immunities).includes(type)) return { amount: 0, applied: 'immunity' };
    if (normList(target.resistances).includes(type)) return { amount: Math.floor(damage / 2), applied: 'resistance' };
    if (normList(target.vulnerabilities).includes(type)) return { amount: damage * 2, applied: 'vulnerability' };
    return { amount: Math.max(0, damage), applied: null };
  };
  const advanceTurn = (currentIndex, currentRound, arr) => {
    let ni = (currentIndex + 1) % arr.length;
    let nr = currentRound;
    if (ni === 0) nr++;
    let safety = 0;
    while (!arr[ni]?.is_conscious && safety < arr.length) {
      ni = (ni + 1) % arr.length;
      if (ni === 0) nr++;
      safety++;
    }
    return { nextIndex: ni, nextRound: nr };
  };

  // ─── COMPANION TURN (Beast Master Ranger, PHB p.93) ────────────────────────
  if (action === 'companion_turn') {
    const { target_id } = payload || {};
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];
    const companion = combatants[combatLog.current_turn_index];
    if (!companion || companion.type !== 'companion' || !companion.is_conscious) {
      return Response.json({ skipped: true });
    }
    const target = combatants.find(c => c.id === target_id && c.type === 'enemy' && c.is_conscious)
      || combatants.find(c => c.type === 'enemy' && c.is_conscious);
    if (!target) {
      const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
      await base44.entities.CombatLog.update(combat_id, { current_turn_index: nextIndex, round: nextRound, world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false } });
      return Response.json({ no_target: true, next_turn_index: nextIndex });
    }

    const attack = (companion.attacks || [])[0] || {};
    const atkBonus = companion.attack_bonus || 3;
    const dmgDice = attack.damage_dice || '1d6';
    const dmgBonus = attack.damage_bonus || 0;

    const roll = rollD20();
    const isCrit = roll === 20;
    const isFumble = roll === 1;
    const totalAttack = roll + atkBonus;
    const hit = !isFumble && (isCrit || totalAttack >= target.ac);

    let damage = 0;
    if (hit) {
      const dMatch = dmgDice.match(/^(\d+)d(\d+)$/);
      const numDice = dMatch ? (isCrit ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1])) : 1;
      const sides = dMatch ? parseInt(dMatch[2]) : 6;
      for (let i = 0; i < numDice; i++) damage += rollDice(sides);
      damage = Math.max(1, damage + dmgBonus);
      const dmgMod = applyDamageModifiers(damage, attack.damage_type || 'slashing', target);
      damage = dmgMod.applied === 'immunity' ? 0 : dmgMod.amount;
      target.hp_current = Math.max(0, target.hp_current - damage);
      if (target.hp_current === 0) target.is_conscious = false;
    }

    const logEntry = {
      round: combatLog.round, actor: companion.name, action: 'companion_attack', target: target.name,
      hit, critical: isCrit, damage,
      text: hit
        ? `${companion.portrait_emoji || '🐾'} ${companion.name} ${attack.name || 'attacks'} ${target.name}${isCrit ? ' (CRIT!)' : ''} for ${damage} damage! (${roll}+${atkBonus}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
        : `${companion.portrait_emoji || '🐾'} ${companion.name} ${attack.name || 'attacks'} ${target.name} but misses! (${roll}+${atkBonus}=${totalAttack} vs AC ${target.ac})`
    };

    const updatedCombatants = combatants.map(c => c.id === target.id ? target : c);
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);
    const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const result = allDead ? 'victory' : 'ongoing';
    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants, log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex, round: nextRound, is_active: result === 'ongoing', result,
      world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false },
    });
    if (allDead) {
      await base44.entities.GameSession.update(session_id, { in_combat: false });
    }

    return Response.json({ hit, damage, log_entry: logEntry, result, combat_ended: result !== 'ongoing', next_turn_index: nextIndex });
  }

  // ─── DRAGONBORN BREATH WEAPON (PHB p.34) ────────────────────────────────────
  if (action === 'breath_weapon') {
    const { target_ids } = payload || {};
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if ((character.race || '') !== 'Dragonborn') {
      return Response.json({ error: 'Breath Weapon is a Dragonborn racial trait.', invalid: true }, { status: 400 });
    }
    const sra = character.short_rest_abilities || {};
    if (sra.breath_weapon_used) {
      return Response.json({ error: 'Breath Weapon already used. Short rest to recover.', invalid: true }, { status: 400 });
    }

    const ancestry = ((character.class_choices?.dragon_ancestry) || 'red').toLowerCase();
    const ANCESTRY_MAP = {
      black: { type: 'acid', shape: 'line' }, copper: { type: 'acid', shape: 'line' },
      blue: { type: 'lightning', shape: 'line' }, bronze: { type: 'lightning', shape: 'line' },
      brass: { type: 'fire', shape: 'cone' }, gold: { type: 'fire', shape: 'cone' }, red: { type: 'fire', shape: 'cone' },
      green: { type: 'poison', shape: 'cone' },
      silver: { type: 'cold', shape: 'cone' }, white: { type: 'cold', shape: 'cone' },
    };
    const aData = ANCESTRY_MAP[ancestry] || ANCESTRY_MAP.red;
    const charLevel = character.level || 1;
    const numDice = charLevel >= 16 ? 5 : charLevel >= 11 ? 4 : charLevel >= 6 ? 3 : 2;
    const breathDC = 8 + statMod(character.constitution || 10) + (character.proficiency_bonus || 2);

    await base44.entities.Character.update(character_id, {
      short_rest_abilities: { ...sra, breath_weapon_used: true },
    });

    const combatants = [...combatLog.combatants];
    const targets = (target_ids || []).map(id => combatants.find(c => c.id === id)).filter(Boolean).filter(c => c.is_conscious);
    if (targets.length === 0) targets.push(...combatants.filter(c => c.type === 'enemy' && c.is_conscious));

    const hitLogs = [];
    for (const target of targets) {
      const saveRoll = rollD20() + statMod(target.dexterity || 10);
      const saveFailed = saveRoll < breathDC;
      let dmg = 0;
      for (let i = 0; i < numDice; i++) dmg += rollDice(6);
      let finalDmg = saveFailed ? dmg : Math.floor(dmg / 2);
      const dmgMod = applyDamageModifiers(finalDmg, aData.type, target);
      finalDmg = dmgMod.applied === 'immunity' ? 0 : dmgMod.amount;
      if (finalDmg > 0) {
        target.hp_current = Math.max(0, target.hp_current - finalDmg);
        if (target.hp_current === 0) target.is_conscious = false;
      }
      hitLogs.push(`${target.name}: ${saveFailed ? 'FAILED' : 'saved'} (${saveRoll} vs DC ${breathDC}), ${finalDmg} ${aData.type}${target.hp_current === 0 ? ' — falls!' : ''}`);
    }

    const updatedCombatants = combatants.map(c => {
      const updated = targets.find(t => t.id === c.id);
      return updated || c;
    });
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'breath_weapon',
      text: `🐉 ${character.name} unleashes their Breath Weapon (${aData.shape} of ${aData.type})! ${hitLogs.join('; ')}`,
    };

    // Breath Weapon consumes an action — advance the turn
    const ws = combatLog.world_state || {};
    const actionsUsed = (ws.actions_used_this_turn || 0) + 1;
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);
    const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const result = allDead ? 'victory' : 'ongoing';
    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants, log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex, round: nextRound, is_active: result === 'ongoing', result,
      world_state: { ...ws, actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false },
    });
    if (allDead) {
      await base44.entities.GameSession.update(session_id, { in_combat: false });
    }

    return Response.json({ hit: true, damage: numDice * 6, log_entry: logEntry, result,
      combat_ended: result !== 'ongoing', next_turn_index: nextIndex });
  }

  return Response.json({ error: 'Unknown action. Use: companion_turn | breath_weapon' }, { status: 400 });
});