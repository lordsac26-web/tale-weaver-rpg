const AMMO_ALIASES = {
  arrows: 'Arrows', arrow: 'Arrows',
  bolts: 'Bolts', bolt: 'Bolts',
  'sling bullets': 'Sling Bullets', 'sling bullet': 'Sling Bullets', bullets: 'Sling Bullets', bullet: 'Sling Bullets',
};

const cleanName = (value) => String(value || '').toLowerCase()
  .replace(/[’']/g, '')
  .replace(/\(\s*\d+\s*\)\s*$/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function canonicalAmmoName(value) {
  return AMMO_ALIASES[cleanName(value)] || null;
}

export function ammoForWeapon(weaponName) {
  const weapon = cleanName(weaponName);
  if (weapon.includes('crossbow')) return 'Bolts';
  if (weapon === 'sling') return 'Sling Bullets';
  if (weapon.includes('bow')) return 'Arrows';
  return null;
}

export function isAmmoPackage(value) {
  const match = String(value || '').match(/\(\s*(\d+)\s*\)\s*$/);
  return match ? Number(match[1]) : 0;
}

export function normalizeAmmoInventory(inventory) {
  const output = [];
  const indexes = new Map();
  for (const item of Array.isArray(inventory) ? inventory : []) {
    const canonical = canonicalAmmoName(item?.name);
    if (!canonical) { output.push(item); continue; }
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const existingIndex = indexes.get(canonical);
    if (existingIndex === undefined) {
      indexes.set(canonical, output.length);
      output.push({ ...item, name: canonical, category: 'Ammunition', stackable: true, unit: canonical === 'Arrows' ? 'arrow' : undefined, stack_semantics: 'individual', quantity });
    } else output[existingIndex] = { ...output[existingIndex], quantity: output[existingIndex].quantity + quantity };
  }
  return output.filter((item) => !canonicalAmmoName(item?.name) || Math.max(0, Number(item.quantity) || 0) > 0);
}

export function addAmmunition(inventory, item, packageQuantity = 1) {
  const canonical = canonicalAmmoName(item?.name);
  if (!canonical) return normalizeAmmoInventory([...inventory, item]);
  const packageSize = isAmmoPackage(item.name) || 1;
  const units = Math.max(0, Number(packageQuantity) || 0) * packageSize;
  const normalized = normalizeAmmoInventory(inventory);
  const index = normalized.findIndex((entry) => entry.name === canonical);
  if (index >= 0) normalized[index] = { ...normalized[index], quantity: normalized[index].quantity + units };
  else normalized.push({ ...item, name: canonical, category: 'Ammunition', stackable: true, quantity: units });
  return normalized;
}

export function availableAmmo(inventory, canonicalName) {
  return normalizeAmmoInventory(inventory)
    .filter((item) => item.name === canonicalName)
    .reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
}

export function consumeAmmunition(inventory, canonicalName) {
  const normalized = normalizeAmmoInventory(inventory);
  const index = normalized.findIndex((item) => item.name === canonicalName && (Number(item.quantity) || 0) > 0);
  if (index < 0) return { ok: false, inventory: normalized, remaining: 0 };
  normalized[index] = { ...normalized[index], quantity: normalized[index].quantity - 1 };
  return { ok: true, inventory: normalized, remaining: availableAmmo(normalized, canonicalName) };
}