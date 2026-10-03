const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const isSceneCorpseReply = text => /\b(?:guard|guards|cultist|cultists|bodies|corpses)\b/i.test(text || '') && /\b(?:last narration|just investigated|just searched|last scene)\b/i.test(text || '');
export function investigatedCorpseLinks(session) {
  const log = session.story_log || [], current = log.at(-1), previous = log.at(-2);
  const investigation = current?.skill_check?.skill === 'Investigation' && /\b(?:fallen|dead|bodies|guards|corpse)\b/i.test(current.player_choice || '');
  const entry = investigation ? (log.find(x => x.request_id === current.investigated_story_request_id) || previous) : current;
  return { investigation, investigation_request_id: investigation ? current.request_id : null,
    source_story_request_id: entry?.request_id, combat_ids: [...new Set([entry?.authoritative_weapon_attack?.combat_id, entry?.combat_handoff?.combat_id, ...(entry?.defeat_combat_ids || [])].filter(Boolean))] };
}
export function unresolvedCorpseMessage(context, reason, sources = []) {
  const names = sources.map(x => x.name).join(', '), stored = context.already.map(x => x.name).join(', ');
  if (reason === 'scene_deaths_unverified') return `I understand: you mean ${context.reference}, searched in the last Investigation, not the older bodies in your bag. That narration describes two deaths, but I cannot link both guards to recorded creature identities and confirmed deaths. ${names ? `Verified here: ${names}. ` : ''}${stored ? `Already in your bag: ${stored}. ` : ''}No bodies moved. Keep this attempt paused until the missing defeat evidence is reconciled; rewording your reply or rolling again cannot supply it.`;
  if (reason === 'already_stowed') return `The referenced bodies are already in your bag: ${stored}. They were excluded from this attempt, so no body was moved again.`;
  return `I received your reply, but it does not select one verified group. ${context.candidates.length ? `Available sources: ${context.candidates.map(x => x.label).join('; ')}. Select the exact bodies below.` : `There are no verified, unstowed bodies in this scene. ${stored ? `Already in your bag: ${stored}.` : ''}`} No bodies moved.`;
}
export function matchSceneCorpseReply(context, session, answer, expectedCount) {
  if (!isSceneCorpseReply(answer)) return null;
  const link = investigatedCorpseLinks(session);
  const linked = context.candidates.filter(x => link.combat_ids.includes(x.group) || (x.source === 'narrative_derived' && x.group === link.source_story_request_id));
  const count = expectedCount || (/\b(?:two|both)\b/i.test(answer) ? 2 : null);
  if (link.combat_ids.length && !linked.length && context.already.filter(x => link.combat_ids.some(id => x.id.startsWith(`corpse:${id}:`))).length >= (count || 1)) return { ok: false, reason: 'already_stowed', sources: [] };
  if (!linked.length || (count && linked.length !== count)) return { ok: false, reason: 'scene_deaths_unverified', sources: linked };
  // Adjacency connects the Investigation to its authoritative prior defeat; words
  // like 'killed' never manufacture a creature id, death certificate, or capacity.
  return { ok: true, sources: linked, link };
}
export const requestedCorpseCount = phrase => /\b(?:two|both|2)\b/i.test(norm(phrase)) ? 2 : null;
// A reply such as "stow just 1 body" states only a count, never an identity.
export const replyCorpseCount = text => /\b(?:two|both|2)\b/i.test(norm(text)) ? 2 : /\b(?:one|1|single)\b/i.test(norm(text)) ? 1 : null;
export const COUNT_ONLY_REPLY_WORDS = new Set(['stow','put','place','just','only','one','1','two','2','single','a','an','it','them','in','into','my','bag','holding','please','i','want','to','mean','that','this','of']);