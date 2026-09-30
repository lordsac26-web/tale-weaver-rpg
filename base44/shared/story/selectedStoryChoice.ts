import { normalizeChoiceActionContract } from './choiceActionContract.js';
import { stripGeneratedChoiceAnnotations } from './generatedChoiceIntent.js';

export function selectStoryChoice({ latestChoices, choiceIndex, choiceText, customInput, context = {} }) {
  const indexed = choiceIndex !== undefined && choiceIndex !== null;
  const persisted = indexed && Number.isInteger(Number(choiceIndex)) ? latestChoices[Number(choiceIndex)] : null;
  if (indexed && (!persisted || (choiceText && stripGeneratedChoiceAnnotations(persisted.text) !== stripGeneratedChoiceAnnotations(choiceText)))) return { ok: false, error: 'The selected choice no longer matches the authoritative scene.', error_code: 'stale_choice_contract' };
  return { ok: true, contract: normalizeChoiceActionContract(persisted || { ...context, text: choiceText || customInput || 'Continue' }) };
}