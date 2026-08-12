import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeChoiceCheckDisplay } from '../../shared/story/choiceCheckDisplay.js';
import { hashValue, PROTECTED_DND_IDS, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const dcTokens = (value) => (String(value || '').match(/\bDC\s*\d+\b/gi) || []).length;

export default async function testChoiceDcDisplayRegression(req) {
  const base44 = createClientFromRequest(req);
  await req.json().catch(() => ({}));
  const before = await hashValue(await readProtectedDndState(base44.asServiceRole));
  const cases = [
    ['clean skill + structured DC', { skill_check: 'Investigation', dc: 16 }, 'INVESTIGATION DC 16'],
    ['compact embedded DC', { skill_check: 'Investigation DC16', dc: 16 }, 'INVESTIGATION DC 16'],
    ['spaced embedded DC', { skill_check: 'Investigation DC 16', dc: 16 }, 'INVESTIGATION DC 16'],
    ['parenthesized embedded DC', { skill_check: 'Investigation (DC 16)', dc: 16 }, 'INVESTIGATION DC 16'],
    ['bracketed embedded DC', { skill_check: '[Skill Check: Investigation DC16]', dc: 16 }, 'INVESTIGATION DC 16'],
    ['duplicate embedded fragments', { skill_check: 'Investigation DC16 DC 16 (DC 16)', dc: 16 }, 'INVESTIGATION DC 16'],
    ['legacy embedded DC only', { skill_check: 'Investigation DC16' }, 'INVESTIGATION DC 16'],
  ];
  const results = cases.map(([name, choice, expected]) => {
    const normalized = normalizeChoiceCheckDisplay(choice);
    return { name, pass: normalized.badgeText === expected && dcTokens(normalized.badgeText) === 1 };
  });
  const conflict = normalizeChoiceCheckDisplay({ skill_check: 'Arcana DC14', dc: 16 });
  results.push({ name: 'conflicting embedded and structured DC uses structured value', pass: conflict.badgeText === 'ARCANA DC 16' && conflict.dc === 16 && conflict.diagnostic?.type === 'choice_dc_conflict' });
  const empty = normalizeChoiceCheckDisplay({ text: 'Wait and listen.' });
  results.push({ name: 'choice without skill or DC has no badge', pass: empty.badgeText === null && empty.dc === null });
  const body = 'Inspect 2 doors, then count 16 tiles.';
  const bodyChoice = { text: body, skill_check: 'Investigation DC16', dc: 16 };
  normalizeChoiceCheckDisplay(bodyChoice);
  results.push({ name: 'choice body numerals remain untouched', pass: bodyChoice.text === body });
  const screenshotChoices = [{ skill_check: 'Investigation DC16', dc: 16 }, { skill_check: 'Survival DC 16', dc: 16 }, { skill_check: 'Arcana (DC 16)', dc: 16 }, { skill_check: '[Skill Check: Athletics DC14]', dc: 14 }].map((choice) => normalizeChoiceCheckDisplay(choice));
  results.push({ name: 'four screenshot-shaped choices each render exactly one DC token', pass: screenshotChoices.every((choice) => choice.badgeText && dcTokens(choice.badgeText) === 1) });
  const after = await hashValue(await readProtectedDndState(base44.asServiceRole));
  results.push({ name: 'protected live IDs unchanged with zero entity writes', pass: before === after });
  const passed = results.filter((result) => result.pass).length;
  return Response.json({ deployment_id: 'choice-dc-display-v1', passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, writes: 0, protected_ids: PROTECTED_DND_IDS, results }, { status: passed === results.length ? 200 : 500 });
}