import { base44 } from '@/api/base44Client';

const invoke = async (payload) => {
  const response = await base44.functions.invoke('resolveStorySkillCheck', payload);
  if (!response.data?.ok) throw new Error(response.data?.error || 'The skill check could not be resolved.');
  return response.data;
};

export const prepareStorySkillCheck = ({ sessionId, characterId, skill, dc, requestId }) => invoke({
  session_id: sessionId, character_id: characterId, skill, dc, request_id: requestId, prepare_only: true,
});

export const resolveStorySkillRoll = async ({ sessionId, characterId, skill, dc, requestId, raw, allRolls, advantageSources, advantage, disadvantage, luckyReroll }) => {
  const resolved = await invoke({
    session_id: sessionId, character_id: characterId, skill, dc, request_id: requestId,
    ...(raw == null ? {} : { raw_d20: raw }), ...(allRolls?.length ? { all_rolls: allRolls } : {}), advantage_sources: advantageSources || [], advantage: !!advantage, disadvantage: !!disadvantage, lucky_reroll: !!luckyReroll,
  });
  return { ...resolved, allRolls: resolved.all_rolls || [], hadAdvantage: !!resolved.receipt?.had_advantage, hadDisadvantage: !!resolved.receipt?.had_disadvantage };
};