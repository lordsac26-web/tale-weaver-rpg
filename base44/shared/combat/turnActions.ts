// Turn-scoped combat actions: Action Surge, Grapple, Dodge, Flurry of Blows,
// next_turn advancement, and Death Saves. Extracted verbatim from combatEngine/entry.ts.
import {
  statMod, rollD20, rollDice, applyDamageModifiers,
  advanceTurn, resolveActionAndAdvance, resetTurnWorldState, SAVEABLE_CONDITIONS,
} from './helpers.ts';
import { finalizeAndPersistCombat } from './persistence.ts';

// ─── ACTION SURGE (Fighter, PHB p.72) ───────────────────────────────────────
// Grants one extra action this turn. Once per short rest (twice at L17+).
// Server-authoritative: tracked in character.short_rest_abilities.action_surge_used.
export async function handleActionSurge(ctx) {
  const { base44, combat_id, character_id } = ctx;
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

// ─── GRAPPLE ACTION (PHB p.195) ─────────────────────────────────────────────
// Replaces one attack: opposed Strength (Athletics) check vs the target's best of
// Strength (Athletics) or Dexterity (Acrobatics). On success, the target is Grappled
// (speed 0 until the grapple ends). Uses one attack/action and may end the turn.
export async function handleGrapple(ctx) {
  const { base44, combat_id, character_id, payload } = ctx;
  const { target_id } = payload || {};
  const combatLog = await base44.entities.CombatLog.get(combat_id);
  const character = await base44.entities.Character.get(character_id);
  const combatants = [...combatLog.combatants];
  const target = combatants.find(c => c.id === target_id);
  if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

  const profBonus = character.proficiency_bonus || 2;
  // Attacker: Strength (Athletics). Add proficiency if proficient in Athletics.
  const athleticsProf = character.skills?.athletics ? profBonus : 0;
  // Frost Rune (invoked): advantage on Strength (Athletics) checks.
  const frostActive = (character.active_modifiers || []).some(m => m.effect === 'frost_advantage');
  const gRoll1 = rollD20();
  const attackerCheck = (frostActive ? Math.max(gRoll1, rollD20()) : gRoll1) + statMod(character.strength) + athleticsProf;

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
  const { nextIndex, nextRound, actionsRemaining, worldState: newWorldState } =
    resolveActionAndAdvance(combatLog, updatedCombatants, character);

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
export async function handleDodge(ctx) {
  const { base44, combat_id, character_id } = ctx;
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
    world_state: resetTurnWorldState(combatLog, { player_dodging: true })
  });
  return Response.json({ success: true, log_entry: logEntry, next_turn_index: nextIndex, round: nextRound });
}

