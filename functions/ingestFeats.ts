import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all feats from Open5e v2
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

    // Transform - note: Base44 doesn't have Feat entity, we'll need to create it or skip
    // For now, just returning the count
    return Response.json({ 
      success: true, 
      count: feats.length,
      message: `Found ${feats.length} feats (Feat entity creation needed)`,
      sample: feats.slice(0, 2)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});