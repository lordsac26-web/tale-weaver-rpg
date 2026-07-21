import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { statMod, rollD20, rollDice } from '../../shared/dice.ts';

// Subclass Actions — activation handlers for subclass features whose riders live
// in the combatEngine (they arm world_state flags) or that resolve immediately.
// Kept separate from combatActions to respect file-size limits.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, combat_id, session_id, character_id, payload } = await req.json();

  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const level = character.level || 1;
  const subclass = (character.subclass || '').toLowerCase();
  const sra = character.short_rest_abilities || {};

  // Channel Divinity shared gate (Cleric L2+): 1 use, 2 at L6, 3 at L18 (PHB p.59)
  const requireChannelDivinity = (domain: string) => {
    if ((character.class || '') !== 'Cleric' || level < 2) return 'Requires Cleric level 2+.';
    if (!subclass.includes(domain)) return `Requires the ${domain[0].toUpperCase() + domain.slice(1)} domain.`;
    const maxCD = level >= 18 ? 3 : level >= 6 ? 2 : 1;
    if ((sra.channel_divinity_used || 0) >= maxCD) return 'Channel Divinity exhausted. Short rest to recover.';
    return null;
  };
  const spendChannelDivinity = () =>
    base44.entities.Character.update(character_id, {
      short_rest_abilities: { ...sra, channel_divinity_used: (sra.channel_divinity_used || 0) + 1 },
    });

  // ─── CHANNEL DIVINITY: RADIANCE OF THE DAWN (Light Cleric, PHB p.61) ────────
  // Action: each enemy within 30ft makes a CON save vs spell DC or takes
  // 2d10 + cleric level radiant damage (half on success).
  if (action === 'channel_divinity_radiance_of_dawn') {
    const gateErr = requireChannelDivinity('light');
    if (gateErr) return Response.json({ error: gateErr, invalid: true }, { status: 400 });
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const dc = 8 + statMod(character.wisdom || 10) + (character.proficiency_bonus || 2);
    const combatants = [...(combatLog.combatants || [])];
    const targets = combatants.filter(c => c.type === 'enemy' && c.is_conscious);
    const hitLogs: string[] = [];
    for (const target of targets) {
      const saveRoll = rollD20() + statMod(target.constitution || 10);
      const saved = saveRoll >= dc;
      let dmg = rollDice(10) + rollDice(10) + level;
      if (saved) dmg = Math.floor(dmg / 2);
      // Radiant damage modifiers
      const imm = (target.immunities || []).map((d: string) => String(d).toLowerCase());
      const res = (target.resistances || []).map((d: string) => String(d).toLowerCase());
      if (imm.includes('radiant')) dmg = 0;
      else if (res.includes('radiant')) dmg = Math.floor(dmg / 2);
      target.hp_current = Math.max(0, target.hp_current - dmg);
      if (target.hp_current === 0) target.is_conscious = false;
      hitLogs.push(`${target.name}: ${saved ? 'saved' : 'FAILED'} (${saveRoll} vs DC ${dc}), ${dmg} radiant${target.hp_current === 0 ? ' — falls!' : ''}`);
    }
    await spendChannelDivinity();
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'channel_divinity_radiance_of_dawn',
      text: `🌅 ${character.name} unleashes Radiance of the Dawn! Searing light floods the battlefield. ${hitLogs.length ? hitLogs.join('; ') : 'No enemies in range.'}`,
    };
    const updatedCombatants = combatants.map(c => targets.find(t => t.id === c.id) || c);
    const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const result = allDead ? 'victory' : 'ongoing';
    const ws = { ...(combatLog.world_state || {}), actions_used_this_turn: (combatLog.world_state?.actions_used_this_turn || 0) + 1 };
    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants, log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: ws, is_active: result === 'ongoing', result,
    });
    if (allDead) await base44.entities.GameSession.update(session_id, { in_combat: false });
    return Response.json({ success: true, log_entry: logEntry, result, combat_ended: result !== 'ongoing' });
  }

  // ─── CHANNEL DIVINITY: DESTRUCTIVE WRATH (Tempest Cleric, PHB p.62) ─────────
  // Arms a flag — the engine maximizes your next lightning/thunder spell damage.
  if (action === 'channel_divinity_destructive_wrath') {
    const gateErr = requireChannelDivinity('tempest');
    if (gateErr) return Response.json({ error: gateErr, invalid: true }, { status: 400 });
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    await spendChannelDivinity();
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'channel_divinity_destructive_wrath',
      text: `⚡ ${character.name} channels Destructive Wrath — the next lightning or thunder spell deals MAXIMUM damage!`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), destructive_wrath: true },
    });
    return Response.json({ success: true, log_entry: logEntry });
  }

  // ─── CHANNEL DIVINITY: PATH TO THE GRAVE (Grave Cleric, XGtE p.20) ──────────
  // Action: curse a target — the next attack that hits it deals DOUBLE damage.
  if (action === 'channel_divinity_path_to_grave') {
    const gateErr = requireChannelDivinity('grave');
    if (gateErr) return Response.json({ error: gateErr, invalid: true }, { status: 400 });
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...(combatLog.combatants || [])];
    const target = combatants.find(c => c.id === payload?.target_id && c.type === 'enemy' && c.is_conscious)
      || combatants.find(c => c.type === 'enemy' && c.is_conscious);
    if (!target) return Response.json({ error: 'No conscious target.', invalid: true }, { status: 400 });
    const existing = (target.conditions || []).map((c: any) => (typeof c === 'string' ? c : c?.name));
    if (!existing.includes('path_to_grave')) {
      target.conditions = [...(target.conditions || []), { name: 'path_to_grave', source: 'Path to the Grave', caster: character.name }];
    }
    await spendChannelDivinity();
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'channel_divinity_path_to_grave', target: target.name,
      text: `⚰️ ${character.name} marks ${target.name} with Path to the Grave — the next attack to hit it deals DOUBLE damage!`,
    };
    const ws = { ...(combatLog.world_state || {}), actions_used_this_turn: (combatLog.world_state?.actions_used_this_turn || 0) + 1 };
    await base44.entities.CombatLog.update(combat_id, {
      combatants: combatants.map(c => c.id === target.id ? target : c),
      log_entries: [...(combatLog.log_entries || []), logEntry], world_state: ws,
    });
    return Response.json({ success: true, log_entry: logEntry });
  }

  // ─── PLANAR WARRIOR (Horizon Walker Ranger L3, XGtE p.42) ───────────────────
  // Bonus action: choose a target — your next hit against it deals +1d8 force (2d8 at L11).
  if (action === 'planar_warrior') {
    if ((character.class || '') !== 'Ranger' || !subclass.includes('horizon') || level < 3) {
      return Response.json({ error: 'Planar Warrior requires a Horizon Walker Ranger, level 3+.', invalid: true }, { status: 400 });
    }
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }
    const combatants = combatLog.combatants || [];
    const target = combatants.find(c => c.id === payload?.target_id && c.type === 'enemy' && c.is_conscious)
      || combatants.find(c => c.type === 'enemy' && c.is_conscious);
    if (!target) return Response.json({ error: 'No conscious target.', invalid: true }, { status: 400 });
    const dice = level >= 11 ? '2d8' : '1d8';
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'planar_warrior', target: target.name,
      text: `🌌 ${character.name} channels planar energy at ${target.name} — the next hit against it deals +${dice} force damage!`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), planar_warrior_target: target.id, bonus_action_used: true },
    });
    return Response.json({ success: true, log_entry: logEntry, bonus_action_used: true });
  }

  // ─── CUTTING WORDS ARM/DISARM (Lore Bard L3, PHB p.54) ──────────────────────
  // Toggle: while armed, the engine spends your reaction + one Bardic Inspiration
  // die to reduce the next enemy attack roll that would hit you.
  if (action === 'cutting_words_arm') {
    if ((character.class || '') !== 'Bard' || !subclass.includes('lore') || level < 3) {
      return Response.json({ error: 'Cutting Words requires a College of Lore Bard, level 3+.', invalid: true }, { status: 400 });
    }
    if ((character.bardic_inspiration_remaining || 0) <= 0) {
      return Response.json({ error: 'No Bardic Inspiration uses remaining.', invalid: true }, { status: 400 });
    }
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const armed = !combatLog.world_state?.cutting_words_armed;
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'cutting_words_arm',
      text: armed
        ? `🎭 ${character.name} readies Cutting Words — the next enemy attack that would hit will be mocked mid-swing!`
        : `${character.name} lowers their Cutting Words.`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), cutting_words_armed: armed },
    });
    return Response.json({ success: true, armed, log_entry: logEntry });
  }

  // ─── COMBAT INSPIRATION (Valor Bard L3, PHB p.55) ───────────────────────────
  // Bonus action: spend a Bardic Inspiration die to empower your companion's next attack.
  if (action === 'combat_inspiration') {
    if ((character.class || '') !== 'Bard' || !subclass.includes('valor') || level < 3) {
      return Response.json({ error: 'Combat Inspiration requires a College of Valor Bard, level 3+.', invalid: true }, { status: 400 });
    }
    if ((character.bardic_inspiration_remaining || 0) <= 0) {
      return Response.json({ error: 'No Bardic Inspiration uses remaining.', invalid: true }, { status: 400 });
    }
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }
    const companion = (combatLog.combatants || []).find(c => c.type === 'companion' && c.is_conscious);
    if (!companion) {
      return Response.json({ error: 'No conscious companion to inspire.', invalid: true }, { status: 400 });
    }
    const die = level < 5 ? 6 : level < 10 ? 8 : level < 15 ? 10 : 12;
    await base44.entities.Character.update(character_id, {
      bardic_inspiration_remaining: Math.max(0, (character.bardic_inspiration_remaining || 1) - 1),
    });
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'combat_inspiration', target: companion.name,
      text: `🎶 ${character.name} plays a battle hymn — ${companion.name} gains Combat Inspiration (+1d${die} on its next attack's damage)!`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), companion_inspiration_die: die, bonus_action_used: true },
    });
    return Response.json({ success: true, log_entry: logEntry, bonus_action_used: true });
  }

  // ─── USE PORTENT (Divination Wizard L2, PHB p.116) ──────────────────────────
  // Consume one foreseen d20 — it replaces your next attack roll in combat.
  if (action === 'use_portent') {
    if ((character.class || '') !== 'Wizard' || !subclass.includes('divination') || level < 2) {
      return Response.json({ error: 'Portent requires a Divination Wizard, level 2+.', invalid: true }, { status: 400 });
    }
    const lra = character.long_rest_abilities || {};
    const portents: number[] = lra.portent_rolls || [];
    if (portents.length === 0) {
      return Response.json({ error: 'No Portent dice remaining. Long rest to foresee new ones.', invalid: true }, { status: 400 });
    }
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    if (combatLog.world_state?.portent_value != null) {
      return Response.json({ error: 'A Portent die is already armed for your next attack.', invalid: true }, { status: 400 });
    }
    const idx = Number.isInteger(payload?.roll_index) && payload.roll_index >= 0 && payload.roll_index < portents.length
      ? payload.roll_index : 0;
    const value = portents[idx];
    await base44.entities.Character.update(character_id, {
      long_rest_abilities: { ...lra, portent_rolls: portents.filter((_, i) => i !== idx) },
    });
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'use_portent',
      text: `🔮 ${character.name} invokes a Portent — their next attack roll is foreseen as a ${value}!`,
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...(combatLog.world_state || {}), portent_value: value },
    });
    return Response.json({ success: true, value, log_entry: logEntry });
  }

  return Response.json({ error: 'Unknown action. Use: channel_divinity_radiance_of_dawn | channel_divinity_destructive_wrath | channel_divinity_path_to_grave | planar_warrior | cutting_words_arm | combat_inspiration | use_portent' }, { status: 400 });
});