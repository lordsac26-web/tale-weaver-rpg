import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * handleWildShape — Druid Wild Shape mechanics (PHB p.66-68)
 *
 * Actions:
 *   transform  — Enter Wild Shape, overlaying beast stats onto the character's combatant slot.
 *   revert     — Return to humanoid form, restoring original stats.
 *   check_uses — Return remaining Wild Shape uses without modifying state.
 *
 * Wild Shape Uses (PHB p.66):
 *   Recovers on short or long rest. Max uses = 2 (at level 2+).
 *   Circle of the Moon: can use bonus action (handled on frontend); base rule = action.
 *
 * CR Restrictions (PHB p.66-67):
 *   Level 2: CR 1/4, no flying/swimming speed
 *   Level 4: CR 1/2, no flying speed
 *   Level 8+: CR 1 (full restriction lifted at L8 for base Druid; Moon Circle removes it)
 *
 * Beast stat block fields expected in payload.beast:
 *   name, cr, hp_max, armor_class, speed, fly_speed?, swim_speed?,
 *   strength, dexterity, constitution, wisdom, intelligence, charisma,
 *   damage_dice, attack_bonus, damage_bonus, damage_type,
 *   resistances?, immunities?, vulnerabilities?, conditions_immune?
 *
 * Payload for 'transform': { character_id, action: 'transform', combat_id?, session_id?, beast: {...} }
 * Payload for 'revert':    { character_id, action: 'revert',    combat_id?, session_id? }
 * Payload for 'check_uses':{ character_id, action: 'check_uses' }
 */

// CR as a sortable number for restriction checks
const parseCR = (cr) => {
  if (cr == null) return 0;
  const s = String(cr);
  if (s === '1/8') return 0.125;
  if (s === '1/4') return 0.25;
  if (s === '1/2') return 0.5;
  return parseFloat(s) || 0;
};

