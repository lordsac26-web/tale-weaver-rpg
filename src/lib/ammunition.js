const aliases = { arrows: 'Arrows', arrow: 'Arrows', bolts: 'Bolts', bolt: 'Bolts', 'sling bullets': 'Sling Bullets', 'sling bullet': 'Sling Bullets', bullets: 'Sling Bullets', bullet: 'Sling Bullets' };

const clean = (value) => String(value || '').toLowerCase().replace(/\(\s*\d+\s*\)\s*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const canonical = (value) => aliases[clean(value)] || null;

export function normalizeAmmoForDisplay(inventory = []) {
  const result = [];
  const indexes = new Map();
  inventory.forEach((item, sourceIndex) => {
    const name = canonical(item?.name);
    if (!name) return result.push({ ...item, __sourceIndices: [sourceIndex] });
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const index = indexes.get(name);
    if (index === undefined) {
      indexes.set(name, result.length);
      result.push({ ...item, name, category: 'Ammunition', stackable: true, quantity, __sourceIndices: [sourceIndex] });
    } else result[index] = { ...result[index], quantity: result[index].quantity + quantity, __sourceIndices: [...result[index].__sourceIndices, sourceIndex] };
  });
  return result;
}

export function addAmmoAtAcquisition(inventory = [], item, packageQuantity = 1) {
  const name = canonical(item?.name);
  if (!name) return normalizeAmmoForDisplay([...inventory, item]);
  const packageSize = Number(String(item.name || '').match(/\(\s*(\d+)\s*\)\s*$/)?.[1]) || 1;
  const result = normalizeAmmoForDisplay(inventory);
  const index = result.findIndex((entry) => entry.name === name);
  const units = Math.max(0, Number(packageQuantity) || 0) * packageSize;
  if (index >= 0) result[index] = { ...result[index], quantity: result[index].quantity + units };
  else result.push({ ...item, name, category: 'Ammunition', stackable: true, quantity: units });
  return result;
}