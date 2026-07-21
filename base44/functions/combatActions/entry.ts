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

  // ─── SECOND WIND (Fighter, PHB p.72) ────────────────────────────────────────
  // Bonus action: regain 1d10 + fighter level HP. Once per short rest.
  if (action === 'second_wind') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if ((character.class || '').toLowerCase() !== 'fighter') {
      return Response.json({ error: 'Second Wind requires Fighter class.', invalid: true }, { status: 400 });
    }
    const level = character.level || 1;
    const sra = character.short_rest_abilities || {};
    if (sra.second_wind_used) {
      return Response.json({ error: 'Second Wind already used. Short rest to recover.', invalid: true }, { status: 400 });
    }
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }
    const healAmount = rollDice(10) + level;
    const newHp = Math.min(character.hp_max || 1, (character.hp_current || 0) + healAmount);
    await base44.entities.Character.update(character_id, {
      hp_current: newHp,
      short_rest_abilities: { ...sra, second_wind_used: true },
    });
    const combatants = [...(combatLog.combatants || [])];
    const playerComp = combatants.find(c => c.type === 'player');
    if (playerComp) { playerComp.hp_current = newHp; }
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'second_wind',
      text: `💨 ${character.name} uses Second Wind and heals ${healAmount} HP! (now ${newHp}/${character.hp_max})`
    };
    const ws = { ...(combatLog.world_state || {}), bonus_action_used: true };
    await base44.entities.CombatLog.update(combat_id, {
      combatants: playerComp ? combatants.map(c => c.type === 'player' ? playerComp : c) : combatLog.combatants,
      log_entries: [...(combatLog.log_entries || []), logEntry], world_state: ws,
    });
    return Response.json({ success: true, heal_amount: healAmount, new_hp: newHp, log_entry: logEntry, bonus_action_used: true });
  }

  // ─── CHANNEL DIVINITY: TURN UNDEAD (Cleric L2, PHB p.59) ───────────────────
  // Action: each undead within 30ft makes WIS save or is turned (flee) for 1 min.
  // Undead with CR ≤ floor(cleric level / 2) are destroyed outright.
  if (action === 'channel_divinity_turn_undead') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const level = character.level || 1;
    if ((character.class || '') !== 'Cleric' || level < 2) {
      return Response.json({ error: 'Channel Divinity requires Cleric level 2+.', invalid: true }, { status: 400 });
    }
    const maxCD = level >= 18 ? 3 : level >= 6 ? 2 : 1;
    const sra = character.short_rest_abilities || {};
    const cdUsed = sra.channel_divinity_used || 0;
    if (cdUsed >= maxCD) {
      return Response.json({ error: `Channel Divinity exhausted (${maxCD}/${maxCD}). Short rest to recover.`, invalid: true }, { status: 400 });
    }
    const turnDC = 8 + statMod(character.wisdom || 10) + (character.proficiency_bonus || 2);
    const destroyCR = Math.floor(level / 2);
    const combatants = [...(combatLog.combatants || [])];
    const targets = combatants.filter(c => c.type === 'enemy' && c.is_conscious);
    const hitLogs = [];
    let turned = 0;
    for (const target of targets) {
      const targetType = (target.type_tag || target.meta || target.creature_type || target.name || '').toLowerCase();
      if (!/undead|zombie|skeleton|ghoul|wight|wraith|specter|ghost|vampire|lich|mummy|revenant|banshee/.test(targetType)) continue;
      const saveRoll = rollD20() + statMod(target.wisdom || 10);
      if (saveRoll >= turnDC) { hitLogs.push(`${target.name}: saved (${saveRoll} vs DC ${turnDC})`); continue; }
      const cr = target.cr || 0;
      if (cr > 0 && cr <= destroyCR) {
        target.hp_current = 0; target.is_conscious = false;
        hitLogs.push(`${target.name}: DESTROYED! (CR ${cr} ≤ ${destroyCR})`);
      } else {
        const existing = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
        if (!existing.includes('turned')) {
          target.conditions = [...(target.conditions || []), { name: 'turned', source: 'Turn Undead', save_dc: turnDC, save_ability: 'wisdom', caster: character.name }];
        }
        turned++;
        hitLogs.push(`${target.name}: TURNED (will flee)`);
      }
    }
    await base44.entities.Character.update(character_id, { short_rest_abilities: { ...sra, channel_divinity_used: cdUsed + 1 } });
    const updatedCombatants = combatants.map(c => { const u = targets.find(t => t.id === c.id); return u || c; });
    const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const result = allDead ? 'victory' : 'ongoing';
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'channel_divinity_turn_undead',
      text: `✨ ${character.name} channels divine energy to Turn Undead! ${hitLogs.length > 0 ? hitLogs.join('; ') : 'No undead in range.'}${turned > 0 ? ` ${turned} undead turned!` : ''}`
    };
    const ws = { ...(combatLog.world_state || {}), actions_used_this_turn: (combatLog.world_state?.actions_used_this_turn || 0) + 1 };
    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants, log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: ws, is_active: result === 'ongoing', result,
    });
    if (allDead) await base44.entities.GameSession.update(session_id, { in_combat: false });
    return Response.json({ success: true, log_entry: logEntry, turned, result, combat_ended: result !== 'ongoing', uses_remaining: maxCD - (cdUsed + 1) });
  }

  // ─── CHANNEL DIVINITY: GUIDED STRIKE (Cleric L2, PHB p.59) ──────────────────
  // Does NOT consume an action: gain +10 to your next attack roll this turn.
  if (action === 'channel_divinity_guided_strike') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const level = character.level || 1;
    if ((character.class || '') !== 'Cleric' || level < 2) {
      return Response.json({ error: 'Channel Divinity requires Cleric level 2+.', invalid: true }, { status: 400 });
    }
    const maxCD = level >= 18 ? 3 : level >= 6 ? 2 : 1;
    const sra = character.short_rest_abilities || {};
    const cdUsed = sra.channel_divinity_used || 0;
    if (cdUsed >= maxCD) {
      return Response.json({ error: 'Channel Divinity exhausted.', invalid: true }, { status: 400 });
    }
    await base44.entities.Character.update(character_id, { short_rest_abilities: { ...sra, channel_divinity_used: cdUsed + 1 } });
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'channel_divinity_guided_strike',
      text: `✨ ${character.name} uses Channel Divinity: Guided Strike — +10 to next attack roll!`
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), guided_strike_bonus: 10 },
    });
    return Response.json({ success: true, log_entry: logEntry, uses_remaining: maxCD - (cdUsed + 1) });
  }

  // ─── CHANNEL DIVINITY: PRESERVE LIFE (Cleric L2, PHB p.60) ─────────────────
  // Action: restore HP to creatures within 30ft. Pool = 5 × cleric level.
  // No target heals above half their max HP.
  if (action === 'channel_divinity_preserve_life') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const level = character.level || 1;
    if ((character.class || '') !== 'Cleric' || level < 2) {
      return Response.json({ error: 'Channel Divinity requires Cleric level 2+.', invalid: true }, { status: 400 });
    }
    const maxCD = level >= 18 ? 3 : level >= 6 ? 2 : 1;
    const sra = character.short_rest_abilities || {};
    const cdUsed = sra.channel_divinity_used || 0;
    if (cdUsed >= maxCD) {
      return Response.json({ error: 'Channel Divinity exhausted.', invalid: true }, { status: 400 });
    }
    const healPool = 5 * level;
    const combatants = [...(combatLog.combatants || [])];
    const allies = combatants.filter(c => c.type !== 'enemy' && c.is_conscious && c.hp_current < c.hp_max);
    let remaining = healPool;
    const healLogs = [];
    for (const ally of allies) {
      if (remaining <= 0) break;
      const halfMax = Math.floor(ally.hp_max / 2);
      const maxHeal = Math.max(0, Math.min(remaining, halfMax - ally.hp_current, ally.hp_max - ally.hp_current));
      if (maxHeal <= 0) continue;
      ally.hp_current = Math.min(ally.hp_max, ally.hp_current + maxHeal);
      remaining -= maxHeal;
      healLogs.push(`${ally.name}: +${maxHeal} HP`);
    }
    const playerComp = combatants.find(c => c.type === 'player');
    if (playerComp) await base44.entities.Character.update(character_id, { hp_current: playerComp.hp_current, short_rest_abilities: { ...sra, channel_divinity_used: cdUsed + 1 } });
    else await base44.entities.Character.update(character_id, { short_rest_abilities: { ...sra, channel_divinity_used: cdUsed + 1 } });
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'channel_divinity_preserve_life',
      text: `✨ ${character.name} uses Channel Divinity: Preserve Life! Pool: ${healPool} HP. ${healLogs.length > 0 ? healLogs.join('; ') : 'No allies needed healing.'}`
    };
    const ws = { ...(combatLog.world_state || {}), actions_used_this_turn: (combatLog.world_state?.actions_used_this_turn || 0) + 1 };
    await base44.entities.CombatLog.update(combat_id, {
      combatants, log_entries: [...(combatLog.log_entries || []), logEntry], world_state: ws,
    });
    return Response.json({ success: true, log_entry: logEntry, heal_pool: healPool, uses_remaining: maxCD - (cdUsed + 1) });
  }

  return Response.json({ error: 'Unknown action. Use: companion_turn | breath_weapon | second_wind | channel_divinity_turn_undead | channel_divinity_guided_strike | channel_divinity_preserve_life' }, { status: 400 });
});