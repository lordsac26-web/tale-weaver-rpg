import { formatCopper, quoteItem } from './vendorEconomy.ts';
import { catalogItemForTrade } from './vendorCatalog.ts';
import { resolveAuthoritativeSkillModifier } from './skills/authoritativeSkillModifier.ts';

export const VENDOR_HAGGLE_VERSION = 'vendor-haggle-v1.0.0';
const normal = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const owns = (character, user) => character?.created_by_id === user?.id || character?.created_by_id === user?.email;
const rollD20 = () => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return (bytes[0] % 20) + 1; };

export async function resolveVendorHaggle({ db, user, characterId, sessionId, vendorId, itemName, visitId, skill, catalogItems = [], rawRoll = null }) {
  if (!visitId || !itemName || !['Persuasion', 'Insight'].includes(skill)) return { status: 400, body: { error: 'invalid_haggle_request', writes: 0 } };
  const [character, session, vendor] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId), db.entities.Vendor.get(vendorId)]);
  if (!character || !session || !vendor || !owns(character, user) || session.character_id !== characterId) return { status: 403, body: { error: 'linkage_mismatch', writes: 0 } };
  const source = catalogItemForTrade(vendor, catalogItems, itemName);
  if (!source) return { status: 404, body: { error: 'unknown_item', writes: 0 } };
  const receipts = Array.isArray(character.long_rest_abilities?.__vendor_haggle_receipts) ? character.long_rest_abilities.__vendor_haggle_receipts : [];
  const attemptKey = `${visitId}|${vendorId}|${normal(itemName)}`;
  const prior = receipts.find((receipt) => receipt.attempt_key === attemptKey);
  if (prior) return { status: 200, body: { success: true, already_processed: true, receipt: prior, quote: prior.adjusted_quote, writes: 0 } };
  const breakdown = resolveAuthoritativeSkillModifier({ character, session, skill });
  if (!breakdown.ok) return { status: 409, body: { error: breakdown.error, writes: 0 } };
  const raw = rawRoll == null ? rollD20() : Math.max(1, Math.min(20, Number(rawRoll) || 1));
  const dc = Math.max(10, Math.min(18, 14 - Math.round(Number(vendor.reputation_modifier || 0) / 10)));
  const total = raw + breakdown.total;
  const succeeded = raw === 20 || (raw !== 1 && total >= dc);
  const discountPercent = succeeded ? (total >= dc + 5 ? 20 : 10) : 0;
  const baseQuote = quoteItem({ vendor, item: source, direction: 'buy_from_vendor' });
  if (baseQuote.status !== 'ok') return { status: 400, body: { error: 'price_unavailable', writes: 0 } };
  const adjustedCopper = Math.max(1, Math.ceil(baseQuote.unit_copper * (100 - discountPercent) / 100));
  const adjustedQuote = { ...baseQuote, unit_copper: adjustedCopper, unit_display: formatCopper(adjustedCopper), quote_id: `${baseQuote.quote_id}|haggle|${attemptKey}|${discountPercent}`, haggle_discount_percent: discountPercent };
  const receipt = { version: VENDOR_HAGGLE_VERSION, attempt_key: attemptKey, visit_id: visitId, vendor_id: vendorId, item_name: source.name, skill, dc, raw_d20: raw, modifier_total: breakdown.total, final_total: total, success: succeeded, discount_percent: discountPercent, base_quote_id: baseQuote.quote_id, adjusted_quote: adjustedQuote, at: new Date().toISOString() };
  await db.entities.Character.update(characterId, { long_rest_abilities: { ...(character.long_rest_abilities || {}), __vendor_haggle_receipts: [...receipts.slice(-99), receipt] } });
  return { status: 200, body: { success: true, already_processed: false, receipt, quote: adjustedQuote, writes: 1 } };
}