import { classifyItemTransferIntent } from './itemTransfer.ts';
import { hashStoryValue } from './storyTransition.ts';

export const BAG_TRANSFER_VERSION = 'bag-transfer-clarification-v1';
export const BAG_PENDING_KEY = '__pending_bag_transfer';
export const bagNorm = value => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const bagSourceId = (item, index) => item.scene_entity_id || item.instance_id || item.item_id || item.equipment_id || `stowed:${index}:${item.name}`;
export function parseBagTransfer(actionText) {
  if (!/\b(?:remove|retrieve|take|pull|empty)\w*\b/i.test(actionText || '')) return null;
  const intent = classifyItemTransferIntent(actionText);
  if (!intent || !/^(?:bag|bag of holding)$/i.test(intent.source_hint || '')) return null;
  const source = String(actionText).match(/\b(?:from|out of)\s+(?:the\s+|my\s+|a\s+)?(?:bag of holding|bag)\b/i);
  if (!source) return null;
  const tail = String(actionText).slice(source.index + source[0].length);
  const placement = tail.match(/\b(?:and\s+)?(?:place|put|set|drop|leave|lay|deposit)\s+(?:it|the\s+(?:body|corpse)|that|them)\s+(near|beside|next to|alongside|by|on|in|at|into)\s+(.+?)[.!]?$/i);
  return { ...intent, container: 'Bag of Holding', ...(placement ? { destination: `scene ground ${placement[1]} ${placement[2].replace(/[.!]$/, '')}`, destination_kind: 'world' } : {}) };
}
export async function bagTransferCandidates(character, intent) {
  const sources = (character.stowed_items || []).map((item,index)=>({item,index,id:bagSourceId(item,index)}))
    .filter(({item})=>bagNorm(item.container)===bagNorm(intent.container) && Number(item.quantity ?? 1)>0);
  const phrase = bagNorm(intent.item_phrase);
  const body = /\b(?:body|corpse|remains|bodies)\b/.test(phrase);
  const eligible = body ? sources.filter(({item})=>item.status==='dead'||item.alive===false||/corpse|body|remains/i.test(`${item.category || ''} ${item.name || ''}`)) : sources;
  const ignored = new Set(['the','a','an','dead','body','corpse','remains','item','from','bag','of','holding']);
  const words = phrase.split(' ').filter(word=>!ignored.has(word));
  const named = words.length ? eligible.filter(({item})=>words.every(word=>bagNorm(item.name).includes(word))) : eligible;
  return Promise.all(named.map(async({item,index,id})=>({id,name:item.name,index,fingerprint:await hashStoryValue(item)})));
}
export function bagClarificationBody(pending, error = '') {
  return { handled:true, action:pending.action, request_id:pending.id, clarification_intent_id:pending.id,
    clarification_kind:'bag_transfer', clarification_role:'stowed_source', clarification_required:true,
    requires_check:false, action_type:'utility', risk_level:'low', writes:0,
    reasoning:error || `Which item in your ${pending.intent.container} do you want to remove?${pending.intent.destination_kind==='world' ? ` It will be placed ${pending.intent.destination.replace(/^scene ground /,'')}.` : ''}`,
    clarification_options:pending.candidates.map(({id,name})=>({id,name})),
    bag_transfer:{intent_id:pending.id,destination:pending.intent.destination} };
}