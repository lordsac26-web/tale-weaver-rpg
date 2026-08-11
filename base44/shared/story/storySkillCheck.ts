import { buildSkillCheckReceipt, resolveAuthoritativeSkillModifier } from '../skills/authoritativeSkillModifier.ts';

const validD20 = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20;

export function resolveStorySkillCheck({ character, session, skill, dc, requestId, raw = null, allRolls = [], advantageSources = [], at = null }) {
  const breakdown = resolveAuthoritativeSkillModifier({ character, session, skill });
  if (!breakdown.ok) return { ok: false, error: breakdown.error, breakdown };
  const checkDc = Number(dc);
  if (!Number.isFinite(checkDc) || checkDc < 1) return { ok: false, error: 'A valid skill-check DC is required', breakdown };
  if (raw == null) return { ok: true, skill: breakdown.skill, dc: checkDc, modifier: breakdown.total, breakdown };
  if (!requestId || !validD20(raw)) return { ok: false, error: 'A request ID and one original d20 from 1 to 20 are required', breakdown };
  const selected = Number(raw);
  const rolls = (Array.isArray(allRolls) && allRolls.length ? allRolls : [selected]).map(Number);
  if (!rolls.every(validD20) || !rolls.includes(selected)) return { ok: false, error: 'Skill-check rolls are invalid', breakdown };
  const final = selected + breakdown.total;
  const success = selected !== 1 && (selected === 20 || final >= checkDc);
  const receipt = buildSkillCheckReceipt({ requestId, raw: selected, allRolls: rolls, dc: checkDc, success, breakdown, advantageSources, ...(at ? { at } : {}) });
  return { ok: true, skill: breakdown.skill, dc: checkDc, raw: selected, all_rolls: rolls, modifier: breakdown.total, final, success, breakdown, receipt, branch: success ? 'success' : 'failure' };
}

export function receiptsMatchResolution(incoming, resolution) {
  if (!incoming || !resolution?.receipt) return false;
  return incoming.request_id === resolution.receipt.request_id
    && Number(incoming.raw_d20) === resolution.raw
    && Number(incoming.dc) === resolution.dc
    && Number(incoming.modifier_total) === resolution.modifier
    && Number(incoming.final_total) === resolution.final
    && incoming.success === resolution.success
    && JSON.stringify(incoming.modifier_breakdown) === JSON.stringify(resolution.breakdown);
}

export const formatStorySkillDisplay = (receipt) => `${receipt.skill} DC${receipt.dc} — ${receipt.success ? 'SUCCESS' : 'FAILURE'} (d20 ${receipt.raw_d20} + modifier ${receipt.modifier_total} = ${receipt.final_total})`;

export const isConcealmentMaintenanceAction = (actionText) => /\bhide|hiding|hidden|secluded|conceal|concealment|shadow|sneak|wait|waiting|observe|watch|maintain|remain\b/i.test(String(actionText || ''));

export function applyAuthoritativeStorySkillOutcome(result, actionText, resolution) {
  if (!resolution?.ok) return result;
  const authoritative = { ...result, authoritative_skill_check: resolution.receipt };
  if (resolution.skill !== 'Stealth' || !isConcealmentMaintenanceAction(actionText)) return authoritative;
  if (!resolution.success) return authoritative;
  return {
    ...authoritative,
    narrative: 'You remain still and patient, preserving your concealed vantage without betraying your position. The threat continues toward the bait, unaware of you, and no further action is taken.',
    combat_trigger: false,
    enemies: [],
    hp_change: 0,
    condition_update: { target: 'player', add: 'Stealthed', remove: ['Engaged', 'Exposed'], duration: 'scene' },
  };
}

export function enforceStorySkillOutcomeInvariant(result, actionText, resolution) {
  if (!resolution?.ok) return { ok: true, result };
  const next = { ...applyAuthoritativeStorySkillOutcome(result, actionText, resolution), skill_display: formatStorySkillDisplay(resolution.receipt) };
  if (JSON.stringify(next.authoritative_skill_check) !== JSON.stringify(resolution.receipt)) return { ok: false, error: 'Story output diverged from the authoritative skill receipt.' };
  if (next.combat_trigger) next.combat_handoff = { resolution_id: resolution.receipt.resolution_id || resolution.receipt.request_id, skill_check: resolution.receipt };
  if (next.combat_trigger && JSON.stringify(next.combat_handoff?.skill_check) !== JSON.stringify(resolution.receipt)) return { ok: false, error: 'Combat handoff does not consume the authoritative skill resolution.' };
  if (resolution.skill === 'Stealth' && isConcealmentMaintenanceAction(actionText) && resolution.success && (next.combat_trigger || next.condition_update?.add !== 'Stealthed')) return { ok: false, error: 'Successful concealment cannot create combat or Exposed state.' };
  return { ok: true, result: next };
}