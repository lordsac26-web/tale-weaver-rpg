import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// SP cost to CREATE a spell slot (PHB p.101 — Font of Magic)
const SP_COST_FOR_SLOT = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

// Full caster slot table (Sorcerer is always a full caster)
const FULL_SLOTS = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];

// Condensed Wild Magic Surge table (20 entries, adapted from PHB p.104)
const WILD_MAGIC_TABLE = [
  { text: 'A surge of energy fills you — roll a d10 and regain that many sorcery points.', effect: 'regain_sp' },
  { text: 'You cast Magic Missile as a 1st-level spell (no slot required).', effect: 'magic_missile' },
  { text: 'You cast Fireball centered on yourself (3rd-level, no slot).', effect: 'fireball_self' },
  { text: 'You cast Lightning Bolt in a random direction (3rd-level, no slot).', effect: 'lightning_bolt' },
  { text: 'You cast Levitate on yourself (2nd-level, no slot).', effect: 'flavor' },
  { text: 'You become invisible for 1 minute.', effect: 'invisible' },
  { text: 'You gain resistance to all damage for 1 minute.', effect: 'resist_all' },
  { text: 'Maximize the damage of the next spell you cast within 1 minute.', effect: 'flavor' },
  { text: 'You teleport up to 60 feet to an unoccupied space.', effect: 'flavor' },
  { text: 'Illusory butterflies flutter around you for 1 minute.', effect: 'flavor' },
  { text: 'You cast Fog Cloud centered on yourself (1st-level, no slot).', effect: 'flavor' },
  { text: 'You regain 2d10 hit points.', effect: 'heal' },
  { text: 'You take 2d10 force damage.', effect: 'force_damage' },
  { text: 'You cast Grease centered on yourself (1st-level, no slot).', effect: 'flavor' },
  { text: 'Creatures within 30 feet take 1d10 necrotic damage.', effect: 'flavor' },
  { text: 'You regain the use of Tides of Chaos immediately.', effect: 'regain_tides' },
  { text: 'You cast Polymorph on yourself, becoming a sheep (no concentration).', effect: 'flavor' },
  { text: 'You cast Fly on yourself (3rd-level, no slot).', effect: 'flavor' },
  { text: 'Roll on this table twice more, ignoring this result.', effect: 'flavor' },
  { text: 'You cast Darkness centered on yourself (2nd-level, no slot).', effect: 'flavor' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, character_id, slot_level, combat_id } = await req.json();
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
    if (character.created_by !== user.email) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if ((character.class || '') !== 'Sorcerer') {
      return Response.json({ error: 'Font of Magic requires Sorcerer class.', invalid: true }, { status: 400 });
    }
    const level = character.level || 1;
    if (level < 2 && action !== 'tides_of_chaos') {
      return Response.json({ error: 'Font of Magic is gained at Sorcerer level 2.', invalid: true }, { status: 400 });
    }
    const isWildMagic = (character.subclass || '').toLowerCase().includes('wild magic');

    // ── convert_sp_to_slot (PHB p.101) ────────────────────────────────────
    if (action === 'convert_sp_to_slot') {
      const spCost = SP_COST_FOR_SLOT[slot_level];
      if (!spCost) return Response.json({ error: 'Invalid slot level (1-5).', invalid: true }, { status: 400 });
      const spCurrent = character.sorcery_points_current ?? 0;
      const spMax = character.sorcery_points_max ?? level;
      if (spCurrent < spCost) {
        return Response.json({ error: `Need ${spCost} SP (have ${spCurrent}).`, invalid: true }, { status: 400 });
      }
      const charLevel = Math.min(20, level);
      const maxSlots = FULL_SLOTS[charLevel - 1] || [];
      const maxAtLevel = maxSlots[slot_level - 1] || 0;
      if (maxAtLevel === 0) return Response.json({ error: `Cannot create ${slot_level}th-level slots at your level.`, invalid: true }, { status: 400 });
      const slotsUsed = (character.spell_slots || {})[`level_${slot_level}`] || 0;
      if (slotsUsed <= 0) return Response.json({ error: `All ${slot_level}th-level slots already available.`, invalid: true }, { status: 400 });

      const newSP = spCurrent - spCost;
      await base44.entities.Character.update(character_id, {
        sorcery_points_current: newSP,
        sorcery_points_max: spMax,
        spell_slots: { ...(character.spell_slots || {}), [`level_${slot_level}`]: slotsUsed - 1 },
      });
      return Response.json({ success: true, sorcery_points_remaining: newSP, slot_created: slot_level,
        message: `Spent ${spCost} SP to create a ${slot_level}th-level slot.` });
    }

    // ── convert_slot_to_sp (PHB p.101) ────────────────────────────────────
    if (action === 'convert_slot_to_sp') {
      const slotsUsed = (character.spell_slots || {})[`level_${slot_level}`] || 0;
      const charLevel = Math.min(20, level);
      const maxSlots = FULL_SLOTS[charLevel - 1] || [];
      const maxAtLevel = maxSlots[slot_level - 1] || 0;
      if (maxAtLevel === 0 || slotsUsed >= maxAtLevel) {
        return Response.json({ error: `No ${slot_level}th-level slots to convert.`, invalid: true }, { status: 400 });
      }
      const spGained = slot_level;
      const spCurrent = character.sorcery_points_current ?? 0;
      const spMax = character.sorcery_points_max ?? level;
      const newSP = Math.min(spMax, spCurrent + spGained);
      await base44.entities.Character.update(character_id, {
        sorcery_points_current: newSP,
        sorcery_points_max: spMax,
        spell_slots: { ...(character.spell_slots || {}), [`level_${slot_level}`]: slotsUsed + 1 },
      });
      return Response.json({ success: true, sorcery_points_remaining: newSP, sp_gained: spGained,
        message: `Converted a ${slot_level}th-level slot for ${spGained} SP.` });
    }

    // ── tides_of_chaos (Wild Magic, PHB p.103) ────────────────────────────
    if (action === 'tides_of_chaos') {
      if (!isWildMagic) return Response.json({ error: 'Tides of Chaos requires Wild Magic origin.', invalid: true }, { status: 400 });
      const lra = character.long_rest_abilities || {};
      if (lra.tides_of_chaos_used) return Response.json({ error: 'Tides of Chaos already used. Long rest to regain.', invalid: true }, { status: 400 });
      await base44.entities.Character.update(character_id, { long_rest_abilities: { ...lra, tides_of_chaos_used: true } });
      return Response.json({ success: true, message: '🌊 Tides of Chaos! Gain advantage on your next attack, check, or save. Your next spell may trigger a Wild Magic Surge.' });
    }

    // ── check_surge (Wild Magic Surge, PHB p.103) ─────────────────────────
    if (action === 'check_surge') {
      if (!isWildMagic) return Response.json({ surge: false, message: 'Not a Wild Magic Sorcerer.' });
      const lra = character.long_rest_abilities || {};
      const tidesUsed = !!lra.tides_of_chaos_used;
      // If Tides of Chaos was used, the next spell auto-surges. Otherwise d20, 1 = surge.
      let surge = tidesUsed || (Math.floor(Math.random() * 20) + 1) === 1;
      if (!surge) return Response.json({ surge: false, message: 'No Wild Magic Surge.' });

      const surgeRoll = Math.floor(Math.random() * 20) + 1;
      const effect = WILD_MAGIC_TABLE[surgeRoll - 1];
      const updates = {};
      let note = '';
      switch (effect.effect) {
        case 'regain_sp': {
          const sp = Math.floor(Math.random() * 10) + 1;
          const spMax = character.sorcery_points_max ?? level;
          updates.sorcery_points_current = Math.min(spMax, (character.sorcery_points_current ?? 0) + sp);
          note = ` Regained ${sp} sorcery points.`;
          break;
        }
        case 'heal': {
          const h = (Math.floor(Math.random() * 10) + 1) * 2;
          updates.hp_current = Math.min(character.hp_max || 1, (character.hp_current || 1) + h);
          note = ` Regained ${h} HP.`;
          break;
        }
        case 'force_damage': {
          const d = (Math.floor(Math.random() * 10) + 1) * 2;
          updates.hp_current = Math.max(0, (character.hp_current || 1) - d);
          note = ` Took ${d} force damage!`;
          break;
        }
        case 'invisible':
          updates.conditions = [...(character.conditions || []), { name: 'invisible', source: 'Wild Magic Surge' }];
          note = ' Became invisible!';
          break;
        case 'resist_all':
          updates.resistances = [...new Set([...(character.resistances || []), 'bludgeoning','piercing','slashing','fire','cold','lightning','thunder','acid','poison'])];
          note = ' Resistance to ALL damage for 1 minute!';
          break;
      }
      // Entry 16 restores Tides of Chaos
      if (effect.effect === 'regain_tides') {
        updates.long_rest_abilities = { ...lra, tides_of_chaos_used: false };
        note = ' Tides of Chaos regained!';
      }
      if (Object.keys(updates).length > 0) await base44.entities.Character.update(character_id, updates);

      if (combat_id) {
        try {
          const cl = await base44.entities.CombatLog.get(combat_id);
          if (cl) await base44.entities.CombatLog.update(combat_id, {
            log_entries: [...(cl.log_entries || []), { round: cl.round, actor: character.name, action: 'wild_magic_surge', text: `🎲 WILD MAGIC SURGE! ${effect.text}${note}` }],
          });
        } catch { /* optional */ }
      }
      return Response.json({ surge: true, surge_roll: surgeRoll, effect, note, message: `🎲 WILD MAGIC SURGE! ${effect.text}${note}` });
    }

    return Response.json({ error: 'Unknown action: convert_sp_to_slot | convert_slot_to_sp | tides_of_chaos | check_surge' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});