import { normalizeEntityName, containsEntityName } from './entityNameMatch.ts';
import { hashStoryValue } from './storyTransition.ts';

export const BAG_TRANSFER_VERSION = 'bag-transfer-clarification-v1';
export const BAG_EXACT_MATCH_VERSION = 'bag-transfer-exact-name-v2';
export const BAG_PENDING_KEY = '__pending_bag_transfer';
export const bagNorm = normalizeEntityName;
export const bagSourceId = (item, index) => item.scene_entity_id || item.instance_id || item.item_id || item.equipment_id || `stowed:${index}:${item.name}`;
export function parseBagTransfer(actionText) {
  const text=String(actionText || '').normalize('NFKC');
  const verb=text.match(/\b(?:remove|retrieve|take|pull|empty)\w*\b/i);
  const source=text.match(/\b(?:from|out\s+of)\s+(?:(?:the|my|a)\s+)?(?:bag\s+of\s+holding|bag)\b/i);
  if(!verb || !source || source.index<=verb.index)return null;
  const itemPhrase=text.slice(verb.index+verb[0].length,source.index).replace(/^\s*(?:the|a|an|my)\s+/i,'').trim();
  if(!bagNorm(itemPhrase))return null;
  const tail=text.slice(source.index+source[0].length);
  const placement=tail.match(/\b(?:place|put|set|drop|leave|lay|deposit)\s+(?:(?:it|the\s+(?:body|corpse)|that|them)\s+)?(near|beside|next\s+to|alongside|by|on|in|at|into)\s+(.+?)[.!]?\s*$/i);
  return {type:'item_transfer',item_phrase:itemPhrase,source_hint:'Bag of Holding',container:'Bag of Holding',
    destination:placement ? `scene ground ${placement[1].replace(/\s+/g,' ')} ${placement[2].replace(/[.!]$/,'').trim()}` : 'Carried Inventory',
    destination_kind:placement ? 'world' : 'carried',version:BAG_EXACT_MATCH_VERSION};
}
export async function bagTransferCandidates(character, intent) {
  const sources = (character.stowed_items || []).map((item,index)=>({item,index,id:bagSourceId(item,index)}))
    .filter(({item})=>bagNorm(item.container)===bagNorm(intent.container) && Number(item.quantity ?? 1)>0);
  const phrase = bagNorm(intent.item_phrase);
  // Match the source phrase ONLY: the bag and scene destination have other roles.
  const equal=sources.filter(({item})=>bagNorm(item.name)===phrase);
  const exact=equal.length ? equal : sources.filter(({item})=>containsEntityName(intent.item_phrase,item.name));
  const body = /\b(?:body|corpse|remains|bodies)\b/.test(phrase);
  const eligible = body ? sources.filter(({item})=>item.status==='dead'||item.alive===false||/corpse|body|remains/i.test(`${item.category || ''} ${item.name || ''}`)) : sources;
  const ignored = new Set(['the','a','an','dead','body','bodies','corpse','corpses','remains','item','from','bag','of','holding']);
  const words = phrase.split(' ').filter(word=>!ignored.has(word));
  const score=entry=>words.filter(word=>bagNorm(entry.item.name).split(' ').includes(word)).length;
  // A now-absent named corpse cannot silently fall back to a different corpse.
  if(!exact.length && words.length && !eligible.some(entry=>score(entry)>0))return [];
  // Complete relevant scope, ranked without any slice/limit. Exact names win over
  // aliases and fuzzy overlap; multiple genuinely identical labels stay ambiguous.
  const named=exact.length ? exact : [...eligible].sort((a,b)=>score(b)-score(a)||a.index-b.index);
  return Promise.all(named.map(async({item,index,id})=>({id,name:item.name,index,exact_name:exact.some(entry=>entry.index===index),fingerprint:await hashStoryValue(item)})));
}
export function bagClarificationBody(pending, error = '') {
  return { handled:true, action:pending.action, request_id:pending.id, clarification_intent_id:pending.id,
    clarification_kind:'bag_transfer', clarification_role:'stowed_source', clarification_required:true,
    requires_check:false, action_type:'utility', risk_level:'low', writes:0,
    reasoning:error || `Which item in your ${pending.intent.container} do you want to remove?${pending.intent.destination_kind==='world' ? ` It will be placed ${pending.intent.destination.replace(/^scene ground /,'')}.` : ''}`,
    clarification_options:pending.candidates.map(({id,name})=>({id,name})),
    bag_transfer:{intent_id:pending.id,destination:pending.intent.destination} };
}