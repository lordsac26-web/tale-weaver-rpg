import { base44 } from '@/api/base44Client';

export async function castSheetSpell({ sessionId, characterId, spellName, spellPayload }) {
  if (!sessionId || !characterId) {
    throw new Error('This sheet is not attached to an active adventure. Use Slot is bookkeeping only.');
  }

  const isHealing = spellPayload?.attack_type === 'healing';
  const result = await base44.functions.invoke('castUtilitySpell', {
    session_id: sessionId,
    character_id: characterId,
    spell_name: spellName,
    slot_level: spellPayload?.slot_level,
    action_text: isHealing ? `cast ${spellName} on myself` : `cast ${spellName}`,
    target: isHealing ? 'self' : undefined,
    cast_token: `sheet:${sessionId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
  });

  const data = result.data;
  if (!data?.success || !data?.spell_detected) {
    throw new Error(data?.error || `${spellName} could not be cast.`);
  }
  if (isHealing && (!Number.isFinite(data.heal_amount) || !Number.isFinite(data.hp_current))) {
    throw new Error(`${spellName} did not return an authoritative healing result.`);
  }
  return data;
}