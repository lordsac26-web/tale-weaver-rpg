// Authoritative explicit-attack contract for story mode.
// An attack the player explicitly declares against established hostile
// creatures may never be resolved as prose: the turn must either open
// structured combat (initiative + CombatLog + HP) or return exactly ONE
// clarification that names the supported phrasing. Narration-only fights are
// rejected zero-write, so no XP, loot, wound, or death can be minted from text.
export const EXPLICIT_ATTACK_TRANSITION_VERSION = 'explicit-attack-transition-v1.1.0';

const ATTACK_VERB = /\b(attack|attacks|attacking|kill|kills|killing|slay|slays|slaying|strike|strikes|striking|eliminate|eliminates|eliminating|assault|charge|charges|engage|engages|fight|fights|loose|shoot|shoots|fire|fires|volley|dispatch|dispatches|cut down|mow down|mow|lay waste|wipe out|execute|executes|butcher|butchers)\b/i;
const HOSTILE_NOUN = /\b(cultists?|enemies|enemy|guards?|sentinels?|sentries|soldiers?|raiders?|bandits?|skeletons?|zombies?|ghouls?|wraiths?|stirges?|acolytes?|vanguard|scouts?|thugs?|mercenaries|assassins?|creatures?|monsters?|goblins?|orcs?|trolls?|ogres?|knights?|wardens?|priests?|necromancers?|ritualists?|minions?|remnants?|survivors?|hostiles?)\b/i;
const NON_CREATURE_OBJECT = /\b(node|nodes|barrier|barriers|seal|seals|door|doors|gate|gates|trap|traps|lock|locks|chain|chains|crystal|crystals|monolith|monoliths|vines?|roots?|walls?|rocks?|stones?|mechanism|mechanisms|levers?|bridge|flames?|artifacts?|amulet|altar|cage|bars|ledger|tome|book)\b/i;
const COLLECTIVE_REF = /\b(them|they|these|those|the rest|the remaining|all of)\b/i;

const escapeRe = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Established hostiles: living scene entities, or a hostile noun the recent
// committed narration already put in front of the player. A skill check or a
// previously narrated casualty never removes a living group from the scene.
export function establishedSceneHostiles(session) {
  const living = (session?.world_state?.scene_entities || [])
    .filter((entity) => entity?.type === 'creature' && entity.status === 'alive' && entity.alive !== false && entity.location === session.current_location && (!entity.transfer_state || entity.transfer_state === 'world'))
    .map((entity) => entity.name)
    .filter(Boolean);
  const recentText = (session?.story_log || []).slice(-3).map((entry) => String(entry?.text || '')).join(' ');
  return { living, recentText };
}

export function classifyExplicitAttackIntent({ actionText, session } = {}) {
  const text = String(actionText || '');
  if (!text.trim() || !ATTACK_VERB.test(text)) return { required: false, reason: 'no_attack_verb' };
  const { living, recentText } = establishedSceneHostiles(session);
  const namedTarget = (session?.world_state?.scene_entities || []).find(entity => living.includes(entity.name) && [entity.name, ...(entity.aliases || [])].some(name => name && new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(text)))?.name;
  const nounMatch = text.match(HOSTILE_NOUN);
  if (!namedTarget && !nounMatch) {
    if (COLLECTIVE_REF.test(text) && living.length) return { required: true, reason: 'explicit_attack_on_established_hostiles', target_kind: 'collective', target_hint: living.length === 1 ? living[0] : 'the hostile figures', established_entities: living };
    return { required: false, reason: NON_CREATURE_OBJECT.test(text) ? 'non_creature_target' : 'no_creature_target' };
  }
  const hint = namedTarget || nounMatch[0].toLowerCase();
  // Number-agnostic establishment: narration says "two cultists", the player says "the
  // nearest cultist". Matching the bare noun made that group unestablished, so the one
  // guard built for declared attacks declined to run — the owner's exact phrasing.
  const variants = (noun) => {
    const base = String(noun || '');
    const forms = new Set([base, `${base}s`, `${base}es`]);
    if (/y$/i.test(base)) forms.add(`${base.slice(0, -1)}ies`);
    if (/(?:ies|es|s)$/i.test(base)) forms.add(base.replace(/(?:ies|es|s)$/i, ''));
    return [...forms].filter(Boolean);
  };
  const established = namedTarget ? true : variants(nounMatch[0]).some((form) => new RegExp(`\\b${escapeRe(form)}\\b`, 'i').test(recentText));
  if (!established) return { required: false, reason: 'no_established_hostiles', target_hint: hint };
  return { required: true, reason: 'explicit_attack_on_established_hostiles', target_kind: namedTarget ? 'entity' : 'collective', target_hint: hint, established_entities: living, recent_hostile_evidence: true };
}