// ─── FLURRY OF BLOWS (Monk L2, PHB p.78) ───────────────────────────────────
// Bonus action: spend 1 Ki to make 2 unarmed strikes after taking the Attack action.
// Uses Martial Arts die (scales with level) and DEX for attack/damage.
export async function handleFlurryOfBlows(ctx) {
  const { base44, session_id, combat_id, character_id, payload } = ctx;
  const { target_id } = payload || {};
  const combatLog = await base44.entities.CombatLog.get(combat_id);
  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const level = character.level || 1;
  if ((character.class || '').toLowerCase() !== 'monk' || level < 2) {
    return Response.json({ error: 'Flurry of Blows requires Monk level 2+.', invalid: true }, { status: 400 });
  }
  const kiRemaining = character.ki_points_remaining ?? 0;
  if (kiRemaining <= 0) {
    return Response.json({ error: 'No Ki points remaining.', invalid: true }, { status: 400 });
  }
  if (combatLog.world_state?.bonus_action_used) {
    return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
  }

  const combatants = [...combatLog.combatants];
  const target = combatants.find(c => c.id === target_id);
  if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

  // Martial Arts die + DEX-based attack (PHB p.76)
  const maDie = level >= 17 ? 10 : level >= 11 ? 8 : level >= 5 ? 6 : 4;
  const dexMod = statMod(character.dexterity || 10);
  const profBonus = character.proficiency_bonus || 2;
  const attackMod = dexMod + profBonus;

  let totalDamage = 0;
  let anyHit = false;
  const strikeLogs = [];

  for (let s = 0; s < 2; s++) {
    if (!target.is_conscious) break;
    const roll1 = rollD20();
    const isCrit = roll1 === 20;
    const isFumble = roll1 === 1;
    const totalAttack = roll1 + attackMod;
    const hit = !isFumble && (isCrit || totalAttack >= target.ac);
    if (hit) {
      anyHit = true;
      const numDice = isCrit ? 2 : 1;
      let dmg = 0;
      for (let i = 0; i < numDice; i++) dmg += rollDice(maDie);
      dmg += dexMod;
      dmg = Math.max(1, dmg);
      const dmgMod = applyDamageModifiers(dmg, 'bludgeoning', {
        resistances: target.resistances, vulnerabilities: target.vulnerabilities, immunities: target.immunities,
      });
      dmg = dmgMod.applied === 'immunity' ? 0 : dmgMod.amount;
      totalDamage += dmg;
      target.hp_current = Math.max(0, target.hp_current - dmg);
      if (target.hp_current === 0) target.is_conscious = false;
      strikeLogs.push(`Strike ${s + 1}: ${isCrit ? 'CRIT! ' : ''}${dmg} dmg (${roll1}+${attackMod}=${totalAttack} vs AC ${target.ac})`);
      // Open Hand Technique (PHB p.79): each Flurry hit — DEX save vs Ki DC or knocked prone (M-S fix)
      if ((character.subclass || '').toLowerCase().includes('open hand') && target.is_conscious) {
        const kiDC = 8 + profBonus + statMod(character.wisdom || 10);
        const ohSave = rollD20() + statMod(target.dexterity || 10);
        if (ohSave < kiDC) {
          const exC = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
          if (!exC.includes('prone')) target.conditions = [...(target.conditions || []), { name: 'prone', source: 'Open Hand Technique' }];
          strikeLogs.push(`— knocked PRONE! (DEX ${ohSave} vs DC ${kiDC})`);
        }
      }
    } else {
      strikeLogs.push(`Strike ${s + 1}: miss (${roll1}+${attackMod}=${totalAttack} vs AC ${target.ac})`);
    }
  }

  // Spend 1 Ki
  await base44.entities.Character.update(character_id, {
    ki_points_remaining: Math.max(0, kiRemaining - 1),
  });

  const logEntry = {
    round: combatLog.round, actor: character.name, action: 'flurry_of_blows', target: target.name,
    hit: anyHit, damage: totalDamage,
    text: `${character.name} uses Flurry of Blows! ${strikeLogs.join(' | ')}${totalDamage > 0 ? ` — ${totalDamage} total bludgeoning damage.` : ''}${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`,
  };

  const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
  const { nextIndex: fIndex, nextRound: fRound, worldState: fWS } =
    resolveActionAndAdvance(combatLog, updatedCombatants, character, { isBonusAction: true });

  const result = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedCombatants,
    [...(combatLog.log_entries || []), logEntry], fIndex, fRound, fWS);

  return Response.json({
    hit: anyHit, damage: totalDamage, log_entry: logEntry, result,
    combat_ended: result !== 'ongoing', ki_remaining: Math.max(0, kiRemaining - 1),
    next_turn_index: fIndex,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: next_turn — simply advance the initiative tracker (used when the
// player ends their turn early or to step a non-acting combatant).
// ═══════════════════════════════════════════════════════════════════════════
export async function handleNextTurn(ctx) {
  const { base44, combat_id } = ctx;
  const combatLog = await base44.entities.CombatLog.get(combat_id);
  const combatants = [...combatLog.combatants];
  const { nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
  const nextWS = resetTurnWorldState(combatLog);
  let condLog = null;
  // Player turn-start: resolve saveable conditions with racial advantages and Paladin auras.
  // Halfling Brave (PHB p.28): advantage on frightened saves.
  // Gnome Cunning (PHB p.37): advantage on INT/WIS/CHA saves vs magic.
  // Aura of Protection (Paladin L6, PHB p.85): +CHA mod to all saves.
  // Aura of Devotion (Paladin L10, PHB p.86): immune to charm.
  if (combatants[nextIndex]?.type === 'player') {
    nextWS.player_reckless = false; nextWS.player_reaction_used = false;
    const pc = combatants[nextIndex];
    if ((pc.conditions || []).some(c => SAVEABLE_CONDITIONS[(typeof c === 'string' ? c : c?.name || '').toLowerCase()])) {
      const ch = await base44.entities.Character.get(pc.id);
      if (ch) {
        const race = (ch.race || '').toLowerCase();
        const auraBonus = ((ch.class || '') === 'Paladin' && (ch.level || 1) >= 6) ? Math.max(1, statMod(ch.charisma || 10)) : 0;
        const devotionImmune = (ch.class || '') === 'Paladin' && (ch.subclass || '').toLowerCase().includes('devotion') && (ch.level || 1) >= 10;
        // Mindless Rage (Berserker 6+, PHB p.49): can't be charmed or frightened while raging (H-S1 fix)
        const mindlessRage = (ch.class || '') === 'Barbarian' && (ch.subclass || '').toLowerCase().includes('berserker') && (ch.level || 1) >= 6
          && (pc.conditions || []).some(c => (typeof c === 'string' ? c : c?.name) === 'raging');
        const remaining = []; let cleared = null;
        for (const cond of pc.conditions) {
          const cN = (typeof cond === 'string' ? cond : cond?.name || '').toLowerCase();
          if (cN === 'charmed' && devotionImmune) { cleared = cN; continue; }
          if ((cN === 'charmed' || cN === 'frightened') && mindlessRage) { cleared = cN; continue; }
          const saveAb = SAVEABLE_CONDITIONS[cN];
          if (saveAb && typeof cond === 'object' && cond.save_dc) {
            const hasAdv = (cN === 'frightened' && race === 'halfling') || (['intelligence','wisdom','charisma'].includes(saveAb) && race === 'gnome');
            // Halfling Lucky (PHB p.28): reroll natural 1s on saving throws
            const luckyD20 = () => { let r = rollD20(); if (race === 'halfling' && r === 1) r = rollD20(); return r; };
            const r1 = luckyD20(), r2 = hasAdv ? luckyD20() : r1;
            if (Math.max(r1, r2) + statMod(ch[saveAb] || 10) + auraBonus >= cond.save_dc) { cleared = cN; continue; }
          }
          remaining.push(cond);
        }
        pc.conditions = remaining;
        if (cleared) condLog = { round: nextRound, actor: pc.name, action: 'condition_save', text: `${pc.name} shakes off ${cleared}!` };
      }
    }
  }
  await base44.entities.CombatLog.update(combat_id, {
    current_turn_index: nextIndex, round: nextRound, world_state: nextWS,
    ...(condLog ? { log_entries: [...(combatLog.log_entries || []), condLog], combatants } : {}),
  });
  return Response.json({ next_turn_index: nextIndex, round: nextRound, current_combatant: combatants[nextIndex], condition_cleared: condLog?.text || null });
}

// ─── DEATH SAVE (PHB p.197) ─────────────────────────────────────────────────
// Player rolls a d20 on their turn while at 0 HP.
// 10+  = success. 3 successes = stabilized.
// 9-   = failure. 3 failures  = dead.
// Nat 20 = regain 1 HP and stand up immediately.
// Nat 1  = counts as 2 failures.
export async function handleDeathSave(ctx) {
  const { base44, combat_id, character_id } = ctx;
  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const combatLog = await base44.entities.CombatLog.get(combat_id);
  const combatants = [...combatLog.combatants];
  const playerCombatant = combatants.find(c => c.type === 'player');

  // Only roll if actually at 0 HP
  if ((character.hp_current || 0) > 0) {
    return Response.json({ error: 'Character is not at 0 HP — no death save needed.', invalid: true }, { status: 400 });
  }

  let roll = rollD20();
  // Halfling Lucky (PHB p.28): death saves are saving throws — reroll natural 1s
  if ((character.race || '') === 'Halfling' && roll === 1) roll = rollD20();
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
    world_state: resetTurnWorldState(combatLog),
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