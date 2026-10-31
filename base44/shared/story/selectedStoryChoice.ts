import { normalizeChoiceActionContract } from './choiceActionContract.js';
import { stripGeneratedChoiceAnnotations } from './generatedChoiceIntent.js';

export function selectStoryChoice({ latestChoices, choiceIndex, choiceText, customInput, context = {} }) {
  const indexed = choiceIndex !== undefined && choiceIndex !== null;
  const persisted = indexed && Number.isInteger(Number(choiceIndex)) ? latestChoices[Number(choiceIndex)] : null;
  if (indexed && (!persisted || (choiceText && stripGeneratedChoiceAnnotations(persisted.text) !== stripGeneratedChoiceAnnotations(choiceText)))) return { ok: false, error: 'The selected choice no longer matches the authoritative scene.', error_code: 'stale_choice_contract' };
    const selected = normalizeChoiceActionContract(persisted || { ...context, text: choiceText || customInput || 'Continue' });
  // Custom-action text recognition must not revive a client-supplied skill roll.
  if (!persisted && selected.action_type === 'weapon_attack' && context?.check?.raw_d20 != null) return { ok: false, error: 'An attack cannot continue from a story skill receipt. No attack was rolled.', error_code: 'attack_cannot_resolve_as_skill' };
  return { ok: true, contract: selected };
}