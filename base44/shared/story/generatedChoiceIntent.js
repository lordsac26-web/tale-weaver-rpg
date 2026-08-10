export const stripGeneratedChoiceAnnotations = (value) => String(value || '')
  .replace(/\s*\[Skill Check:[^\]]*\]/gi, '')
  .replace(/\s*\[(?:Roll|Outcome|Result):[^\]]*\]/gi, '')
  .replace(/\s+/g, ' ')
  .trim();

export const classifyPrecisionAmbushIntent = (value) => {
  const text = stripGeneratedChoiceAnnotations(value).toLowerCase();
  const strike = /\b(strike|attack|shot|shoot|fire|arrow)\b/.test(text);
  const precision = /\b(precision|precise|surgical|long[- ]range|ranged)\b/.test(text);
  const stealth = /\b(stealth|shadow|hidden|conceal|unseen)\b/.test(text);
  const target = /\b(necromancer|ritual master|ritualist|obsidian circle scout)\b/.test(text);
  return strike && precision && target ? { type: 'precision_stealth_strike', setup_skill: 'Stealth', target_hint: targetNameFromIntent(text), stealth_language: stealth } : null;
};

export const targetNameFromIntent = (value) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('ritual master')) return 'Ritual Master';
  if (text.includes('obsidian circle scout')) return 'Obsidian Circle Scout';
  return 'Necromancer';
};

const targetPattern = /necromancer|ritual master|ritualist|obsidian circle scout/i;
export const isMatchingAmbushTarget = (name) => targetPattern.test(String(name || ''));

export const normalizePendingAmbushRoster = (enemies) => {
  const rows = Array.isArray(enemies) ? enemies.map((enemy) => ({ ...enemy })) : [];
  const matches = rows.filter((enemy) => isMatchingAmbushTarget(enemy?.name || enemy?.monster_name));
  if (matches.length !== 1) return { ok: false, error: matches.length ? 'ambiguous_target' : 'missing_target', enemies: rows, target: null };
  const target = matches[0];
  const hp = Number(target.hp);
  const ac = Number(target.ac);
  if (!Number.isFinite(hp) || hp <= 0 || !Number.isFinite(ac) || ac <= 0) return { ok: false, error: 'incomplete_target_stat_block', enemies: rows, target: null };
  target.current_hp = hp;
  target.authoritative_state = 'alive_pending_attack';
  return { ok: true, enemies: rows.map((enemy) => enemy === matches[0] ? target : enemy), target };
};

export const pendingAmbushNarrative = (targetName, success = true) => success
  ? `Your stealth approach succeeds and you secure a clear line on the ${targetName}. The weapon strike itself is still pending and no hit, damage, or defeat has been resolved.`
  : `Your stealth approach fails to secure a clean line on the ${targetName}. No weapon attack, damage, or defeat has been resolved.`;