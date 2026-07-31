import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action = 'dry_run', combat_id } = await req.json();
    if (combat_id !== '6a6bd975890c8e998b8f5b4d') return Response.json({ error: 'Unexpected combat id' }, { status: 400 });
    const log = await base44.asServiceRole.entities.CombatLog.get(combat_id);
    const entries = log.log_entries || [];
    const last = entries[entries.length - 1];
    const prior = entries[entries.length - 2];
    const duplicateConfirmed = entries.length === 3
      && last?.actor === "Craig's Ranger"
      && prior?.actor === "Craig's Ranger"
      && last?.target === 'Skeleton Reinforcement'
      && prior?.target === 'Skeleton Reinforcement'
      && last?.text?.includes('falls!')
      && prior?.text?.includes('falls!')
      && log.current_turn_index === 2;
    if (!duplicateConfirmed) return Response.json({ error: 'Expected duplicate-shot state not found; no changes made', entries: entries.length, current_turn_index: log.current_turn_index }, { status: 409 });
    const repairedWorldState = { ...(log.world_state || {}), actions_used_this_turn: 1, bonus_action_used: false, reaction_used: false };
    if (action === 'apply') {
      await base44.asServiceRole.entities.CombatLog.update(combat_id, {
        log_entries: entries.slice(0, -1),
        current_turn_index: 0,
        round: 1,
        world_state: repairedWorldState,
      });
    }
    return Response.json({ success: true, action, duplicate_confirmed: true, removed_text: last.text, restored_turn_index: 0, actions_used_this_turn: 1, actions_remaining: 1, changed: action === 'apply' });
  } catch (error) {
    return Response.json({ error: error.message || 'Repair failed' }, { status: 500 });
  }
});
