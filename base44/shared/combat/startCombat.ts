// start_combat handler — roll initiative for player + enemies, sort the order,
// and create the CombatLog record. Extracted verbatim from combatEngine/entry.ts.
import { statMod, rollD20 } from './helpers.ts';
import { inferArchetype } from '../monsterAI.ts';

export async function handleStartCombat(ctx) {
  const { base44, session_id, payload } = ctx;
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
  // Dwarves ignore the heavy-armor STR speed penalty (PHB p.20)
  if (equippedArmor?.armor_type?.toLowerCase() === 'heavy' && (character.race || '') !== 'Dwarf') {
    const strReq = equippedArmor.str_requirement || 13;
    if ((character.strength || 10) < strReq) playerSpeed = Math.max(0, playerSpeed - 10);
  }
  // Monk Unarmored Movement (PHB p.78): +10/15/20/25/30 at L2/6/10/14/18 (unarmored only)
  if ((character.class || '') === 'Monk' && !equippedArmor) {
    const monkLevel = character.level || 1;
    const umBonus = monkLevel >= 18 ? 30 : monkLevel >= 14 ? 25 : monkLevel >= 10 ? 20 : monkLevel >= 6 ? 15 : monkLevel >= 2 ? 10 : 0;
    playerSpeed += umBonus;
  }
  // Barbarian Fast Movement (PHB p.48): +10 ft at L5 (not wearing heavy armor)
  if ((character.class || '') === 'Barbarian' && (character.level || 1) >= 5) {
    const armorType = (equippedArmor?.armor_type || '').toLowerCase();
    if (armorType !== 'heavy') playerSpeed += 10;
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
    // Rogue defensive passives (surfaced for condition/save checks in the engine)
    has_evasion: (character.class === 'Rogue' && (character.level || 1) >= 7),
    has_uncanny_dodge: (character.class === 'Rogue' && (character.level || 1) >= 5),
    is_conscious: true
  });

  // Beast Master Ranger: add summoned companions to initiative (PHB p.93)
  try {
    const companions = await base44.entities.Companion.filter({ character_id: character.id, is_summoned: true });
    for (const comp of (companions || [])) {
      if (!comp.is_active) continue;
      const compInitRoll = rollD20();
      const compDexMod = statMod(comp.dexterity || 10);
      combatants.push({
        id: comp.id,
        name: comp.name,
        type: 'companion',
        initiative_roll: compInitRoll,
        initiative_mod: compDexMod,
        initiative_total: compInitRoll + compDexMod,
        hp_current: comp.hp_current || 1,
        hp_max: comp.hp_max || 1,
        ac: comp.armor_class || 10,
        speed: comp.speed || 30,
        conditions: [],
        is_conscious: true,
        attacks: comp.attacks || [],
        attack_bonus: comp.proficiency_bonus || character.proficiency_bonus || 2,
        owner_id: character.id,
        portrait_emoji: comp.portrait_emoji || '🐾',
      });
    }
  } catch { /* Companion entity may not exist */ }

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