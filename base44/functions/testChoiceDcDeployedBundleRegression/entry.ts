import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeChoiceCheckDisplay } from '../../shared/story/choiceCheckDisplay.js';
import { hashValue, PROTECTED_DND_IDS, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const MARKER = 'data-choice-dc-render-version';
const DUPLICATE_APPEND_PATTERNS = [
  /skill_check\s*[},)]\s*[+,:]?\s*["'`]\s*DC\s*["'`]/i,
  /skill_check.{0,45}["'`]DC["'`].{0,45}(?:\.dc|\["dc"\])/i,
  /(?:\.skill|\["skill"\]).{0,45}["'`]DC["'`].{0,45}(?:\.dc|\["dc"\])/i,
];
const fetchText = async (url) => {
  const response = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache, no-store', pragma: 'no-cache' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Fetch failed for ${url}: HTTP ${response.status}`);
  return response.text();
};
const scriptRefs = (text) => [...text.matchAll(/["']([^"']+\.js(?:\?[^"']*)?)["']/gi)].map((match) => match[1]);

export default async function testChoiceDcDeployedBundleRegression(req) {
  const base44 = createClientFromRequest(req);
  const payload = await req.json().catch(() => ({}));
  const before = await hashValue(await readProtectedDndState(base44.asServiceRole));
  const rawUrl = String(payload.deployed_url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) return Response.json({ error: 'deployed_url is required to inspect the published bundle', real_index_asset: null, marker_found_in_exact_asset: false, duplicate_pattern_absent: false, production_render_site_count: 0, rendered_badge_texts: [], protected_ids: PROTECTED_DND_IDS, writes: 0 }, { status: 400 });

  const deployedUrl = new URL(rawUrl);
  deployedUrl.searchParams.set('__choice_dc_v3', String(Date.now()));
  const html = await fetchText(deployedUrl.href);
  const indexMatch = html.match(/<script[^>]+src=["']([^"']*\/index-[A-Za-z0-9_-]+\.js(?:\?[^"']*)?)["']/i);
  if (!indexMatch) return Response.json({ error: 'Published index.html does not reference a hashed index-<hash>.js asset', real_index_asset: null, marker_found_in_exact_asset: false, duplicate_pattern_absent: false, production_render_site_count: 0, rendered_badge_texts: [], protected_ids: PROTECTED_DND_IDS, writes: 0 }, { status: 409 });

  const indexAssetUrl = new URL(indexMatch[1], deployedUrl);
  indexAssetUrl.searchParams.set('__choice_dc_v3', String(Date.now()));
  const indexCode = await fetchText(indexAssetUrl.href);
  const queue = [...new Set([...scriptRefs(html), ...scriptRefs(indexCode)].map((ref) => new URL(ref, indexAssetUrl).href))];
  const assetBodies = new Map([[indexAssetUrl.href, indexCode]]);
  while (queue.length && assetBodies.size < 50) {
    const url = queue.shift();
    if (assetBodies.has(url) || new URL(url).origin !== deployedUrl.origin) continue;
    const code = await fetchText(url);
    assetBodies.set(url, code);
    scriptRefs(code).forEach((ref) => queue.push(new URL(ref, url).href));
  }

  const markerCount = indexCode.split(MARKER).length - 1;
  const duplicatePatternAbsent = [...assetBodies.values()].every((code) => DUPLICATE_APPEND_PATTERNS.every((pattern) => !pattern.test(code)));
  const renderedBadgeTexts = [
    { skill_check: 'Investigation DC16', dc: 'DC16' },
    { skill_check: 'Survival DC16', dc: 'DC16' },
    { skill_check: 'Arcana DC15', dc: 'DC15' },
    { skill_check: 'Athletics DC14', dc: 'DC14' },
  ].map((choice) => normalizeChoiceCheckDisplay(choice).badgeText);
  const renderedValid = renderedBadgeTexts.every((text) => (text.match(/\bDC\b/gi) || []).length === 1 && (text.match(/\b\d+\b/g) || []).length === 1);
  const after = await hashValue(await readProtectedDndState(base44.asServiceRole));
  const protectedUnchanged = before === after;
  const markerFound = markerCount > 0;
  const passed = markerFound && duplicatePatternAbsent && markerCount === 1 && renderedValid && protectedUnchanged;
  return Response.json({ deployment_id: 'choice-dc-deployed-bundle-v3', real_index_asset: indexMatch[1].split('?')[0].split('/').pop(), real_index_asset_url: indexAssetUrl.href.split('?')[0], marker_found_in_exact_asset: markerFound, duplicate_pattern_absent: duplicatePatternAbsent, production_render_site_count: markerCount, built_js_asset_count: assetBodies.size, rendered_badge_texts: renderedBadgeTexts, protected_ids: PROTECTED_DND_IDS, protected_unchanged: protectedUnchanged, writes: 0, all_pass: passed }, { status: passed ? 200 : 500 });
}