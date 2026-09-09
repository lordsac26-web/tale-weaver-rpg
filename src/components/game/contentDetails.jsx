import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { enrichSpell, enrichSpellList, getSpellDescriptionFallback, normalizeSpellName, selectCanonicalSpell } from '@/lib/spellDescriptionResolver';

export { enrichSpell, enrichSpellList, getSpellDescriptionFallback, normalizeSpellName, selectCanonicalSpell };

const meaningful = (value) => value !== undefined && value !== null && value !== '';
const usableText = (value) => typeof value === 'string' && value.trim().length > 0;
const unwrapRecord = (record) => record?.data && typeof record.data === 'object' ? record.data : record;

export function resolveCanonicalSpellInfo(spell, candidates = []) {
  return selectCanonicalSpell(unwrapRecord(spell), candidates.map(unwrapRecord).filter(Boolean));
}

export function normalizeSpellView(fallback = {}, canonical = null) {
  const merged = enrichSpell(unwrapRecord(fallback) || {}, canonical ? [unwrapRecord(canonical)] : []);
  return { ...merged, effect: usableText(merged.effect_summary) ? merged.effect_summary : merged.description };
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

export function useCanonicalSpellCatalog() {
  const query = useQuery({ queryKey: ['canonical-spell-catalog'], queryFn: () => base44.entities.Spell.list('name', 1000), staleTime: 0, refetchOnMount: 'always' });
  return { ...query, spells: query.data || [] };
}

export function useCanonicalSpell(spell, fallback) {
  const { spells, ...query } = useCanonicalSpellCatalog();
  const source = spell || fallback;
  return { ...query, detail: enrichSpell(source, [...spells, fallback].map(unwrapRecord).filter(Boolean)) };
}

export function selectPopulatedRecord(records = []) {
  return [...records].sort((a, b) => Number(usableText(b?.description)) - Number(usableText(a?.description)) || String(a?.id || '').localeCompare(String(b?.id || '')))[0] || null;
}

export function useCanonicalMagicItem(item) {
  const itemId = item?.magic_item_id || item?.id;
  const query = useQuery({
    queryKey: ['magic-item-detail', itemId || item?.name],
    queryFn: async () => {
      const matches = itemId
        ? await base44.entities.MagicItem.filter({ id: itemId }, 'name', 10)
        : await base44.entities.MagicItem.filter({ name: item.name }, 'name', 50);
      return selectPopulatedRecord(matches);
    },
    enabled: !!item?.is_magic && !!(itemId || item?.name),
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, detail: mergeCanonicalDetail(item, query.data) };
}

export function useEquipmentDescription(item) {
  const query = useQuery({
    queryKey: ['equipment-description', item?.name],
    queryFn: async () => selectPopulatedRecord(await base44.entities.Equipment.filter({ name: item.name }, 'name', 50)),
    enabled: !!item?.name && !usableText(item?.description),
    staleTime: 5 * 60 * 1000,
  });
  return usableText(item?.description) ? item.description : query.data?.description || 'No description available';
}

export function hasUsableItemContent(item) {
  return Boolean(item?.description || item?.effect || item?.properties?.length || item?.magic_properties?.length || item?.damage || item?.damage_dice || item?.armor_class || item?.modifiers);
}