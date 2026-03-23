import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all races from Open5e
    let races = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(`${OPEN5E}/races/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      races = [...races, ...(data.results || [])];
      hasMore = !!data.next;
      page++;
    }

    // Transform to Race entity schema
    const transformed = races.map(r => {
      const statBonuses = {};
      (r.asi || []).forEach(a => {
        (a.attributes || []).forEach(attr => {
          const key = attr.toLowerCase();
          statBonuses[key] = (statBonuses[key] || 0) + (a.value || 0);
        });
      });

      return {
        name: r.name,
        description: r.desc || '',
        ability_score_increase: statBonuses,
        age: r.age || '',
        alignment: r.alignment || '',
        size: r.size_raw || 'Medium',
        speed: r.speed?.walk || 30,
        languages: r.languages ? r.languages.split(',').map(l => l.trim()) : [],
        traits: parseTraits(r.traits || ''),
        subraces: (r.subraces || []).map(sr => ({
          name: sr.name,
          description: sr.desc || '',
          ability_score_increase: (sr.asi || []).reduce((acc, a) => {
            (a.attributes || []).forEach(attr => {
              const key = attr.toLowerCase();
              acc[key] = a.value || 0;
            });
            return acc;
          }, {}),
          traits: parseTraits(sr.traits || '')
        })),
        raw_data: r
      };
    });

    // Clear existing races first (optional)
    // await base44.asServiceRole.entities.Race.delete({ name: { $exists: true } });

    // Bulk create
    const result = await base44.asServiceRole.entities.Race.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} races`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseTraits(text) {
  const traits = [];
  const lines = text.split('\n');
  lines.forEach(line => {
    const match = line.match(/^\*\*([^*]+)\*\*\s*\.\s*(.+)/);
    if (match) {
      traits.push({ name: match[1], description: match[2] });
    }
  });
  return traits;
}