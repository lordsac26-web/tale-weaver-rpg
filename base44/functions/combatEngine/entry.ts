import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Combat Engine - handles initiative, turns, damage, conditions.
 * All math done server-side referencing DB state.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ TABLE OF CONTENTS — search the banner text to jump to a section          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  SECTION: SHARED HELPERS        dice, damage mods, conditions, advanceTurn│
 * │  ACTION: start_combat           roll initiative, build the CombatLog      │
 * │  HELPER: getActionsPerTurn      Extra Attack / action economy             │
 * │  ACTION: player_attack          weapon + spell attacks (largest handler)  │
 * │  ACTION: offhand_attack         two-weapon fighting bonus-action strike   │
 * │  ACTION: enemy_turn             enemy AI, damage mitigation, death saves  │
 * │  ACTION: action_surge           Fighter extra action                      │
 * │  ACTION: legendary_action       Monster Manual legendary attack           │
 * │  ACTION: grapple                opposed Athletics check → Grappled        │
 * │  ACTION: dodge                  disadvantage on incoming attacks          │
 * │  ACTION: next_turn              advance initiative tracker                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, session_id, combat_id, character_id, payload } = await req.json();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: SHARED HELPERS — dice rolling, damage modifiers, condition logic,
  // and turn advancement. Used by every action handler below.
  // ═══════════════════════════════════════════════════════════════════════════
  const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
  const rollD20 = () => Math.floor(Math.random() * 20) + 1;
  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  // Cantrip damage scaling: doubles at char levels 5, 11, 17 (PHB p.205)
  const scaleCantripDice = (damageDice, characterLevel) => {
    if (!damageDice || damageDice === '0') return damageDice;
    const m = damageDice.match(/^(\d+)d(\d+)$/);
    if (!m) return damageDice;
    const baseDice = parseInt(m[1]);
    const sides = parseInt(m[2]);
    const mult = characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
    return `${baseDice * mult}d${sides}`;
  };

  // Spellcasting ability by class (server-side authoritative copy)
  const SPELL_ABILITY_MAP = {
    wizard: 'intelligence', artificer: 'intelligence',
    eldritch_knight: 'intelligence', arcane_trickster: 'intelligence',
    cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
    bard: 'charisma', paladin: 'charisma', sorcerer: 'charisma', warlock: 'charisma'
  };

  // Roll dice string (e.g. "3d6") and return total
  const rollDiceStr = (diceStr) => {
    const m = (diceStr || '').match(/^(\d+)d(\d+)$/);
    if (!m) return 0;
    let total = 0;
    for (let i = 0; i < parseInt(m[1]); i++) total += rollDice(parseInt(m[2]));
    return total;
  };

  // Damage Resistance/Vulnerability/Immunity (PHB p.197): immunity → 0,
  // resistance → halved (rounded down), vulnerability → doubled.
  const normList = (l) => Array.isArray(l) ? l.map(d => String(d || '').toLowerCase().trim()).filter(Boolean) : [];
  const applyDamageModifiers = (damage, damageType, target = {}) => {
    const type = String(damageType || '').toLowerCase().trim();
    if (!type || damage <= 0) return { amount: Math.max(0, damage), applied: null };
    const immunities = normList(target.immunities);
    const resistances = normList(target.resistances);
    const vulnerabilities = normList(target.vulnerabilities);
    if (immunities.includes(type)) return { amount: 0, applied: 'immunity' };
    if (resistances.includes(type)) return { amount: Math.floor(damage / 2), applied: 'resistance' };
    if (vulnerabilities.includes(type)) return { amount: damage * 2, applied: 'vulnerability' };
    return { amount: Math.max(0, damage), applied: null };
  };

  // Centralized condition mechanics (PHB p.290-292). Mirrors components/game/conditionEffects.js.
  const CONDITION_FLAGS = {
    blinded:     { no_actions: false, incoming_attack_advantage: true },
    paralyzed:   { no_actions: true, incoming_attack_advantage: true, melee_auto_crit: true },
    stunned:     { no_actions: true, incoming_attack_advantage: true },
    unconscious: { no_actions: true, incoming_attack_advantage: true, melee_auto_crit: true },
    petrified:   { no_actions: true, incoming_attack_advantage: true, resist_all: true },
    incapacitated:{ no_actions: true },
    grappled:    { speed_zero: true },
    restrained:  { speed_zero: true, incoming_attack_advantage: true },
    banished:    { no_actions: true, removed_from_combat: true },
    polymorphed: { no_actions: false },
    prone:       {},
    invisible:   { incoming_attack_disadvantage: true },
  };
  const condNames = (arr) => (arr || []).map(c => String(typeof c === 'string' ? c : c?.name || '').toLowerCase().trim());
  const hasNoActions = (arr) => condNames(arr).some(n => CONDITION_FLAGS[n]?.no_actions);
  // Conditions that get a save at the end of each turn to shake off (engine handles at turn start).
  const SAVEABLE_CONDITIONS = {
    paralyzed: 'wisdom', // Hold Person / Hold Monster — WIS save
    banished: 'charisma',
    charmed: 'wisdom',
    frightened: 'wisdom',
    polymorphed: 'wisdom',
    stunned: 'constitution',
  };

  // ─── DATA-DRIVEN MONSTER AI ─────────────────────────────────────────────────
  // Each enemy has an `archetype` (stored at start_combat). The archetype maps to a
  // tactical preset: a prioritized list of tactics, each with a `when` predicate and
  // the combat effects it applies (extra attacks, accuracy/damage tweaks, descriptor).
  // To add or tune a monster's behavior, edit AI_ARCHETYPES — no control-flow changes.
  //
  // Tactic effect fields:
  //   numAttacks   — total attacks this turn (default 1)
  //   attackBonus  — flat bonus/penalty to the attack roll
  //   bonusDamage  — flat bonus damage per hit
  //   desc         — flavor text shown in the log ("[Name <desc>]")
  // Tactic gating fields (all optional; a tactic fires when ALL provided predicates pass):
  //   selfHpBelow / selfHpAbove — fraction of the enemy's own max HP
  //   playerHpBelow             — fraction of the player's max HP
  //   roundLte                  — only on/before this round
  //   chance                    — probabilistic gate (0..1)
  // Tactics are evaluated in order; the FIRST match wins, else `default` is used.
  const AI_ARCHETYPES = {
    // Big dumb melee: hits hard, gets reckless when wounded.
    brute: {
      label: 'brute',
      tactics: [
        { id: 'desperate_fury', when: { selfHpBelow: 0.25 }, effects: { numAttacks: 2, attackBonus: 2, bonusDamage: 2, desc: 'swings in a desperate frenzy!' } },
        { id: 'reckless',       when: { chance: 0.5 },        effects: { attackBonus: 3, bonusDamage: 2, desc: 'attacks recklessly!' } },
      ],
      default: { desc: 'attacks!' },
    },
    // Mobile striker: opportunistic, presses weakened foes, retreats when nearly dead.
    scout: {
      label: 'scout',
      tactics: [
        { id: 'retreat',        when: { selfHpBelow: 0.25, chance: 0.5 }, effects: { attackBonus: -1, desc: 'looks for an opening to flee!' } },
        { id: 'press',          when: { playerHpBelow: 0.3 },             effects: { attackBonus: 2, bonusDamage: 1, desc: 'darts in to finish the wounded hero!' } },
        { id: 'tactical_strike',when: { chance: 0.35 },                   effects: { attackBonus: 1, desc: 'strikes at a weak point!' } },
      ],
      default: { desc: 'attacks!' },
    },
    // Ranged caster: opens with a calculated assessment, then precise blasts.
    spellcaster: {
      label: 'spellcaster',
      tactics: [
        { id: 'opening_assess', when: { roundLte: 1 },        effects: { attackBonus: 1, desc: 'weaves a spell, sizing up the hero...' } },
        { id: 'focused_blast',  when: { playerHpBelow: 0.4 }, effects: { attackBonus: 2, bonusDamage: 2, desc: 'channels a focused blast!' } },
        { id: 'arcane_volley',  when: { chance: 0.4 },        effects: { numAttacks: 2, desc: 'unleashes an arcane volley!' } },
      ],
      default: { desc: 'casts a spell!' },
    },
    // Disciplined fighter: balanced, tactical, holds the line.
    soldier: {
      label: 'soldier',
      tactics: [
        { id: 'multiattack',    when: { selfHpAbove: 0.5 },   effects: { numAttacks: 2, desc: 'executes a disciplined multiattack!' } },
        { id: 'press',          when: { playerHpBelow: 0.3 }, effects: { attackBonus: 2, bonusDamage: 1, desc: 'presses the advantage!' } },
        { id: 'defensive',      when: { chance: 0.2 },        effects: { attackBonus: -2, desc: 'takes a defensive stance!' } },
      ],
      default: { desc: 'attacks!' },
    },
    // Boss/legendary: relentless, escalates with multiattacks and fury.
    boss: {
      label: 'boss',
      tactics: [
        { id: 'desperate_fury', when: { selfHpBelow: 0.25 }, effects: { numAttacks: 3, bonusDamage: 2, desc: 'fights with desperate fury!' } },
        { id: 'press',          when: { playerHpBelow: 0.3 }, effects: { numAttacks: 2, attackBonus: 2, bonusDamage: 2, desc: 'moves in for the kill!' } },
        { id: 'opening',        when: { roundLte: 1 },        effects: { numAttacks: 2, desc: 'sizes up the hero with cold calculation...' } },
        { id: 'multiattack',    when: { chance: 1 },          effects: { numAttacks: 2, desc: 'unleashes a flurry of blows!' } },
      ],
      default: { numAttacks: 2, desc: 'attacks!' },
    },
  };

  // Infer an archetype from monster metadata when one isn't explicitly provided.
  const inferArchetype = (enemy) => {
    if (enemy.archetype && AI_ARCHETYPES[enemy.archetype]) return enemy.archetype;
    const cr = enemy.cr || 1;
    if (enemy.is_legendary || cr >= 10) return 'boss';
    const text = `${enemy.name || ''} ${enemy.monster_name || ''} ${enemy.meta || ''} ${enemy.type || ''} ${(enemy.actions || '')}`.toLowerCase();
    if ((enemy.attack_type === 'ranged') || /mage|wizard|sorcerer|warlock|caster|cultist|priest|shaman|witch|lich|spell/.test(text)) return 'spellcaster';
    if (/scout|rogue|assassin|thief|archer|skirmisher|goblin|kobold|wolf|raptor|stalker/.test(text)) return 'scout';
    if (/knight|guard|soldier|veteran|captain|legionnaire|hobgoblin|warrior/.test(text)) return 'soldier';
    if (cr >= 5) return 'boss';
    return 'brute';
  };

  // Evaluate an archetype's tactic list against the current battlefield state and
  // return the chosen tactic effects ({ numAttacks, attackBonus, bonusDamage, desc }).
  const chooseTactic = (archetypeKey, ctx) => {
    const arch = AI_ARCHETYPES[archetypeKey] || AI_ARCHETYPES.brute;
    const passes = (when = {}) => {
      if (when.selfHpBelow != null && !(ctx.selfHpPct < when.selfHpBelow)) return false;
      if (when.selfHpAbove != null && !(ctx.selfHpPct >= when.selfHpAbove)) return false;
      if (when.playerHpBelow != null && !(ctx.playerHpPct < when.playerHpBelow)) return false;
      if (when.roundLte != null && !(ctx.round <= when.roundLte)) return false;
      if (when.chance != null && !(Math.random() < when.chance)) return false;
      return true;
    };
    const chosen = (arch.tactics || []).find(t => passes(t.when)) || null;
    const eff = chosen ? chosen.effects : (arch.default || {});
    return {
      id: chosen ? chosen.id : 'default',
      numAttacks: eff.numAttacks || 1,
      attackBonus: eff.attackBonus || 0,
      bonusDamage: eff.bonusDamage || 0,
      desc: eff.desc || null,
      archetype: arch.label || archetypeKey,
    };
  };

  // Advance initiative tracker past current combatant, skipping unconscious
  const advanceTurn = (currentIndex, currentRound, combatantsArr) => {
    let nextIndex = (currentIndex + 1) % combatantsArr.length;
    let nextRound = currentRound;
    if (nextIndex === 0) nextRound++;
    let safety = 0;
    while (!combatantsArr[nextIndex]?.is_conscious && safety < combatantsArr.length) {
      nextIndex = (nextIndex + 1) % combatantsArr.length;
      if (nextIndex === 0) nextRound++;
      safety++;
    }
    return { nextIndex, nextRound };
  };

  // Award victory XP exactly ONCE per combat. Re-reads the CombatLog and checks the
  // xp_awarded flag to guard against duplicate/stale writes (race condition fix).
  const awardVictoryXP = async (cid, combatantsArr, cid_char) => {
    const freshLog = await base44.entities.CombatLog.get(cid);
    if (freshLog.xp_awarded) return;
    const totalXP = combatantsArr.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
    const ch = await base44.entities.Character.get(cid_char);
    await base44.entities.Character.update(cid_char, { xp: (ch.xp || 0) + totalXP });
    await base44.entities.CombatLog.update(cid, { xp_awarded: true });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: start_combat — roll initiative for player + enemies, sort the order,
  // and create the CombatLog record that drives the whole encounter.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'start_combat') {
    let { enemies } = payload;
    const session = await base44.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const character = await base44.entities.Character.get(session.character_id);

    // ─── DYNAMIC ENCOUNTER SCALING ──────────────────────────────────────────
    // Keep solo-player encounters balanced and challenging by scaling enemy HP,
    // attack bonus, and participant count to the player's level and current HP.
    //  • Level scaling: enemies grow tougher as the hero levels up.
    //  • HP scaling: if the hero is wounded (< 50% HP), ease off slightly so a
    //    fresh encounter isn't an instant death spiral; if at full HP, push harder.
    //  • Count scaling: higher-level heroes face more foes (more action economy).
    const scaleEnemies = (rawEnemies, char) => {
      const level = char?.level || 1;
      const hpPct = (char?.hp_max ? (char.hp_current || 0) / char.hp_max : 1);
      // Per-enemy stat multipliers driven by level (≈ +6% per level over 1).
      const levelFactor = 1 + Math.max(0, level - 1) * 0.06;
      // Difficulty trim when the hero is hurt, boost when topped off.
      const hpFactor = hpPct < 0.35 ? 0.8 : hpPct < 0.5 ? 0.9 : hpPct >= 0.95 ? 1.1 : 1;
      const statMult = levelFactor * hpFactor;

      const scaled = rawEnemies.map(e => {
        const baseHp = parseInt(e.hp) || e.hp_current || 10;
        const baseAtk = e.attack_bonus ?? 3;
        const baseDmgBonus = e.damage_bonus ?? 2;
        const scaledMaxHp = Math.max(1, Math.round(baseHp * statMult));
        const woundedPct = (e.current_hp != null && Number(e.current_hp) < baseHp) ? Math.max(0, Number(e.current_hp)) / baseHp : 1;
        return {
          ...e,
          hp: scaledMaxHp,
          current_hp: Math.max(1, Math.round(scaledMaxHp * woundedPct)),
          attack_bonus: Math.round(baseAtk + Math.max(0, level - 1) * 0.25),
          damage_bonus: Math.round(baseDmgBonus + Math.max(0, level - 4) * 0.2),
        };
      });

      // Add extra reinforcements for higher-level, healthy heroes (action economy).
      // +1 enemy at L5, +2 at L11 — but never reinforce a wounded hero.
      let reinforcements = 0;
      if (hpPct >= 0.5) {
        if (level >= 11) reinforcements = 2;
        else if (level >= 5) reinforcements = 1;
      }
      if (reinforcements > 0 && scaled.length > 0) {
        // Clone the weakest existing enemy as the reinforcement template.
        const template = [...scaled].sort((a, b) => (parseInt(a.hp) || 0) - (parseInt(b.hp) || 0))[0];
        for (let i = 0; i < reinforcements; i++) {
          scaled.push({ ...template, name: `${template.name} Reinforcement` });
        }
      }
      return scaled;
    };

    enemies = scaleEnemies(enemies, character);

    // Roll initiative for all combatants
    const combatants = [];

    // Check feat flags (Alert: +5 init, cannot be surprised)
    const playerFeatFlags = character._feat_flags || [];
    const hasAlert = (character.feats || []).includes('Alert') || playerFeatFlags.includes('alert');
    // Harengon: Hare-Trigger — add proficiency bonus to Initiative rolls (Wilds Beyond the Witchlight)
    const isHarengon = (character.race || '') === 'Harengon';
    const harengonInitBonus = isHarengon ? (character.proficiency_bonus || 2) : 0;

    // Player initiative
    const playerInitRoll = rollD20();
    const alertBonus = hasAlert ? 5 : 0;
    const playerInitMod = statMod(character.dexterity) + (character.initiative || 0) + alertBonus + harengonInitBonus;
    // Heavy armor STR requirement speed penalty (PHB p.144): -10 ft if STR < armor minimum
    let playerSpeed = character.speed || 30;
    const equippedArmor = character.equipped?.armor;
    if (equippedArmor?.armor_type?.toLowerCase() === 'heavy') {
      const strReq = equippedArmor.str_requirement || 13;
      if ((character.strength || 10) < strReq) playerSpeed = Math.max(0, playerSpeed - 10);
    }

    combatants.push({
      id: character.id,
      name: character.name,
      type: 'player',
      initiative_roll: playerInitRoll,
      initiative_mod: playerInitMod,
      initiative_total: playerInitRoll + playerInitMod,
      hp_current: character.hp_current,
      hp_max: character.hp_max,
      ac: character.armor_class,
      speed: playerSpeed,
      conditions: character.conditions || [],
      is_conscious: true
    });

    // Enemy initiatives
    for (const enemy of enemies) {
      const initRoll = rollD20();
      const initMod = statMod(enemy.dexterity || 10);
      const enemyHP = parseInt(enemy.hp) || enemy.hp_current || 10;
      // Legendary creatures (CR 10+ or explicitly flagged) get Legendary Actions (3/round)
      // and Legendary Resistance (3/day) per the Monster Manual.
      const cr = enemy.cr || 1;
      const isLegendary = enemy.is_legendary || cr >= 10;
      combatants.push({
        id: `enemy_${Math.random().toString(36).substr(2, 9)}`,
        name: enemy.name || enemy.monster_name || `Enemy`,
        type: 'enemy',
        initiative_roll: initRoll,
        initiative_mod: initMod,
        initiative_total: initRoll + initMod,
        hp_current: enemy.current_hp != null ? Math.max(1, Math.min(enemyHP, Number(enemy.current_hp))) : enemyHP,
        hp_max: enemyHP,
        ac: enemy.ac || 12,
        attack_bonus: enemy.attack_bonus || 3,
        damage_dice: enemy.damage_dice || '1d6',
        damage_bonus: enemy.damage_bonus || 2,
        conditions: Array.isArray(enemy.starting_conditions) ? enemy.starting_conditions.map(n => ({ name: String(n).toLowerCase().trim(), source: 'story' })) : [],
        is_conscious: true,
        cr,
        xp: enemy.xp || 100,
        is_legendary: isLegendary,
        legendary_resistance_remaining: isLegendary ? 3 : 0,
        // Data-driven AI: explicit archetype if provided, else inferred from meta/CR.
        archetype: inferArchetype(enemy),
        attack_type: enemy.attack_type || 'melee'
      });
    }

    // Sort by initiative (ties broken by dex mod)
    combatants.sort((a, b) => {
      if (b.initiative_total !== a.initiative_total) return b.initiative_total - a.initiative_total;
      return b.initiative_mod - a.initiative_mod;
    });

    const combatLog = await base44.entities.CombatLog.create({
      session_id,
      round: 1,
      combatants,
      initiative_order: combatants.map(c => ({ id: c.id, name: c.name, initiative_value: c.initiative_total, initiative: c.initiative_total })),
      current_turn_index: 0,
      log_entries: [{ round: 1, text: `⚔️ Combat begins! Initiative: ${combatants.map(c => `${c.name} (${c.initiative_total})`).join(' → ')}` }],
      is_active: true,
      result: 'ongoing',
      world_state: { actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false }
    });

    await base44.entities.GameSession.update(session_id, { in_combat: true, combat_state: { combat_id: combatLog.id } });

    return Response.json({ combat_id: combatLog.id, combatants, initiative_order: combatants });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: getActionsPerTurn — action economy (Extra Attack and class overrides).
  // ═══════════════════════════════════════════════════════════════════════════
  const getActionsPerTurn = (character) => {
    const features = (character.features || []).map(f => (typeof f === 'string' ? f : f.name || '').toLowerCase());
    const charClass = (character.class || '').toLowerCase();
    const subclass  = (character.subclass || '').toLowerCase();
    const level = character.level || 1;
    let actions = 1;
    // Extra Attack: Fighter 5+, Ranger 5+, Paladin 5+, Barbarian 5+, Monk 5+
    if (['fighter','ranger','paladin','barbarian','monk'].includes(charClass) && level >= 5) actions = 2;
    if (charClass === 'fighter' && level >= 11) actions = 3;
    if (charClass === 'fighter' && level >= 20) actions = 4;
    // Artificer Battle Smith / Armorer get Extra Attack at level 5 (Tasha's p.17)
    if (charClass === 'artificer' && level >= 5 && (subclass.includes('battle smith') || subclass.includes('armorer'))) actions = Math.max(actions, 2);
    // Bard College of Valor: Extra Attack at level 6 (PHB p.55)
    if (charClass === 'bard' && level >= 6 && subclass.includes('valor')) actions = Math.max(actions, 2);
    // Warlock Thirsting Blade invocation: Extra Attack at level 5 (PHB p.111)
    if (charClass === 'warlock' && level >= 5 && features.some(f => f.includes('thirsting blade'))) actions = Math.max(actions, 2);
    // Feature-based overrides (catches any class with explicit 'extra attack' in features list)
    if (features.some(f => f.includes('extra attack'))) actions = Math.max(actions, 2);
    return actions;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: player_attack — the largest handler. Resolves weapon AND spell
  // attacks (utility, healing, saving-throw, auto-hit/Magic Missile, Eldritch
  // Blast, then generic attack-roll), applies feats, conditions, damage mods,
  // smite/sneak/rage, and advances the turn. Sub-branches are marked with === ===.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'player_attack') {
    const { target_id, weapon, spell, modifiers = {} } = payload;
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    // User-scoped fetch: RLS only returns the record if the user may read (owns) it,
    // so a successful fetch proves ownership. (Manual created_by/email compare was
    // fragile and caused false 403s for the legitimate owner.)
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    // Handle advantage/disadvantage
    let attackRoll1 = rollD20();
    let attackRoll2 = modifiers.advantage || modifiers.disadvantage ? rollD20() : attackRoll1;
    let attackRoll = attackRoll1;
    if (modifiers.advantage) attackRoll = Math.max(attackRoll1, attackRoll2);
    if (modifiers.disadvantage) attackRoll = Math.min(attackRoll1, attackRoll2);

    let attackMod = 0;
    let damageDice = '1d6';
    let damageBonus = 0;
    let attackType = 'melee';
    let isCritical = attackRoll === 20;
    let isMiss = attackRoll === 1;
    let extraDamageDice = []; // For smite, sneak attack, etc
    let sneakAttackApplied = false; // tracks if Sneak Attack was used this attack (once-per-turn guard)

    if (spell) {
      // Barbarian Rage (PHB p.48): cannot cast or concentrate on spells while raging.
      const playerConds = (character.conditions || []).map(c => String(typeof c === 'string' ? c : c?.name || '').toLowerCase());
      if (playerConds.includes('raging')) {
        return Response.json({ error: 'You cannot cast spells while raging (PHB p.48).', invalid: true }, { status: 400 });
      }
      const spellAbility = SPELL_ABILITY_MAP[(character.class || '').toLowerCase()] || 'intelligence';
      const spellStatMod = statMod(character[spellAbility]);
      const profBonus = character.proficiency_bonus || 2;
      const spellSaveDC = 8 + spellStatMod + profBonus;
      const spellAttackBonus = spellStatMod + profBonus;

      attackMod = spellAttackBonus;
      // Scale cantrip damage by character level (PHB cantrip scaling rules)
      const isCantrip = (spell.base_level === 0 || spell.slot_level === 0);
      damageDice = isCantrip
        ? scaleCantripDice(spell.damage_dice || '1d6', character.level || 1)
        : (spell.damage_dice || '2d6');
      damageBonus = 0; // spell damage doesn't add ability mod (unless explicit)
      attackType = spell.attack_type || 'ranged_spell_attack';

      // Handle upcast: scale damage dice if upcasting (add 1 die per slot level above base)
      // e.g. Fireball (8d6 base level 3) cast at level 4 → 9d6, level 5 → 10d6
      const slotLevel = spell.slot_level || spell.base_level || 1;
      const baseLevel = spell.base_level || 1;
      const upcasting = slotLevel > baseLevel;
      if (upcasting && damageDice && damageDice !== '0') {
        const dMatch0 = damageDice.match(/^(\d+)d(\d+)$/);
        if (dMatch0) {
          const baseDieCount = parseInt(dMatch0[1]);
          const dieSides = parseInt(dMatch0[2]);
          const extraLevels = slotLevel - baseLevel;
          // Add 1 die per extra slot level, capped so we don't over-scale cantrips
          damageDice = `${baseDieCount + extraLevels}d${dieSides}`;
        }
      }

      // Use slot on cast — server validates availability before spending (Security fix #5)
      if (spell.slot_level && spell.slot_level > 0) {
        const slotsKey = `level_${spell.slot_level}`;
        const currentUsed = (character.spell_slots || {})[slotsKey] || 0;
        // Compute max slots for this level from the handleRest SPELL_SLOTS_BY_CLASS table.
        // We inline a simplified full-caster/half-caster check here.
        const FULL_CASTER_MAX = [4,3,3,3,3,2,2,1,1];
        const HALF_CASTER_CLASSES = ['Paladin', 'Ranger', 'Artificer'];
        const THIRD_CASTER_SUBCLASSES = ['eldritch knight', 'arcane trickster'];
        const isHalfCaster = HALF_CASTER_CLASSES.includes(character.class);
        const isThirdCaster = NON_CASTERS.includes(character.class) &&
          THIRD_CASTER_SUBCLASSES.some(s => (character.subclass || '').toLowerCase().includes(s));
        // Use a generous cap of 4 for validation — this prevents spending slots that were never granted
        // while avoiding storing the full slot table here (handleRest owns that).
        const slotLevelIdx = spell.slot_level - 1;
        const maxForLevel = isThirdCaster ? 4 : (FULL_CASTER_MAX[slotLevelIdx] || 4);
        if (currentUsed >= maxForLevel) {
          return Response.json({ error: `No ${spell.slot_level === 1 ? '1st' : spell.slot_level + 'th'}-level spell slots remaining.`, invalid: true }, { status: 400 });
        }
        await base44.entities.Character.update(character_id, {
          spell_slots: { ...(character.spell_slots || {}), [slotsKey]: currentUsed + 1 }
        });
      }

      // === SORCERER METAMAGIC: spend sorcery points (PHB p.101-102) ===
      // Quickened = 2 SP, Heightened = 3 SP, Twinned = spell level (min 1).
      const meta = modifiers.metamagic || {};
      if ((character.class || '').toLowerCase() === 'sorcerer' && (meta.quickened || meta.twinned || meta.heightened)) {
        const lvl = spell.slot_level || 1;
        let spCost = 0;
        if (meta.quickened) spCost += 2;
        if (meta.heightened) spCost += 3;
        if (meta.twinned) spCost += Math.max(1, lvl);
        // Self-heal: initialize SP pool (= sorcerer level from level 2) if not yet set.
        const spMax = character.sorcery_points_max ?? ((character.level || 1) >= 2 ? (character.level || 1) : 0);
        const spAvail = character.sorcery_points_current ?? spMax;
        if (spCost > spAvail) {
          return Response.json({ error: `Not enough sorcery points (need ${spCost}, have ${spAvail}).`, invalid: true }, { status: 400 });
        }
        await base44.entities.Character.update(character_id, {
          sorcery_points_max: spMax,
          sorcery_points_current: spAvail - spCost,
        });
      }

      // === UTILITY / BUFF spells ===
      if (spell.is_utility) {
        const utilEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
          hit: null, text: `${character.name} casts ${spell.name}!`,
          spell_name: spell.name, is_utility: true
        };
        const updatedLog = [...(combatLog.log_entries || []), utilEntry];
        const actionsPerTurn2 = getActionsPerTurn(character);
        const currentActionsUsed2 = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const actionsRemaining2 = actionsPerTurn2 - currentActionsUsed2;
        let nextIndex2 = combatLog.current_turn_index;
        let nextRound2 = combatLog.round;
        let newWorldState2 = { ...(combatLog.world_state || {}), actions_used_this_turn: currentActionsUsed2 };
        if (actionsRemaining2 <= 0) {
          nextIndex2 = (combatLog.current_turn_index + 1) % combatants.length;
          if (nextIndex2 === 0) nextRound2 += 1;
          let safety2 = 0;
          while (!combatants[nextIndex2]?.is_conscious && safety2 < combatants.length) {
            nextIndex2 = (nextIndex2 + 1) % combatants.length;
            if (nextIndex2 === 0) nextRound2 += 1;
            safety2++;
          }
          newWorldState2.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, {
          log_entries: updatedLog, current_turn_index: nextIndex2, round: nextRound2, world_state: newWorldState2
        });
        return Response.json({ hit: null, damage: 0, log_entry: utilEntry, result: 'ongoing', combat_ended: false, actions_remaining: actionsRemaining2, next_turn_index: nextIndex2 });
      }

      // === HEALING spells ===
      if (spell.attack_type === 'healing' && spell.heal_dice) {
        let healAmt = rollDiceStr(spell.heal_dice || '1d8');
        healAmt += spellStatMod;
        const player2 = combatants.find(c => c.type === 'player');
        if (player2) {
          player2.hp_current = Math.min(player2.hp_max, player2.hp_current + healAmt);
          await base44.entities.Character.update(character_id, { hp_current: player2.hp_current });
        }
        const healEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: character.name,
          hit: true, text: `${character.name} casts ${spell.name}! Restores ${healAmt} HP.`,
          spell_name: spell.name, heal_amount: healAmt
        };
        const updatedCombatants2 = combatants.map(c => c.type === 'player' ? player2 : c);
        const actionsPerTurn3 = getActionsPerTurn(character);
        const actionsUsed3 = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const actionsRem3 = actionsPerTurn3 - actionsUsed3;
        let ni3 = combatLog.current_turn_index;
        let nr3 = combatLog.round;
        let ws3 = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed3 };
        if (actionsRem3 <= 0) {
          ni3 = (combatLog.current_turn_index + 1) % updatedCombatants2.length;
          if (ni3 === 0) nr3++;
          ws3.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, {
          combatants: updatedCombatants2, log_entries: [...(combatLog.log_entries || []), healEntry],
          current_turn_index: ni3, round: nr3, world_state: ws3
        });
        return Response.json({ hit: true, damage: 0, heal_amount: healAmt, log_entry: healEntry, result: 'ongoing', combat_ended: false, actions_remaining: actionsRem3, next_turn_index: ni3 });
      }

      // === SAVING THROW spells ===
      if (spell.attack_type === 'saving_throw' && spell.save_type) {
        // Target's save ability — use what we have on the combatant, else default to 10
        const targetSaveStat = target[spell.save_type] || target.save_stats?.[spell.save_type] || 10;
        const targetSaveMod = statMod(targetSaveStat);
        const saveRoll = rollD20();
        const saveTotal = saveRoll + targetSaveMod;
        const saveFailed = saveTotal < spellSaveDC;

        // Heightened Spell metamagic: target rolls its save with disadvantage (PHB p.102)
        let effectiveSaveTotal = saveTotal;
        let effectiveSaveFailed = saveFailed;
        if (modifiers.metamagic?.heightened) {
          const saveRoll2 = rollD20();
          const saveTotal2 = saveRoll2 + targetSaveMod;
          effectiveSaveTotal = Math.min(saveTotal, saveTotal2);
          effectiveSaveFailed = effectiveSaveTotal < spellSaveDC;
        }

        // Legendary Resistance (MM): a legendary creature can choose to succeed on a
        // failed save, up to legendary_resistance_remaining times per day.
        let usedLegendaryResistance = false;
        if (effectiveSaveFailed && (target.legendary_resistance_remaining || 0) > 0) {
          target.legendary_resistance_remaining -= 1;
          effectiveSaveFailed = false;
          usedLegendaryResistance = true;
        }

        const dmg2 = rollDiceStr(damageDice);
        // On save failure: minimum 1 damage. On success: half damage (can be 0 for weak saves)
        const finalDmg = effectiveSaveFailed ? Math.max(1, dmg2) : Math.max(0, Math.floor(dmg2 / 2));
        if (finalDmg > 0) {
          target.hp_current = Math.max(0, target.hp_current - finalDmg);
          if (target.hp_current === 0) target.is_conscious = false;
        }

        // === STATUS-EFFECT spells (Hold Person/Monster, Banishment, Polymorph, etc.) ===
        // If the spell inflicts a condition and the save failed, apply it to the target.
        let appliedCondition = null;
        const specialEffects = spell.special_effects || [];
        const CONDITION_EFFECT_NAMES = ['paralyzed','banished','polymorphed','charmed','frightened','stunned','restrained','prone','blinded','incapacitated'];
        const conditionToApply = specialEffects.find(e => CONDITION_EFFECT_NAMES.includes(e));
        if (effectiveSaveFailed && conditionToApply && target.hp_current > 0) {
          const existing = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
          if (!existing.includes(conditionToApply)) {
            // Store the save DC + ability so the affected creature can re-save each turn.
            target.conditions = [
              ...(target.conditions || []),
              { name: conditionToApply, source: spell.name, save_dc: spellSaveDC, save_ability: spell.save_type, caster: character.name }
            ];
            appliedCondition = conditionToApply;
          }
        }

        const saveEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
          hit: effectiveSaveFailed, spell_name: spell.name,
          text: `${character.name} casts ${spell.name}! DC${spellSaveDC} ${spell.save_type} save: ${target.name} rolled ${effectiveSaveTotal}${modifiers.metamagic?.heightened ? ' (Heightened: disadvantage)' : ''} — ${usedLegendaryResistance ? `FAILED but uses LEGENDARY RESISTANCE (${target.legendary_resistance_remaining} left)` : (effectiveSaveFailed ? 'FAILED' : 'success')}.${finalDmg > 0 ? ` Takes ${finalDmg} ${spell.damage_type || ''} damage.` : ''}${appliedCondition ? ` ${target.name} is ${appliedCondition.toUpperCase()}!` : ''}${target.hp_current === 0 ? ` ${target.name} falls!` : ''}`
        };

        // Twinned Spell: resolve the same spell against a second creature (PHB p.102).
        let twinTarget = null;
        let twinText = '';
        if (modifiers.metamagic?.twinned && payload.twin_target_id && payload.twin_target_id !== target_id) {
          twinTarget = combatants.find(c => c.id === payload.twin_target_id);
          if (twinTarget && twinTarget.is_conscious) {
            const tStat = twinTarget[spell.save_type] || twinTarget.save_stats?.[spell.save_type] || 10;
            const tMod = statMod(tStat);
            const tr1 = rollD20();
            const tr2 = modifiers.metamagic?.heightened ? rollD20() : tr1;
            const tTotal = Math.min(tr1 + tMod, tr2 + tMod);
            const tFailed = tTotal < spellSaveDC;
            const tDmgRaw = rollDiceStr(damageDice);
            const tDmg = tFailed ? Math.max(1, tDmgRaw) : Math.max(0, Math.floor(tDmgRaw / 2));
            if (tDmg > 0) { twinTarget.hp_current = Math.max(0, twinTarget.hp_current - tDmg); if (twinTarget.hp_current === 0) twinTarget.is_conscious = false; }
            if (tFailed && conditionToApply && twinTarget.hp_current > 0) {
              const tExisting = (twinTarget.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
              if (!tExisting.includes(conditionToApply)) {
                twinTarget.conditions = [...(twinTarget.conditions || []), { name: conditionToApply, source: spell.name, save_dc: spellSaveDC, save_ability: spell.save_type, caster: character.name }];
              }
            }
            twinText = ` Twinned → ${twinTarget.name}: rolled ${tTotal}, ${tFailed ? 'FAILED' : 'success'}.${tDmg > 0 ? ` ${tDmg} damage.` : ''}${tFailed && conditionToApply ? ` ${conditionToApply.toUpperCase()}!` : ''}`;
            saveEntry.text += twinText;
          }
        }

        const updatedC = combatants.map(c => {
          if (c.id === target_id) return target;
          if (twinTarget && c.id === twinTarget.id) return twinTarget;
          return c;
        });
        const allDead = updatedC.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
        const playerDead2 = updatedC.find(c => c.type === 'player')?.is_conscious === false;
        let result2 = 'ongoing';
        if (allDead) result2 = 'victory';
        if (playerDead2) result2 = 'defeat';

        // Quickened Spell: cast as a bonus action — does NOT consume an action.
        const isQuickened = !!modifiers.metamagic?.quickened;
        const apt = getActionsPerTurn(character);
        const acu = isQuickened
          ? (combatLog.world_state?.actions_used_this_turn || 0)
          : (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const ar2 = apt - acu;
        let ni = combatLog.current_turn_index;
        let nr = combatLog.round;
        // Track concentration spell in world_state
        let ws = { ...(combatLog.world_state || {}), actions_used_this_turn: acu };
        if (isQuickened) ws.bonus_action_used = true;
        if (spell.requires_concentration) {
          ws.concentration_spell = spell.name;
          ws.concentration_caster = character.name;
        }
        // Quickened keeps the player's turn (bonus action), unless combat ended.
        if (result2 !== 'ongoing' || (ar2 <= 0 && !isQuickened)) {
          if (result2 === 'ongoing') {
            const adv2 = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedC);
            ni = adv2.nextIndex; nr = adv2.nextRound;
          }
          ws.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, {
          combatants: updatedC, log_entries: [...(combatLog.log_entries || []), saveEntry],
          current_turn_index: ni, round: nr, world_state: ws, is_active: result2 === 'ongoing', result: result2
        });
        if (result2 !== 'ongoing') {
          await base44.entities.GameSession.update(session_id, { in_combat: false });
          if (result2 === 'victory') await awardVictoryXP(combat_id, updatedC, character_id);
        }
        return Response.json({ hit: saveFailed, damage: finalDmg, log_entry: saveEntry, result: result2, combat_ended: result2 !== 'ongoing', actions_remaining: Math.max(0, ar2), next_turn_index: ni });
      }

      // === MAGIC MISSILE (auto-hit, no attack roll needed) ===
      if (spell.attack_type === 'auto_hit') {
        const numMissiles = (spell.num_missiles || 3) + Math.max(0, (spell.slot_level || 1) - 1);
        let totalMissileDmg = 0;
        for (let m = 0; m < numMissiles; m++) {
          totalMissileDmg += rollDice(4) + 1; // 1d4+1 per missile
        }
        totalMissileDmg = Math.max(1, totalMissileDmg);
        target.hp_current = Math.max(0, target.hp_current - totalMissileDmg);
        if (target.hp_current === 0) target.is_conscious = false;
        const updatedCMM = combatants.map(c => c.id === target_id ? target : c);
        const allDeadMM = updatedCMM.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
        const resultMM = allDeadMM ? 'victory' : 'ongoing';
        const mmEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
          hit: true, damage: totalMissileDmg, spell_name: spell.name,
          text: `${character.name} fires ${numMissiles} Magic Missile${numMissiles > 1 ? 's' : ''} at ${target.name} for ${totalMissileDmg} force damage! (auto-hit)${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
        };
        const aptMM = getActionsPerTurn(character);
        const acuMM = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const arMM = aptMM - acuMM;
        let niMM = combatLog.current_turn_index; let nrMM = combatLog.round;
        const wsMM = { ...(combatLog.world_state || {}), actions_used_this_turn: acuMM };
        if (resultMM !== 'ongoing' || arMM <= 0) {
          if (resultMM === 'ongoing') { const a = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCMM); niMM = a.nextIndex; nrMM = a.nextRound; }
          wsMM.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, { combatants: updatedCMM, log_entries: [...(combatLog.log_entries || []), mmEntry], current_turn_index: niMM, round: nrMM, world_state: wsMM, is_active: resultMM === 'ongoing', result: resultMM });
        if (resultMM !== 'ongoing') {
          await base44.entities.GameSession.update(session_id, { in_combat: false });
          if (resultMM === 'victory') await awardVictoryXP(combat_id, updatedCMM, character_id);
        }
        return Response.json({ hit: true, damage: totalMissileDmg, log_entry: mmEntry, result: resultMM, combat_ended: resultMM !== 'ongoing', actions_remaining: Math.max(0, arMM), next_turn_index: niMM });
      }

      // === ELDRITCH BLAST multi-beam (Warlock, scales at levels 5/11/17) ===
      if (spell.name === 'Eldritch Blast') {
        // targetACBonus defined here so it is in scope for the beam loop
        const ebTargetACBonus = (modifiers.half_cover ? 2 : 0) + (modifiers.three_quarters_cover ? 5 : 0);
        const beams = character.level >= 17 ? 4 : character.level >= 11 ? 3 : character.level >= 5 ? 2 : 1;
        let totalBeamDmg = 0; let anyBeamHit = false; let beamCrit = false;
        const beamLogs = [];
        for (let b = 0; b < beams; b++) {
          const br1 = rollD20(); const br2 = rollD20();
          const br = (modifiers.advantage ? Math.max(br1,br2) : modifiers.disadvantage ? Math.min(br1,br2) : br1);
          const bCrit = br === 20; const bMiss = br === 1;
          const bMod = spellAttackBonus;
          const bHit = !bMiss && (bCrit || (br + bMod) >= (target.ac + ebTargetACBonus));
          if (bCrit) beamCrit = true;
          if (bHit) {
            anyBeamHit = true;
            const numD = bCrit ? 2 : 1;
            let d = 0; for (let i = 0; i < numD; i++) d += rollDice(10);
            totalBeamDmg += d;
            beamLogs.push(`Beam ${b+1}: ${bCrit?'CRIT! ':''}${d} force (${br}+${bMod}=${br+bMod} vs AC ${target.ac})`);
          } else {
            beamLogs.push(`Beam ${b+1}: miss (${br}+${bMod}=${br+bMod} vs AC ${target.ac})`);
          }
        }
        if (totalBeamDmg > 0) {
          target.hp_current = Math.max(0, target.hp_current - totalBeamDmg);
          if (target.hp_current === 0) target.is_conscious = false;
        }
        const updatedCEB = combatants.map(c => c.id === target_id ? target : c);
        const allDeadEB = updatedCEB.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
        const resultEB = allDeadEB ? 'victory' : 'ongoing';
        const ebEntry = {
          round: combatLog.round, actor: character.name, action: 'spell', target: target.name,
          hit: anyBeamHit, critical: beamCrit, damage: totalBeamDmg, spell_name: 'Eldritch Blast',
          text: `${character.name} fires ${beams} Eldritch Blast beam${beams>1?'s':''} at ${target.name}! ${beamLogs.join(' | ')} — Total: ${totalBeamDmg} force damage.${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
        };
        const aptEB = getActionsPerTurn(character);
        const acuEB = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
        const arEB = aptEB - acuEB;
        let niEB = combatLog.current_turn_index; let nrEB = combatLog.round;
        const wsEB = { ...(combatLog.world_state || {}), actions_used_this_turn: acuEB };
        if (resultEB !== 'ongoing' || arEB <= 0) {
          if (resultEB === 'ongoing') { const a = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCEB); niEB = a.nextIndex; nrEB = a.nextRound; }
          wsEB.actions_used_this_turn = 0;
        }
        await base44.entities.CombatLog.update(combat_id, { combatants: updatedCEB, log_entries: [...(combatLog.log_entries || []), ebEntry], current_turn_index: niEB, round: nrEB, world_state: wsEB, is_active: resultEB === 'ongoing', result: resultEB });
        if (resultEB !== 'ongoing') {
          await base44.entities.GameSession.update(session_id, { in_combat: false });
          if (resultEB === 'victory') await awardVictoryXP(combat_id, updatedCEB, character_id);
        }
        return Response.json({ hit: anyBeamHit, damage: totalBeamDmg, log_entry: ebEntry, result: resultEB, combat_ended: resultEB !== 'ongoing', actions_remaining: Math.max(0, arEB), next_turn_index: niEB });
      }

      // Fall through: ranged/melee spell attacks use spellAttackBonus already set above.
      // damageBonus stays 0 for spell attacks (no ability mod added to spell damage by default).
    } else if (weapon) {
      const isRanged = weapon.type === 'ranged';
      // Ammunition (PHB p.146): ranged weapons with the Ammunition property must
      // consume a matching ammo item from inventory. Block the attack if none left.
      const weaponProps = (weapon.properties || []).map(p => p.toLowerCase());
      const usesAmmo = weaponProps.includes('ammunition');
      if (isRanged && usesAmmo) {
        const AMMO_FOR = {
          'longbow': 'arrow', 'shortbow': 'arrow',
          'light crossbow': 'bolt', 'heavy crossbow': 'bolt', 'hand crossbow': 'bolt',
          'sling': 'bullet',
        };
        const ammoKeyword = AMMO_FOR[(weapon.name || '').toLowerCase()] || 'arrow';
        const inv = character.inventory || [];
        const ammoIdx = inv.findIndex(it =>
          (it.name || '').toLowerCase().includes(ammoKeyword) && (it.quantity ?? 1) > 0
        );
        if (ammoIdx === -1) {
          return Response.json({ error: `Out of ammunition (${ammoKeyword}s). Restock before firing.`, invalid: true }, { status: 400 });
        }
        // Decrement one unit of ammunition
        const newInv = inv.map((it, i) => i === ammoIdx ? { ...it, quantity: Math.max(0, (it.quantity ?? 1) - 1) } : it);
        await base44.entities.Character.update(character_id, { inventory: newInv });
      }
      // Loading (PHB p.147): a weapon with the Loading property fires only ONCE per
      // turn, regardless of Extra Attack, bonus actions, or other action sources.
      const hasLoading = weaponProps.includes('loading');
      if (isRanged && hasLoading && combatLog.world_state?.loading_weapon_fired) {
        return Response.json({ error: `${weapon.name} has the Loading property — it can only be fired once per turn.`, invalid: true }, { status: 400 });
      }
      const isFinesse = (weapon.properties || []).includes('finesse');
      const strMod = statMod(character.strength);
      const dexMod = statMod(character.dexterity);
      // Ranged weapons use DEX; finesse uses best of STR/DEX; melee uses STR
      const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
      const profBonus = character.proficiency_bonus || 2;
      attackMod = abilityMod + profBonus + (weapon.attack_bonus || 0);
      damageBonus = abilityMod + (weapon.damage_bonus || 0);
      damageDice = weapon.damage_dice || '1d8';
      attackType = isRanged ? 'ranged' : 'melee';

      // Apply Fighting Style bonuses
      const fightingStyle = character.fighting_style?.toLowerCase();
      if (fightingStyle === 'archery' && isRanged) attackMod += 2;
      // Dueling: +2 damage when wielding a single one-handed weapon and no other weapon in offhand
      // Shield occupies 'offhand' slot (not 'shield'), so check both keys
      const hasOffhandItem = !!(character.equipped?.offhand || character.equipped?.shield);
      if (fightingStyle === 'dueling' && !isRanged && !hasOffhandItem) damageBonus += 2;

      // === FEAT EFFECTS on weapon attacks ===
      const featFlags = character._feat_flags || [];
      const hasFeat = (name) => (character.feats || []).includes(name) || featFlags.includes(name.toLowerCase().replace(/\s+/g,'_'));

      // Small creature + Heavy weapon = disadvantage (PHB p.147)
      // Small races: Halfling, Gnome, Goblin, Kobold (Small size)
      const SMALL_RACES = ['Halfling', 'Gnome', 'Goblin', 'Kobold'];
      const isSmallRace = SMALL_RACES.includes(character.race);
      const weapon2H = (weapon.properties || []).map(p => p.toLowerCase());
      const isHeavyWeapon = weapon2H.includes('heavy');
      if (isSmallRace && isHeavyWeapon && !modifiers.disadvantage) {
        modifiers.disadvantage = true;
        attackRoll2 = rollD20();
        attackRoll = Math.min(attackRoll1, attackRoll2);
        isCritical = attackRoll === 20;
        isMiss = attackRoll === 1;
      }

      // Great Weapon Master: -5/+10 on heavy two-handed weapons (PHB p.167)
      const isHeavyTwoHanded = weapon2H.includes('heavy') && weapon2H.includes('two-handed');
      if (modifiers.great_weapon_master && hasFeat('Great Weapon Master') && isHeavyTwoHanded && !isRanged) {
        attackMod -= 5;
        damageBonus += 10;
      }

      // Sharpshooter: -5/+10 on ranged proficient attacks (PHB p.170)
      if (modifiers.sharpshooter && hasFeat('Sharpshooter') && isRanged) {
        attackMod -= 5;
        damageBonus += 10;
      }

      // Barbarian Rage
      if (modifiers.rage && !isRanged) {
        const level = character.level || 1;
        const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
        damageBonus += rageDamage;
      }
      // Reckless Attack (PHB p.48): advantage on melee STR attacks this turn
      if (modifiers.reckless_attack && character.class === 'Barbarian' && !isRanged && !modifiers.disadvantage) {
        modifiers.advantage = true; attackRoll2 = rollD20(); attackRoll = Math.max(attackRoll1, attackRoll2); isCritical = attackRoll === 20; isMiss = attackRoll === 1;
      }

      // Rogue Sneak Attack (PHB p.96) — server-authoritative validation:
      //  • once per TURN (tracked in world_state.sneak_attack_used)
      //  • requires a finesse or ranged weapon
      //  • requires advantage on the attack OR an ally adjacent to the target (modifiers.ally_adjacent)
      //    (advantage is negated if the attacker has disadvantage — handled by the cancel rule)
      if (modifiers.sneak_attack_ready && character.class === 'Rogue') {
        const alreadyUsed = combatLog.world_state?.sneak_attack_used;
        const weaponProps = (weapon?.properties || []).map(p => p.toLowerCase());
        const isFinesseOrRanged = weaponProps.includes('finesse') || weapon?.type === 'ranged';
        const hasSneakCondition = (modifiers.advantage && !modifiers.disadvantage) || modifiers.ally_adjacent;
        if (!alreadyUsed && isFinesseOrRanged && hasSneakCondition) {
          const sneakDice = Math.ceil((character.level || 1) / 2);
          extraDamageDice.push({ dice: `${sneakDice}d6`, type: 'sneak', label: 'Sneak Attack' });
          sneakAttackApplied = true;
        }
      }

      // Lucky feat (PHB p.167): spend a luck point to reroll one attack/check/save d20 and take either result.
      // Here: if modifiers.use_lucky_point is set and character has points remaining, reroll the attack die.
      if (modifiers.use_lucky_point && hasFeat('Lucky') && (character.luck_points_remaining || 0) > 0) {
        const luckyRoll = rollD20();
        // Player may choose either roll — for automation, take the higher one (favorable to player)
        const chosenRoll = Math.max(attackRoll, luckyRoll);
        if (chosenRoll !== attackRoll) attackRoll = chosenRoll;
        isCritical = attackRoll === 20;
        isMiss = attackRoll === 1;
        await base44.entities.Character.update(character_id, {
          luck_points_remaining: Math.max(0, (character.luck_points_remaining || 0) - 1),
        });
      }

      // Fighter Action Surge — handled by action tracking in world_state; no extra variable needed here
    }

    // Apply active modifiers
    const activeMods = character.active_modifiers || [];
    for (const mod of activeMods) {
      if (mod.applies_to === 'attack' || mod.applies_to === 'all') {
        attackMod += mod.value;
      }
      if (mod.applies_to === 'damage') {
        damageBonus += mod.value;
      }
    }

    // Condition checks — apply RAW condition mechanics (PHB p.290-292)
    const conditions = (character.conditions || []).map(c => c.name || c);

    // EXHAUSTION level 3+ : disadvantage on attack rolls (PHB p.291)
    if ((character.exhaustion_level || 0) >= 3 && !modifiers.disadvantage) {
      modifiers.disadvantage = true;
      attackRoll2 = rollD20();
      attackRoll = Math.min(attackRoll1, attackRoll2);
      isCritical = attackRoll === 20;
      isMiss = attackRoll === 1;
    }

    // POISONED: disadvantage on attack rolls (PHB p.292) — NOT a flat penalty
    if (conditions.includes('poisoned') && !modifiers.disadvantage) {
      modifiers.disadvantage = true;
      // Re-roll for disadvantage if we didn't already have it
      attackRoll2 = rollD20();
      attackRoll = Math.min(attackRoll1, attackRoll2);
      isCritical = attackRoll === 20;
      isMiss = attackRoll === 1;
    }

    // BLINDED: disadvantage on attack rolls (PHB p.290)
    if (conditions.includes('blinded') && !modifiers.disadvantage) {
      modifiers.disadvantage = true;
      attackRoll2 = rollD20();
      attackRoll = Math.min(attackRoll1, attackRoll2);
      isCritical = attackRoll === 20;
      isMiss = attackRoll === 1;
    }

    // FRIGHTENED: disadvantage on attack rolls while source visible (PHB p.290)
    if (conditions.includes('frightened') && !modifiers.disadvantage) {
      modifiers.disadvantage = true;
      attackRoll2 = rollD20();
      attackRoll = Math.min(attackRoll1, attackRoll2);
      isCritical = attackRoll === 20;
      isMiss = attackRoll === 1;
    }

    // Target modifiers (cover, etc)
    let targetACBonus = 0;
    if (modifiers.half_cover) targetACBonus += 2;
    if (modifiers.three_quarters_cover) targetACBonus += 5;

    // === TARGET CONDITION MODIFIERS (PHB p.290-292) ===
    const targetConditions = (target.conditions || []).map(c => c.name || c);

    // PARALYZED: attacks have advantage; hits from within 5ft are auto-crits (PHB p.291)
    if (targetConditions.includes('paralyzed')) {
      modifiers.advantage = true;
      if (attackType === 'melee') isCritical = true; // within 5ft assumed for melee
    }

    // STUNNED: attacks have advantage (PHB p.292)
    if (targetConditions.includes('stunned')) {
      modifiers.advantage = true;
    }

    // UNCONSCIOUS: attacks have advantage; hits from within 5ft are auto-crits (PHB p.292)
    if (targetConditions.includes('unconscious')) {
      modifiers.advantage = true;
      if (attackType === 'melee') isCritical = true;
    }

    // PRONE: melee = advantage, ranged = disadvantage (PHB p.292)
    if (targetConditions.includes('prone')) {
      if (attackType === 'melee') {
        if (!modifiers.disadvantage) modifiers.advantage = true;
      } else {
        modifiers.advantage = false;
        modifiers.disadvantage = true;
      }
    }

    // RESTRAINED: attacks against have advantage (PHB p.292)
    if (targetConditions.includes('restrained') && !modifiers.disadvantage) {
      modifiers.advantage = true;
    }

    // INVISIBLE: attacks against have disadvantage (PHB p.291)
    if (targetConditions.includes('invisible')) {
      modifiers.advantage = false;
      modifiers.disadvantage = true;
    }

    // BLINDED (target): attacks against have advantage (PHB p.290)
    if (targetConditions.includes('blinded') && !modifiers.disadvantage) {
      modifiers.advantage = true;
    }

    // Re-resolve the attack roll if advantage/disadvantage changed after initial roll
    if (modifiers.advantage && !modifiers.disadvantage) {
      attackRoll2 = modifiers.advantage && attackRoll2 === attackRoll1 ? rollD20() : attackRoll2;
      attackRoll = Math.max(attackRoll1, attackRoll2);
    } else if (modifiers.disadvantage && !modifiers.advantage) {
      attackRoll2 = modifiers.disadvantage && attackRoll2 === attackRoll1 ? rollD20() : attackRoll2;
      attackRoll = Math.min(attackRoll1, attackRoll2);
    }
    // Advantage + disadvantage cancel each other (PHB p.173)
    isCritical = !isMiss && (attackRoll === 20 || (targetConditions.includes('paralyzed') && attackType === 'melee') || (targetConditions.includes('unconscious') && attackType === 'melee'));
    isMiss = attackRoll === 1;

    const totalAttack = attackRoll + attackMod;
    let hit = !isMiss && (isCritical || totalAttack >= (target.ac + targetACBonus));

    let damage = 0;
    let damageRolls = [];
    const isSpellAttack = !!spell;
    const logEntry = { round: combatLog.round, actor: character.name, action: isSpellAttack ? 'spell' : 'attack', target: target.name, spell_name: spell?.name || null };

    if (hit) {
      const dMatch = damageDice.match(/^(\d+)d(\d+)$/);
      let numDice = isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
      const sides = parseInt(dMatch[2]);

      // Brutal Critical (Barbarian 9+) - add extra crit dice
      if (isCritical && character.class === 'Barbarian') {
        const level = character.level || 1;
        if (level >= 9) numDice += 1;
        if (level >= 13) numDice += 1;
        if (level >= 17) numDice += 1;
      }

      for (let i = 0; i < numDice; i++) {
        const r = rollDice(sides);
        damageRolls.push(r);
        damage += r;
      }
      damage += damageBonus;

      // Extra damage dice (Sneak Attack, Divine Smite, etc)
      for (const extra of extraDamageDice) {
        const eMatch = extra.dice.match(/^(\d+)d(\d+)$/);
        if (eMatch) {
          const eNum = isCritical ? parseInt(eMatch[1]) * 2 : parseInt(eMatch[1]);
          const eSides = parseInt(eMatch[2]);
          let eDmg = 0;
          for (let i = 0; i < eNum; i++) eDmg += rollDice(eSides);
          damage += eDmg;
        }
      }

      // Paladin Divine Smite (if toggled and spell slots available)
      if (modifiers.divine_smite_ready && character.class === 'Paladin' && attackType === 'melee') {
        // Find LOWEST available spell slot (Paladin should choose lowest to conserve resources)
        // spell_slots tracks USED counts. A slot at level i is available if used < max_slots[i].
        // Paladin half-caster table: level 1-2=0, level 3-4=2/3 slots per level, etc.
        // We compare used vs a safe max of 4 (which covers all Paladin slot maxes at any level).
        // Paladin half-caster max slots per level by character level
        const PALADIN_MAX_SLOTS = {
          2:[2,0,0,0,0], 3:[3,0,0,0,0], 4:[3,0,0,0,0],
          5:[4,2,0,0,0], 6:[4,2,0,0,0], 7:[4,3,0,0,0], 8:[4,3,0,0,0],
          9:[4,3,2,0,0], 10:[4,3,2,0,0], 11:[4,3,3,0,0], 12:[4,3,3,0,0],
          13:[4,3,3,1,0], 14:[4,3,3,1,0], 15:[4,3,3,2,0], 16:[4,3,3,2,0],
          17:[4,3,3,3,1], 18:[4,3,3,3,1], 19:[4,3,3,3,2], 20:[4,3,3,3,2],
        };
        const paladinMaxSlots = PALADIN_MAX_SLOTS[Math.min(20, character.level || 1)] || [0,0,0,0,0];
        const slots = character.spell_slots || {};
        let smiteLevel = 0;
        for (let i = 1; i <= 5; i++) {
          const key = `level_${i}`;
          const used = slots[key] || 0;
          const maxAtLevel = paladinMaxSlots[i - 1] || 0;
          if (maxAtLevel > 0 && used < maxAtLevel) {
            smiteLevel = i;
            break;
          }
        }
        if (smiteLevel > 0) {
          // Divine Smite: 2d8 + 1d8 per slot level above 1st, max 5d8 total (cap at slot level 4)
          // +1d8 bonus vs undead or fiends (PHB p.85)
          const effectiveLevel = Math.min(smiteLevel, 4);
          let smiteDice = 1 + effectiveLevel; // 2d8 at level 1, up to 5d8 at level 4+
          const targetType = (target.type_tag || target.meta || target.creature_type || '').toLowerCase();
          const isUndeadOrFiend = /undead|fiend|devil|demon|yugoloth/.test(targetType);
          if (isUndeadOrFiend) smiteDice += 1; // +1d8 vs undead/fiends (PHB p.85)
          smiteDice = Math.min(smiteDice, 6); // hard cap: absolute max is 6d8 (5d8 normal + 1d8 bonus)
          let smiteDmg = 0;
          for (let i = 0; i < smiteDice; i++) smiteDmg += rollDice(8);
          damage += smiteDmg;
          // Consume spell slot (increment used count)
          const slotKey = `level_${smiteLevel}`;
          await base44.entities.Character.update(character_id, {
            spell_slots: { ...slots, [slotKey]: (slots[slotKey] || 0) + 1 }
          });
        }
      }

      // Improved Divine Smite (Paladin 11+) - automatic +1d8 radiant on all melee
      if (character.class === 'Paladin' && (character.level || 1) >= 11 && attackType === 'melee') {
        damage += rollDice(8);
      }

      // PHB rule: a hit always deals at least 1 damage
      damage = Math.max(1, damage);

      // Apply target's Resistance/Vulnerability/Immunity (PHB p.197).
      // Damage type: spell uses spell.damage_type; weapon uses its damage_type (default slashing).
      const dmgType = (spell?.damage_type || weapon?.damage_type || 'slashing').toLowerCase();
      const tgtMod = applyDamageModifiers(damage, dmgType, {
        resistances: target.resistances,
        vulnerabilities: target.vulnerabilities,
        immunities: target.immunities,
      });
      if (tgtMod.applied) {
        logEntry.damage_modifier = tgtMod.applied;
        damage = tgtMod.applied === 'immunity' ? 0 : tgtMod.amount;
      }

      // Concentration check: if caster is concentrating and takes damage, DC = max(10, half damage) CON save
      // (Enemy triggering concentration check is handled in enemy_turn)

      target.hp_current = Math.max(0, target.hp_current - damage);
      if (target.hp_current === 0) target.is_conscious = false;

      logEntry.hit = true;
      logEntry.critical = isCritical;
      logEntry.attack_roll = totalAttack;
      logEntry.damage = damage;
      logEntry.damage_rolls = damageRolls;
      const actionLabel = spell ? `casts ${spell.name} at` : (isCritical ? 'CRITICALLY strikes' : 'hits');
      logEntry.text = `${character.name} ${actionLabel} ${target.name} for ${damage} ${spell?.damage_type || ''} damage! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`;
    } else {
      logEntry.hit = false;
      logEntry.attack_roll = totalAttack;
      const missLabel = spell ? `${spell.name} misses` : 'misses';
      logEntry.text = `${character.name} ${missLabel} ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`;
    }

    const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
    const updatedLog = [...(combatLog.log_entries || []), logEntry];

    // Check combat end
    const allEnemiesDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
    let result = 'ongoing';
    if (allEnemiesDead) result = 'victory';
    if (playerDead) result = 'defeat';

    // Track actions used this turn in the combat log's world_state.
    // Quickened Spell (Sorcerer): spell costs a bonus action, not an action.
    const isQuickenedMain = !!modifiers.metamagic?.quickened && !!spell;
    const actionsPerTurn = getActionsPerTurn(character);
    const currentActionsUsed = isQuickenedMain
      ? (combatLog.world_state?.actions_used_this_turn || 0)
      : (combatLog.world_state?.actions_used_this_turn || 0) + 1;
    const actionsRemaining = actionsPerTurn - currentActionsUsed;

    // Advance turn only if all actions for this turn are exhausted
    let nextIndex = combatLog.current_turn_index;
    let nextRound = combatLog.round;
    let newWorldState = { ...(combatLog.world_state || {}), actions_used_this_turn: currentActionsUsed };
    if (isQuickenedMain) newWorldState.bonus_action_used = true;
    // Mark Sneak Attack consumed for this turn so it can't trigger again until next turn
    if (sneakAttackApplied) newWorldState.sneak_attack_used = true;
    // Mark a Loading weapon as fired so it can't fire again this turn (PHB p.147)
    if (weapon && (weapon.properties || []).map(p => p.toLowerCase()).includes('loading') && weapon.type === 'ranged') {
      newWorldState.loading_weapon_fired = true;
    }

    // Track concentration spells
    if (spell?.requires_concentration) {
      newWorldState.concentration_spell = spell.name;
      newWorldState.concentration_caster = character.name;
    }

    if (result !== 'ongoing' || (actionsRemaining <= 0 && !isQuickenedMain)) {
      if (result === 'ongoing') {
        const adv = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);
        nextIndex = adv.nextIndex; nextRound = adv.nextRound;
      }
      newWorldState.actions_used_this_turn = 0;
      newWorldState.bonus_action_used = false;
      newWorldState.sneak_attack_used = false; // player turn ended — refresh for next turn
      newWorldState.loading_weapon_fired = false; // refresh Loading weapon for next turn
    }

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: updatedLog,
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: newWorldState,
      is_active: result === 'ongoing',
      result
    });

    if (result !== 'ongoing') {
      await base44.entities.GameSession.update(session_id, { in_combat: false });
      if (result === 'victory') await awardVictoryXP(combat_id, updatedCombatants, character_id);
    }

    return Response.json({
      hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
      target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
      next_turn_index: nextIndex,
      actions_remaining: actionsRemaining > 0 ? actionsRemaining : 0,
      actions_per_turn: actionsPerTurn
    });
  }

  // ─── OFF-HAND ATTACK (Two-Weapon Fighting, PHB p.195) ───────────────────────
  // Bonus action attack with a light weapon in the off-hand. No ability modifier
  // added to damage unless the character has the Two-Weapon Fighting fighting style.
  if (action === 'offhand_attack') {
    const { target_id, modifiers = {} } = payload;
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    // Off-hand weapon comes from the offhand slot; must be a light melee weapon
    const offhand = character.equipped?.offhand;
    const mainhand = character.equipped?.weapon || character.equipped?.mainhand;
    const isLight = (w) => (w?.properties || []).map(p => p.toLowerCase()).includes('light')
      || ['dagger','shortsword','scimitar','handaxe','light hammer','club','sickle'].includes((w?.name || '').toLowerCase());

    if (!offhand || !isLight(offhand) || !isLight(mainhand)) {
      return Response.json({ error: 'Two-weapon fighting requires a light melee weapon in each hand.', invalid: true }, { status: 400 });
    }

    // Bonus action gating
    if (combatLog.world_state?.bonus_action_used) {
      return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
    }

    const strMod = statMod(character.strength);
    const dexMod = statMod(character.dexterity);
    const isFinesse = (offhand.properties || []).map(p => p.toLowerCase()).includes('finesse');
    const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
    const profBonus = character.proficiency_bonus || 2;

    let attackRoll1 = rollD20();
    let attackRoll2 = (modifiers.advantage || modifiers.disadvantage) ? rollD20() : attackRoll1;
    let attackRoll = modifiers.advantage ? Math.max(attackRoll1, attackRoll2)
      : modifiers.disadvantage ? Math.min(attackRoll1, attackRoll2) : attackRoll1;

    // Exhaustion 3+ : disadvantage on attacks
    if ((character.exhaustion_level || 0) >= 3 && !modifiers.disadvantage) {
      attackRoll2 = rollD20();
      attackRoll = Math.min(attackRoll1, attackRoll2);
    }

    const isCritical = attackRoll === 20;
    const isMiss = attackRoll === 1;
    const attackMod = abilityMod + profBonus + (offhand.attack_bonus || 0);
    const totalAttack = attackRoll + attackMod;
    const hit = !isMiss && (isCritical || totalAttack >= target.ac);

    // Two-Weapon Fighting style: add ability modifier to off-hand damage
    const hasTWFStyle = (character.fighting_style || '').toLowerCase().includes('two-weapon');
    let damage = 0;
    const damageRolls = [];
    if (hit) {
      const dMatch = (offhand.damage_dice || offhand.damage || '1d4').match(/^(\d+)d(\d+)$/);
      const numDice = dMatch ? (isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1])) : (isCritical ? 2 : 1);
      const sides = dMatch ? parseInt(dMatch[2]) : 4;
      for (let i = 0; i < numDice; i++) { const r = rollDice(sides); damageRolls.push(r); damage += r; }
      // Off-hand: NO ability mod to damage unless TWF style (PHB p.195). Negative mod always applies.
      if (hasTWFStyle) damage += abilityMod;
      else if (abilityMod < 0) damage += abilityMod;
      damage += (offhand.damage_bonus || 0);
      damage = Math.max(1, damage);
      target.hp_current = Math.max(0, target.hp_current - damage);
      if (target.hp_current === 0) target.is_conscious = false;
    }

    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'offhand_attack', target: target.name,
      hit, critical: isCritical, attack_roll: totalAttack, damage,
      text: hit
        ? `${character.name} strikes with their off-hand ${offhand.name}${isCritical ? ' (CRIT!)' : ''} for ${damage} damage!${hasTWFStyle ? '' : ' (no ability mod — off-hand)'} (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
        : `${character.name}'s off-hand ${offhand.name} misses ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`
    };

    const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
    const allEnemiesDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
    const result = allEnemiesDead ? 'victory' : 'ongoing';

    // Off-hand uses the BONUS ACTION, not an action — do not consume an action or advance the turn
    const newWorldState = { ...(combatLog.world_state || {}), bonus_action_used: true };

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: newWorldState,
      is_active: result === 'ongoing',
      result
    });

    if (result !== 'ongoing') {
      await base44.entities.GameSession.update(session_id, { in_combat: false });
      if (result === 'victory') await awardVictoryXP(combat_id, updatedCombatants, character_id);
    }

    return Response.json({
      hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
      target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
      bonus_action_used: true, two_weapon_style: hasTWFStyle
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: enemy_turn — resolves the active enemy's turn: end-of-turn saves,
  // attacking a downed player (death-save failures), DATA-DRIVEN AI tactic selection
  // (see AI_ARCHETYPES in SHARED HELPERS), multiattack resolution, damage mitigation,
  // and concentration checks.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'enemy_turn') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];

    // Find current enemy turn
    const currentCombatant = combatants[combatLog.current_turn_index];
    if (!currentCombatant || currentCombatant.type !== 'enemy' || !currentCombatant.is_conscious) {
      return Response.json({ skipped: true });
    }

    // Legendary creature: refresh its 3 legendary actions at the start of its turn (MM).
    if (currentCombatant.is_legendary) {
      await base44.entities.CombatLog.update(combat_id, {
        world_state: { ...(combatLog.world_state || {}), legendary_actions_remaining: 3 }
      });
      combatLog.world_state = { ...(combatLog.world_state || {}), legendary_actions_remaining: 3 };
    }

    // === AUTO-SAVE: shake off saveable conditions at the start of the turn ===
    // Hold Person/Monster, Banishment, etc. grant a save at the end of each turn;
    // we resolve it here at the start of the affected creature's turn for simplicity.
    let conditionCleared = null;
    let stillIncapacitated = false;
    if ((currentCombatant.conditions || []).length > 0) {
      const remaining = [];
      for (const cond of currentCombatant.conditions) {
        const cName = (typeof cond === 'string' ? cond : cond?.name || '').toLowerCase();
        const saveAbility = SAVEABLE_CONDITIONS[cName];
        if (saveAbility && typeof cond === 'object' && cond.save_dc) {
          const saveStat = currentCombatant[saveAbility] || currentCombatant.save_stats?.[saveAbility] || 10;
          const roll = rollD20() + statMod(saveStat);
          if (roll >= cond.save_dc) {
            conditionCleared = cName; // saved — drop the condition
            continue;
          }
        }
        remaining.push(cond);
      }
      currentCombatant.conditions = remaining;
      stillIncapacitated = hasNoActions(remaining);
    }

    // If still incapacitated (paralyzed/stunned/banished, etc.), the enemy loses its turn.
    if (stillIncapacitated) {
      const updatedSkip = combatants.map(c => c.id === currentCombatant.id ? currentCombatant : c);
      const { nextIndex: niSk, nextRound: nrSk } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedSkip);
      const skipText = conditionCleared
        ? `${currentCombatant.name} shakes off ${conditionCleared}, but is still incapacitated and loses its turn!`
        : `${currentCombatant.name} is incapacitated and can take no actions!`;
      await base44.entities.CombatLog.update(combat_id, {
        combatants: updatedSkip,
        log_entries: [...(combatLog.log_entries || []), { round: combatLog.round, actor: currentCombatant.name, action: 'incapacitated', text: skipText }],
        current_turn_index: niSk, round: nrSk,
        world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0 },
      });
      return Response.json({ skipped_incapacitated: true, log_entry: { text: skipText }, next_turn_index: niSk, round: nrSk });
    }

    // Enemy attacks player
    const player = combatants.find(c => c.type === 'player');
    if (!player) {
      return Response.json({ no_target: true });
    }

    // Player is at 0 HP (downed): an attack that hits causes a death save failure (PHB p.197).
    // A melee hit from within 5 ft is an automatic critical → 2 failures.
    if (!player.is_conscious || player.hp_current === 0) {
      const downedChar = await base44.entities.Character.get(player.id);
      const atkRoll = rollD20();
      const atkBonus = currentCombatant.attack_bonus || 3;
      const isCrit = atkRoll === 20;
      const hitDowned = !(atkRoll === 1) && (isCrit || (atkRoll + atkBonus) >= player.ac);

      let downedLog = `${currentCombatant.name} strikes at the fallen ${player.name}`;
      const ws0 = { ...(combatLog.world_state || {}), actions_used_this_turn: 0 };

      if (hitDowned) {
        // Melee hit at 0 HP = auto-crit = 2 failures; ranged/normal hit = 1 failure
        const isMeleeEnemy = (currentCombatant.attack_type || 'melee') !== 'ranged';
        const failuresToAdd = (isCrit || isMeleeEnemy) ? 2 : 1;
        const newFailures = Math.min(3, (downedChar.death_saves_failure || 0) + failuresToAdd);
        await base44.entities.Character.update(player.id, { death_saves_failure: newFailures });
        downedLog += ` — a brutal blow lands! +${failuresToAdd} death save failure${failuresToAdd > 1 ? 's' : ''} (${newFailures}/3).`;
        if (newFailures >= 3) downedLog += ` ${player.name} has died.`;
      } else {
        downedLog += ` but misses (${atkRoll}+${atkBonus} vs AC ${player.ac}).`;
      }

      const { nextIndex: ni0, nextRound: nr0 } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
      await base44.entities.CombatLog.update(combat_id, {
        log_entries: [...(combatLog.log_entries || []), { round: combatLog.round, actor: currentCombatant.name, action: 'attack_downed', target: player.name, hit: hitDowned, text: downedLog }],
        current_turn_index: ni0,
        round: nr0,
        world_state: ws0,
      });
      return Response.json({ no_target: false, player_unconscious: true, attacked_downed: true, hit: hitDowned, log_entry: { text: downedLog, hit: hitDowned }, next_turn_index: ni0, round: nr0 });
    }

    // === DATA-DRIVEN AI: pick a tactic from the enemy's archetype preset ===
    const enemyHpPct = currentCombatant.hp_max ? currentCombatant.hp_current / currentCombatant.hp_max : 1;
    const playerHpPct = player.hp_max ? player.hp_current / player.hp_max : 1;
    // Older combats may predate the `archetype` field — infer on the fly as a fallback.
    const archetypeKey = currentCombatant.archetype || inferArchetype(currentCombatant);
    const tactic = chooseTactic(archetypeKey, {
      selfHpPct: enemyHpPct,
      playerHpPct,
      round: combatLog.round,
    });
    const strategy = `${archetypeKey}:${tactic.id}`;
    const strategyDesc = tactic.desc;

    let attackBonus = (currentCombatant.attack_bonus || 3) + tactic.attackBonus;
    let targetAC = player.ac;
    let numAttacks = tactic.numAttacks;
    let bonusDamage = tactic.bonusDamage;

    // Dodge action (PHB p.192): attacks against a dodging player roll with disadvantage.
    const playerDodging = !!combatLog.world_state?.player_dodging;

    let totalDamage = 0;
    let anyHit = false;
    let isCritical = false;
    const attackLogs = [];

    for (let atk = 0; atk < numAttacks; atk++) {
      const roll1 = rollD20();
      const attackRoll = playerDodging ? Math.min(roll1, rollD20()) : roll1;
      const totalAttack = attackRoll + attackBonus;
      const isCrit = attackRoll === 20;
      const isFumble = attackRoll === 1;
      const hit = !isFumble && (isCrit || totalAttack >= targetAC);

      if (isCrit) isCritical = true;

      if (hit) {
        anyHit = true;
        const dMatch = (currentCombatant.damage_dice || '1d6').match(/^(\d+)d(\d+)$/);
        if (dMatch) {
          const numDice = isCrit ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
          const sides = parseInt(dMatch[2]);
          let dmg = 0;
          for (let i = 0; i < numDice; i++) dmg += rollDice(sides);
          dmg += (currentCombatant.damage_bonus || 0) + bonusDamage;
          dmg = Math.max(1, dmg);
          totalDamage += dmg;
          attackLogs.push(`${isCrit ? '💥 CRITICAL! ' : ''}${currentCombatant.name} hits for ${dmg} dmg (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
        }
      } else {
        attackLogs.push(`${currentCombatant.name} misses (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
      }
    }

    // === DAMAGE MITIGATION (applied in priority order) ===
    const playerConditions = (player.conditions || []).map(c => c.name || c);
    const isRaging = playerConditions.includes('raging');
    const enemyDamageType = (currentCombatant.damage_type || 'bludgeoning').toLowerCase();
    const physicalTypes = ['bludgeoning', 'piercing', 'slashing'];
    const charFull = await base44.entities.Character.get(player.id);
    const charFeats = charFull?.feats || [];
    const charFeatFlags = charFull?._feat_flags || [];
    const playerHasFeat = (name) => charFeats.includes(name) || charFeatFlags.includes(name.toLowerCase().replace(/\s+/g,'_'));

    let finalDamage = totalDamage;

    // Heavy Armor Master: -3 nonmagical B/P/S damage (PHB p.167)
    // Only applies in heavy armor; enemies at CR<5 treated as nonmagical
    const wearingHeavyArmor = (charFull?.equipped?.armor?.armor_type || '').toLowerCase() === 'heavy';
    const attackIsNonmagical = (currentCombatant.cr || 1) < 5; // heuristic: low-CR enemies lack magical weapons
    if (playerHasFeat('Heavy Armor Master') && wearingHeavyArmor && physicalTypes.includes(enemyDamageType) && attackIsNonmagical) {
      const reduced = Math.max(0, finalDamage - 3);
      if (reduced < finalDamage) {
        attackLogs.push(`[Heavy Armor Master: ${finalDamage} → ${reduced} ${enemyDamageType}]`);
        finalDamage = reduced;
      }
    }

    // Barbarian Rage Resistance (PHB p.48): halve B/P/S while raging
    const isBarbarianRaging = isRaging && (charFull?.class === 'Barbarian' || charFull?.class === 'barbarian');
    let alreadyResisted = false;
    if (isBarbarianRaging && physicalTypes.includes(enemyDamageType)) {
      const halved = Math.floor(finalDamage / 2);
      attackLogs.push(`[Rage Resistance: ${finalDamage} → ${halved} ${enemyDamageType}]`);
      finalDamage = halved;
      alreadyResisted = true;
    }

    // General Resistance/Vulnerability/Immunity from character fields (PHB p.197).
    // Resistance doesn't stack (a damage type can only be halved once), so skip
    // resistance if Rage already halved this same physical damage.
    const dmgMod = applyDamageModifiers(finalDamage, enemyDamageType, {
      resistances: charFull?.resistances,
      vulnerabilities: charFull?.vulnerabilities,
      immunities: charFull?.immunities,
    });
    if (dmgMod.applied === 'immunity') {
      attackLogs.push(`[Immune to ${enemyDamageType}: ${finalDamage} → 0]`);
      finalDamage = 0;
    } else if (dmgMod.applied === 'resistance' && !alreadyResisted) {
      attackLogs.push(`[Resist ${enemyDamageType}: ${finalDamage} → ${dmgMod.amount}]`);
      finalDamage = dmgMod.amount;
    } else if (dmgMod.applied === 'vulnerability') {
      attackLogs.push(`[Vulnerable to ${enemyDamageType}: ${finalDamage} → ${dmgMod.amount}]`);
      finalDamage = dmgMod.amount;
    }

    // Apply total damage to player — temp HP absorbs first (PHB p.198)
    let instantDeath = false;
    if (finalDamage > 0) {
      // Temporary HP acts as a buffer: absorbed before real HP, never stacks
      const currentTempHP = charFull.temp_hp || 0;
      let remainingDamage = finalDamage;
      if (currentTempHP > 0) {
        const tempAbsorbed = Math.min(currentTempHP, remainingDamage);
        remainingDamage -= tempAbsorbed;
        const newTempHP = currentTempHP - tempAbsorbed;
        await base44.entities.Character.update(player.id, { temp_hp: newTempHP });
        if (tempAbsorbed > 0) {
          attackLogs.push(`[Temp HP absorbed ${tempAbsorbed} damage (${newTempHP} temp HP remaining)]`);
        }
      }
      if (remainingDamage > 0) {
        const hpBefore = player.hp_current;
        const overkill = remainingDamage - hpBefore; // damage remaining after reaching 0 HP
        player.hp_current = Math.max(0, hpBefore - remainingDamage);
        if (player.hp_current === 0) {
          player.is_conscious = false;
          // Instant Death (PHB p.197): if remaining damage >= max HP, the creature dies instantly
          if (overkill >= (player.hp_max || 0)) {
            instantDeath = true;
            await base44.entities.Character.update(player.id, {
              hp_current: 0,
              death_saves_failure: 3, // mark as dead
              death_saves_success: 0,
            });
          }
        }
        if (!instantDeath) {
          await base44.entities.Character.update(player.id, { hp_current: player.hp_current });
        }
      }
      totalDamage = finalDamage; // reflects actual damage after temp HP absorption
    }

    // Build log entry
    let logText = '';
    if (conditionCleared) logText += `${currentCombatant.name} breaks free of ${conditionCleared}! `;
    if (strategyDesc) logText += `[${currentCombatant.name} ${strategyDesc}] `;
    if (anyHit) {
      logText += attackLogs.join('; ') + `. ${player.name} takes ${totalDamage} total damage! (${player.hp_current}/${player.hp_max} HP)`;
      if (instantDeath) logText += ` 💀 The blow is so massive that ${player.name} dies instantly!`;
      else if (!player.is_conscious) logText += ` ${player.name} falls!`;
    } else {
      logText = `${strategyDesc ? `[${currentCombatant.name} ${strategyDesc}] ` : ''}${currentCombatant.name} attacks but misses ${player.name}! (${attackLogs.join('; ')})`;
    }

    // Build updated combatants with player HP changes BEFORE advancing turn
    const updatedCombatants = combatants.map(c => c.id === player.id ? player : c);

    const { nextIndex, nextRound: round } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);

    // Carry over world_state, clear concentration if broken.
    // player_dodging expires once enemies have acted (it only lasts until the player's next turn).
    const newWS = { ...(combatLog.world_state || {}), actions_used_this_turn: 0, player_dodging: false };
    const concentrationSpellCheck = combatLog.world_state?.concentration_spell;
    if (concentrationSpellCheck && finalDamage > 0) {
      const dc = Math.max(10, Math.floor(finalDamage / 2));
      // War Caster: advantage on concentration saves (PHB p.170)
      const hasWarCaster = playerHasFeat('War Caster');
      // Resilient (CON): add proficiency bonus to CON saves (PHB p.168)
      const hasResilientCon = !!(charFull?.saving_throws?.constitution);
      const conProf = hasResilientCon ? (charFull?.proficiency_bonus || 2) : 0;
      const conRoll1 = rollD20();
      const conRoll2 = hasWarCaster ? rollD20() : conRoll1;
      // Paladin Aura of Protection (PHB p.85): add CHA modifier (min +1) to own saves at L6+
      const auraBonus = (charFull?.class === 'Paladin' && (charFull?.level || 1) >= 6)
        ? Math.max(1, statMod(charFull?.charisma || 10)) : 0;
      const conSave2 = Math.max(conRoll1, conRoll2) + statMod(charFull?.constitution || 10) + conProf + auraBonus;
      if (conSave2 < dc) {
        newWS.concentration_spell = null;
        newWS.concentration_caster = null;
        logText += ` ⚠️ Concentration on ${concentrationSpellCheck} broken! (CON save: ${conSave2} vs DC ${dc})`;
      }
    }

    const logEntry = {
      round: combatLog.round,
      actor: currentCombatant.name,
      action: strategy,
      target: player.name,
      hit: anyHit,
      critical: isCritical,
      damage: totalDamage,
      ai_strategy: strategyDesc,
      text: logText
    };

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round,
      world_state: newWS,
    });

    const playerAtZero = !player.is_conscious;
    if (playerAtZero && player.hp_current === 0) {
      // Don't end combat immediately - let death saves play out
      // Only mark as defeat if death saves are failed (handled elsewhere)
    }

    return Response.json({ log_entry: logEntry, player_hp: player.hp_current, player_at_zero_hp: playerAtZero, next_turn_index: nextIndex, round, ai_strategy: strategy });
  }

  // ─── ACTION SURGE (Fighter, PHB p.72) ───────────────────────────────────────
  // Grants one extra action this turn. Once per short rest (twice at L17+).
  // Server-authoritative: tracked in character.short_rest_abilities.action_surge_used.
  if (action === 'action_surge') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    const charClass = (character.class || '').toLowerCase();
    const level = character.level || 1;

    if (charClass !== 'fighter' || level < 2) {
      return Response.json({ error: 'Action Surge requires Fighter level 2+.', invalid: true }, { status: 400 });
    }

    const maxUses = level >= 17 ? 2 : 1;
    const sra = character.short_rest_abilities || {};
    const used = sra.action_surge_used || 0;
    if (used >= maxUses) {
      return Response.json({ error: 'Action Surge already used — recover it on a short or long rest.', invalid: true }, { status: 400 });
    }

    // Consume one use (persist to character)
    await base44.entities.Character.update(character_id, {
      short_rest_abilities: { ...sra, action_surge_used: used + 1 }
    });

    // Grant an extra action this turn by giving back one action's worth of budget
    const ws = combatLog.world_state || {};
    const newUsed = Math.max(0, (ws.actions_used_this_turn || 0) - 1);
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'action_surge',
      text: `⚡ ${character.name} uses Action Surge — gaining an extra action this turn! (${used + 1}/${maxUses} used)`
    };
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...ws, actions_used_this_turn: newUsed },
    });
    return Response.json({ success: true, log_entry: logEntry, uses_remaining: maxUses - (used + 1) });
  }

  // ─── LEGENDARY ACTION (Monster Manual) ──────────────────────────────────────
  // A legendary creature can spend legendary actions at the end of another
  // creature's turn. Budget = 3 per round, refreshed at the start of its own turn
  // (handled in enemy_turn via world_state reset). Here we resolve one LA: a melee
  // attack against the player.
  if (action === 'legendary_action') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];

    // Find the legendary enemy (first conscious enemy flagged legendary with budget left)
    const ws = combatLog.world_state || {};
    const budget = ws.legendary_actions_remaining ?? 3;
    const legendary = combatants.find(c => c.type === 'enemy' && c.is_conscious && c.is_legendary);
    const player = combatants.find(c => c.type === 'player');

    if (!legendary || !player || !player.is_conscious || budget <= 0) {
      return Response.json({ skipped: true, legendary_actions_remaining: Math.max(0, budget) });
    }

    // Resolve a single legendary melee attack
    const atkRoll = rollD20();
    const atkBonus = legendary.attack_bonus || 5;
    const isCrit = atkRoll === 20;
    const hit = !(atkRoll === 1) && (isCrit || (atkRoll + atkBonus) >= player.ac);
    let dmg = 0;
    if (hit) {
      const dMatch = (legendary.damage_dice || '2d6').match(/^(\d+)d(\d+)$/);
      const numDice = dMatch ? (isCrit ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1])) : (isCrit ? 4 : 2);
      const sides = dMatch ? parseInt(dMatch[2]) : 6;
      for (let i = 0; i < numDice; i++) dmg += rollDice(sides);
      dmg = Math.max(1, dmg + (legendary.damage_bonus || 0));
      // Temp HP absorbs legendary action damage first (PHB p.198)
      const laCharFull = await base44.entities.Character.get(player.id);
      const laTempHP = laCharFull.temp_hp || 0;
      let laRemainingDmg = dmg;
      if (laTempHP > 0) {
        const absorbed = Math.min(laTempHP, laRemainingDmg);
        laRemainingDmg -= absorbed;
        await base44.entities.Character.update(player.id, { temp_hp: laTempHP - absorbed });
      }
      if (laRemainingDmg > 0) {
        player.hp_current = Math.max(0, player.hp_current - laRemainingDmg);
        if (player.hp_current === 0) player.is_conscious = false;
        await base44.entities.Character.update(player.id, { hp_current: player.hp_current });
      }
    }

    const newBudget = budget - 1;
    const logEntry = {
      round: combatLog.round, actor: legendary.name, action: 'legendary_action', target: player.name,
      hit, critical: isCrit, damage: dmg,
      text: hit
        ? `✨ LEGENDARY ACTION — ${legendary.name} strikes ${player.name}${isCrit ? ' (CRIT!)' : ''} for ${dmg} damage! (${newBudget} legendary actions left)${player.hp_current === 0 ? ` ${player.name} falls!` : ''}`
        : `✨ LEGENDARY ACTION — ${legendary.name} strikes at ${player.name} but misses. (${newBudget} legendary actions left)`
    };

    await base44.entities.CombatLog.update(combat_id, {
      combatants: combatants.map(c => c.id === player.id ? player : c),
      log_entries: [...(combatLog.log_entries || []), logEntry],
      world_state: { ...ws, legendary_actions_remaining: newBudget },
    });

    return Response.json({ log_entry: logEntry, player_hp: player.hp_current, legendary_actions_remaining: newBudget });
  }

  // ─── GRAPPLE ACTION (PHB p.195) ─────────────────────────────────────────────
  // Replaces one attack: opposed Strength (Athletics) check vs the target's best of
  // Strength (Athletics) or Dexterity (Acrobatics). On success, the target is Grappled
  // (speed 0 until the grapple ends). Uses one attack/action and may end the turn.
  if (action === 'grapple') {
    const { target_id } = payload || {};
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const character = await base44.entities.Character.get(character_id);
    const combatants = [...combatLog.combatants];
    const target = combatants.find(c => c.id === target_id);
    if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

    const profBonus = character.proficiency_bonus || 2;
    // Attacker: Strength (Athletics). Add proficiency if proficient in Athletics.
    const athleticsProf = character.skills?.athletics ? profBonus : 0;
    const attackerCheck = rollD20() + statMod(character.strength) + athleticsProf;

    // Defender: best of Athletics (STR) or Acrobatics (DEX). Monster stats are on the combatant.
    const defStr = target.strength || (target.str ? parseInt(target.str) : 10);
    const defDex = target.dexterity || (target.dex ? parseInt(target.dex) : 10);
    const defenderCheck = rollD20() + Math.max(statMod(defStr), statMod(defDex));

    const success = attackerCheck >= defenderCheck;
    let logText;
    if (success) {
      const existing = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
      if (!existing.includes('grappled')) {
        target.conditions = [...(target.conditions || []), { name: 'grappled', source: character.name, escape_dc: 8 + statMod(character.strength) + athleticsProf }];
      }
      logText = `🤼 ${character.name} GRAPPLES ${target.name}! (Athletics ${attackerCheck} vs ${defenderCheck}) — ${target.name}'s speed is reduced to 0 until they break free.`;
    } else {
      logText = `${character.name} tries to grapple ${target.name} but fails! (Athletics ${attackerCheck} vs ${defenderCheck})`;
    }

    const logEntry = { round: combatLog.round, actor: character.name, action: 'grapple', target: target.name, hit: success, text: logText };
    const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);

    // Grapple replaces one attack — consume one action from the turn budget.
    const actionsPerTurn = getActionsPerTurn(character);
    const actionsUsed = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
    const actionsRemaining = actionsPerTurn - actionsUsed;
    let nextIndex = combatLog.current_turn_index;
    let nextRound = combatLog.round;
    const newWorldState = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed };
    if (actionsRemaining <= 0) {
      const adv = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);
      nextIndex = adv.nextIndex; nextRound = adv.nextRound;
      newWorldState.actions_used_this_turn = 0;
      newWorldState.bonus_action_used = false;
      newWorldState.sneak_attack_used = false;
      newWorldState.loading_weapon_fired = false;
    }

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: newWorldState,
    });

    return Response.json({ success, log_entry: logEntry, actions_remaining: Math.max(0, actionsRemaining), next_turn_index: nextIndex });
  }

  // ─── DODGE ACTION (PHB p.192) ───────────────────────────────────────────────
  // Until the start of your next turn, attack rolls against you have disadvantage
  // (if you can see the attacker) and you make DEX saves with advantage. Uses your
  // action and ends the turn. Server marks player_dodging in world_state; enemy_turn
  // applies disadvantage to attacks against the player.
  if (action === 'dodge') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = combatLog.combatants;
    const character = await base44.entities.Character.get(character_id);
    const logEntry = {
      round: combatLog.round, actor: character.name, action: 'dodge',
      text: `🛡️ ${character.name} takes the Dodge action — attacks against them have disadvantage until their next turn.`
    };
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    await base44.entities.CombatLog.update(combat_id, {
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false, sneak_attack_used: false, loading_weapon_fired: false, player_dodging: true }
    });
    return Response.json({ success: true, log_entry: logEntry, next_turn_index: nextIndex, round: nextRound });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: next_turn — simply advance the initiative tracker (used when the
  // player ends their turn early or to step a non-acting combatant).
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'next_turn') {
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = combatLog.combatants;
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    await base44.entities.CombatLog.update(combat_id, {
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false, sneak_attack_used: false, loading_weapon_fired: false }
    });
    return Response.json({ next_turn_index: nextIndex, round: nextRound, current_combatant: combatants[nextIndex] });
  }

  // ─── DEATH SAVE (PHB p.197) ─────────────────────────────────────────────────
  // Player rolls a d20 on their turn while at 0 HP.
  // 10+  = success. 3 successes = stabilized.
  // 9-   = failure. 3 failures  = dead.
  // Nat 20 = regain 1 HP and stand up immediately.
  // Nat 1  = counts as 2 failures.
  if (action === 'death_save') {
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const combatLog = await base44.entities.CombatLog.get(combat_id);
    const combatants = [...combatLog.combatants];
    const playerCombatant = combatants.find(c => c.type === 'player');

    // Only roll if actually at 0 HP
    if ((character.hp_current || 0) > 0) {
      return Response.json({ error: 'Character is not at 0 HP — no death save needed.', invalid: true }, { status: 400 });
    }

    const roll = rollD20();
    let successDelta = 0;
    let failureDelta = 0;
    let logText = `💀 ${character.name} rolls a Death Saving Throw: ${roll}`;
    let stabilized = false;
    let regainedHP = false;

    if (roll === 20) {
      // Nat 20: regain 1 HP, stand up (PHB p.197)
      await base44.entities.Character.update(character_id, {
        hp_current: 1,
        death_saves_success: 0,
        death_saves_failure: 0,
      });
      if (playerCombatant) {
        playerCombatant.hp_current = 1;
        playerCombatant.is_conscious = true;
      }
      logText += ` — NATURAL 20! ${character.name} regains 1 HP and stands back up! 🌟`;
      regainedHP = true;
    } else if (roll === 1) {
      // Nat 1: 2 failures
      failureDelta = 2;
      logText += ` — Natural 1! Two death save failures!`;
    } else if (roll >= 10) {
      successDelta = 1;
      logText += ` — Success! (${roll} ≥ 10)`;
    } else {
      failureDelta = 1;
      logText += ` — Failure. (${roll} < 10)`;
    }

    const newSuccesses = Math.min(3, (character.death_saves_success || 0) + successDelta);
    const newFailures = Math.min(3, (character.death_saves_failure || 0) + failureDelta);

    if (!regainedHP) {
      if (newSuccesses >= 3) {
        // Stabilized: unconscious but no longer dying (PHB p.197)
        stabilized = true;
        logText += ` — ${character.name} is STABILIZED and no longer dying!`;
        await base44.entities.Character.update(character_id, {
          death_saves_success: newSuccesses,
          death_saves_failure: newFailures,
        });
      } else if (newFailures >= 3) {
        logText += ` — ${character.name} has DIED. ☠️`;
        await base44.entities.Character.update(character_id, {
          death_saves_success: newSuccesses,
          death_saves_failure: 3,
        });
      } else {
        await base44.entities.Character.update(character_id, {
          death_saves_success: newSuccesses,
          death_saves_failure: newFailures,
        });
      }
    }

    const logEntry = {
      round: combatLog.round,
      actor: character.name,
      action: 'death_save',
      roll,
      text: logText + ` (${newSuccesses}/3 successes, ${newFailures}/3 failures)`,
    };

    // Advance turn after death save (it consumes the player's turn)
    const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    const updatedCombatants = playerCombatant ? combatants.map(c => c.type === 'player' ? playerCombatant : c) : combatants;

    await base44.entities.CombatLog.update(combat_id, {
      combatants: updatedCombatants,
      log_entries: [...(combatLog.log_entries || []), logEntry],
      current_turn_index: nextIndex,
      round: nextRound,
      world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0, bonus_action_used: false },
    });

    return Response.json({
      roll,
      success: successDelta > 0,
      nat20: roll === 20,
      nat1: roll === 1,
      stabilized,
      regained_hp: regainedHP,
      death_saves_success: newSuccesses,
      death_saves_failure: newFailures,
      character_dead: newFailures >= 3 && !regainedHP,
      log_entry: logEntry,
      next_turn_index: nextIndex,
    });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});