import { classifyNarratedAcquisition, NARRATED_RECOVERY_PARSER_VERSION, validateNarratedRecovery } from './narratedStoryInventoryCommit.ts';

export const GENERATED_RECOVERY_RESOLUTION_VERSION = 'generated-recovery-resolution-v1.0.0';

const fallbackChoices = (location) => [
  { text: `Study the safest route through ${location}.`, skill_check: 'Perception', dc: 11, risk_level: 'low' },
  { text: 'Continue quietly while watching the surrounding cover.', skill_check: 'Stealth', dc: 12, risk_level: 'medium' },
  { text: 'Pause and listen for movement ahead.', skill_check: 'Perception', dc: 12, risk_level: 'low' },
  { text: 'Circle toward firmer terrain before proceeding.', skill_check: 'Survival', dc: 13, risk_level: 'medium' },
];

const groundedFallback = ({ action, location, check }) => ({
  narrative: `${check?.success === false ? 'The attempt does not gain the intended advantage' : 'Your cautious advance succeeds'}, and you remain focused on the surroundings. The terrain around ${location} offers several ways forward, but nothing changes hands and no supplies are added.`,
  choices: fallbackChoices(location),
  current_recovery: null,
  loot: [],
  loot_coins: { gold: 0, silver: 0, copper: 0 },
  xp_earned: 0,
  combat_trigger: false,
  enemies: [],
  key_event: '',
  recovery_fallback: { action: String(action || '').slice(0, 240), reason: 'unsupported_acquisition_removed' },
});

export async function resolveGeneratedRecoveryCandidate({ candidate, regenerate, action, location, check }) {
  const inspect = (value) => validateNarratedRecovery({ narrative: value?.narrative, recovery: value?.current_recovery });
  const initial = inspect(candidate);
  if (initial.ok) return { result: candidate, parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: initial.status, attempts: 0, initial_validation: initial };

  const repaired = await regenerate({
    validation: initial,
    instruction: `RECOVERY SCHEMA REPAIR: The prior candidate was rejected by ${NARRATED_RECOVERY_PARSER_VERSION} as ${initial.status}. Trigger: ${JSON.stringify(initial.claim)}. Rewrite the complete response once. If the current action truly grants that exact item, emit a matching current_recovery object; otherwise remove the acquisition claim while preserving the authoritative roll result and return exactly four choices.`,
  });
  const repairedValidation = inspect(repaired);
  if (repairedValidation.ok) return { result: repaired, parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: repairedValidation.status, attempts: 1, initial_validation: initial, final_validation: repairedValidation };

  const fallback = groundedFallback({ action, location: location || 'the current area', check });
  const fallbackValidation = inspect(fallback);
  return { result: fallback, parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: fallbackValidation.status, attempts: 1, fallback_used: true, initial_validation: initial, final_validation: fallbackValidation, rejected_repair: { narrative: repaired?.narrative, current_recovery: repaired?.current_recovery, validation: repairedValidation } };
}

export const generatedRecoveryDiagnostics = (result) => ({
  parser_version: NARRATED_RECOVERY_PARSER_VERSION,
  classification: classifyNarratedAcquisition(result?.narrative).classification,
  current_recovery: result?.current_recovery || null,
});