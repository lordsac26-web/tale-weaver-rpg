import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const meaningful = (value) => value !== undefined && value !== null && value !== '';

export function mergeCanonicalDetail(fallback = {}, canonical = null) {
  if (!canonical) return fallback;
  return Object.entries(canonical).reduce((merged, [key, value]) => {
    if (meaningful(value)) merged[key] = value;
    return merged;
  }, { ...fallback });
}

export function useCanonicalSpell(spellName, fallback) {
  const query = useQuery({
    queryKey: ['spell-detail', spellName],
    queryFn: async () => (await base44.entities.Spell.filter({ name: spellName }, 'name', 1))[0] || null,
    enabled: !!spellName,
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, detail: mergeCanonicalDetail(fallback, query.data) };
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