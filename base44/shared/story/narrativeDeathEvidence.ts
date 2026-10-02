// A committed kill + its immediately linked searched aftermath can establish
// narrative-mode remains. This never authorizes a newly generated attack.
const countedCultists = /\b(?:the )?two (?:remaining )?cultists\b/i;
const collapse = /\b(?:the )?cultists collapse instantly[^.]*connection to the Weaver severed[^.]*crumple\b/i;
const remains = /\bbodies of the cultist vanguard\b[^.]*pooling,? cold blood\b/i;
const searched = /\b(?:searching|search|searched)\b/i;
const livingCultists = /\b(?:cultists?|guards?|vanguard scouts?)\b[^.]{0,70}\b(?:alive|breathing|unconscious|stabili[sz]ed|wake|wakes|stand up|stands up|escape|escapes|flee|flees|speak|speaks)\b/i;
export function hasCommittedCultistDeathChain(session, entry, candidate) {
  const log = session.story_log || [], index = log.indexOf(entry), aftermath = log[index + 1];
  if (index < 0 || session.in_combat || entry.mechanics_status === 'pending' || !aftermath || aftermath.mechanics_status === 'pending'
    || entry.combat_handoff || entry.authoritative_weapon_attack?.combat_id || (entry.scene_location && entry.scene_location !== session.current_location)
    || (aftermath.scene_location && aftermath.scene_location !== session.current_location)) return false;
  if (candidate.quantity !== 2 || candidate.name.toLowerCase() !== 'cultists' || candidate.quote !== entry.text || candidate.source_request_id !== entry.request_id) return false;
  const deathSentence = String(entry.text).split(/(?<=[.!?])\s+/).find(x => collapse.test(x)) || '';
  if (/\b(?:if|might|could|would|perhaps|not|unconscious|alive|breathing)\b/i.test(deathSentence)) return false;
  if (!countedCultists.test(entry.text) || !collapse.test(entry.text) || !remains.test(aftermath.text) || !searched.test(aftermath.text)
    || !/\b(?:scavenge|search|investigate)\b/i.test(aftermath.player_choice || '') || !/\b(?:guards|cultists|bodies)\b/i.test(aftermath.player_choice || '')) return false;
  return !log.slice(index).some(e => livingCultists.test(e.text || ''));
}
export function committedCultistCandidate(session, entry) {
  const candidate = { name: 'cultists', aliases: ['cultist guards', 'vanguard scouts'], type: 'corpse', status: 'dead', quantity: 2, source_request_id: entry.request_id, quote: entry.text };
  return hasCommittedCultistDeathChain(session, entry, candidate) ? candidate : null;
}