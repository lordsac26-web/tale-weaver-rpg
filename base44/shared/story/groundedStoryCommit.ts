import { materializeSceneCandidates } from './sceneEvidence.ts';

// Called BEFORE the existing single story/world-state commit, not after it.
// This is only a grounded scene projection, never an inventory reward dispatch.
export async function prepareGroundedStoryCommit({ session, entry, candidates, existingPlan }) {
  const scene = { ...session, current_location: entry.scene_location || session.current_location || '' };
  const existing = (session.world_state?.scene_entities || []).filter(x => x.session_id === session.id && x.location === scene.current_location);
  const freshCandidates = (Array.isArray(candidates) ? candidates : []).filter(x => x.source_request_id === entry.request_id && !existing.some(e => e.id === x.existing_id));
  const projection = await materializeSceneCandidates({ session: scene, entry, candidates: freshCandidates, structured: [...existing, ...(session.combat_state?.combatants || [])], newlyGenerated: true });
  const reconciled = (existingPlan?.targets || []).filter(x => x.session_id === session.id && x.evidence?.authority === 'committed_dm_narration');
  const registry = new Map(existing.map(x => [x.id, x]));
  for (const entity of [...reconciled, ...projection.accepted]) if (!registry.has(entity.id)) registry.set(entity.id, entity);
  return { entities: projection.accepted, registry: [...registry.values()].slice(-64), diagnostics: { version: projection.version, rejected: projection.rejected } };
}