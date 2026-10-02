import { evidenceEntries, materializeSceneCandidates } from './sceneEvidence.ts';
import { committedCultistCandidate } from './narrativeDeathEvidence.ts';

export async function readNarrativeCorpseEntities({ session, structured = [] }) {
  const entities = [];
  for (const entry of evidenceEntries(session).slice(-4)) {
    const candidate = committedCultistCandidate(session, entry);
    if (!candidate) continue;
    const projection = await materializeSceneCandidates({ session, entry, candidates: [candidate], structured });
    entities.push(...projection.accepted.map(x => ({ ...x, name: `Tunnel Cultist Guard ${x.source_ordinal}`, aliases: [...x.aliases, 'guards', 'corpses'] })));
  }
  return entities;
}