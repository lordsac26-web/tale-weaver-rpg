import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const APP_URL = 'https://tale-weaver-cotfr.base44.app';
const fetchText = async (url) => { const response = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache, no-store' }, signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); };

export default async function testStoryCommitDeployedBundleRegression(req) {
  const base44 = createClientFromRequest(req); const before = await hashValue(await readProtectedDndState(base44.asServiceRole));
  try {
    await req.json().catch(() => ({})); const page = new URL(APP_URL); page.searchParams.set('__story_commit_gate', String(Date.now())); const html = await fetchText(page.href);
    const sources = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi)].map((match) => match[2]);
    const assets = sources.map((source) => new URL(source, page)).filter((url) => url.origin === page.origin && /^\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(url.pathname)); if (assets.length !== 1) throw new Error(`Expected one index asset; found ${assets.length}`);
    const code = await fetchText(assets[0].href); const markers = ['story-transition-v2.5.0', 'choice-action-transition-v1.0.0', 'persistence_unconfirmed', 'persisted_pair_mismatch', 'The authoritative scene and choice were preserved; retry when ready.'];
    const after = await hashValue(await readProtectedDndState(base44.asServiceRole)); const result = { function_version: 'test-story-commit-deployed-bundle-v1.2.0', source_expected_transition_version: 'story-transition-v2.5.0', source_expected_choice_action_version: 'choice-action-transition-v1.0.0', public_asset: assets[0].pathname.split('/').pop(), public_markers: Object.fromEntries(markers.map((marker) => [marker, code.includes(marker)])), protected_unchanged: before === after, writes: 0 };
    result.public_all_pass = Object.values(result.public_markers).every(Boolean); result.all_pass = result.public_all_pass && result.protected_unchanged; return Response.json(result, { status: result.all_pass ? 200 : 500 });
  } catch (error) { const after = await hashValue(await readProtectedDndState(base44.asServiceRole)); return Response.json({ error: error.message, function_version: 'test-story-commit-deployed-bundle-v1.2.0', source_expected_transition_version: 'story-transition-v2.5.0', source_expected_choice_action_version: 'choice-action-transition-v1.0.0', protected_unchanged: before === after, writes: 0, public_all_pass: false, all_pass: false }, { status: 500 }); }
}