// enemy_turn + legendary_action handlers — end-of-turn saves, attacking a downed
// player (death-save failures), data-driven AI tactic selection, multiattack
// resolution, damage mitigation, and concentration checks.
// Extracted verbatim from combatEngine/entry.ts.
import {
  statMod, rollD20, rollDice, applyDamageModifiers, hasNoActions,
  SAVEABLE_CONDITIONS, advanceTurn, resetTurnWorldState, rollConcentrationSave,
} from './helpers.ts';
import { awardVictoryXP } from './persistence.ts';
import { inferArchetype, chooseTactic } from '../monsterAI.ts';

export async function handleEnemyTurn(ctx) {
  const { base44, session_id, combat_id } = ctx;
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
      world_state: resetTurnWorldState(combatLog),
    });
    return Response.json({ skipped_incapacitated: true, log_entry: { text: skipText }, next_turn_index: niSk, round: nrSk });
  }

  // Enemy attacks player
  const player = combatants.find(c => c.type === 'player');
  if (!player) {
    return Response.json({ no_target: true });
  }

  // SYNC PLAYER HP FROM LIVE CHARACTER RECORD (fixes Second Wind / potion heals being
  // wiped). The combatant snapshot can go stale when HP changes outside the engine
  // (Second Wind, healing potions, etc.). Re-read the authoritative Character HP so
  // enemy damage is subtracted from the player's ACTUAL current HP, not the snapshot.
  let liveChar = null;
  {
    const livePlayer = await base44.entities.Character.get(player.id);
    if (livePlayer) {
      liveChar = livePlayer;
      player.hp_current = Math.min(livePlayer.hp_max ?? player.hp_max, livePlayer.hp_current ?? player.hp_current);
      player.hp_max = livePlayer.hp_max ?? player.hp_max;
      player.is_conscious = player.hp_current > 0;
    }
  }
  // Rune Knight: invoked runes on the DEFENDER (attacker-side runes live in player_attack).
  const playerRunes = new Set((liveChar?.active_modifiers || []).map(m => m.effect).filter(Boolean));

  // Player is at 0 HP (downed): an attack that hits causes a death save failure (PHB p.197).
  // A melee hit from within 5 ft is an automatic critical → 2 failures.
  if (!player.is_conscious || player.hp_current === 0) {
    const downedChar = await base44.entities.Character.get(player.id);
    const atkRoll = rollD20();
    const atkBonus = currentCombatant.attack_bonus || 3;
    const isCrit = atkRoll === 20;
    const hitDowned = !(atkRoll === 1) && (isCrit || (atkRoll + atkBonus) >= player.ac);

    let downedLog = `${currentCombatant.name} strikes at the fallen ${player.name}`;
    const ws0 = resetTurnWorldState(combatLog);

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
  // Invisible player (Firbolg Hidden Step): attacks against have disadvantage (PHB p.291)
  const playerInvisible = (player.conditions || []).map(c => (typeof c === 'string' ? c : c?.name)).includes('invisible');
  // Reckless Attack drawback (PHB p.48): enemies have advantage vs the barbarian
  // until the start of the barbarian's next turn.
  const playerReckless = !!combatLog.world_state?.player_reckless;

  // ── RUNE KNIGHT (defender) reactions — one reaction per turn ────────────
  // Stone Rune: the attacker must make a WIS save vs the rune DC or be charmed
  // and unable to attack. Cloud Rune: redirect the first hit to another creature.
  // Each is a single-use invocation, consumed when it triggers.
  const runesConsumed = [];
  let reactionAvailable = !combatLog.world_state?.reaction_used;
  let stoneText = '';
  const defRuneDC = 8 + (liveChar?.proficiency_bonus || 2) + statMod(liveChar?.constitution || 10);
  if (playerRunes.has('stone_charm') && reactionAvailable) {
    reactionAvailable = false;
    runesConsumed.push('stone_charm');
    const wisSave = rollD20() + statMod(currentCombatant.wisdom || 10);
    if (wisSave < defRuneDC) {
      numAttacks = 0;
      const existingConds = (currentCombatant.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
      if (!existingConds.includes('charmed')) {
        currentCombatant.conditions = [...(currentCombatant.conditions || []), { name: 'charmed', source: 'Stone Rune', save_dc: defRuneDC, save_ability: 'wisdom', caster: player.name }];
      }
      stoneText = `🗿 STONE RUNE! ${currentCombatant.name} fails a WIS save (${wisSave} vs DC ${defRuneDC}) and is CHARMED — it cannot bring itself to attack! `;
    } else {
      stoneText = `🗿 Stone Rune: ${currentCombatant.name} resists the charm. (WIS save ${wisSave} vs DC ${defRuneDC}) `;
    }
  }
  let cloudRedirectAvailable = playerRunes.has('redirect_attack') && reactionAvailable;
  // Cutting Words (Lore Bard 3+, PHB p.54): armed reaction — subtract an inspiration die from one enemy attack (M-S fix)
  const cwLvl = liveChar?.level || 1;
  const cwDie = cwLvl < 5 ? 6 : cwLvl < 10 ? 8 : cwLvl < 15 ? 10 : 12;
  let cwReady = !!combatLog.world_state?.cutting_words_armed && reactionAvailable
    && liveChar?.class === 'Bard' && (liveChar?.bardic_inspiration_remaining || 0) > 0;
  let cwConsumed = false;

  let totalDamage = 0;
  let anyHit = false;
  let isCritical = false;
  const attackLogs = [];

  for (let atk = 0; atk < numAttacks; atk++) {
    if (!currentCombatant.is_conscious) break; // felled mid-turn (Cloud Rune self-redirect)
    const roll1 = rollD20();
    // Advantage (reckless barbarian) and disadvantage (dodging) cancel per PHB p.173
    const hasAdv = playerReckless && !(playerDodging || playerInvisible);
    const hasDis = (playerDodging || playerInvisible) && !playerReckless;
    const attackRoll = hasAdv ? Math.max(roll1, rollD20()) : hasDis ? Math.min(roll1, rollD20()) : roll1;
    let totalAttack = attackRoll + attackBonus;
    const isCrit = attackRoll === 20;
    const isFumble = attackRoll === 1;
    let hit = !isFumble && (isCrit || totalAttack >= targetAC);
    if (hit && !isCrit && cwReady) {
      const cwRoll = rollDice(cwDie);
      cwReady = false; cwConsumed = true;
      totalAttack -= cwRoll;
      hit = totalAttack >= targetAC;
      attackLogs.push(`🎭 CUTTING WORDS! -${cwRoll} to the attack roll${hit ? '' : ' — it MISSES!'}`);
    }

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
        // Cloud Rune (reaction): redirect the first attack that hits to another
        // creature — another enemy if present, otherwise the attacker itself.
        if (cloudRedirectAvailable) {
          cloudRedirectAvailable = false;
          runesConsumed.push('redirect_attack');
          const redirectTarget = combatants.find(c => c.type === 'enemy' && c.is_conscious && c.id !== currentCombatant.id) || currentCombatant;
          redirectTarget.hp_current = Math.max(0, redirectTarget.hp_current - dmg);
          if (redirectTarget.hp_current === 0) redirectTarget.is_conscious = false;
          attackLogs.push(`☁️ CLOUD RUNE! ${player.name} redirects the blow — ${redirectTarget.name} takes ${dmg} damage instead!${redirectTarget.hp_current === 0 ? ` ${redirectTarget.name} falls!` : ''}`);
          continue;
        }
        totalDamage += dmg;
        attackLogs.push(`${isCrit ? '💥 CRITICAL! ' : ''}${currentCombatant.name} hits for ${dmg} dmg (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
      }
    } else {
      attackLogs.push(`${currentCombatant.name} misses (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${targetAC})`);
    }
  }

  // === DAMAGE MITIGATION (applied in priority order) ===
  let usedReaction = false;
  const playerConditions = (player.conditions || []).map(c => c.name || c);
  const isRaging = playerConditions.includes('raging');
  const enemyDamageType = (currentCombatant.damage_type || 'bludgeoning').toLowerCase();
  const physicalTypes = ['bludgeoning', 'piercing', 'slashing'];
  // PERFORMANCE: only fetch the full character record when an attack actually landed —
  // all mitigation, temp-HP, and concentration logic below depends on a hit.
  const charFull = anyHit ? await base44.entities.Character.get(player.id) : null;
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

  // Barbarian Rage Resistance (PHB p.48): halve B/P/S while raging.
  // Bear Totem (Totem Warrior L3, PHB p.49): resistance to ALL damage except psychic.
  const isBarbarianRaging = isRaging && (charFull?.class === 'Barbarian' || charFull?.class === 'barbarian');
  const isBearTotem = (charFull?.class_choices?.totem_spirit || '').toLowerCase() === 'bear';
  let alreadyResisted = false;
  const rageApplies = isBarbarianRaging && (isBearTotem ? enemyDamageType !== 'psychic' : physicalTypes.includes(enemyDamageType));
  if (rageApplies) {
    const halved = Math.floor(finalDamage / 2);
    attackLogs.push(`[Rage${isBearTotem ? ' (Bear Totem)' : ''} Resistance: ${finalDamage} → ${halved} ${enemyDamageType}]`);
    finalDamage = halved;
    alreadyResisted = true;
  }

  // General Resistance/Vulnerability/Immunity from character fields (PHB p.197).
  // Resistance doesn't stack (a damage type can only be halved once), so skip
  // resistance if Rage already halved this same physical damage.
  // Hill Rune (invoked): resistance to poison damage while active.
  // Racial damage traits (applied even if not on the character's arrays)
  const racialRes = [];
  const racialImm = [];
  if ((charFull?.race || '') === 'Yuan-ti Pureblood') { racialImm.push('poison'); }
  if ((charFull?.race || '') === 'Dragonborn') {
    const anc = (charFull?.class_choices?.dragon_ancestry || 'red').toLowerCase();
    const DR = { black:'acid', copper:'acid', blue:'lightning', bronze:'lightning', brass:'fire', gold:'fire', red:'fire', green:'poison', silver:'cold', white:'cold' };
    if (DR[anc]) racialRes.push(DR[anc]);
  }
  const dmgMod = applyDamageModifiers(finalDamage, enemyDamageType, {
    resistances: [...(charFull?.resistances || []), ...racialRes, ...(playerRunes.has('hill_resilience') ? ['poison'] : [])],
    vulnerabilities: charFull?.vulnerabilities,
    immunities: [...(charFull?.immunities || []), ...racialImm],
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

  // === REACTION-BASED DAMAGE MITIGATION ===
  // Goliath Stone's Endurance (reaction): 1d12 + CON reduction, once per short rest (PHB p.X)
  // Rogue Uncanny Dodge (reaction): halve damage from one attacker, L5+ (PHB p.96)
  // Both consume the player's one reaction per round.
  const playerReactionUsed = !!combatLog.world_state?.player_reaction_used;
  if (finalDamage > 0 && !playerReactionUsed) {
    const isRangedAttack = (currentCombatant.attack_type || 'melee') === 'ranged';
    // Monk Deflect Missiles (PHB p.78): reaction vs a ranged weapon attack —
    // reduce damage by 1d10 + DEX + monk level (M-C2 fix). Automatic.
    if (charFull?.class === 'Monk' && (charFull?.level || 1) >= 3 && isRangedAttack) {
      const deflect = rollDice(10) + statMod(charFull.dexterity || 10) + (charFull.level || 1);
      const reduced = Math.max(0, finalDamage - deflect);
      attackLogs.push(`[Deflect Missiles: -${deflect} → ${reduced}${reduced === 0 ? ' — missile caught!' : ''}]`);
      finalDamage = reduced;
      usedReaction = true;
    // Stone's Endurance takes priority over Uncanny Dodge (bigger reduction on average)
    } else if ((charFull?.race === 'Goliath') && !(charFull?.short_rest_abilities?.stones_endurance_used)) {
      const stoneRed = rollDice(12) + statMod(charFull.constitution || 10);
      finalDamage = Math.max(0, finalDamage - stoneRed);
      attackLogs.push(`[Stone's Endurance: -${stoneRed} → ${finalDamage}]`);
      await base44.entities.Character.update(player.id, {
        short_rest_abilities: { ...(charFull.short_rest_abilities || {}), stones_endurance_used: true },
      });
      usedReaction = true;
    } else if (charFull?.class === 'Rogue' && (charFull?.level || 1) >= 5) {
      finalDamage = Math.floor(finalDamage / 2);
      attackLogs.push(`[Uncanny Dodge: halved → ${finalDamage}]`);
      usedReaction = true;
    }
  }

  // Arcane Ward (Abjuration Wizard 2+, PHB p.115): the ward absorbs damage before HP (M-S fix)
  if (finalDamage > 0 && charFull?.class === 'Wizard' && (charFull?.subclass || '').toLowerCase().includes('abjuration')) {
    const wardHp = charFull?.long_rest_abilities?.arcane_ward_hp || 0;
    if (wardHp > 0) {
      const absorbed = Math.min(wardHp, finalDamage);
      finalDamage -= absorbed;
      totalDamage = finalDamage;
      await base44.entities.Character.update(player.id, { long_rest_abilities: { ...(charFull.long_rest_abilities || {}), arcane_ward_hp: wardHp - absorbed } });
      attackLogs.push(`[🛡️ Arcane Ward absorbs ${absorbed} (${wardHp - absorbed} ward HP left)]`);
    }
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
            death_saves_failure: 3,
            death_saves_success: 0,
          });
        }
      }
      // Half-Orc Relentless Endurance (PHB p.41): drop to 1 HP instead of 0, once per long rest
      if (player.hp_current === 0 && !instantDeath && (charFull?.race === 'Half-Orc')
          && !(charFull?.long_rest_abilities?.relentless_endurance_used)) {
        player.hp_current = 1;
        player.is_conscious = true;
        await base44.entities.Character.update(player.id, {
          hp_current: 1,
          long_rest_abilities: { ...(charFull.long_rest_abilities || {}), relentless_endurance_used: true },
        });
        attackLogs.push(`[Relentless Endurance: dropped to 1 HP instead of 0!]`);
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
  if (stoneText) logText += stoneText;
  if (strategyDesc && numAttacks > 0) logText += `[${currentCombatant.name} ${strategyDesc}] `;
  if (anyHit) {
    logText += attackLogs.join('; ') + (totalDamage > 0 ? `. ${player.name} takes ${totalDamage} total damage! (${player.hp_current}/${player.hp_max} HP)` : `. ${player.name} takes no damage!`);
    if (instantDeath) logText += ` 💀 The blow is so massive that ${player.name} dies instantly!`;
    else if (!player.is_conscious) logText += ` ${player.name} falls!`;
  } else if (numAttacks === 0) {
    logText += `${currentCombatant.name} takes no hostile action this turn.`;
  } else {
    logText += `${currentCombatant.name} attacks but misses ${player.name}! (${attackLogs.join('; ')})`;
  }

  // Build updated combatants with player HP changes BEFORE advancing turn
  const updatedCombatants = combatants.map(c => c.id === player.id ? player : c);

  const { nextIndex, nextRound: round } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants);

  // Carry over world_state, clear concentration if broken.
  // player_dodging expires once enemies have acted (it only lasts until the player's next turn).
  const newWS = resetTurnWorldState(combatLog, { player_dodging: false, player_reaction_used: usedReaction || !!combatLog.world_state?.player_reaction_used });
  if (cwConsumed) {
    newWS.cutting_words_armed = false;
    newWS.player_reaction_used = true;
    await base44.entities.Character.update(player.id, { bardic_inspiration_remaining: Math.max(0, (liveChar?.bardic_inspiration_remaining || 1) - 1) });
  }
  if (updatedCombatants[nextIndex]?.type === 'player') {
    newWS.player_reckless = false;
    newWS.player_reaction_used = false;
  }
  const concentrationSpellCheck = combatLog.world_state?.concentration_spell;
  if (concentrationSpellCheck && finalDamage > 0) {
    const conc = rollConcentrationSave(charFull, finalDamage);
    if (conc.broken) {
      newWS.concentration_spell = null;
      newWS.concentration_caster = null;
      logText += ` ⚠️ Concentration on ${concentrationSpellCheck} broken! (CON save: ${conc.save} vs DC ${conc.dc})`;
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

  // Persist consumed rune invocations (Cloud/Stone are single-use reactions).
  if (runesConsumed.length > 0 && liveChar) {
    await base44.entities.Character.update(player.id, {
      active_modifiers: (liveChar.active_modifiers || []).filter(m => !runesConsumed.includes(m.effect)),
    });
  }

  // A Cloud Rune redirect can fell an enemy on its own turn — check for victory.
  const allEnemiesDown = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);

  await base44.entities.CombatLog.update(combat_id, {
    combatants: updatedCombatants,
    log_entries: [...(combatLog.log_entries || []), logEntry],
    current_turn_index: nextIndex,
    round,
    world_state: newWS,
    ...(allEnemiesDown ? { is_active: false, result: 'victory' } : {}),
  });
  if (allEnemiesDown) {
    await base44.entities.GameSession.update(session_id, { in_combat: false });
    await awardVictoryXP(base44, combat_id, updatedCombatants, player.id);
  }

  const playerAtZero = !player.is_conscious;
  if (playerAtZero && player.hp_current === 0) {
    // Don't end combat immediately - let death saves play out
    // Only mark as defeat if death saves are failed (handled elsewhere)
  }

  return Response.json({ log_entry: logEntry, player_hp: player.hp_current, player_at_zero_hp: playerAtZero, next_turn_index: nextIndex, round, ai_strategy: strategy, result: allEnemiesDown ? 'victory' : 'ongoing', combat_ended: allEnemiesDown });
}

// ─── LEGENDARY ACTION (Monster Manual) ──────────────────────────────────────
// A legendary creature can spend legendary actions at the end of another
// creature's turn. Budget = 3 per round, refreshed at the start of its own turn
// (handled in enemy_turn via world_state reset). Here we resolve one LA: a melee
// attack against the player.
export async function handleLegendaryAction(ctx) {
  const { base44, combat_id } = ctx;
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
    if (laRemainingDmg > 0) { // legendary damage is only computed inside `if (hit)`, so dmg>0 here
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