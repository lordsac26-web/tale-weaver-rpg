import { formatAmmunitionProperty, formatAuthoritativeAmmoLabel } from '../../base44/shared/ammunitionFormat.js';

const aliases = { arrows: 'Arrows', arrow: 'Arrows', bolts: 'Bolts', bolt: 'Bolts', 'crossbow bolts': 'Bolts', 'crossbow bolt': 'Bolts', 'sling bullets': 'Sling Bullets', 'sling bullet': 'Sling Bullets', bullets: 'Sling Bullets', bullet: 'Sling Bullets' };
const units = { Arrows: 'arrow', Bolts: 'bolt', 'Sling Bullets': 'sling bullet' };

const clean = (value) => String(value || '').toLowerCase().replace(/\(\s*\d+\s*\)\s*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const canonicalAmmoName = (value) => aliases[clean(value)] || null;
export const catalogPackSize = (value) => Number(String(value || '').match(/\(\s*(\d+)\s*\)\s*$/)?.[1]) || 0;
export const ammoUnits = (item) => item?.stack_semantics === 'packs'
  ? Math.max(0, Number(item.quantity) || 0) * Math.max(1, Number(item.pack_size) || catalogPackSize(item.name) || 1) + Math.max(0, Number(item.units) || 0)
  : Math.max(0, Number(item?.quantity) || 0);

export function normalizeAmmoForDisplay(inventory = []) {
  const result = []; const indexes = new Map();
  inventory.forEach((item, sourceIndex) => {
    const name = canonicalAmmoName(item?.name);
    if (!name) return result.push({ ...item, __sourceIndices: [sourceIndex] });
    const index = indexes.get(name); const quantity = ammoUnits(item);
    const normalized = { ...item, name, category: 'Ammunition', stackable: true, unit: item.unit || units[name], stack_semantics: 'individual', pack_size: Number(item.pack_size) || catalogPackSize(item.name) || undefined, quantity, __sourceIndices: [sourceIndex] };
    if (index === undefined) { indexes.set(name, result.length); result.push(normalized); }
    else result[index] = { ...result[index], quantity: result[index].quantity + quantity, __sourceIndices: [...result[index].__sourceIndices, sourceIndex] };
  });
  return result;
}

export function formatInventoryItemName(item) {
  const name = canonicalAmmoName(item?.name);
  if (!name) return item?.name || 'Item';
  const quantity = ammoUnits(item);
  return formatAuthoritativeAmmoLabel(name, quantity);
}

export function formatWeaponProperty(property) {
  return formatAmmunitionProperty(property);
}

export function ammoForWeapon(weaponName) {
  const name = clean(weaponName);
  if (name.includes('crossbow')) return 'Bolts';
  if (name === 'sling') return 'Sling Bullets';
  if (name.includes('bow')) return 'Arrows';
  return null;
}

export function ammoStatusForWeapon(inventory, weapon) {
  const properties = (weapon?.properties || []).map((value) => String(value).toLowerCase());
  const ammoName = weapon?.type === 'ranged' && properties.some((value) => value.includes('ammunition')) ? ammoForWeapon(weapon.name) : null;
  const remaining = ammoName ? normalizeAmmoForDisplay(inventory).filter((item) => canonicalAmmoName(item.name) === ammoName).reduce((sum, item) => sum + ammoUnits(item), 0) : null;
  return { required: !!ammoName, ammoName, remaining, depleted: !!ammoName && remaining === 0 };
}

export function addAmmoAtAcquisition(inventory = [], item, packageQuantity = 1) {
  const name = canonicalAmmoName(item?.name);
  if (!name) return [...inventory, item];
  const count = Math.max(0, Number(packageQuantity) || 0);
  const acquiredUnits = item?.stack_semantics === 'individual' ? count : count * Math.max(1, Number(item?.pack_size) || catalogPackSize(item?.name) || 1);
  const result = normalizeAmmoForDisplay(inventory); const index = result.findIndex((entry) => entry.name === name);
  const acquired = { ...item, name, category: 'Ammunition', stackable: true, unit: units[name], stack_semantics: 'individual', pack_size: Number(item?.pack_size) || catalogPackSize(item?.name) || undefined, quantity: acquiredUnits };
  if (index >= 0) result[index] = { ...result[index], ...acquired, quantity: result[index].quantity + acquiredUnits };
  else result.push(acquired);
  return result.map(({ __sourceIndices, ...entry }) => entry);
}

export function addInventoryItemAtAcquisition(inventory = [], item) {
  const cleanInventory = inventory.map(({ __sourceIndices, ...entry }) => entry);
  return canonicalAmmoName(item?.name) || String(item?.category || '').toLowerCase() === 'ammunition'
    ? addAmmoAtAcquisition(cleanInventory, item, item.quantity || 1)
    : [...cleanInventory, item];
}