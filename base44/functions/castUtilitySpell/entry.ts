import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FULL = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF = [[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];

const UTILITY_SPELLS = {
  'pass without trace': {
    canonicalName: 'Pass without Trace',
    level: 2,
    modifier: { effect: 'skill_bonus', skill: 'Stealth', bonus: 10 },
    concentration: true,
  },
};

function maxSlots(character, slotLevel) {
  const level = Math.max(1, Math.min(20, Number(character.level) || 1));
  const cls = String(character.class || '');
  const table = ['Ranger', 'Paladin'].includes(cls) ? HALF : FULL;
  return (table[level - 1] || [])[slotLevel - 1] || 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id, character_id, spell_name } = await req.json();
    if (!session_id || !character_id || !spell_name) {
      return Response.json({ error: 'session_id, character_id, and spell_name are required' }, { status: 400 });
    }

    const config = UTILITY_SPELLS[String(spell_name).trim().toLowerCase()];
    if (!config) return Response.json({ error: 'Unsupported utility spell' }, { status: 400 });

    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session || session.character_id !== character_id) {
      return Response.json({ error: 'Session and character do not match' }, { status: 400 });
    }
    const character = await base44.asServiceRole.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

    const knowsSpell = (character.spells_known || []).some(s => String(s).toLowerCase() === config.canonicalName.toLowerCase());
    if (!knowsSpell) return Response.json({ error: `${character.name} does not know ${config.canonicalName}` }, { status: 400 });

    const now = Date.now();
    const active = (character.active_modifiers || []).filter(m => !m.expires_at || new Date(m.expires_at).getTime() > now);
    const existing = active.find(m => m.source === config.canonicalName && m.concentration);
    if (existing) {
      // Utility-spell duration follows game time/concentration, not wall-clock time;
      // normalize older records that used a real-time expires_at value.
      const activeModifiers = active.map(m => {
        if (m !== existing || !m.expires_at) return m;
        const normalized = { ...m };
        delete normalized.expires_at;
        return normalized;
      });
      if (existing.expires_at) {
        await base44.asServiceRole.entities.Character.update(character_id, { active_modifiers: activeModifiers });
      }
      return Response.json({ success: true, already_active: true, spell_name: config.canonicalName, spell_slots: character.spell_slots || {}, active_modifiers: activeModifiers });
    }

    const slotKey = `level_${config.level}`;
    const used = Number((character.spell_slots || {})[slotKey]) || 0;
    const maximum = maxSlots(character, config.level);
    if (maximum <= 0 || used >= maximum) {
      return Response.json({ error: `No ${config.level}nd-level spell slots remaining`, invalid: true }, { status: 400 });
    }

    // Starting a new concentration spell ends any prior concentration effect.
    const retained = active.filter(m => !m.concentration);
    const appliedAt = new Date(now).toISOString();
    const modifier = {
      id: `spell_pass_without_trace_${now}`,
      source: config.canonicalName,
      ...config.modifier,
      concentration: true,
      applied_at: appliedAt,
      duration: '1 hour',
    };
    const spellSlots = { ...(character.spell_slots || {}), [slotKey]: used + 1 };
    const activeModifiers = [...retained, modifier];
    await base44.asServiceRole.entities.Character.update(character_id, { spell_slots: spellSlots, active_modifiers: activeModifiers });

    if (session.in_combat && session.combat_state?.combat_id) {
      const combat = await base44.asServiceRole.entities.CombatLog.get(session.combat_state.combat_id);
      if (combat?.is_active) {
        await base44.asServiceRole.entities.CombatLog.update(combat.id, {
          world_state: {
            ...(combat.world_state || {}),
            concentration_spell: config.canonicalName,
            concentration_caster: character.name,
          },
        });
      }
    }

    return Response.json({
      success: true,
      already_active: false,
      spell_name: config.canonicalName,
      slot_level: config.level,
      used_slots: used + 1,
      max_slots: maximum,
      remaining_slots: maximum - used - 1,
      spell_slots: spellSlots,
      active_modifiers: activeModifiers,
      modifier,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Utility spell cast failed' }, { status: 500 });
  }
});
