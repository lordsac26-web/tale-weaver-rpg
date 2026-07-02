import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OPEN5E = 'https://api.open5e.com/v1';

// Most classes choose their subclass at level 3; these pick earlier.
const SUBCLASS_LEVEL = {
  Cleric: 1, Sorcerer: 1, Warlock: 1,
  Druid: 2, Wizard: 2,
};

/**
 * Pulls every class's subclasses (Open5e "archetypes") into the Subclass entity.
 * Admin-only. Idempotent: clears existing Subclass rows then re-inserts.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all classes (with embedded archetypes)
    let classes = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const res = await fetch(`${OPEN5E}/classes/?limit=50&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      classes = [...classes, ...(data.results || [])];
      hasMore = !!data.next;
      page++;
    }

    // Build subclass records
    const records = [];
    for (const cls of classes) {
      const className = cls.name;
      const flavor = cls.subtypes_name || 'Subclass';
      const level = SUBCLASS_LEVEL[className] || 3;
      for (const arch of (cls.archetypes || [])) {
        const desc = arch.desc || '';
        // First paragraph as a short description
        const short = desc.split('\n').map(s => s.trim()).find(Boolean) || '';
        records.push({
          name: arch.name,
          class_name: className,
          description: desc,
          short_description: short.replace(/[#*]/g, '').slice(0, 240),
          subclass_flavor: flavor,
          features_by_level: { [level]: [`${arch.name} features`] },
          source: arch.document__title || arch.document_slug || '5e SRD',
          raw_data: arch,
        });
      }
    }

    // Clear & re-insert (idempotent)
    const existing = await base44.asServiceRole.entities.Subclass.list('-created_date', 1000);
    for (const e of existing) {
      await base44.asServiceRole.entities.Subclass.delete(e.id);
    }

    // Bulk insert in chunks
    let inserted = 0;
    for (let i = 0; i < records.length; i += 50) {
      const chunk = records.slice(i, i + 50);
      await base44.asServiceRole.entities.Subclass.bulkCreate(chunk);
      inserted += chunk.length;
    }

    return Response.json({
      success: true,
      classes_scanned: classes.length,
      subclasses_inserted: inserted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});