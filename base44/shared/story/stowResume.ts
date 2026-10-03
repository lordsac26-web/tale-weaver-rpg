import { classifyStowIntent } from './stowIntent.ts';

// One attempt group per (source scene, container): every saved corpse-stow
// check from the current scene into the same container. The earliest
// successful check is the canonical attempt; later duplicate rolls for the
// same wording are superseded, so repeating the action resumes the saved
// attempt instead of rolling again. A committed attempt ends the group.
export function resolveStowResume({ session, character, actionText }) {
  const parsed = classifyStowIntent(actionText);
  if (!parsed || !/\b(?:corpses|bodies)\b/i.test(parsed.item_phrase)) return null;
  const source = session.story_log?.at(-1)?.request_id;
  if (!source) return null;
  const attempts = (session.world_state?.__skill_check_receipts || []).filter(x => {
    const prior = classifyStowIntent(x.action_text);
    return x.unified_story_skill_resolution === true && x.source_story_request_id === source && prior
      && /\b(?:corpses|bodies)\b/i.test(prior.item_phrase) && prior.container === parsed.container
      && !session.story_log.some(e => e.request_id === x.request_id);
  });
  if (!attempts.length) return null;
  const committed = (character.long_rest_abilities?.__stow_receipts || []).some(r => attempts.some(x => x.request_id === r.token));
  if (committed) return null;
  const successful = attempts.filter(x => x.success === true);
  if (!successful.length) return null;
  const canonical = successful[0];
  return { handled: true, request_id: canonical.request_id,
    resume: { request_id: canonical.request_id, source_story_request_id: canonical.source_story_request_id, action_text: canonical.action_text,
      skill: canonical.skill, dc: canonical.dc, raw_d20: canonical.raw_d20, all_rolls: canonical.all_rolls || [canonical.raw_d20],
      modifier_total: canonical.modifier_total, modifier_breakdown: canonical.modifier_breakdown || [], final_total: canonical.final_total,
      success: canonical.success, had_advantage: !!canonical.had_advantage, had_disadvantage: !!canonical.had_disadvantage,
      advantage_sources: canonical.advantage_sources || [], roll_origin: canonical.roll_origin || 'ai' },
    superseded_request_ids: attempts.filter(x => x.request_id !== canonical.request_id).map(x => x.request_id) };
}