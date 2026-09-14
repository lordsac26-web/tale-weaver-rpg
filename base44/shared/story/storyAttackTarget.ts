export const STORY_ATTACK_TARGET_VERSION = 'story-attack-target-v1.0.0';

const ignored = new Set(['the', 'a', 'an', 'lead', 'leader', 'primary', 'main', 'target', 'squad', 'group', 'precise']);
const words = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((word) => word && !ignored.has(word));
const normalized = (value) => words(value).join(' ');
const validEnemy = (enemy) => Number(enemy?.hp ?? enemy?.current_hp) > 0 && Number(enemy?.ac) > 0;
const nameMatches = (name, targetRef) => {
  const nameKey = normalized(name);
  const targetKey = normalized(targetRef);
  if (!nameKey || !targetKey) return false;
  if (nameKey.includes(targetKey) || targetKey.includes(nameKey)) return true;
  const targetWords = words(targetRef);
  const nameWords = new Set(words(name));
  return targetWords.length > 0 && targetWords.every((word) => nameWords.has(word));
};

export function resolveStoryAttackTarget({ targetRef, enemies = [], sceneText = '', characterLevel = 1 } = {}) {
  const ref = String(targetRef || '').trim();
  const meaningful = words(ref);
  if (!ref || meaningful.length === 0) return { ok: false, clarification_required: true, reason: 'missing_target_ref' };

  const roster = (Array.isArray(enemies) ? enemies : []).filter(validEnemy);
  const matches = roster.filter((enemy) => nameMatches(enemy.name || enemy.monster_name, ref));
  if (matches.length === 1) return { ok: true, target: { ...matches[0] }, enemies: [{ ...matches[0] }], materialized: false };
  if (matches.length > 1) return { ok: false, clarification_required: true, reason: 'ambiguous_authoritative_targets', candidates: matches.map((enemy) => enemy.name) };

  if (!nameMatches(sceneText, ref)) return { ok: false, clarification_required: true, reason: 'target_not_established_in_scene', candidates: roster.map((enemy) => enemy.name).filter(Boolean) };

  const level = Math.max(1, Number(characterLevel) || 1);
  const target = {
    name: ref.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    hp: Math.max(8, 8 + level * 2),
    current_hp: Math.max(8, 8 + level * 2),
    ac: Math.min(18, 12 + Math.floor(level / 4)),
    attack_bonus: 2 + Math.ceil(level / 4),
    damage_dice: level >= 7 ? '2d6' : '1d6',
    damage_bonus: Math.max(1, Math.floor(level / 3)),
    dexterity: 12,
    cr: Math.max(0.125, Math.round((level / 4) * 2) / 2),
    xp: Math.max(25, level * 50),
    narrative_materialization: { version: STORY_ATTACK_TARGET_VERSION, target_ref: ref, evidence: 'named living NPC in immediately preceding player-visible scene' },
  };
  return { ok: true, target, enemies: [target], materialized: true };
}

export function storyAttackClarification(targetRef, candidates = []) {
  const choices = candidates.filter(Boolean);
  return choices.length
    ? `Your target is not uniquely established. Did you mean ${choices.join(' or ')}? No attack was rolled and combat did not begin.`
    : `Which living target do you mean by “${String(targetRef || 'that target')}”? No attack was rolled and combat did not begin.`;
}