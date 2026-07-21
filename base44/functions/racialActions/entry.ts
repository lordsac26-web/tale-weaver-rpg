import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { statMod, rollD20, rollDice, condName } from '../../shared/dice.ts';

// Racial Actions — active racial abilities (Aasimar transformations, Healing Hands,
// Hungry Jaws, Fury of the Small, Draconic Cry, Shell Defense). Kept separate from
// combatActions to respect per-file size limits. Reads/writes the same CombatLog.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, combat_id, session_id, character_id, payload } = await req.json();

  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const race = character.race || '';
  const level = character.level || 1;
  const sra = character.short_rest_abilities || {};
  const lra = character.long_rest_abilities || {};

  const loadCombat = async () => (combat_id ? await base44.entities.CombatLog.get(combat_id) : null);
  const appendLog = async (combatLog, logEntry, extra = {}) => {
    if (!combatLog) return;
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry], ...extra,
    });
  };
  const bonusActionBlocked = (combatLog) => !!combatLog?.world_state?.bonus_action_used;

  // ─── AASIMAR TRANSFORMATION (Volo's p.105, level 3, 1/long rest) ────────────
  // Radiant Soul (Protector) / Radiant Consumption (Scourge) / Necrotic Shroud (Fallen).
  // Bonus action, lasts 1 minute; grants +level damage once per turn (engine rider).
  if (action === 'aasimar_transform') {
    if (race !== 'Aasimar') return Response.json({ error: 'This is an Aasimar racial trait.', invalid: true }, { status: 400 });
    if (level < 3) return Response.json({ error: 'Aasimar transformations unlock at level 3.', invalid: true }, { status: 400 });
    const sub = character.subrace || '';
    const form = sub.includes('Protector') ? 'radiant_soul'
      : sub.includes('Scourge') ? 'radiant_consumption'
      : sub.includes('Fallen') ? 'necrotic_shroud' : null;
    if (!form) return Response.json({ error: 'Transformation requires an Aasimar lineage (Protector, Scourge, or Fallen).', invalid: true }, { status: 400 });
    if (lra.aasimar_transform_used) return Response.json({ error: 'Transformation already used. Long rest to recover.', invalid: true }, { status: 400 });

    const combatLog = await loadCombat();
    if (bonusActionBlocked(combatLog)) return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });

    const charConds = (character.conditions || []).filter(c => !['radiant_soul', 'radiant_consumption', 'necrotic_shroud'].includes(condName(c)));
    await base44.entities.Character.update(character_id, {
      conditions: [...charConds, { name: form, source: 'Celestial Revelation' }],
      long_rest_abilities: { ...lra, aasimar_transform_used: true },
    });

    const FORM_LABEL = { radiant_soul: 'Radiant Soul', radiant_consumption: 'Radiant Consumption', necrotic_shroud: 'Necrotic Shroud' };
    let text = `😇 ${character.name} reveals their celestial nature — ${FORM_LABEL[form]}! (+${level} ${form === 'necrotic_shroud' ? 'necrotic' : 'radiant'} damage once per turn for 1 minute)`;
    if (form === 'radiant_soul') text += ' Luminous wings unfurl — flying speed equals walking speed.';

    if (combatLog) {
      const combatants = [...(combatLog.combatants || [])];
      const playerComp = combatants.find(c => c.type === 'player');
      if (playerComp) {
        playerComp.conditions = [...(playerComp.conditions || []).filter(c => !['radiant_soul', 'radiant_consumption', 'necrotic_shroud'].includes(condName(c))), { name: form, source: 'Celestial Revelation' }];
      }
      const hitLogs = [];

      // Necrotic Shroud: enemies within 10 ft make a CHA save or are frightened (until end of your next turn)
      if (form === 'necrotic_shroud') {
        const dc = 8 + (character.proficiency_bonus || 2) + statMod(character.charisma || 10);
        for (const target of combatants.filter(c => c.type === 'enemy' && c.is_conscious)) {
          const save = rollD20() + statMod(target.charisma || 10);
          if (save >= dc) { hitLogs.push(`${target.name}: unafraid (${save} vs DC ${dc})`); continue; }
          const existing = (target.conditions || []).map(condName);
          if (!existing.includes('frightened')) {
            target.conditions = [...(target.conditions || []), { name: 'frightened', source: 'Necrotic Shroud', save_dc: dc, save_ability: 'wisdom', caster: character.name }];
          }
          hitLogs.push(`${target.name}: FRIGHTENED (${save} vs DC ${dc})`);
        }
      }
      // Radiant Consumption: searing light — nearby enemies (and you) take ceil(level/2) radiant on activation
      if (form === 'radiant_consumption') {
        const aura = Math.ceil(level / 2);
        for (const target of combatants.filter(c => c.type === 'enemy' && c.is_conscious)) {
          target.hp_current = Math.max(0, target.hp_current - aura);
          if (target.hp_current === 0) target.is_conscious = false;
          hitLogs.push(`${target.name}: ${aura} radiant${target.hp_current === 0 ? ' — falls!' : ''}`);
        }
        if (playerComp) {
          playerComp.hp_current = Math.max(1, playerComp.hp_current - aura);
          await base44.entities.Character.update(character_id, { hp_current: playerComp.hp_current });
          hitLogs.push(`${character.name} is seared for ${aura} radiant by their own light`);
        }
      }
      if (hitLogs.length > 0) text += ` ${hitLogs.join('; ')}`;

      const logEntry = { round: combatLog.round, actor: character.name, action: 'aasimar_transform', text };
      await base44.entities.CombatLog.update(combat_id, {
        combatants,
        log_entries: [...(combatLog.log_entries || []), logEntry],
        world_state: { ...(combatLog.world_state || {}), bonus_action_used: true },
      });
      return Response.json({ success: true, form, log_entry: logEntry, bonus_action_used: true });
    }
    return Response.json({ success: true, form, message: text });
  }

  // ─── HEALING HANDS (Aasimar, Volo's p.105) ──────────────────────────────────
  // Action: touch heal = your level. 1/long rest. (Solo play: heals yourself.)
  if (action === 'healing_hands') {
    if (race !== 'Aasimar') return Response.json({ error: 'Healing Hands is an Aasimar racial trait.', invalid: true }, { status: 400 });
    if (lra.healing_hands_used) return Response.json({ error: 'Healing Hands already used. Long rest to recover.', invalid: true }, { status: 400 });
    const healAmount = level;
    const newHp = Math.min(character.hp_max || 1, (character.hp_current || 0) + healAmount);
    await base44.entities.Character.update(character_id, {
      hp_current: newHp,
      long_rest_abilities: { ...lra, healing_hands_used: true },
    });
    const combatLog = await loadCombat();
    const logEntry = { round: combatLog?.round || 0, actor: character.name, action: 'healing_hands', text: `✨ ${character.name} uses Healing Hands — heals ${newHp - (character.hp_current || 0)} HP! (now ${newHp}/${character.hp_max})` };
    if (combatLog) {
      const combatants = (combatLog.combatants || []).map(c => c.type === 'player' ? { ...c, hp_current: newHp } : c);
      const ws = { ...(combatLog.world_state || {}), actions_used_this_turn: (combatLog.world_state?.actions_used_this_turn || 0) + 1 };
      await base44.entities.CombatLog.update(combat_id, {
        combatants, log_entries: [...(combatLog.log_entries || []), logEntry], world_state: ws,
      });
    }
    return Response.json({ success: true, heal_amount: newHp - (character.hp_current || 0), new_hp: newHp, log_entry: logEntry });
  }

  // ─── HUNGRY JAWS (Lizardfolk, Volo's p.113) ─────────────────────────────────
  // Bonus action: bite attack (1d6 + STR piercing); on hit gain temp HP = CON mod (min 1). 1/short rest.
  if (action === 'hungry_jaws') {
    if (race !== 'Lizardfolk') return Response.json({ error: 'Hungry Jaws is a Lizardfolk racial trait.', invalid: true }, { status: 400 });
    if (sra.hungry_jaws_used) return Response.json({ error: 'Hungry Jaws already used. Short rest to recover.', invalid: true }, { status: 400 });
    const combatLog = await loadCombat();
    if (!combatLog) return Response.json({ error: 'Hungry Jaws can only be used in combat.', invalid: true }, { status: 400 });
    if (bonusActionBlocked(combatLog)) return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });

    const combatants = [...(combatLog.combatants || [])];
    const target = combatants.find(c => c.id === payload?.target_id && c.type === 'enemy' && c.is_conscious)
      || combatants.find(c => c.type === 'enemy' && c.is_conscious);
    if (!target) return Response.json({ error: 'No conscious target.', invalid: true }, { status: 400 });

    const strM = statMod(character.strength || 10);
    const atkMod = strM + (character.proficiency_bonus || 2);
    const roll = rollD20();
    const isCrit = roll === 20;
    const hit = roll !== 1 && (isCrit || roll + atkMod >= target.ac);
    let damage = 0;
    let tempGained = 0;
    if (hit) {
      damage = Math.max(1, rollDice(6) + (isCrit ? rollDice(6) : 0) + strM);
      target.hp_current = Math.max(0, target.hp_current - damage);
      if (target.hp_current === 0) target.is_conscious = false;
      // Temp HP doesn't stack — keep the higher value (PHB p.198)
      tempGained = Math.max(1, statMod(character.constitution || 10));
      await base44.entities.Character.update(character_id, {
        temp_hp: Math.max(character.temp_hp || 0, tempGained),
        short_rest_abilities: { ...sra, hungry_jaws_used: true },
      });
    } else {
      await base44.entities.Character.update(character_id, { short_rest_abilities: { ...sra, hungry_jaws_used: true } });
    }
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'hungry_jaws', target: target.name, hit, critical: isCrit, damage,
      text: hit
        ? `🦎 ${character.name} lunges with Hungry Jaws${isCrit ? ' (CRIT!)' : ''} — ${damage} piercing to ${target.name}, feeding on the strike (+${tempGained} temp HP)! (${roll}+${atkMod} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ''}`
        : `🦎 ${character.name}'s Hungry Jaws snap shut on empty air! (${roll}+${atkMod} vs AC ${target.ac})`,
    };
    const updated = combatants.map(c => c.id === target.id ? target : c);
    const allDead = updated.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    await base44.entities.CombatLog.update(combat_id, {
      combatants: updated, log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), bonus_action_used: true },
      ...(allDead ? { is_active: false, result: 'victory' } : {}),
    });
    if (allDead) await base44.entities.GameSession.update(session_id, { in_combat: false });
    return Response.json({ success: true, hit, damage, temp_hp: tempGained, log_entry: logEntry, result: allDead ? 'victory' : 'ongoing', combat_ended: allDead, bonus_action_used: true });
  }

  // ─── FURY OF THE SMALL (Goblin, Volo's p.119) ───────────────────────────────
  // No action: prime +level bonus damage for your next damaging hit. 1/short rest.
  if (action === 'fury_of_the_small') {
    if (race !== 'Goblin') return Response.json({ error: 'Fury of the Small is a Goblin racial trait.', invalid: true }, { status: 400 });
    if (sra.fury_of_the_small_used) return Response.json({ error: 'Fury of the Small already used. Short rest to recover.', invalid: true }, { status: 400 });
    const combatLog = await loadCombat();
    if (!combatLog) return Response.json({ error: 'Fury of the Small can only be used in combat.', invalid: true }, { status: 400 });
    await base44.entities.Character.update(character_id, { short_rest_abilities: { ...sra, fury_of_the_small_used: true } });
    const logEntry = { round: combatLog.round, actor: character.name, action: 'fury_of_the_small', text: `😤 ${character.name} channels Fury of the Small — their next hit deals +${level} bonus damage!` };
    await appendLog(combatLog, logEntry, { world_state: { ...(combatLog.world_state || {}), fury_primed: true } });
    return Response.json({ success: true, log_entry: logEntry, bonus_damage: level });
  }

  // ─── DRACONIC CRY (Kobold, MotM) ────────────────────────────────────────────
  // Bonus action: you have advantage on attacks against nearby enemies until your next turn. 1/short rest.
  if (action === 'draconic_cry') {
    if (race !== 'Kobold') return Response.json({ error: 'Draconic Cry is a Kobold racial trait.', invalid: true }, { status: 400 });
    if (sra.draconic_cry_used) return Response.json({ error: 'Draconic Cry already used. Short rest to recover.', invalid: true }, { status: 400 });
    const combatLog = await loadCombat();
    if (!combatLog) return Response.json({ error: 'Draconic Cry can only be used in combat.', invalid: true }, { status: 400 });
    if (bonusActionBlocked(combatLog)) return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    await base44.entities.Character.update(character_id, { short_rest_abilities: { ...sra, draconic_cry_used: true } });
    const logEntry = { round: combatLog.round, actor: character.name, action: 'draconic_cry', text: `🐉 ${character.name} lets out a Draconic Cry — advantage on attacks against nearby enemies this turn!` };
    await appendLog(combatLog, logEntry, { world_state: { ...(combatLog.world_state || {}), draconic_cry_active: true, bonus_action_used: true } });
    return Response.json({ success: true, log_entry: logEntry, bonus_action_used: true });
  }

  // ─── SHELL DEFENSE (Tortle, TP p.4) ─────────────────────────────────────────
  // Enter (bonus action): AC 19, speed 0, can't act until you emerge (action).
  if (action === 'shell_defense') {
    if (race !== 'Tortle') return Response.json({ error: 'Shell Defense is a Tortle racial trait.', invalid: true }, { status: 400 });
    const combatLog = await loadCombat();
    if (!combatLog) return Response.json({ error: 'Shell Defense is managed in combat.', invalid: true }, { status: 400 });
    const combatants = [...(combatLog.combatants || [])];
    const playerComp = combatants.find(c => c.type === 'player');
    if (!playerComp) return Response.json({ error: 'No player combatant found.', invalid: true }, { status: 400 });
    const inShell = (character.conditions || []).map(condName).includes('shell_defense');
    const mode = payload?.mode || (inShell ? 'exit' : 'enter');

    if (mode === 'enter') {
      if (inShell) return Response.json({ error: 'Already withdrawn into your shell.', invalid: true }, { status: 400 });
      if (bonusActionBlocked(combatLog)) return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
      playerComp.shell_original_ac = playerComp.ac;
      playerComp.ac = 19;
      playerComp.conditions = [...(playerComp.conditions || []), { name: 'shell_defense', source: 'Shell Defense' }];
      await base44.entities.Character.update(character_id, {
        conditions: [...(character.conditions || []), { name: 'shell_defense', source: 'Shell Defense' }],
      });
      const logEntry = { round: combatLog.round, actor: character.name, action: 'shell_defense', text: `🐢 ${character.name} withdraws into their shell — AC 19, speed 0, advantage on STR/CON saves. (Use an action to emerge.)` };
      await base44.entities.CombatLog.update(combat_id, {
        combatants, log_entries: [...(combatLog.log_entries || []), logEntry],
        world_state: { ...(combatLog.world_state || {}), bonus_action_used: true },
      });
      return Response.json({ success: true, mode: 'enter', ac: 19, log_entry: logEntry, bonus_action_used: true });
    }

    // exit — uses your action
    if (!inShell) return Response.json({ error: 'Not currently in your shell.', invalid: true }, { status: 400 });
    playerComp.ac = playerComp.shell_original_ac || character.armor_class || playerComp.ac;
    playerComp.shell_original_ac = null;
    playerComp.conditions = (playerComp.conditions || []).filter(c => condName(c) !== 'shell_defense');
    await base44.entities.Character.update(character_id, {
      conditions: (character.conditions || []).filter(c => condName(c) !== 'shell_defense'),
    });
    const logEntry = { round: combatLog.round, actor: character.name, action: 'shell_defense', text: `🐢 ${character.name} emerges from their shell, ready to fight!` };
    await base44.entities.CombatLog.update(combat_id, {
      combatants, log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: (combatLog.world_state?.actions_used_this_turn || 0) + 1 },
    });
    return Response.json({ success: true, mode: 'exit', ac: playerComp.ac, log_entry: logEntry });
  }

  return Response.json({ error: 'Unknown action. Use: aasimar_transform | healing_hands | hungry_jaws | fury_of_the_small | draconic_cry | shell_defense' }, { status: 400 });
});