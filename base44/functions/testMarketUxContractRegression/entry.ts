import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { currencyCopper, quoteInventoryForVendor, quoteItem, VENDOR_ECONOMY_VERSION } from '../../shared/vendorEconomy.ts';
import { executeVendorTrade } from '../../shared/vendorTradeCore.ts';
import { quotedVendorCatalog } from '../../shared/vendorCatalog.ts';
import { resolveVendorHaggle, VENDOR_HAGGLE_VERSION } from '../../shared/vendorHaggle.ts';
import { buildSellQuotesRequest, formatCharacterFunds, marketCategories, mergeCatalogPages, MARKET_UX_BUNDLE_VERSION } from '../../shared/marketUxContract.js';
import { handleVendorTradeRequest, VENDOR_TRADE_REQUEST_VERSION } from '../../shared/vendorTradeRequest.ts';

const PROTECTED = { Character: ['6a6825cd07a490fa70a46852'], GameSession: ['6a6825edd695bd65a4322256'], CombatLog: ['6a767f23ec36fe219063ae49', '6a77463582a26b50018110ea'] };
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const protectedState = async (db) => Promise.all(Object.entries(PROTECTED).flatMap(([entity, ids]) => ids.map(async (id) => { try { return [entity, id, await db.entities[entity].get(id)]; } catch { return [entity, id, null]; } })));

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
  await req.json().catch(() => ({}));
  const db = base44.asServiceRole;
  const fixtures = [];
  const cleanup = [];
  const tests = [];
  const record = (name, pass, detail = undefined) => tests.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
  const beforeProtected = await hash(await protectedState(db));
  try {
    const tag = `MarketUxQA_${Date.now()}`;
    const dagger = { name: 'Dagger', category: 'Weapon', rarity: 'common', base_price: '2 gp', stock: 4, quantity: 2, stackable: false };
    const liveShapeInventory = [
      { ...dagger, stock: undefined },
      { name: 'Goodberry', category: 'Consumable', expires_at: '2026-08-15T00:27:01.843Z', quantity: 10 },
      { name: 'Unidentified Staff', category: 'Staff', is_magic: true, identification_status: 'unidentified', quantity: 1, stackable: false, acquisition_request_id: `${tag}:pickup` },
      { name: 'Club', category: 'Weapon', rarity: 'common', cost: 1, cost_unit: 'sp', value: 1, source: 'Equipment Database', quantity: 1 },
      { name: 'Torch', category: 'Adventuring Gear', rarity: 'common', cost: 1, cost_unit: 'gp', value: 1, source: 'Loot Table', quantity: 1 },
      { name: 'Longbow', category: 'Weapon', rarity: 'common', cost: 50, cost_unit: 'gp', value: 50, source: 'Equipment Database', quantity: 1 },
      { name: 'Arrows', category: 'Ammunition', rarity: 'common', cost: 1, cost_unit: 'gp', quantity: 36, stackable: true },
    ];
    let character = await base44.entities.Character.create({ name: tag, race: 'Human', class: 'Rogue', level: 3, charisma: 16, wisdom: 14, proficiency_bonus: 2, skills: { Persuasion: true, Insight: true }, gold: 20, silver: 5, copper: 2, inventory: liveShapeInventory, long_rest_abilities: {}, is_active: false });
    fixtures.push(['Character', character.id]);
    const session = await db.entities.GameSession.create({ character_id: character.id, title: tag, current_location: 'Market Square', story_log: [], is_active: false });
    fixtures.push(['GameSession', session.id]);
    let vendor = await db.entities.Vendor.create({ name: tag, type: 'blacksmith', location: 'Market Square', gold_reserve: 100, items: [{ ...dagger, quantity: undefined }], is_active: false });
    fixtures.push(['Vendor', vendor.id]);
    const catalog = Array.from({ length: 65 }, (_, index) => ({ name: index === 64 ? 'Rope of the Last Shelf' : `Catalog ${String(index).padStart(2, '0')}`, category: index % 3 ? 'Weapon' : 'Tool', rarity: index % 2 ? 'common' : 'uncommon', base_price: index === 64 ? '3 gp' : '1 gp', stock: 5, vendor_types: ['blacksmith'] }));

    const sellQuote = quoteItem({ vendor, item: character.inventory[0], direction: 'sell_to_vendor' });
    record('authoritative sell quote displays half value and never flat five gold', sellQuote.unit_copper === 100 && sellQuote.unit_display === '1 gp' && sellQuote.unit_display !== '5 gp');
    const inventoryQuotes = quoteInventoryForVendor(vendor, character.inventory);
    const quoteFor = (name) => inventoryQuotes.find((entry) => entry.item_name === name)?.quote;
    record('live-shaped sell list prices every item independently without a blanket failure', inventoryQuotes.length === liveShapeInventory.length && quoteFor('Goodberry')?.reason === 'no_vendor_value' && quoteFor('Unidentified Staff')?.reason === 'unidentified_item' && quoteFor('Club')?.unit_copper === 5 && quoteFor('Club')?.unit_display === '5 cp' && quoteFor('Torch')?.unit_display === '5 sp' && quoteFor('Longbow')?.unit_display === '25 gp' && quoteFor('Arrows')?.status === 'ok');
    const sellPanelPayload = buildSellQuotesRequest(vendor.id, character.id);
    const beforeSellPanel = JSON.stringify({ character: await db.entities.Character.get(character.id), vendor: await db.entities.Vendor.get(vendor.id) });
    const sellPanel = await handleVendorTradeRequest({ payload: sellPanelPayload, db, user, catalogItems: catalog });
    const afterSellPanel = JSON.stringify({ character: await db.entities.Character.get(character.id), vendor: await db.entities.Vendor.get(vendor.id) });
    const routedQuote = (name) => sellPanel.body?.quotes?.find((entry) => entry.item_name === name)?.quote;
    record('exact frontend sell-panel request passes the production dispatcher with zero writes', sellPanel.status === 200 && sellPanel.body?.success === true && sellPanel.body?.quotes?.length === liveShapeInventory.length && routedQuote('Goodberry')?.reason === 'no_vendor_value' && routedQuote('Unidentified Staff')?.reason === 'unidentified_item' && routedQuote('Club')?.unit_display === '5 cp' && beforeSellPanel === afterSellPanel, { request_version: sellPanel.body?.request_version });
    const quoted = quotedVendorCatalog(vendor, catalog);
    const pages = [0, 1].map((page) => ({ items: quoted.slice(page * 40, (page + 1) * 40) }));
    const merged = mergeCatalogPages(pages, quoted.length);
    record('all paged catalog items are reachable in the UI contract', merged.complete && merged.reachable_count === quoted.length && merged.items.some((item) => item.name === 'Rope of the Last Shelf'), { reachable: merged.reachable_count });
    record('searchable category contract exposes every stock category', marketCategories(merged.items).includes('Weapon') && marketCategories(merged.items).includes('Tool') && merged.items.every((item) => item.quote?.unit_display && item.icon));

    const buyItem = quoted.find((item) => item.name === 'Rope of the Last Shelf');
    const buy = await executeVendorTrade({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: buyItem.name, direction: 'buy_from_vendor', quantity: 1, quoteId: buyItem.quote.quote_id, requestId: `${tag}:buy`, catalogItems: catalog });
    character = await db.entities.Character.get(character.id); vendor = await db.entities.Vendor.get(vendor.id);
    const boughtFunds = formatCharacterFunds(character);
    record('UI buy contract uses atomic trade and returns synced currency', buy.status === 200 && character.inventory.some((item) => item.name === buyItem.name) && boughtFunds === '17 gp · 5 sp · 2 cp');
    const boughtSource = character.inventory.find((item) => item.name === buyItem.name);
    const roundTripQuote = quoteItem({ vendor, item: boughtSource, direction: 'sell_to_vendor' });
    const sell = await executeVendorTrade({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: buyItem.name, direction: 'sell_to_vendor', quantity: 1, quoteId: roundTripQuote.quote_id, requestId: `${tag}:sell`, catalogItems: catalog });
    character = await db.entities.Character.get(character.id);
    record('UI sell round trip is atomic and refreshes inventory and funds', sell.status === 200 && !character.inventory.some((item) => item.name === buyItem.name) && currencyCopper(character) === 1902);

    const visitId = `${tag}:visit`;
    const haggle = await resolveVendorHaggle({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: 'Dagger', visitId, skill: 'Persuasion', catalogItems: catalog, rawRoll: 18 });
    const repeatHaggle = await resolveVendorHaggle({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: 'Dagger', visitId, skill: 'Insight', catalogItems: catalog, rawRoll: 20 });
    record('haggle is authoritative bounded and once per item per visit', haggle.body?.receipt?.version === VENDOR_HAGGLE_VERSION && [10, 20].includes(haggle.body?.receipt?.discount_percent) && repeatHaggle.body?.already_processed && repeatHaggle.body?.writes === 0 && repeatHaggle.body?.receipt?.raw_d20 === 18);
    const haggleBuy = await executeVendorTrade({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: 'Dagger', direction: 'buy_from_vendor', quantity: 1, quoteId: haggle.body.quote.quote_id, requestId: `${tag}:haggle-buy`, catalogItems: catalog });
    const replay = await executeVendorTrade({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: 'Dagger', direction: 'buy_from_vendor', quantity: 1, quoteId: haggle.body.quote.quote_id, requestId: `${tag}:haggle-buy`, catalogItems: catalog });
    record('adjusted quote commits through vendorTrade and double tap replays inertly', haggleBuy.status === 200 && haggleBuy.body?.receipt?.quote?.haggle_discount_percent > 0 && replay.body?.already_processed === true);
    const afterReplay = await db.entities.Character.get(character.id);
    record('currency display remains synchronized with authoritative receipt', formatCharacterFunds(afterReplay) === formatCharacterFunds(haggleBuy.body.character_after));

    const stateBeforeReject = JSON.stringify({ character: afterReplay, vendor: await db.entities.Vendor.get(vendor.id) });
    const rejected = await executeVendorTrade({ db, user, characterId: character.id, sessionId: session.id, vendorId: vendor.id, itemName: 'Dagger', direction: 'buy_from_vendor', quantity: 1, quoteId: 'stale', requestId: `${tag}:reject`, catalogItems: catalog });
    const stateAfterReject = JSON.stringify({ character: await db.entities.Character.get(character.id), vendor: await db.entities.Vendor.get(vendor.id) });
    record('failed interrupted contract leaves zero partial writes', rejected.body?.error === 'stale_quote' && stateBeforeReject === stateAfterReject);
  } catch (error) { record(`execution: ${error.message}`, false); }
  finally {
    for (const [entity, id] of fixtures.reverse()) { let absent = false; try { await db.entities[entity].delete(id); } catch {} try { absent = !(await db.entities[entity].get(id)); } catch { absent = true; } cleanup.push({ entity, id, verified_absent: absent }); }
  }
  record('fixture cleanup verified', cleanup.every((item) => item.verified_absent));
  record('protected live records untouched', beforeProtected === await hash(await protectedState(db)));
  const passed = tests.filter((test) => test.pass).length;
  const allPass = passed === tests.length;
  return Response.json({ function_version: 'test-market-ux-contract-v1.2.0', bundle_version: MARKET_UX_BUNDLE_VERSION, request_version: VENDOR_TRADE_REQUEST_VERSION, vendor_economy_version: VENDOR_ECONOMY_VERSION, haggle_version: VENDOR_HAGGLE_VERSION, passed, failed: tests.length - passed, total: tests.length, all_pass: allPass, tests, cleanup, cleanup_verified: cleanup.every((item) => item.verified_absent), protected_ids: PROTECTED }, { status: allPass ? 200 : 500 });
}