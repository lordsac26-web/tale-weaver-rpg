/**
 * Safe description resolver for D&D entity records.
 *
 * Fallback chain (per spec):
 *   1. entity.description        (top-level string)
 *   2. entity.desc               (used by static gameData class features)
 *   3. entity.raw_data.data.desc (legacy DB records)
 *   4. entity.raw_data.desc     (legacy DB records)
 *   5. entity.benefits          (joined as readable bullets)
 *   6. entity.short_description (useful for Subclass entities)
 *   7. caller-provided fallback string
 *
 * Never returns blank, undefined, [object Object], or raw JSON.
 */

function usable(v) {
  return typeof v === 'string' &&
    v.trim() !== '' &&
    v !== '[object Object]' &&
    !v.startsWith('{') &&
    !v.startsWith('[');
}

export function resolveDescription(entity, fallback = 'No description available.') {
  if (!entity) return fallback;
  if (typeof entity === 'string') return fallback;

  // 1. Top-level description
  if (usable(entity.description)) return entity.description;

  // 2. desc (static gameData field name)
  if (usable(entity.desc)) return entity.desc;

  // 3-4. raw_data fallbacks for legacy DB records
  const rd = entity.raw_data;
  if (rd && typeof rd === 'object') {
    if (usable(rd.data?.desc)) return rd.data.desc;
    if (usable(rd.desc)) return rd.desc;
  }

  // 5. Benefits joined as readable bullets
  if (Array.isArray(entity.benefits) && entity.benefits.length > 0) {
    const bullets = entity.benefits
      .filter(b => typeof b === 'string' && b.trim())
      .map(b => `\u2022 ${b}`)
      .join('\n');
    if (bullets) return bullets;
  }

  // 6. short_description (Subclass entities)
  if (usable(entity.short_description)) return entity.short_description;

  // 7. Final fallback
  return fallback;
}