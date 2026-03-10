import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generates a Combat After-Action Report from a CombatLog.
 * Analyzes log_entries for damage dealt/taken, MVPs, and generates
 * a narrative bridge paragraph via LLM.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { combat_id, session_id, character_id } = await req.json();
  if (!combat_id) return Response.json({ error: 'combat_id required' }, { status: 400 });

  // Fetch combat log
  const logs = await base44.asServiceRole.entities.CombatLog.filter({ id: combat_id });
  const combatLog = logs[0];
  if (!combatLog) return Response.json({ error: 'Combat log not found' }, { status: 404 });

  // Fetch session and character for narrative context
  let session = null, character = null;
  if (session_id) {
    const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
    session = sessions[0] || null;
  }
  if (character_id) {
    const chars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
    character = chars[0] || null;
  }

  const entries = combatLog.log_entries || [];
  const combatants = combatLog.combatants || [];
  const result = combatLog.result || 'resolved';
  const totalRounds = combatLog.total_rounds || combatLog.round || 1;

  // ── Stat Aggregation ──
  const actorStats = {}; // { actorName: { damage_dealt, damage_taken, hits, misses, crits, heals, kills } }

  const ensureActor = (name) => {
    if (!actorStats[name]) {
      actorStats[name] = { damage_dealt: 0, damage_taken: 0, hits: 0, misses: 0, crits: 0, heals: 0, kills: 0, spells_cast: 0 };
    }
  };

  for (const entry of entries) {
    if (!entry.actor) continue;
    ensureActor(entry.actor);
    if (entry.target) ensureActor(entry.target);

    if (entry.hit === true) {
      actorStats[entry.actor].hits++;
      if (entry.damage > 0) {
        actorStats[entry.actor].damage_dealt += entry.damage;
        actorStats[entry.target].damage_taken += entry.damage;
      }
      if (entry.heal_amount > 0) {
        actorStats[entry.actor].heals += entry.heal_amount;
      }
      if (entry.critical) actorStats[entry.actor].crits++;
      // Check for kill
      if (entry.text && (entry.text.includes('falls!') || entry.text.includes('falls.'))) {
        actorStats[entry.actor].kills++;
      }
    } else if (entry.hit === false) {
      actorStats[entry.actor].misses++;
    }
    if (entry.action === 'spell') {
      actorStats[entry.actor].spells_cast++;
    }
  }

  // ── Identify player and enemies ──
  const playerCombatant = combatants.find(c => c.type === 'player');
  const enemyCombatants = combatants.filter(c => c.type === 'enemy');
  const playerName = playerCombatant?.name || character?.name || 'Hero';

  const playerStats = actorStats[playerName] || { damage_dealt: 0, damage_taken: 0, hits: 0, misses: 0, crits: 0, heals: 0, kills: 0, spells_cast: 0 };

  // Total damage dealt by all enemies to player
  const totalDamageToPlayer = playerStats.damage_taken;
  const totalDamageByPlayer = playerStats.damage_dealt;
  const playerAccuracy = (playerStats.hits + playerStats.misses) > 0
    ? Math.round((playerStats.hits / (playerStats.hits + playerStats.misses)) * 100) : 0;

  // Enemy MVP (most damage dealt)
  let enemyMvpName = null;
  let enemyMvpDamage = 0;
  for (const e of enemyCombatants) {
    const s = actorStats[e.name];
    if (s && s.damage_dealt > enemyMvpDamage) {
      enemyMvpDamage = s.damage_dealt;
      enemyMvpName = e.name;
    }
  }

  // ── MVP Awards ──
  const mvps = [];
  if (totalDamageByPlayer > 0) {
    mvps.push({ title: 'Damage Dealer', name: playerName, value: `${totalDamageByPlayer} damage dealt`, icon: '⚔️' });
  }
  if (playerStats.crits > 0) {
    mvps.push({ title: 'Critical Striker', name: playerName, value: `${playerStats.crits} critical hit${playerStats.crits > 1 ? 's' : ''}`, icon: '💥' });
  }
  if (playerStats.heals > 0) {
    mvps.push({ title: 'Healer', name: playerName, value: `${playerStats.heals} HP restored`, icon: '💚' });
  }
  if (playerStats.kills > 0) {
    mvps.push({ title: 'Slayer', name: playerName, value: `${playerStats.kills} kill${playerStats.kills > 1 ? 's' : ''}`, icon: '💀' });
  }
  if (enemyMvpName) {
    mvps.push({ title: 'Most Dangerous Foe', name: enemyMvpName, value: `${enemyMvpDamage} damage dealt`, icon: '🩸' });
  }

  // ── Generate Narrative Bridge via LLM ──
  const enemyNames = enemyCombatants.map(e => e.name).join(', ');
  const location = session?.current_location || combatLog.location || 'unknown location';
  const setting = session?.setting || 'High Fantasy';
  const timeOfDay = session?.time_of_day || 'unknown';

  const prompt = `You are a D&D Dungeon Master writing a brief narrative paragraph (3-5 sentences) that bridges the end of a combat encounter back into the ongoing story.

Context:
- Setting: ${setting}
- Location: ${location}
- Time of day: ${timeOfDay}
- Player character: ${playerName} (Level ${character?.level || 1} ${character?.race || ''} ${character?.class || ''})
- Enemies faced: ${enemyNames}
- Combat result: ${result}
- Total rounds: ${totalRounds}
- Player dealt ${totalDamageByPlayer} damage and took ${totalDamageToPlayer} damage
- Player HP after combat: ${playerCombatant?.hp_current || '?'}/${playerCombatant?.hp_max || '?'}
${playerStats.crits > 0 ? `- Player landed ${playerStats.crits} critical hit(s)` : ''}
${result === 'defeat' ? '- The player character fell unconscious' : ''}
${result === 'fled' ? '- The player fled the encounter' : ''}

Write a vivid, atmospheric paragraph that:
1. Describes the immediate aftermath of the battle (bodies, environment, mood)
2. Transitions the scene back to the world (what does the character see/hear/feel now that combat has ended)
3. Subtly hints at what might come next
4. Matches the tone of the combat result (triumphant for victory, grim for defeat, tense for fled)

Write ONLY the narrative paragraph, no headers or labels.`;

  let narrativeBridge = '';
  try {
    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    narrativeBridge = llmResult;
  } catch (e) {
    narrativeBridge = result === 'victory'
      ? `The dust settles over the battlefield at ${location}. ${playerName} stands victorious, though the echoes of steel still ring in the air.`
      : result === 'defeat'
      ? `Darkness closes in as ${playerName} falls. The sounds of battle fade into an eerie silence at ${location}.`
      : `${playerName} escapes into the shadows, heart pounding, leaving ${location} behind.`;
  }

  // ── Persist AAR to CombatLog ──
  const aar = {
    total_damage_dealt: totalDamageByPlayer,
    total_damage_taken: totalDamageToPlayer,
    total_rounds: totalRounds,
    player_accuracy: playerAccuracy,
    crits: playerStats.crits,
    kills: playerStats.kills,
    heals: playerStats.heals,
    spells_cast: playerStats.spells_cast,
    mvps,
    enemy_stats: enemyCombatants.map(e => ({
      name: e.name,
      hp_max: e.hp_max,
      damage_dealt: actorStats[e.name]?.damage_dealt || 0,
      damage_taken: actorStats[e.name]?.damage_taken || 0,
    })),
    narrative_bridge: narrativeBridge,
    result,
  };

  // Save to combat log for future reference
  await base44.asServiceRole.entities.CombatLog.update(combat_id, { after_action_report: aar });

  return Response.json(aar);
});