import { evidenceEntries, materializeSceneCandidates } from './sceneEvidence.ts';
import { committedCultistCandidate } from './narrativeDeathEvidence.ts';

const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SCENE_STOP = new Set(['the','of','a','an','at','in','on','near','to','with','and','having','from','into','his','her','their','your','by','for']);
const ORDINAL = /\b(first|second|third|fourth|fifth)\b/;

// A scene match tolerant of rewording ("Threshold of the Spire of Whispers…"
// vs "at the Spire of Whispers"), but never across distinct ordinals such as
// the first and second harmonic node.
export function sameNarrativeScene(a, b) {
  if (!a || !b) return true;
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  const oa = na.match(ORDINAL), ob = nb.match(ORDINAL);
  if (oa && ob && oa[0] !== ob[0]) return false;
  const ta = new Set(na.split(' ').filter(t => t && !SCENE_STOP.has(t)));
  let overlap = 0;
  new Set(nb.split(' ')).forEach(t => { if (ta.has(t)) overlap++; });
  return overlap >= 2;
}

// Committed narrative remains reach a second, authoritative source: the scene
// registry. A corpse materialized from committed DM narration (narrative_derived
// death provenance) is stowable exactly where it died, so narrated defeats stay
// lootable instead of existing only as prose.
function registryCorpseEntities({ session, structured, seen }) {
  const out = [];
  const liveIds = new Set((structured || []).filter(x => x && (Number(x.hp_current) > 0 || x.is_conscious === true || x.is_stable === true)).map(x => x.id || x.entity_id));
  for (const entity of (session.world_state?.scene_entities || []).slice(0, 64)) {
    if (!entity || entity.type !== 'corpse' || entity.status !== 'dead') continue;
    if (entity.evidence?.narrative_derived !== true) continue;
    if (entity.transfer_state && entity.transfer_state !== 'world') continue;
    if (!entity.id || seen.has(entity.id) || liveIds.has(entity.id)) continue;
    const provenance = entity.death_provenance || {};
    if (provenance.source !== 'narrative_derived' || !provenance.scene_entity_id || !provenance.source_request_id || !provenance.source_hash) continue;
    if (!sameNarrativeScene(entity.location, session.current_location)) continue;
    seen.add(entity.id);
    out.push(entity);
  }
  return out;
}

export async function readNarrativeCorpseEntities({ session, structured = [] }) {
  const seen = new Set();
  const entities = registryCorpseEntities({ session, structured, seen });
  for (const entry of evidenceEntries(session).slice(-4)) {
    const candidate = committedCultistCandidate(session, entry);
    if (!candidate) continue;
    const projection = await materializeSceneCandidates({ session, entry, candidates: [candidate], structured });
    for (const accepted of projection.accepted) {
      if (seen.has(accepted.id)) continue;
      seen.add(accepted.id);
      entities.push({ ...accepted, name: `Tunnel Cultist Guard ${accepted.source_ordinal}`, aliases: [...accepted.aliases, 'guards', 'corpses'] });
    }
  }
  return entities;
}