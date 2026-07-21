import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { statMod, rollD20 } from '../../shared/dice.ts';

// Monk Actions — Ki-powered abilities extracted from combatEngine to keep that
// file within size limits. Flurry of Blows stays in the engine (it needs the
// turn-advancement helpers); Patient Defense, Step of the Wind, and Stunning
// Strike only touch the CombatLog directly and live here.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, combat_id, character_id, payload } = await req.json();

  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const level = character.level || 1;
  const minLevel = action === 'stunning_strike' ? 5 : 2;
  if ((character.class || '').toLowerCase() !== 'monk' || level < minLevel) {
    return Response.json({ error: `This ability requires Monk level ${minLevel}+.`, invalid: true }, { status: 400 });
  }
  const kiRemaining = character.ki_points_remaining ?? 0;
  if (kiRemaining <= 0) {
    return Response.json({ error: 'No Ki points remaining.', invalid: true }, { status: 400 });
  }
  if (!combat_id) {
    return Response.json({ error: 'These abilities can only be used in combat.', invalid: true }, { status: 400 });
  }
  const combatLog = await base44.entities.CombatLog.get(combat_id);

  // ─── PATIENT DEFENSE (PHB p.78) ─────────────────────────────────────────────
  // Bonus action: spend 1 Ki to gain the effects of the Dodge action. Does NOT end the turn.
  if (action === 'patient_defense') {
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }
    await base44.entities.Character.update(character_id, {
      ki_points_remaining: Math.max(0, kiRemaining - 1),
    });
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'patient_defense',
      text: `🛡️ ${character.name} uses Patient Defense — gains the effects of Dodge (attacks against them have disadvantage). (${Math.max(0, kiRemaining - 1)} Ki remaining)`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), player_dodging: true, bonus_action_used: true },
    });
    return Response.json({ success: true, log_entry: logEntry, ki_remaining: Math.max(0, kiRemaining - 1) });
  }

  // ─── STEP OF THE WIND (PHB p.78) ────────────────────────────────────────────
  // Bonus action: spend 1 Ki to Dash or Disengage; jump distance doubled this turn.
  if (action === 'step_of_the_wind') {
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }
    await base44.entities.Character.update(character_id, {
      ki_points_remaining: Math.max(0, kiRemaining - 1),
    });
    const mode = (payload?.mode === 'dash') ? 'Dash' : 'Disengage';
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'step_of_the_wind',
      text: `💨 ${character.name} uses Step of the Wind (${mode}) — ${mode === 'Dash' ? 'movement doubled' : 'movement provokes no opportunity attacks'} and jump distance doubled this turn. (${Math.max(0, kiRemaining - 1)} Ki remaining)`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), bonus_action_used: true },
    });
    return Response.json({ success: true, log_entry: logEntry, ki_remaining: Math.max(0, kiRemaining - 1) });
  }

  // ─── STUNNING STRIKE (PHB p.79) ─────────────────────────────────────────────
  // After hitting with a melee attack, spend 1 Ki to force a CON save; on failure
  // the target is stunned until the end of the monk's next turn. No action cost.
  if (action === 'stunning_strike') {
    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === payload?.target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });
    if (!target.is_conscious) {
      return Response.json({ error: 'Target is already downed.', invalid: true }, { status: 400 });
    }

    // Ki save DC = 8 + proficiency + WIS (PHB p.79)
    const kiDC = 8 + statMod(character.wisdom || 10) + (character.proficiency_bonus || 2);
    const saveRoll = rollD20() + statMod(target.constitution || 10);
    const saveFailed = saveRoll < kiDC;

    // Spend 1 Ki regardless of outcome
    await base44.entities.Character.update(character_id, {
      ki_points_remaining: Math.max(0, kiRemaining - 1),
    });

    let logText;
    if (saveFailed) {
      const existing = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
      if (!existing.includes('stunned')) {
        target.conditions = [...(target.conditions || []), { name: 'stunned', source: 'Stunning Strike', save_dc: kiDC, save_ability: 'constitution', caster: character.name }];
      }
      logText = `💥 ${character.name} uses Stunning Strike! ${target.name} fails a CON save (${saveRoll} vs DC ${kiDC}) and is STUNNED until the end of ${character.name}'s next turn!`;
    } else {
      logText = `${character.name} uses Stunning Strike! ${target.name} resists (CON save ${saveRoll} vs DC ${kiDC}).`;
    }

    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'stunning_strike', target: target.name,
      hit: saveFailed, text: logText,
    };
    await base44.entities.CombatLog.update(combat_id, {
      combatants: combatants.map(c => c.id === target.id ? target : c),
      log_entries: [...(combatLog.log_entries || []), logEntry],
    });
    return Response.json({ success: saveFailed, log_entry: logEntry, ki_remaining: Math.max(0, kiRemaining - 1) });
  }

  return Response.json({ error: 'Unknown action. Use: patient_defense | step_of_the_wind | stunning_strike' }, { status: 400 });
});