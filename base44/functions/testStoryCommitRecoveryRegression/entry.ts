import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import storyCommitRecoveryFixtures from '../../shared/tests/storyCommitRecoveryFixtures.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    const report = await storyCommitRecoveryFixtures();
    return Response.json({ version: 'story-commit-recovery-regression-v1', ...report }, { status: report.all_pass ? 200 : 500 });
  } catch (error) {
    console.error('Story recovery fixture failed', error);
    return Response.json({ error: error.message, all_pass: false }, { status: 500 });
  }
}