// A required attack turn passes ONLY as a live combat handoff with complete
// living enemy stat blocks. Anything else is a clarification, never prose.
export function validateExplicitAttackResolution({ intent, candidate } = {}) {
  if (!intent?.required) return { ok: true, applied: false, mode: 'not_required' };
  const enemies = (Array.isArray(candidate?.enemies) ? candidate.enemies : [])
    .filter((enemy) => Number(enemy?.hp) > 0 && Number(enemy?.ac) > 0);
  if (candidate?.combat_trigger === true && enemies.length > 0) return { ok: true, applied: true, mode: 'combat', enemies };
  return {
    ok: false,
    applied: true,
    mode: 'clarification',
    reason_code: candidate?.combat_trigger === true ? 'combat_without_valid_enemy' : 'narration_only_attack',
    received: { combat_trigger: candidate?.combat_trigger === true, living_enemies: enemies.length },
  };
}

export function explicitAttackGateInstruction(intent) {
  return `EXPLICIT ATTACK CONTRACT (authoritative, overrides any earlier instruction): the player has declared an attack on ${intent.target_hint}. An attack against established hostile creatures can NEVER be resolved in prose. Set combat_trigger to true and provide a complete living stat block for every hostile present (name, hp, current_hp, ac, attack_bonus, damage_dice, damage_bonus, dexterity, cr, xp). The narration must stop at the instant before the first blow: no attack roll, no hit or miss, no damage, no wound, no death, no defeat, no loot, no cleared enemies, and no XP. Structured combat resolves all of that.`;
}

// Full enforcement step. Returns one of three outcomes:
//  • not required  → the turn is untouched
//  • applied       → the turn now carries a live combat handoff (no HP/XP/loot)
//  • blocked       → the caller must return the single clarification, zero-write
export async function enforceExplicitAttackTransition({ actionText, session, candidate, regenerate, finalize } = {}) {
  const intent = classifyExplicitAttackIntent({ actionText, session });
  if (!intent.required) return { intent, applied: false, blocked: false, candidate };
  let gate = validateExplicitAttackResolution({ intent, candidate });
  let resolved = candidate;
  if (!gate.ok) {
    if (typeof regenerate !== 'function') return { intent, applied: false, blocked: true, gate, candidate };
    const retry = await regenerate(explicitAttackGateInstruction(intent));
    const retryGate = validateExplicitAttackResolution({ intent, candidate: retry });
    if (!retryGate.ok) return { intent, applied: false, blocked: true, gate: retryGate, candidate };
    resolved = typeof finalize === 'function' ? finalize(retry) : retry;
    gate = retryGate;
  }
  return {
    intent, applied: true, blocked: false, gate,
    candidate: { ...resolved, combat_trigger: true, enemies: gate.enemies, hp_change: 0, xp_earned: 0, loot: [], current_recovery: null, key_event: '',
      explicit_attack_gate: { version: EXPLICIT_ATTACK_TRANSITION_VERSION, required: true, target_hint: intent.target_hint, target_kind: intent.target_kind, mode: gate.mode } },
  };
}

export function explicitAttackClarification(intent, gate = {}) {
  const why = gate?.reason_code === 'combat_without_valid_enemy'
    ? 'the hostile stat blocks came back incomplete'
    : 'the scene tried to resolve it as prose';
  return {
    error: `Nothing was written — this is an attack on ${intent?.target_hint || 'hostile creatures'}, so it must resolve through structured combat (initiative, HP, combat log), but ${why}. To open the fight, either pick an attack option from the list, or phrase it as a weapon attack with a target, for example: "Loose an arrow at the nearest cultist." A non-combat move (sneak, parley, withdraw) also works.`,
    error_code: 'explicit_attack_requires_combat',
    reason_code: gate?.reason_code || 'narration_only_attack',
    invalid: true,
    preserve_scene: true,
    writes: 0,
    explicit_attack_transition_version: EXPLICIT_ATTACK_TRANSITION_VERSION,
  };
}