// Max CR a Druid can Wild Shape into given their level (PHB p.66-67 table)
const maxCRForLevel = (level) => {
  if (level >= 8) return 1;
  if (level >= 4) return 0.5;
  return 0.25;
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, character_id, combat_id, session_id, beast } = body;

  if (!character_id) return Response.json({ error: 'character_id is required' }, { status: 400 });

  const character = await base44.entities.Character.get(character_id);
  if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
  if (character.created_by !== user.email) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Only Druids can Wild Shape
  if ((character.class || '').toLowerCase() !== 'druid') {
    return Response.json({ error: 'Only Druids can use Wild Shape (PHB p.66).', invalid: true }, { status: 400 });
  }

  const level = character.level || 1;
  if (level < 2) {
    return Response.json({ error: 'Wild Shape is gained at Druid level 2.', invalid: true }, { status: 400 });
  }

  const isCircleOfMoon = (character.subclass || '').toLowerCase().includes('moon');

  // Current use tracking stored in character.short_rest_abilities.wild_shape_used
  const sra = character.short_rest_abilities || {};
  const usedCount = sra.wild_shape_used || 0;
  const maxUses = 2; // PHB p.66: 2 uses recovered on short or long rest

  // ── check_uses ─────────────────────────────────────────────────────────────
  if (action === 'check_uses') {
    return Response.json({
      uses_remaining: Math.max(0, maxUses - usedCount),
      uses_max: maxUses,
      uses_used: usedCount,
      in_wild_shape: !!(character.short_rest_abilities?.wild_shape_active),
      beast_form: character.short_rest_abilities?.wild_shape_beast || null,
      max_cr: maxCRForLevel(level),
      circle_of_moon: isCircleOfMoon,
    });
  }

  // ── transform ──────────────────────────────────────────────────────────────
  if (action === 'transform') {
    if (!beast) return Response.json({ error: 'beast stat block is required for transform', invalid: true }, { status: 400 });

    // Already in Wild Shape?
    if (sra.wild_shape_active) {
      return Response.json({ error: 'Already in Wild Shape. Revert first before transforming again.', invalid: true }, { status: 400 });
    }

    // Use check
    if (usedCount >= maxUses) {
      return Response.json({ error: `No Wild Shape uses remaining (0/${maxUses}). Rest to recover.`, invalid: true }, { status: 400 });
    }

    // CR restriction check (Circle of Moon: full CR table lifted — PHB p.69)
    const beastCR = parseCR(beast.cr);
    let crCap = maxCRForLevel(level);
    if (isCircleOfMoon) {
      // Circle of the Moon: CR cap = Math.floor(level / 3), min 1
      crCap = Math.max(1, Math.floor(level / 3));
    }
    if (beastCR > crCap) {
      return Response.json({
        error: `CR ${beast.cr} exceeds your Wild Shape limit of CR ${crCap} at Druid level ${level}.`,
        invalid: true,
      }, { status: 400 });
    }

    // Flying/swimming speed restrictions (PHB p.67)
    if (beast.fly_speed && level < 8 && !isCircleOfMoon) {
      return Response.json({ error: 'Cannot assume beast forms with flying speed until Druid level 8.', invalid: true }, { status: 400 });
    }
    if (beast.swim_speed && level < 4 && !isCircleOfMoon) {
      return Response.json({ error: 'Cannot assume beast forms with swimming speed until Druid level 4.', invalid: true }, { status: 400 });
    }

    // Beast HP pool — separate from Druid HP (PHB p.67). Starts at beast's full HP.
    const beastHP = beast.hp_max || 10;

    // Save the original character stats so we can restore them on revert
    const originalSnapshot = {
      hp_current: character.hp_current,
      hp_max: character.hp_max,
      armor_class: character.armor_class,
      speed: character.speed,
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
    };

    // Persist Wild Shape state to the character
    await base44.entities.Character.update(character_id, {
      short_rest_abilities: {
        ...sra,
        wild_shape_used: usedCount + 1,
        wild_shape_active: true,
        wild_shape_beast: beast,
        wild_shape_beast_hp: beastHP,
        wild_shape_original: originalSnapshot,
      },
      // The Druid's own HP is NOT replaced — it is held separately.
      // Beast HP is tracked in wild_shape_beast_hp. When beast HP hits 0,
      // excess damage carries over to Druid HP (PHB p.67).
    });

    // If in active combat, update the combatant's stat block to beast form
    let combatantUpdate = null;
    if (combat_id) {
      const combatLog = await base44.entities.CombatLog.get(combat_id);
      if (combatLog) {
        const updatedCombatants = combatLog.combatants.map(c => {
          if (c.id !== character_id) return c;
          return {
            ...c,
            name: `${character.name} (${beast.name})`,
            hp_current: beastHP,
            hp_max: beastHP,
            ac: beast.armor_class || c.ac,
            speed: beast.speed || c.speed,
            // Beast's physical stats override player's (PHB p.67)
            strength: beast.strength || c.strength,
            dexterity: beast.dexterity || c.dexterity,
            constitution: beast.constitution || c.constitution,
            resistances: beast.resistances || [],
            immunities: beast.immunities || [],
            vulnerabilities: beast.vulnerabilities || [],
            // Combat attack stats
            damage_dice: beast.damage_dice || '1d6',
            attack_bonus: beast.attack_bonus || 3,
            damage_bonus: beast.damage_bonus || 0,
            damage_type: beast.damage_type || 'bludgeoning',
            // Flag for revert
            is_wild_shaped: true,
            wild_shape_beast_name: beast.name,
            // Preserve player identity
            original_character_id: character_id,
            type: 'player',
          };
        });
        const logEntry = {
          round: combatLog.round,
          actor: character.name,
          action: 'wild_shape_transform',
          text: `🐾 ${character.name} uses Wild Shape, transforming into a ${beast.name}! (HP: ${beastHP}, AC: ${beast.armor_class || '?'})`,
        };
        await base44.entities.CombatLog.update(combat_id, {
          combatants: updatedCombatants,
          log_entries: [...(combatLog.log_entries || []), logEntry],
        });
        combatantUpdate = { beast_name: beast.name, beast_hp: beastHP };
      }
    }

    return Response.json({
      success: true,
      action: 'transform',
      beast_name: beast.name,
      beast_hp: beastHP,
      beast_ac: beast.armor_class,
      uses_remaining: maxUses - (usedCount + 1),
      uses_max: maxUses,
      combatant_updated: !!combatantUpdate,
      message: `${character.name} transforms into a ${beast.name}! Beast HP: ${beastHP}. Druid HP is preserved.`,
    });
  }

  // ── revert ─────────────────────────────────────────────────────────────────
  if (action === 'revert') {
    if (!sra.wild_shape_active) {
      return Response.json({ error: 'Not currently in Wild Shape.', invalid: true }, { status: 400 });
    }

    const original = sra.wild_shape_original || {};
    const druidHP = Math.max(0, original.hp_current || character.hp_current || 1);

    // Restore original character stats
    await base44.entities.Character.update(character_id, {
      hp_current: druidHP,
      short_rest_abilities: {
        ...sra,
        wild_shape_active: false,
        wild_shape_beast: null,
        wild_shape_beast_hp: 0,
        wild_shape_original: null,
      },
    });

    // If in active combat, restore combatant to humanoid stats
    if (combat_id) {
      const combatLog = await base44.entities.CombatLog.get(combat_id);
      if (combatLog) {
        const beastName = sra.wild_shape_beast?.name || 'beast form';
        const updatedCombatants = combatLog.combatants.map(c => {
          if (c.id !== character_id) return c;
          return {
            ...c,
            name: character.name,
            hp_current: druidHP,
            hp_max: original.hp_max || character.hp_max,
            ac: original.armor_class || character.armor_class,
            speed: original.speed || character.speed,
            strength: original.strength || character.strength,
            dexterity: original.dexterity || character.dexterity,
            constitution: original.constitution || character.constitution,
            resistances: character.resistances || [],
            immunities: character.immunities || [],
            vulnerabilities: character.vulnerabilities || [],
            damage_dice: '1d6',
            is_wild_shaped: false,
            wild_shape_beast_name: null,
            is_conscious: druidHP > 0,
          };
        });
        const logEntry = {
          round: combatLog.round,
          actor: character.name,
          action: 'wild_shape_revert',
          text: `🧙 ${character.name} reverts from ${beastName} back to humanoid form. (Druid HP: ${druidHP})`,
        };
        await base44.entities.CombatLog.update(combat_id, {
          combatants: updatedCombatants,
          log_entries: [...(combatLog.log_entries || []), logEntry],
        });
      }
    }

    return Response.json({
      success: true,
      action: 'revert',
      druid_hp: druidHP,
      message: `${character.name} reverts to humanoid form with ${druidHP} HP.`,
    });
  }

  // ── beast_damage — PHB p.67 carry-over when beast HP hits 0 ───────────────
  // Called after enemy_turn to reconcile beast HP. If the beast drops to 0,
  // overflow damage carries to Druid HP and form is force-reverted.
  if (action === 'beast_damage') {
    if (!sra.wild_shape_active) {
      return Response.json({ error: 'Not in Wild Shape.', invalid: true }, { status: 400 });
    }

    const dmg = Math.max(0, parseInt(body.incoming_damage) || 0);
    const beastHP = sra.wild_shape_beast_hp || 0;
    const beastRemaining = Math.max(0, beastHP - dmg);
    const overflow = Math.max(0, dmg - beastHP);
    const originalDruidHP = sra.wild_shape_original?.hp_current || 0;
    const druidHP = Math.max(0, originalDruidHP - overflow);

    if (beastRemaining === 0) {
      // Beast felled — force revert with carry-over damage
      const original = sra.wild_shape_original || {};
      await base44.entities.Character.update(character_id, {
        hp_current: druidHP,
        short_rest_abilities: { ...sra, wild_shape_active: false, wild_shape_beast: null, wild_shape_beast_hp: 0, wild_shape_original: null },
      });

      // Update the CombatLog combatant back to humanoid if in combat
      if (combat_id) {
        const combatLog = await base44.entities.CombatLog.get(combat_id);
        if (combatLog) {
          const beastName = sra.wild_shape_beast?.name || 'beast form';
          const updatedCombatants = combatLog.combatants.map(c => {
            if (c.id !== character_id) return c;
            return {
              ...c,
              name: character.name,
              hp_current: druidHP,
              hp_max: original.hp_max || character.hp_max,
              ac: original.armor_class || character.armor_class,
              speed: original.speed || character.speed,
              is_wild_shaped: false,
              wild_shape_beast_name: null,
              is_conscious: druidHP > 0,
            };
          });
          const revertEntry = {
            round: combatLog.round, actor: character.name, action: 'wild_shape_revert',
            text: `💥 ${character.name}'s ${beastName} form collapses from the assault! Reverts to humanoid with ${druidHP} HP${overflow > 0 ? ` (${overflow} overflow damage carried through)` : ''}.`,
          };
          await base44.entities.CombatLog.update(combat_id, {
            combatants: updatedCombatants,
            log_entries: [...(combatLog.log_entries || []), revertEntry],
          });
        }
      }

      return Response.json({ beast_felled: true, druid_hp: druidHP, overflow_damage: overflow, reverted: true });
    }

    // Beast still standing — update beast HP only
    await base44.entities.Character.update(character_id, {
      short_rest_abilities: { ...sra, wild_shape_beast_hp: beastRemaining },
    });
    return Response.json({ beast_felled: false, beast_hp_remaining: beastRemaining, druid_hp: originalDruidHP });
  }

  return Response.json({ error: 'action must be transform | revert | check_uses | beast_damage', invalid: true }, { status: 400 });
});