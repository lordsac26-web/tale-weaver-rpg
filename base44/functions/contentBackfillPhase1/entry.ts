import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyPhase1Plan, buildPhase1Plan, loadPhase1Records, PHASE1_DEPLOYMENT_ID } from '../../shared/contentBackfill/phase1.ts';

export default async function contentBackfillPhase1(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const input = await req.json(); const mode = input?.mode === 'apply' ? 'apply' : 'dry_run';
    if (mode === 'dry_run') {
      const plan = await buildPhase1Plan(await loadPhase1Records(base44));
      if (input?.report_section === 'ids') return Response.json({ deployment_id: plan.deployment_id, mode: plan.mode, writes: 0, counts: plan.counts, proposal_hash: plan.proposal_hash, proposal_ids: plan.proposals.map((proposal) => proposal.recipient_id) });
      if (input?.report_section === 'ambiguities') { const offset = Math.max(0, Number(input?.offset) || 0); const limit = Math.min(50, Math.max(1, Number(input?.limit) || 15)); return Response.json({ deployment_id: plan.deployment_id, mode: plan.mode, writes: 0, counts: plan.counts, proposal_hash: plan.proposal_hash, offset, limit, ambiguity_blocks: plan.ambiguity_blocks.slice(offset, offset + limit) }); }
      if (input?.report_section === 'hashes') { const groups = {}; for (const proposal of plan.proposals) { if (!groups[proposal.proposed_value_hash]) groups[proposal.proposed_value_hash] = []; groups[proposal.proposed_value_hash].push(proposal.recipient_id); } return Response.json({ deployment_id: plan.deployment_id, mode: plan.mode, writes: 0, counts: plan.counts, proposal_hash: plan.proposal_hash, proposed_value_hash_groups: groups }); }
      return Response.json({ ...plan, apply_requirements: { proposal_hash: plan.proposal_hash, approval_id: 'required non-empty string', proposals: 'return this exact proposals array' }, live_apply_performed: false });
    }
    const submittedPlan = { proposals: input?.proposals };
    const result = await applyPhase1Plan({ base44, submittedPlan, proposalHash: input?.proposal_hash, approvalId: input?.approval_id });
    return Response.json({ deployment_id: PHASE1_DEPLOYMENT_ID, ...result.body }, { status: result.status });
  } catch (error) {
    return Response.json({ deployment_id: PHASE1_DEPLOYMENT_ID, error: error.message || 'Phase 1 content backfill failed', writes: 0 }, { status: 500 });
  }
}