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

export function applyAuthoritativeStorySkillOutcome(result, actionText, resolution) {
  if (!resolution?.ok || resolution.skill !== 'Stealth' || !/\bhide|hiding|secluded|conceal|shadow|sneak\b/i.test(String(actionText || ''))) return result;
  if (!resolution.success) return { ...result, authoritative_skill_check: resolution.receipt };
  return {
    ...result,
    narrative: 'You settle into concealment without betraying your position. Pass without Trace muffles every sound, and the threat fails to locate you.',
    combat_trigger: false,
    enemies: [],
    hp_change: 0,
    condition_update: { target: 'player', add: 'Stealthed', remove: ['Engaged'], duration: 'scene' },
    authoritative_skill_check: resolution.receipt,
  };
}