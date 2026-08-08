import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const meaningful = (value) => value !== undefined && value !== null && value !== '';
const usableText = (value) => typeof value === 'string' && value.trim().length > 0;
const unwrapRecord = (record) => record?.data && typeof record.data === 'object' ? record.data : record;

export const normalizeSpellName = (value) => String(value || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export function resolveCanonicalSpellInfo(spellName, candidates = []) {
  const target = normalizeSpellName(spellName);
  const unique = new Map();
  candidates.map(unwrapRecord).filter(Boolean).filter(record => !target || normalizeSpellName(record.name) === target).forEach(record => {
    const key = `${normalizeSpellName(record.name)}:${record.level ?? 'unknown'}`;
    const source = `${record.source || record.raw_data?.source || record.raw_data?.document__title || ''}`.toLowerCase();
    const text = usableText(record.description) ? record.description.trim() : usableText(record.raw_data?.desc) ? record.raw_data.desc.trim() : usableText(record.effect_summary) ? record.effect_summary.trim() : usableText(record.visual_summary) ? record.visual_summary.trim() : '';
    const sourceRank = /2014|phb|basic rules|srd 5\.1|core/.test(source) ? 2 : /2024|5\.2/.test(source) ? 0 : 1;
    const candidate = { ...record, description: text || record.description || '', __rank: [text ? 1 : 0, sourceRank, usableText(record.description) ? 3 : usableText(record.raw_data?.desc) ? 2 : usableText(record.effect_summary) ? 1 : 0] };
    const previous = unique.get(key);
    if (!previous || candidate.__rank.join() > previous.__rank.join()) unique.set(key, candidate);
  });
  const best = [...unique.values()].sort((a, b) => b.__rank[0] - a.__rank[0] || b.__rank[1] - a.__rank[1] || b.__rank[2] - a.__rank[2])[0] || null;
  if (best) delete best.__rank;
  return best;
}

export function normalizeSpellView(fallback = {}, canonical = null) {
  const merged = mergeCanonicalDetail(unwrapRecord(fallback) || {}, unwrapRecord(canonical));
  const description = usableText(merged.description) ? merged.description : usableText(merged.raw_data?.desc) ? merged.raw_data.desc.trim() : usableText(merged.effect_summary) ? merged.effect_summary : usableText(merged.visual_summary) ? merged.visual_summary : '';
  return { ...merged, description, effect: usableText(merged.effect_summary) ? merged.effect_summary : description };
}

export function getSpellDisplayFallback(spell = {}) {
  const fields = [
    spell.school && `${spell.school} spell`,
    spell.casting_time && `Casting time: ${spell.casting_time}`,
    spell.range && `Range: ${spell.range}`,
    spell.duration && `Duration: ${spell.duration}`,
    spell.components && `Components: ${spell.components}`,
  ].filter(Boolean);
  return fields.join(' · ');
}

export function mergeCanonicalDetail(fallback = {}, canonical = null) {
  if (!canonical) return fallback;
  return Object.entries(canonical).reduce((merged, [key, value]) => {
    if (meaningful(value)) merged[key] = value;
    return merged;
  }, { ...fallback });
}

export function useCanonicalSpell(spell, fallback) {
  const spellId = typeof spell === 'object' ? spell?.id : null;
  const spellName = typeof spell === 'object' ? spell?.name : spell;
  const query = useQuery({
    queryKey: ['spell-detail', spellId || spellName],
    queryFn: async () => {
      const matches = await base44.entities.Spell.filter({ name: spellName }, 'name', 50);
      const byId = spellId ? await base44.entities.Spell.filter({ id: spellId }, 'name', 1) : [];
      return resolveCanonicalSpellInfo(spellName, [...byId, ...matches, fallback]);
    },
    enabled: !!(spellId || spellName),
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, detail: normalizeSpellView(fallback, query.data) };
}

export function useCanonicalMagicItem(item) {
  const itemId = item?.magic_item_id || item?.id;
  const query = useQuery({
    queryKey: ['magic-item-detail', itemId || item?.name],
    queryFn: async () => {
      const matches = itemId
        ? await base44.entities.MagicItem.filter({ id: itemId }, 'name', 1)
        : await base44.entities.MagicItem.filter({ name: item.name }, 'name', 1);
      return matches[0] || null;
    },
    enabled: !!item?.is_magic && !!(itemId || item?.name),
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, detail: mergeCanonicalDetail(item, query.data) };
}

export function hasUsableItemContent(item) {
  return Boolean(item?.description || item?.effect || item?.properties?.length || item?.magic_properties?.length || item?.damage || item?.damage_dice || item?.armor_class || item?.modifiers);
}