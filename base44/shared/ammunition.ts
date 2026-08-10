import { formatAuthoritativeAmmoLabel } from './ammunitionFormat.js';

const AMMO_ALIASES = {
  arrows: 'Arrows', arrow: 'Arrows',
  bolts: 'Bolts', bolt: 'Bolts', 'crossbow bolts': 'Bolts', 'crossbow bolt': 'Bolts',
  'sling bullets': 'Sling Bullets', 'sling bullet': 'Sling Bullets', bullets: 'Sling Bullets', bullet: 'Sling Bullets',
};

const AMMO_UNITS = { Arrows: 'arrow', Bolts: 'bolt', 'Sling Bullets': 'sling bullet' };

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

export function authoritativeAmmoUnits(item) {
  if (!canonicalAmmoName(item?.name)) return 0;
  const quantity = Math.max(0, Number(item?.quantity) || 0);
  if (item?.stack_semantics === 'packs') return quantity * Math.max(1, Number(item.pack_size) || isAmmoPackage(item.name) || 1) + Math.max(0, Number(item.units) || 0);
  return quantity;
}

export function normalizeAmmoStack(item) {
  const canonical = canonicalAmmoName(item?.name);
  if (!canonical) return item;
  return { ...item, name: canonical, category: 'Ammunition', stackable: true, unit: item.unit || AMMO_UNITS[canonical], stack_semantics: 'individual', pack_size: Number(item.pack_size) || isAmmoPackage(item.name) || undefined, quantity: authoritativeAmmoUnits(item) };
}

export function normalizeAmmoInventory(inventory) {
  return (Array.isArray(inventory) ? inventory : []).map((item) => normalizeAmmoStack(item));
}

export function addAmmunition(inventory, item, packageQuantity = 1) {
  const canonical = canonicalAmmoName(item?.name);
  if (!canonical) return [...(inventory || []), item];
  const count = Math.max(0, Number(packageQuantity) || 0);
  const acquiredUnits = item?.stack_semantics === 'individual' ? count : count * Math.max(1, Number(item?.pack_size) || isAmmoPackage(item?.name) || 1);
  const normalized = normalizeAmmoInventory(inventory);
  const index = normalized.findIndex((entry) => canonicalAmmoName(entry?.name) === canonical);
  const acquired = { ...item, name: canonical, category: 'Ammunition', stackable: true, unit: AMMO_UNITS[canonical], stack_semantics: 'individual', pack_size: Number(item?.pack_size) || isAmmoPackage(item?.name) || undefined, quantity: acquiredUnits };
  if (index >= 0) normalized[index] = { ...normalized[index], ...acquired, quantity: authoritativeAmmoUnits(normalized[index]) + acquiredUnits };
  else normalized.push(acquired);
  return normalized;
}

export function availableAmmo(inventory, canonicalName) {
  return (inventory || []).filter((item) => canonicalAmmoName(item?.name) === canonicalName).reduce((total, item) => total + authoritativeAmmoUnits(item), 0);
}

export function formatAmmoDisplay(item) {
  const name = canonicalAmmoName(item?.name) || String(item?.name || 'Ammunition');
  const quantity = authoritativeAmmoUnits(item);
  return formatAuthoritativeAmmoLabel(name, quantity);
}

export function consumeAmmunition(inventory, canonicalName) {
  const output = [...(Array.isArray(inventory) ? inventory : [])];
  const index = output.findIndex((item) => canonicalAmmoName(item?.name) === canonicalName && authoritativeAmmoUnits(item) > 0);
  if (index < 0) return { ok: false, inventory: output, remaining: 0, consumed_index: null };
  const source = output[index];
  output[index] = source.stack_semantics === 'packs'
    ? { ...source, name: canonicalName, category: 'Ammunition', quantity: authoritativeAmmoUnits(source) - 1, unit: AMMO_UNITS[canonicalName], stack_semantics: 'individual', pack_size: Number(source.pack_size) || isAmmoPackage(source.name) || undefined }
    : { ...source, quantity: authoritativeAmmoUnits(source) - 1 };
  return { ok: true, inventory: output, remaining: availableAmmo(output, canonicalName), consumed_index: index };
}