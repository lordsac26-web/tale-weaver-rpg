import React, { useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import RestModal from '@/components/game/RestModal';

export default function RestFlowContainer({ character, session, sessionId, onClose, onBusyChange, onRefresh, onNarrative, onChoices, onStartCombat }) {
  const performRest = useCallback(async (restType, hitDiceToSpend, requestId) => {
    const characterId = character?.id;
    if (!characterId) throw new Error('Your character changed. Close the rest window, reload, and try again.');
    const locationSafe = /town|inn|tavern|village|city|camp|home|sanctuary|temple/i.test(session?.current_location || '');
    const response = await base44.functions.invoke('handleRest', {
      character_id: characterId,
      session_id: sessionId,
      rest_request_id: requestId,
      rest_type: restType,
      rest_intent: restType === 'long' ? 'long_rest_8h' : undefined,
      hit_dice_to_spend: hitDiceToSpend,
      location_safe: locationSafe,
    });
    const data = response.data;

    if (data?.interrupted) {
      onNarrative(`⚠️ ${data.encounter_message}`);
      const encounter = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'generate_event', custom_input: 'random_encounter' });
      if (encounter.data?.narrative) onNarrative(encounter.data.narrative);
      if (encounter.data?.combat_trigger && encounter.data?.enemies) await onStartCombat(encounter.data.enemies);
      else if (encounter.data?.choices) onChoices(encounter.data.choices);
      await onRefresh();
      return { interrupted: true, title: 'Rest Interrupted', message: data.encounter_message };
    }

    await onRefresh();
    const updated = data.character || {};
    const healed = Number(data.healing) || 0;
    const hpLine = healed > 0 ? `Restored ${healed} HP (now ${updated.hp_current}/${updated.hp_max}).` : restType === 'long' ? `Health remains ${updated.hp_current}/${updated.hp_max}.` : '';
    const details = (data.restorations || []).join(', ');
    const timeLine = data.clock ? `${data.clock.elapsed_hours} hours passed: ${data.clock.before_label} → ${data.clock.after_label}.` : '';
    const intro = restType === 'long' ? (data.narrative || 'You complete a long rest.') : 'You catch your breath beside a low fire.';
    onNarrative(`${restType === 'long' ? '🌙' : '☕'} ${intro} ${hpLine} ${details}. ${timeLine}`.trim());
    return { title: `${restType === 'long' ? 'Long' : 'Short'} Rest Complete`, message: [hpLine, details, timeLine].filter(Boolean).join(' '), receiptId: data.receipt_id || requestId, alreadyProcessed: !!data.already_processed };
  }, [character?.id, onChoices, onNarrative, onRefresh, onStartCombat, session?.current_location, sessionId]);

  return <RestModal character={character} sessionId={sessionId} onClose={onClose} onBusyChange={onBusyChange} onRest={performRest} />;
}