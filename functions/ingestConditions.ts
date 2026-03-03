import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all conditions from Open5e v2
    const res = await fetch(`${OPEN5E}/conditions/?limit=100`);
    if (!res.ok) throw new Error('Failed to fetch conditions');
    const data = await res.json();
    const conditions = data.results || [];

    // Transform to DnDCondition entity schema
    const transformed = conditions.map(c => ({
      name: c.name,
      description: Array.isArray(c.description) ? c.description : (c.description ? [c.description] : []),
      mechanical_effects: c.mechanical_effects || {}
    }));

    // Bulk create
    const result = await base44.asServiceRole.entities.DnDCondition.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} conditions`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});