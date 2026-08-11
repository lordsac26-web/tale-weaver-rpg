import { base44 } from '@/api/base44Client';

const invoke = async (payload) => {
  const response = await base44.functions.invoke('resolveStorySkillCheck', payload);
  if (!response.data?.ok) throw new Error(response.data?.error || 'The skill check could not be resolved.');
  return response.data;
};

export const prepareStorySkillCheck = ({ sessionId, characterId, skill, dc, requestId }) => invoke({
  session_id: sessionId, character_id: characterId, skill, dc, request_id: requestId,
});

export const resolveStorySkillRoll = ({ sessionId, characterId, skill, dc, requestId, raw, allRolls, advantageSources }) => invoke({
  session_id: sessionId, character_id: characterId, skill, dc, request_id: requestId,
  raw_d20: raw, all_rolls: allRolls, advantage_sources: advantageSources,
});