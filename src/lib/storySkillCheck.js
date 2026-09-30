import { base44 } from '@/api/base44Client';

const invoke = async (payload) => {
  const response = await base44.functions.invoke('resolveStorySkillCheck', payload);
  if (!response.data?.ok) throw new Error(response.data?.error || 'The skill check could not be resolved.');
  return response.data;
};

export const prepareStorySkillCheck = ({ sessionId, characterId, skill, dc, requestId, actionText }) => invoke({
  session_id: sessionId, character_id: characterId, skill, dc, request_id: requestId, action_text: actionText, prepare_only: true,
});

export const resumeStorySkillResolution = (session, actionText, skill, dc) => {
  const sourceId = session?.story_log?.at(-1)?.request_id;
  const receipt = [...(session?.world_state?.__skill_check_receipts || [])].reverse().find(entry =>
    entry.source_story_request_id === sourceId && entry.action_text === actionText && entry.skill === skill && Number(entry.dc) === Number(dc)
    && !(session.story_log || []).some(story => story.request_id === entry.request_id));
  if (!receipt) return null;
  return { receipt, raw: receipt.raw_d20, allRolls: receipt.all_rolls || [receipt.raw_d20], modifier: receipt.modifier_total, breakdown: receipt.modifier_breakdown, final: receipt.final_total, success: receipt.success, hadAdvantage: !!receipt.had_advantage, hadDisadvantage: !!receipt.had_disadvantage, advantageSources: receipt.advantage_sources || [] };
};

export const resolveStorySkillRoll = async ({ sessionId, characterId, skill, dc, requestId, raw, allRolls, advantageSources, advantage, disadvantage, luckyReroll, rollOrigin, actionText }) => {
  const resolved = await invoke({
    session_id: sessionId, character_id: characterId, skill, dc, request_id: requestId, action_text: actionText,
    ...(raw == null ? {} : { raw_d20: raw }), ...(allRolls?.length ? { all_rolls: allRolls } : {}), ...(rollOrigin ? { roll_origin: rollOrigin } : {}), advantage_sources: advantageSources || [], advantage: !!advantage, disadvantage: !!disadvantage, lucky_reroll: !!luckyReroll,
  });
  return { ...resolved, allRolls: resolved.all_rolls || [], hadAdvantage: !!resolved.receipt?.had_advantage, hadDisadvantage: !!resolved.receipt?.had_disadvantage };
};