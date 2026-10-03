export const CONTAINER_CAPACITY_VERSION = 'container-capacity-v1.0.0';

const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const finite = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const joins = (values) => values.length < 2 ? values[0] || 'the item' : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;

// Canonical DMG container contracts: capacity weight (lb), interior volume
// (cubic ft), opening width (ft). A container's own recorded fields
// (capacity_weight_lb / capacity_volume_cubic_ft / opening_width_ft) override
// the canonical contract; its description is parsed as a last fallback.
const CONTAINER_CONTRACTS = new Map([
  ['bag of holding', { capacity_weight_lb: 500, capacity_volume_cubic_ft: 64, opening_width_ft: 2 }],
  ['backpack', { capacity_weight_lb: 30, capacity_volume_cubic_ft: 1, opening_width_ft: 1 }],
  ['satchel', { capacity_weight_lb: 20, capacity_volume_cubic_ft: 0.5, opening_width_ft: 1 }],
  ['pouch', { capacity_weight_lb: 8, capacity_volume_cubic_ft: 0.2, opening_width_ft: 0.75 }],
  ['case', { capacity_weight_lb: 10, capacity_volume_cubic_ft: 0.3, opening_width_ft: 0.75 }],
  ['container', { capacity_weight_lb: 30, capacity_volume_cubic_ft: 1, opening_width_ft: 1 }],
]);

// Conservative canonical defaults when no recorded weight exists (DMG-standard
// figures). Missing weight never auto-passes: it takes the heavier default.
export function defaultStowableMeasure(item) {
  const name = norm(item?.name), category = norm(item?.category);
  if (category.includes('corpse') || /\bcorpse\b|\bbody\b/.test(name)) return { weight: 160, volume: 8 };
  if (category.includes('book') || /\bledger\b|\btome\b|\bbook\b/.test(name)) return { weight: 2, volume: 0.1 };
  if (category.includes('staff') || /\bstaff\b|\bpole\b/.test(name)) return { weight: 4, volume: 1 };
  return { weight: 5, volume: 0.5 };
}

export function stowableMeasure(item) {
  const fallback = defaultStowableMeasure(item);
  const weight = finite(Number(item?.weight)) ? Number(item.weight) : fallback.weight;
  const volume = finite(Number(item?.volume_cubic_ft)) ? Number(item.volume_cubic_ft) : fallback.volume;
  const width = Number(item?.dimensions_ft?.width), height = Number(item?.dimensions_ft?.height);
  const dimensions_ft = finite(width) && finite(height) ? { width, height } : null;
  return { weight, volume, dimensions_ft };
}

export function containerContract(containerName, bagRecord) {
  const key = norm(containerName);
  const bag = bagRecord || {};
  const description = `${bag.description || ''} ${bag.effect || ''}`;
  const canonical = CONTAINER_CONTRACTS.get(key) || null;
  const capacity_weight_lb = finite(Number(bag.capacity_weight_lb)) ? Number(bag.capacity_weight_lb) : canonical?.capacity_weight_lb ?? Number(description.match(/(?:up to |holds )?(\d+)\s*(?:lb|pounds)/i)?.[1]);
  const capacity_volume_cubic_ft = finite(Number(bag.capacity_volume_cubic_ft)) ? Number(bag.capacity_volume_cubic_ft) : canonical?.capacity_volume_cubic_ft ?? Number(description.match(/(\d+)\s*(?:cubic feet|cubic ft)/i)?.[1]);
  const opening_width_ft = finite(Number(bag.opening_width_ft)) ? Number(bag.opening_width_ft) : canonical?.opening_width_ft ?? 2;
  if (!finite(capacity_weight_lb) || !finite(capacity_volume_cubic_ft)) return null;
  return { container: bag.name || containerName, capacity_weight_lb, capacity_volume_cubic_ft, opening_width_ft, canonical: !!canonical };
}

// Authoritative capacity check over the full post-stow container contents.
// Oversized or excess loads are refused with a specific visible explanation;
// missing weights take conservative defaults, never auto-pass. A Bag of
// Holding is never ruptured, closed, or lost by ordinary carried goods or
// bodies — this is plain capacity math, and refusals move nothing.
export function validateContainerFit({ character, container, incoming = [] }) {
  const key = norm(container);
  const bag = (character.inventory || []).find((x) => norm(x.name) === key && Number(x.quantity ?? 1) > 0);
  if (!bag) return { ok: false, message: `I can't confirm that you're carrying ${container}. Nothing has been moved.` };
  const contract = containerContract(container, bag);
  if (!contract) return { ok: false, message: `I can't verify ${container}'s capacity from its recorded limits. Nothing has been moved.` };
  const contents = [...(character.stowed_items || []).filter((x) => norm(x.container) === key), ...incoming];
  const measures = contents.map((item) => ({ ...stowableMeasure(item), quantity: Number(item?.quantity ?? 1) }));
  const weight = measures.reduce((sum, x) => sum + x.weight * x.quantity, 0);
  const volume = measures.reduce((sum, x) => sum + x.volume * x.quantity, 0);
  const totals = { weight_lb: weight, volume_cubic_ft: volume, capacity_weight_lb: contract.capacity_weight_lb, capacity_volume_cubic_ft: contract.capacity_volume_cubic_ft };
  const oversized = incoming.map((item) => ({ item, m: stowableMeasure(item) }))
    .filter(({ m }) => m.dimensions_ft && (m.dimensions_ft.width > contract.opening_width_ft || m.dimensions_ft.height > contract.opening_width_ft))
    .map(({ item }) => item.name || 'the item');
  if (oversized.length) return { ok: false, totals, message: `${joins(oversized)} cannot pass through ${contract.container}'s ${contract.opening_width_ft}-foot opening. Nothing has been moved.` };
  if (weight > contract.capacity_weight_lb) return { ok: false, totals, message: key === 'bag of holding'
    ? `That would overload your Bag of Holding: its contents would weigh ${Math.round(weight)} lb against its 500 lb limit — ${Math.round(weight - contract.capacity_weight_lb)} lb over. Empty some of it first; nothing has been moved.`
    : `That would overload ${contract.container}: ${Math.round(weight)} lb against its ${contract.capacity_weight_lb} lb limit. Nothing has been moved.` };
  if (volume > contract.capacity_volume_cubic_ft) return { ok: false, totals, message: key === 'bag of holding'
    ? `That would exceed your Bag of Holding's interior: ${Math.round(volume)} cubic feet against its 64 cubic-foot limit. Empty some of it first; nothing has been moved.`
    : `That would exceed ${contract.container}'s interior: ${Math.round(volume)} cubic feet against its ${contract.capacity_volume_cubic_ft} cubic-foot limit. Nothing has been moved.` };
  return { ok: true, totals: { ...totals, remaining_weight_lb: Math.round((contract.capacity_weight_lb - weight) * 10) / 10, remaining_volume_cubic_ft: Math.round((contract.capacity_volume_cubic_ft - volume) * 10) / 10 } };
}