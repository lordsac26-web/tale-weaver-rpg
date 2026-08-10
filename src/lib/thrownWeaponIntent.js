const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const thrown = (item) => (item?.properties || []).some((property) => normalize(property) === 'thrown' || normalize(property).startsWith('thrown range '));

export function buildThrownWeaponContext(actionText, character, checkSuccess = true) {
  const match = String(actionText || '').match(/\b(?:throw|throws|threw|hurl|hurls|hurled|toss|tosses|tossed)\s+(?:my|the|a|an)?\s*([a-z][a-z -]{1,40}?)(?:\s+(?:at|toward|towards|into)\s+)(?:the\s+)?([a-z][a-z -]{1,60})/i);
  if (!match) return null;
  const name = match[1].trim();
  const target = match[2].trim();
  const inventory = Array.isArray(character?.inventory) ? character.inventory : [];
  const matches = inventory.filter((item) => normalize(item?.name) === normalize(name) && thrown(item));
  const equipped = Object.values(character?.equipped || {}).find((item) => normalize(item?.name) === normalize(name) && thrown(item));
  const equippedId = equipped?.equipment_id || equipped?.item_id;
  const selected = equippedId ? matches.find((item) => (item.equipment_id || item.item_id) === equippedId) : matches.length === 1 ? matches[0] : null;
  return { item_name: name, item_id: selected?.equipment_id || selected?.item_id || null, target, outcome: { committed: true, hit: checkSuccess === true, kill: false } };
}