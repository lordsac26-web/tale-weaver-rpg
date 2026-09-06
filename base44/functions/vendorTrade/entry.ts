import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handleVendorTradeRequest } from '../../shared/vendorTradeRequest.ts';

export default async function vendorTrade(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json();
    const catalogItems = await base44.asServiceRole.entities.VendorItem.list('name', 500);
    const result = await handleVendorTradeRequest({ payload, db: base44.asServiceRole, user, catalogItems });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Vendor trade failed' }, { status: 500 });
  }
}