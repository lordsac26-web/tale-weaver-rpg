const norm = value => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set('i me my the a an to of at in on and please loot search inspect examine body bodies corpse corpses dead killed just one nearest closest him her it them that this you put down'.split(' '));
const terms = value => norm(value).split(' ').filter(word => word && !STOP.has(word));
const names = entity => [entity.id, entity.name, entity.source_name, ...(entity.aliases || []), ...(entity.player_aliases || [])].filter(Boolean);
export const SEMANTIC_SCENE_REFERENCE_VERSION = 'semantic-scene-reference-v2.0.0';

// Identity selection only. Neither the model nor player words can mint scene facts.
export async function resolveSemanticSceneReference({ base44, catalog, actionText, answerText = '', boundIds = [], optionIds = [] }) {
  const reference = answerText.trim() || actionText;
  const usable = catalog.filter(entity => !entity.transfer_state || entity.transfer_state === 'world');
  const pinned = boundIds.length === 1 ? usable.find(entity => entity.id === boundIds[0]) : null;
  if (pinned) return { target: pinned, assumption: '' };
  const idMatch = usable.find(entity => reference.trim() === entity.id);
  if (idMatch) return { target: idMatch, assumption: '' };
  const ordinal = norm(reference).match(/\b(first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th)?)\b/);
  if (ordinal) {
    const number = ['first','second','third','fourth','fifth'].indexOf(ordinal[1]) + 1 || parseInt(ordinal[1]);
    const ordered = optionIds.length ? optionIds.map(id => usable.find(entity => entity.id === id)).filter(Boolean) : usable;
    const target = ordered[number - 1];
    if (target) return { target, assumption: '' };
  }
  const refTerms = terms(reference);
  const ranked = usable.map((entity, index) => ({ entity, index, score: Math.max(0, ...names(entity).map(name => {
    const labelTerms = terms(name);
    return refTerms.filter(word => labelTerms.some(label => label === word || label.replace(/s$/, '') === word.replace(/s$/, ''))).length;
  })) })).sort((a, b) => b.score - a.score || a.index - b.index);
  const relevant = ranked.filter(row => row.score > 0);
  const pronoun = /\b(?:him|her|it|the body|the dead one|corpse|just killed|put down|fallen)\b/i.test(reference);
  if (relevant.length === 1 || (relevant.length > 1 && relevant[0].score > relevant[1].score)) return { target: relevant[0].entity, assumption: '' };
  if (!refTerms.length && usable.length === 1 && pronoun) return { target: usable[0], assumption: '' };
  const pool = relevant.length ? relevant.map(row => row.entity) : usable;
  if (!pool.length) return { target: null, terminal: true, reason: 'There is no verified searchable body in this scene. Nothing was rolled or taken.' };
  const proposal = await base44.integrations.Core.InvokeLLM({
    prompt: `Resolve only the intended identity, semantically, from SAVED CANDIDATES. Interpret partial names, aliases, pronouns, ordinal replies, and definite descriptions. A clarification answer binds to the original action, not a new action. Prefer the most recently defeated matching enemy for "the one I just killed". Use nearest only if distance evidence exists; otherwise state a most-recent assumption. Never invent IDs, death, proximity, items, coins or rewards. Unknown subject means no target. Ask at most one identity question; after a reply choose the best supported matching candidate with an explicit assumption, or fail cleanly. DATA=${JSON.stringify({ action: actionText, answer: answerText, candidates: pool.map(entity => ({ id: entity.id, name: entity.name, aliases: entity.aliases, defeat: entity.death_provenance, distance_feet: entity.distance_feet, quote: entity.evidence?.quote })) })}`,
    response_json_schema: { type: 'object', properties: { target_id: { type: 'string' }, ambiguous: { type: 'boolean' }, assumption: { type: 'string' } }, required: ['target_id','ambiguous','assumption'] }
  });
  const target = pool.find(entity => entity.id === proposal.target_id);
  const clean = value => ['null','none','undefined'].includes(String(value || '').toLowerCase()) ? '' : String(value || '').trim();
  if (target && (!proposal.ambiguous || answerText)) return { target, assumption: clean(proposal.assumption) || (proposal.ambiguous ? `Assuming you mean ${target.name}.` : '') };
  // A saved defeat is a supported tie-break, not an invented position or death.
  if (answerText && relevant.length && relevant.every(row => row.entity.status === 'dead')) {
    const sorted = [...relevant].sort((a, b) => (Date.parse(b.entity.death_provenance?.died_at || '') || 0) - (Date.parse(a.entity.death_provenance?.died_at || '') || 0));
    if (sorted.length === 1 || (Date.parse(sorted[0].entity.death_provenance?.died_at || '') || 0) > (Date.parse(sorted[1].entity.death_provenance?.died_at || '') || 0)) return { target: sorted[0].entity, assumption: 'Assuming you mean the most recently defeated matching enemy.' };
  }
  return { target: null, terminal: !!answerText, reason: answerText ? 'That reply does not identify a supported body. This search is stopped; no roll, loot or resources were spent.' : 'Which fallen enemy do you want to search?', options: pool.map(entity => ({ id: entity.id, name: entity.name })) };
}