import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export const VERSION = 'zero-quantity-display-regression-v1.0.0';

// Contract under test (mirrors src/lib/ammunition.js isDepletedInventoryItem):
// An inventory/stowed row is depleted only when it carries an explicit quantity field <= 0.
export function isDepletedInventoryItem(item) {
  return item != null && Object.prototype.hasOwnProperty.call(item, 'quantity') && Number(item.quantity) <= 0;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const hornetConsumed = { name: 'Angry Hornet', type: 'Wondrous Item', equip_slot: 'trinket', quantity: 0 };
    const hornetFresh = { name: 'Angry Hornet', type: 'Wondrous Item', equip_slot: 'trinket', quantity: 1 };
    const plainItem = { name: 'Rope', type: 'Adventuring Gear' }; // no quantity field -> not depleted
    const arrowsEmpty = { name: 'Arrows (20)', type: 'Ammunition', quantity: 0 };
    const stowedZero = { name: 'Angry Hornet', container: 'Bag of Holding', quantity: 0 };

    const tests = [
      { name: 'consumed wondrous ammo row is depleted (inventory)', pass: isDepletedInventoryItem(hornetConsumed) === true },
      { name: 'fresh wondrous ammo row is not depleted', pass: isDepletedInventoryItem(hornetFresh) === false },
      { name: 'item without quantity field is never depleted', pass: isDepletedInventoryItem(plainItem) === false },
      { name: 'ordinary empty ammunition stack is depleted', pass: isDepletedInventoryItem(arrowsEmpty) === true },
      { name: 'zero-quantity stowed row is depleted (bag pane)', pass: isDepletedInventoryItem(stowedZero) === true },
      { name: 'null item is safe', pass: isDepletedInventoryItem(null) === false },
    ];

    const passed = tests.filter((t) => t.pass).length;
    return Response.json({ version: VERSION, passed, failed: tests.length - passed, total: tests.length, all_pass: passed === tests.length, tests });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}