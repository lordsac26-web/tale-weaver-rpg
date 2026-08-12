import React from 'npm:react@18.2.0';
import { renderToStaticMarkup } from 'npm:react-dom@18.2.0/server';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { CHOICE_CHECK_BOUNDARY_CONTRACT, createChoiceCheckBadgeElement } from '../../shared/story/choiceCheckDisplay.js';
import { hashValue, PROTECTED_DND_IDS, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const renderBadge = (choice) => renderToStaticMarkup(createChoiceCheckBadgeElement(React.createElement, choice, { 'data-story-choice-check-badge': 'true' }));
const visibleText = (markup) => markup.replace(/<[^>]*>/g, '');
const oneDc = (text) => (text.match(/\bDC\b/gi) || []).length === 1 && (text.match(/\b\d+\b/g) || []).length === 1;

export default async function testChoiceDcLiveComponentRegression(req) {
  const base44 = createClientFromRequest(req);
  await req.json().catch(() => ({}));
  const before = await hashValue(await readProtectedDndState(base44.asServiceRole));
  const screenshotChoices = [
    { skill_check: 'Investigation DC16', dc: 'DC16', expected: 'INVESTIGATION DC 16' },
    { skill_check: 'Survival DC 16', dc: 'DC 16', expected: 'SURVIVAL DC 16' },
    { skill: '[Skill Check: Arcana DC15]', difficulty_class: 'DC15', expected: 'ARCANA DC 15' },
    { skill_check: 'Athletics DC14 DC14', dc: 14, expected: 'ATHLETICS DC 14' },
  ];
  const rendered = screenshotChoices.map(({ expected, ...choice }) => ({ expected, markup: renderBadge(choice) }));
  const results = rendered.map(({ expected, markup }, index) => {
    const text = visibleText(markup);
    return { name: `live story choice badge ${index + 1}`, pass: text === expected && oneDc(text), rendered_text: text };
  });
  const conflictText = visibleText(renderBadge({ skill_check: 'Arcana DC14', dc: 'DC 15' }));
  results.push({ name: 'prefixed structured DC wins a conflicting embedded DC', pass: conflictText === 'ARCANA DC 15' && oneDc(conflictText), rendered_text: conflictText });
  const legacyText = visibleText(renderBadge({ skill_check: 'Investigation (DC 16)' }));
  results.push({ name: 'legacy embedded DC renders once when structured DC is absent', pass: legacyText === 'INVESTIGATION DC 16' && oneDc(legacyText), rendered_text: legacyText });
  const noCheckMarkup = renderBadge({ text: 'Wait 16 minutes.' });
  results.push({ name: 'no-check choice renders no check badge', pass: noCheckMarkup === '' });
  results.push({ name: 'production render boundary has no separate DC append path', pass: CHOICE_CHECK_BOUNDARY_CONTRACT.text_children === 'formatted_badge_text_only' && CHOICE_CHECK_BOUNDARY_CONTRACT.separately_appends_dc === false && CHOICE_CHECK_BOUNDARY_CONTRACT.production_render_sites.length === 1 });
  const after = await hashValue(await readProtectedDndState(base44.asServiceRole));
  results.push({ name: 'protected live IDs unchanged with zero entity writes', pass: before === after });
  const passed = results.filter((result) => result.pass).length;
  return Response.json({ deployment_id: 'choice-dc-live-component-v2', production_bundle_id: 'story-choice-dc-boundary-v2', changed_component_files: ['src/components/game/StoryPanel.jsx', 'src/components/game/StoryChoiceCheckBadge.jsx'], production_render_sites: CHOICE_CHECK_BOUNDARY_CONTRACT.production_render_sites, passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, writes: 0, protected_ids: PROTECTED_DND_IDS, results }, { status: passed === results.length ? 200 : 500 });
}