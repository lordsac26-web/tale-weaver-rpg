import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const meaningful = (value) => value !== undefined && value !== null && value !== '';
const usableText = (value) => typeof value === 'string' && value.trim().length > 0;
const unwrapRecord = (record) => record?.data && typeof record.data === 'object' ? record.data : record;

export function normalizeSpellView(fallback = {}, canonical = null) {
  const merged = mergeCanonicalDetail(unwrapRecord(fallback) || {}, unwrapRecord(canonical));
  const description = usableText(merged.description) ? merged.description : usableText(merged.effect_summary) ? merged.effect_summary : '';
  const effect = usableText(merged.effect_summary) ? merged.effect_summary : description;
  return { ...merged, description, effect };
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
      if (spellId) {
        const byId = await base44.entities.Spell.filter({ id: spellId }, 'name', 1);
        if (byId[0]) return unwrapRecord(byId[0]);
      }
      const matches = await base44.entities.Spell.filter({ name: spellName }, 'name', 50);
      return matches.map(unwrapRecord).find(record => usableText(record?.description) || usableText(record?.effect_summary)) || matches.map(unwrapRecord)[0] || null;
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