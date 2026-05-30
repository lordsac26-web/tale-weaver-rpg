import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OPEN5E = 'https://api.open5e.com/v2';

// Map Open5e feat "type" to our category buckets.
const CATEGORY_MAP = {
  GENERAL: 'General',
  COMBAT: 'Combat',
  MAGIC: 'Magic',
  RACIAL: 'Racial',
  SKILL: 'Utility',
};

/**
 * Pulls all feats from Open5e v2 into the Feat entity.
 * Admin-only. Idempotent: clears existing non-curated feats then re-inserts.
 * Curated feats (has_engine_support=true) are preserved so engine wiring isn't lost.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all feats
    let feats = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const res = await fetch(`${OPEN5E}/feats/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      feats = [...feats, ...(data.results || [])];
      hasMore = !!data.next;
      page++;
    }

    // Names already curated in featData.jsx with engine support — keep those rows intact.
    const existing = await base44.asServiceRole.entities.Feat.list('-created_date', 1000);
    const curatedNames = new Set(
      existing.filter(f => f.has_engine_support).map(f => (f.name || '').toLowerCase())
    );
    // Delete previously-ingested (non-curated) rows so re-runs stay idempotent.
    for (const f of existing) {
      if (!f.has_engine_support) await base44.asServiceRole.entities.Feat.delete(f.id);
    }

    // Transform, skipping any that duplicate a curated feat by name.
    const records = [];
    const seen = new Set();
    for (const f of feats) {
      const lower = (f.name || '').toLowerCase();
      if (!f.name || curatedNames.has(lower) || seen.has(lower)) continue;
      seen.add(lower);
      records.push({
        name: f.name,
        prerequisite: f.prerequisite || null,
        category: CATEGORY_MAP[f.type] || 'General',
        description: f.desc || '',
        benefits: (f.benefits || []).map(b => b.desc).filter(Boolean),
        tags: [],
        asi: false,
        asi_choices: [],
        source: f.document?.display_name || f.document?.name || '5e SRD',
        has_engine_support: false,
        raw_data: f,
      });
    }

    let inserted = 0;
    for (let i = 0; i < records.length; i += 50) {
      const chunk = records.slice(i, i + 50);
      await base44.asServiceRole.entities.Feat.bulkCreate(chunk);
      inserted += chunk.length;
    }

    return Response.json({
      success: true,
      feats_fetched: feats.length,
      feats_inserted: inserted,
      curated_preserved: curatedNames.size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});