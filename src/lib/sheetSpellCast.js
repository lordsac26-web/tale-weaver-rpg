import { base44 } from '@/api/base44Client';

export async function castSheetSpell({ sessionId, characterId, spellName, spellPayload }) {
  const isHealing = spellPayload?.attack_type === 'healing';
  if (!isHealing) throw new Error(`${spellName} needs a combat target and cannot be cast from this sheet.`);

  const requestId = `sheet:${sessionId || 'character'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const result = await base44.functions.invoke('castCharacterSheetHealing', {
    session_id: sessionId || undefined,
    character_id: characterId,
    spell_name: spellName,
    slot_level: spellPayload?.slot_level,
    request_id: requestId,
  });

  const data = result.data;
  const validHealingResult = data?.success && data?.receipt_id && data?.request_id === requestId &&
    Number.isFinite(data.roll_total) && Number.isFinite(data.hp_before) && Number.isFinite(data.hp_after) &&
    Number.isFinite(data.used_slots) && (data.hp_after > data.hp_before || data.hp_before === data.hp_max);
  if (!validHealingResult) throw new Error(data?.error || `${spellName} did not return a valid authoritative healing receipt.`);
  return data;
}