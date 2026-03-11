import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Combat Engine - handles initiative, turns, damage, conditions
 * All math done server-side referencing DB state
 * 
 * FIXES APPLIED:
 * 1. Wrapped entire handler in try/catch with proper error logging
 * 2. Fixed round advancement bug in enemy_turn (was: nextIndex <= current, now: nextIndex < current_after_wrap)
 * 3. Implemented retreat strategy with actual flee logic + has_fled_attempt flag
 * 4. has_fled_attempt is now written back to the combatant so it only triggers once
 * 5. Fixed duplicate XP award - extracted into a single helper: awardVictoryXP()
 * 6. Fixed next_turn to skip dead combatants
 * 7. Extracted shared turn-advancement logic into advanceTurn() helper
 * 8. Improved variable naming in spell blocks
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, session_id, combat_id, character_id, payload } = await req.json();

    // ─── Dice Helpers ────────────────────────────────────────────────────────
    const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
    const rollD20 = () => Math.floor(Math.random() * 20) + 1;
    const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

    const rollDiceExpression = (diceStr, critical = false) => {
      const match = diceStr.match(/^(\d+)d(\d+)$/);
      if (!match) return 0;
      const numDice = critical ? parseInt(match[1]) * 2 : parseInt(match[1]);
      const sides = parseInt(match[2]);
      let total = 0;
      for (let i = 0; i < numDice; i++) total += rollDice(sides);
      return total;
    };

    // ─── Shared: Determine actions per turn ──────────────────────────────────
    const getActionsPerTurn = (character) => {
      const features = (character.features || []).map(f =>
        (typeof f === 'string' ? f : f.name || '').toLowerCase()
      );
      const charClass = (character.class || '').toLowerCase();
      const level = character.level || 1;
      let actions = 1;
      if (['fighter', 'ranger', 'paladin', 'barbarian', 'monk'].includes(charClass) && level >= 5) actions = 2;
      if (charClass === 'fighter' && level >= 11) actions = 3;
      if (charClass === 'fighter' && level >= 20) actions = 4;
      if (features.some(f => f.includes('extra attack'))) actions = Math.max(actions, 2);
      return actions;
    };

    // ─── Shared: Advance turn index, skipping dead combatants ────────────────
    const advanceTurn = (currentIndex, currentRound, combatants) => {
      let nextIndex = (currentIndex + 1) % combatants.length;
      let nextRound = currentRound;
      if (nextIndex === 0) nextRound += 1; // wrapped around = new round

      // Skip unconscious combatants (with safety cap to avoid infinite loop)
      let safety = 0;
      while (!combatants[nextIndex]?.is_conscious && safety < combatants.length) {
        nextIndex = (nextIndex + 1) % combatants.length;
        if (nextIndex === 0) nextRound += 1;
        safety++;
      }
      return { nextIndex, nextRound };
    };

    // ─── Shared: Award XP on victory (called once, prevents duplicate awards) ─
    const awardVictoryXP = async (characterId, combatants) => {
      const totalXP = combatants
        .filter(c => c.type === 'enemy')
        .reduce((sum, e) => sum + (e.xp || 0), 0);
      if (totalXP === 0) return totalXP;
      const chars = await base44.asServiceRole.entities.Character.filter({ id: characterId });
      const character = chars[0];
      if (character) {
        await base44.asServiceRole.entities.Character.update(characterId, {
          xp: (character.xp || 0) + totalXP
        });
      }
      return totalXP;
    };

    // ─── Shared: Resolve combat end (victory/defeat) ──────────────────────────
    const resolveCombatEnd = async (result, sessionId, combatId, characterId, updatedCombatants) => {
      await base44.asServiceRole.entities.GameSession.update(sessionId, { in_combat: false });
      await base44.asServiceRole.entities.CombatLog.update(combatId, {
        is_active: false,
        result
      });
      let xpAwarded = 0;
      if (result === 'victory') {
        xpAwarded = await awardVictoryXP(characterId, updatedCombatants);
      }
      return xpAwarded;
    };

    // =========================================================================
    // ACTION: start_combat
    // =========================================================================
    if (action === 'start_combat') {
      const { enemies } = payload;
      const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
      const session = sessions[0];
      const chars = await base44.asServiceRole.entities.Character.filter({ id: session.character_id });
      const character = chars[0];

      const combatants = [];

      // Player initiative
      const playerInitRoll = rollD20();
      const playerInitMod = statMod(character.dexterity) + (character.initiative || 0);
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
        conditions: character.conditions || [],
        is_conscious: true
      });

      // Enemy initiatives
      for (const enemy of enemies) {
        const initRoll = rollD20();
        const initMod = statMod(enemy.dexterity || 10);
        combatants.push({
          id: `enemy_${Math.random().toString(36).substr(2, 9)}`,
          name: enemy.name,
          type: 'enemy',
          initiative_roll: initRoll,
          initiative_mod: initMod,
          initiative_total: initRoll + initMod,
          hp_current: enemy.hp,
          hp_max: enemy.hp,
          ac: enemy.ac || 12,
          attack_bonus: enemy.attack_bonus || 3,
          damage_dice: enemy.damage_dice || '1d6',
          damage_bonus: enemy.damage_bonus || 2,
          conditions: [],
          is_conscious: true,
          has_fled_attempt: false, // FIX #4: initialize flee flag
          cr: enemy.cr || 1,
          xp: enemy.xp || 100
        });
      }

      combatants.sort((a, b) => {
        if (b.initiative_total !== a.initiative_total) return b.initiative_total - a.initiative_total;
        return b.initiative_mod - a.initiative_mod;
      });

      const combatLog = await base44.asServiceRole.entities.CombatLog.create({
        session_id,
        round: 1,
        combatants,
        initiative_order: combatants.map(c => ({
          id: c.id,
          name: c.name,
          initiative_value: c.initiative_total,
          initiative: c.initiative_total
        })),
        current_turn_index: 0,
        log_entries: [{
          round: 1,
          text: `⚔️ Combat begins! Initiative: ${combatants.map(c => `${c.name} (${c.initiative_total})`).join(' → ')}`
        }],
        is_active: true,
        result: 'ongoing',
        world_state: { actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false }
      });

      await base44.asServiceRole.entities.GameSession.update(session_id, {
        in_combat: true,
        combat_state: { combat_id: combatLog.id }
      });

      return Response.json({ combat_id: combatLog.id, combatants, initiative_order: combatants });
    }

    // =========================================================================
    // ACTION: player_attack
    // =========================================================================
    if (action === 'player_attack') {
      const { target_id, weapon, spell } = payload;
      const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
      const combatLog = logs[0];
      const chars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
      const character = chars[0];

      const combatants = [...combatLog.combatants];
      const target = combatants.find(c => c.id === target_id);
      if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

      let attackRoll = rollD20();
      let attackMod = 0;
      let damageDice = '1d6';
      let damageBonus = 0;
      let attackType = 'melee';
      const isCritical = attackRoll === 20;
      const isMiss = attackRoll === 1;

      // ── Spell attacks ──────────────────────────────────────────────────────
      if (spell) {
        const spellAbilityMap = {
          wizard: 'intelligence', eldritch_knight: 'intelligence', arcane_trickster: 'intelligence',
          cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
          bard: 'charisma', paladin: 'charisma', sorcerer: 'charisma', warlock: 'charisma'
        };
        const spellAbility = spellAbilityMap[(character.class || '').toLowerCase()] || 'intelligence';
        const spellStatMod = statMod(character[spellAbility]);
        const profBonus = character.proficiency_bonus || 2;
        const spellSaveDC = 8 + spellStatMod + profBonus;
        const spellAttackBonus = spellStatMod + profBonus;

        attackMod = spellAttackBonus;
        damageDice = spell.damage_dice || '2d6';
        damageBonus = 0;
        attackType = spell.attack_type || 'ranged_spell_attack';

        // Handle upcasting
        const slotLevel = spell.slot_level || spell.base_level || 1;
        const baseLevel = spell.base_level || 1;
        if (slotLevel > baseLevel && damageDice && damageDice !== '0') {
          const upcastMatch = damageDice.match(/^(\d+)d(\d+)$/);
          if (upcastMatch) {
            const extraLevels = slotLevel - baseLevel;
            damageDice = `${parseInt(upcastMatch[1]) + extraLevels}d${upcastMatch[2]}`;
          }
        }

        // Consume spell slot
        if (spell.slot_level && spell.slot_level > 0) {
          const slotsKey = `level_${spell.slot_level}`;
          const currentUsed = (character.spell_slots || {})[slotsKey] || 0;
          await base44.asServiceRole.entities.Character.update(character_id, {
            spell_slots: { ...(character.spell_slots || {}), [slotsKey]: currentUsed + 1 }
          });
        }

        // ── Utility spells ──────────────────────────────────────────────────
        if (spell.is_utility) {
          const utilEntry = {
            round: combatLog.round, actor: character.name, action: 'spell',
            target: target.name, hit: null,
            text: `${character.name} casts ${spell.name}!`,
            spell_name: spell.name, is_utility: true
          };

          const actionsPerTurn = getActionsPerTurn(character);
          const actionsUsed = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
          const actionsRemaining = actionsPerTurn - actionsUsed;
          let worldState = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed };
          let nextIndex = combatLog.current_turn_index;
          let nextRound = combatLog.round;

          if (actionsRemaining <= 0) {
            ({ nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants));
            worldState.actions_used_this_turn = 0;
          }

          await base44.asServiceRole.entities.CombatLog.update(combat_id, {
            log_entries: [...(combatLog.log_entries || []), utilEntry],
            current_turn_index: nextIndex, round: nextRound, world_state: worldState
          });

          return Response.json({
            hit: null, damage: 0, log_entry: utilEntry, result: 'ongoing',
            combat_ended: false, actions_remaining: actionsRemaining, next_turn_index: nextIndex
          });
        }

        // ── Healing spells ──────────────────────────────────────────────────
        if (spell.attack_type === 'healing' && spell.heal_dice) {
          let healAmt = rollDiceExpression(spell.heal_dice || '1d8');
          healAmt += spellStatMod;

          const player = combatants.find(c => c.type === 'player');
          if (player) {
            player.hp_current = Math.min(player.hp_max, player.hp_current + healAmt);
            await base44.asServiceRole.entities.Character.update(character_id, { hp_current: player.hp_current });
          }

          const healEntry = {
            round: combatLog.round, actor: character.name, action: 'spell',
            target: character.name, hit: true,
            text: `${character.name} casts ${spell.name}! Restores ${healAmt} HP.`,
            spell_name: spell.name, heal_amount: healAmt
          };

          const updatedCombatants = combatants.map(c => c.type === 'player' ? player : c);
          const actionsPerTurn = getActionsPerTurn(character);
          const actionsUsed = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
          const actionsRemaining = actionsPerTurn - actionsUsed;
          let worldState = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed };
          let nextIndex = combatLog.current_turn_index;
          let nextRound = combatLog.round;

          if (actionsRemaining <= 0) {
            ({ nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants));
            worldState.actions_used_this_turn = 0;
          }

          await base44.asServiceRole.entities.CombatLog.update(combat_id, {
            combatants: updatedCombatants,
            log_entries: [...(combatLog.log_entries || []), healEntry],
            current_turn_index: nextIndex, round: nextRound, world_state: worldState
          });

          return Response.json({
            hit: true, damage: 0, heal_amount: healAmt, log_entry: healEntry,
            result: 'ongoing', combat_ended: false,
            actions_remaining: actionsRemaining, next_turn_index: nextIndex
          });
        }

        // ── Saving throw spells ─────────────────────────────────────────────
        if (spell.attack_type === 'saving_throw' && spell.save_type) {
          const targetSaveStat = target[spell.save_type] || target.save_stats?.[spell.save_type] || 10;
          const targetSaveMod = statMod(targetSaveStat);
          const saveRoll = rollD20();
          const saveTotal = saveRoll + targetSaveMod;
          const saveFailed = saveTotal < spellSaveDC;

          let rawDamage = rollDiceExpression(damageDice);
          const finalDmg = saveFailed ? rawDamage : Math.floor(rawDamage / 2);

          if (finalDmg > 0) {
            target.hp_current = Math.max(0, target.hp_current - finalDmg);
            if (target.hp_current === 0) target.is_conscious = false;
          }

          const saveEntry = {
            round: combatLog.round, actor: character.name, action: 'spell',
            target: target.name, hit: saveFailed, spell_name: spell.name,
            text: `${character.name} casts ${spell.name}! DC${spellSaveDC} ${spell.save_type} save: ${target.name} rolled ${saveTotal} — ${saveFailed ? 'FAILED' : 'success'}. Takes ${finalDmg} ${spell.damage_type || ''} damage.${target.hp_current === 0 ? ` ${target.name} falls!` : ''}`
          };

          const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
          const allEnemiesDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
          const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
          const result = allEnemiesDead ? 'victory' : playerDead ? 'defeat' : 'ongoing';

          const actionsPerTurn = getActionsPerTurn(character);
          const actionsUsed = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
          const actionsRemaining = actionsPerTurn - actionsUsed;
          let worldState = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed };
          let nextIndex = combatLog.current_turn_index;
          let nextRound = combatLog.round;

          if (result !== 'ongoing' || actionsRemaining <= 0) {
            if (result === 'ongoing') {
              ({ nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants));
            }
            worldState.actions_used_this_turn = 0;
          }

          await base44.asServiceRole.entities.CombatLog.update(combat_id, {
            combatants: updatedCombatants,
            log_entries: [...(combatLog.log_entries || []), saveEntry],
            current_turn_index: nextIndex, round: nextRound,
            world_state: worldState, is_active: result === 'ongoing', result
          });

          // FIX #5: single XP award path
          let xpAwarded = 0;
          if (result !== 'ongoing') {
            xpAwarded = await resolveCombatEnd(result, session_id, combat_id, character_id, updatedCombatants);
          }

          return Response.json({
            hit: saveFailed, damage: finalDmg, log_entry: saveEntry, result,
            combat_ended: result !== 'ongoing', xp_awarded: xpAwarded,
            actions_remaining: Math.max(0, actionsRemaining), next_turn_index: nextIndex
          });
        }
        // Fall through to standard attack roll for melee/ranged spell attacks
      }

      // ── Weapon attacks ─────────────────────────────────────────────────────
      if (weapon) {
        const isRanged = weapon.type === 'ranged';
        const isFinesse = (weapon.properties || []).includes('finesse');
        const strMod = statMod(character.strength);
        const dexMod = statMod(character.dexterity);
        const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
        const profBonus = character.proficiency_bonus || 2;
        attackMod = abilityMod + profBonus + (weapon.attack_bonus || 0);
        damageBonus = abilityMod + (weapon.damage_bonus || 0);
        damageDice = weapon.damage_dice || '1d8';
        attackType = isRanged ? 'ranged' : 'melee';
      }

      // Apply active modifiers
      for (const mod of (character.active_modifiers || [])) {
        if (mod.applies_to === 'attack' || mod.applies_to === 'all') attackMod += mod.value;
        if (mod.applies_to === 'damage') damageBonus += mod.value;
      }

      // Condition penalties
      const conditions = (character.conditions || []).map(c => c.name || c);
      if (conditions.includes('poisoned')) attackMod -= 2;

      const totalAttack = attackRoll + attackMod;
      const hit = !isMiss && (isCritical || totalAttack >= target.ac);

      let damage = 0;
      let damageRolls = [];
      const isSpellAttack = !!spell;
      const logEntry = {
        round: combatLog.round, actor: character.name,
        action: isSpellAttack ? 'spell' : 'attack',
        target: target.name, spell_name: spell?.name || null
      };

      if (hit) {
        damage = rollDiceExpression(damageDice, isCritical) + damageBonus;
        damage = Math.max(0, damage);
        target.hp_current = Math.max(0, target.hp_current - damage);
        if (target.hp_current === 0) target.is_conscious = false;

        const actionLabel = spell ? `casts ${spell.name} at` : (isCritical ? 'CRITICALLY strikes' : 'hits');
        logEntry.hit = true;
        logEntry.critical = isCritical;
        logEntry.attack_roll = totalAttack;
        logEntry.damage = damage;
        logEntry.text = `${character.name} ${actionLabel} ${target.name} for ${damage} ${spell?.damage_type || ''} damage! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`;
      } else {
        const missLabel = spell ? `${spell.name} misses` : 'misses';
        logEntry.hit = false;
        logEntry.attack_roll = totalAttack;
        logEntry.text = `${character.name} ${missLabel} ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})`;
      }

      const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
      const allEnemiesDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
      const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
      const result = allEnemiesDead ? 'victory' : playerDead ? 'defeat' : 'ongoing';

      const actionsPerTurn = getActionsPerTurn(character);
      const actionsUsed = (combatLog.world_state?.actions_used_this_turn || 0) + 1;
      const actionsRemaining = actionsPerTurn - actionsUsed;
      let worldState = { ...(combatLog.world_state || {}), actions_used_this_turn: actionsUsed };
      let nextIndex = combatLog.current_turn_index;
      let nextRound = combatLog.round;

      if (result !== 'ongoing' || actionsRemaining <= 0) {
        if (result === 'ongoing') {
          ({ nextIndex, nextRound } = advanceTurn(combatLog.current_turn_index, combatLog.round, updatedCombatants));
        }
        worldState.actions_used_this_turn = 0;
      }

      await base44.asServiceRole.entities.CombatLog.update(combat_id, {
        combatants: updatedCombatants,
        log_entries: [...(combatLog.log_entries || []), logEntry],
        current_turn_index: nextIndex, round: nextRound,
        world_state: worldState, is_active: result === 'ongoing', result
      });

      // FIX #5: single XP award path
      let xpAwarded = 0;
      if (result !== 'ongoing') {
        xpAwarded = await resolveCombatEnd(result, session_id, combat_id, character_id, updatedCombatants);
      }

      return Response.json({
        hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack,
        log_entry: logEntry, target_hp: target.hp_current, result,
        combat_ended: result !== 'ongoing', xp_awarded: xpAwarded,
        next_turn_index: nextIndex,
        actions_remaining: Math.max(0, actionsRemaining),
        actions_per_turn: actionsPerTurn
      });
    }

    // =========================================================================
    // ACTION: enemy_turn
    // =========================================================================
    if (action === 'enemy_turn') {
      const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
      const combatLog = logs[0];
      const combatants = [...combatLog.combatants];

      const currentCombatant = combatants[combatLog.current_turn_index];
      if (!currentCombatant || currentCombatant.type !== 'enemy' || !currentCombatant.is_conscious) {
        return Response.json({ skipped: true });
      }

      const player = combatants.find(c => c.type === 'player' && c.is_conscious);
      if (!player) return Response.json({ no_target: true });

      // ── AI Strategy ─────────────────────────────────────────────────────
      const enemyHpPct = currentCombatant.hp_max
        ? currentCombatant.hp_current / currentCombatant.hp_max : 1;
      const playerHpPct = player.hp_max ? player.hp_current / player.hp_max : 1;
      const cr = currentCombatant.cr || 1;
      const isBoss = cr >= 5;
      const isElite = cr >= 3;

      let strategy = 'attack';
      let strategyDesc = null;

      if (enemyHpPct < 0.25 && !currentCombatant.has_fled_attempt) {
        if (isBoss) {
          strategy = 'multiattack';
          strategyDesc = 'fights with desperate fury!';
        } else if (cr < 2 && Math.random() < 0.4) {
          // FIX #3: retreat is now actually implemented
          strategy = 'retreat';
          strategyDesc = 'attempts to flee from combat!';
        } else {
          strategy = 'reckless_attack';
          strategyDesc = 'attacks recklessly in desperation!';
        }
      } else if (playerHpPct < 0.3) {
        strategy = 'press_advantage';
        strategyDesc = 'presses the advantage against the weakened hero!';
      } else if (isBoss && combatLog.round <= 1) {
        strategy = 'intimidate_then_attack';
        strategyDesc = 'sizes up the hero with cold calculation...';
      } else if (isElite && Math.random() < 0.3) {
        strategy = 'tactical_strike';
        strategyDesc = 'uses a tactical strike!';
      } else if (Math.random() < 0.15) {
        strategy = 'defensive_stance';
        strategyDesc = 'takes a defensive stance before attacking!';
      }

      // FIX #3: Retreat — enemy disengages and is removed from combat
      if (strategy === 'retreat') {
        // Mark the enemy as having fled (remove from active combatants)
        const updatedCombatants = combatants.map(c =>
          c.id === currentCombatant.id
            ? { ...c, is_conscious: false, has_fled: true, has_fled_attempt: true } // FIX #4: write flag back
            : c
        );

        const fleeEntry = {
          round: combatLog.round,
          actor: currentCombatant.name,
          action: 'retreat',
          target: null,
          hit: false,
          text: `${currentCombatant.name} breaks away and flees the battle!`
        };

        // Check if all remaining enemies are gone after the flee
        const allEnemiesGone = updatedCombatants
          .filter(c => c.type === 'enemy')
          .every(c => !c.is_conscious);
        const result = allEnemiesGone ? 'victory' : 'ongoing';

        const { nextIndex, nextRound } = advanceTurn(
          combatLog.current_turn_index, combatLog.round, updatedCombatants
        );

        await base44.asServiceRole.entities.CombatLog.update(combat_id, {
          combatants: updatedCombatants,
          log_entries: [...(combatLog.log_entries || []), fleeEntry],
          current_turn_index: nextIndex,
          round: nextRound,
          world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0 },
          is_active: result === 'ongoing',
          result
        });

        let xpAwarded = 0;
        if (result !== 'ongoing') {
          // No XP for enemies that flee (they escaped)
          await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false });
        }

        return Response.json({
          log_entry: fleeEntry,
          player_hp: player.hp_current,
          player_dead: false,
          next_turn_index: nextIndex,
          round: nextRound,
          ai_strategy: strategy,
          enemy_fled: true,
          result
        });
      }

      // ── Normal attack execution ──────────────────────────────────────────
      let attackBonus = currentCombatant.attack_bonus || 3;
      let numAttacks = 1;
      let bonusDamage = 0;

      if (strategy === 'reckless_attack') { attackBonus += 3; bonusDamage += 2; }
      else if (strategy === 'press_advantage') { attackBonus += 2; bonusDamage += 1; }
      else if (strategy === 'multiattack') { numAttacks = isBoss ? 3 : 2; }
      else if (strategy === 'tactical_strike') { attackBonus += 1; bonusDamage += Math.floor(cr); }
      else if (strategy === 'defensive_stance') { attackBonus -= 2; }

      let totalDamage = 0;
      let anyHit = false;
      let isCritical = false;
      const attackLogs = [];

      for (let atk = 0; atk < numAttacks; atk++) {
        const attackRoll = rollD20();
        const totalAttack = attackRoll + attackBonus;
        const isCrit = attackRoll === 20;
        const isFumble = attackRoll === 1;
        const hit = !isFumble && (isCrit || totalAttack >= player.ac);
        if (isCrit) isCritical = true;

        if (hit) {
          anyHit = true;
          let dmg = rollDiceExpression(currentCombatant.damage_dice || '1d6', isCrit);
          dmg += (currentCombatant.damage_bonus || 0) + bonusDamage;
          dmg = Math.max(1, dmg);
          totalDamage += dmg;
          attackLogs.push(`${isCrit ? '💥 CRITICAL! ' : ''}${currentCombatant.name} hits for ${dmg} dmg (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${player.ac})`);
        } else {
          attackLogs.push(`${currentCombatant.name} misses (${attackRoll}+${attackBonus}=${totalAttack} vs AC ${player.ac})`);
        }
      }

      if (totalDamage > 0) {
        player.hp_current = Math.max(0, player.hp_current - totalDamage);
        if (player.hp_current === 0) player.is_conscious = false;
        await base44.asServiceRole.entities.Character.update(player.id, { hp_current: player.hp_current });
      }

      let logText = strategyDesc ? `[${currentCombatant.name} ${strategyDesc}] ` : '';
      if (anyHit) {
        logText += `${attackLogs.join('; ')}. ${player.name} takes ${totalDamage} total damage! (${player.hp_current}/${player.hp_max} HP)`;
        if (!player.is_conscious) logText += ` ${player.name} falls!`;
      } else {
        logText += `${currentCombatant.name} attacks but misses ${player.name}! (${attackLogs.join('; ')})`;
      }

      const logEntry = {
        round: combatLog.round, actor: currentCombatant.name,
        action: strategy, target: player.name,
        hit: anyHit, critical: isCritical, damage: totalDamage,
        ai_strategy: strategyDesc, text: logText
      };

      // FIX #2: use advanceTurn helper for correct round counting
      const updatedCombatants = combatants.map(c => c.id === player.id ? player : c);
      const { nextIndex, nextRound } = advanceTurn(
        combatLog.current_turn_index, combatLog.round, updatedCombatants
      );

      await base44.asServiceRole.entities.CombatLog.update(combat_id, {
        combatants: updatedCombatants,
        log_entries: [...(combatLog.log_entries || []), logEntry],
        current_turn_index: nextIndex,
        round: nextRound,
        world_state: { ...(combatLog.world_state || {}), actions_used_this_turn: 0 }
      });

      const playerDead = !player.is_conscious;
      if (playerDead) {
        await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false });
        await base44.asServiceRole.entities.CombatLog.update(combat_id, { is_active: false, result: 'defeat' });
      }

      return Response.json({
        log_entry: logEntry, player_hp: player.hp_current,
        player_dead: playerDead, next_turn_index: nextIndex,
        round: nextRound, ai_strategy: strategy
      });
    }

    // =========================================================================
    // ACTION: next_turn
    // FIX #6: now skips dead combatants
    // =========================================================================
    if (action === 'next_turn') {
      const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
      const combatLog = logs[0];

      const { nextIndex, nextRound } = advanceTurn(
        combatLog.current_turn_index, combatLog.round, combatLog.combatants
      );

      await base44.asServiceRole.entities.CombatLog.update(combat_id, {
        current_turn_index: nextIndex,
        round: nextRound
      });

      return Response.json({
        next_turn_index: nextIndex,
        round: nextRound,
        current_combatant: combatLog.combatants[nextIndex]
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    // FIX #1: top-level error handling
    console.error('combatEngine error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
});