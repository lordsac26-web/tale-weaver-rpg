import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { npc_id, player_message, character_id, session_id } = await req.json();

    if (!npc_id || !player_message || !character_id) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch NPC data
    const npc = await base44.entities.NPC.get(npc_id);
    if (!npc) {
      return Response.json({ error: 'NPC not found' }, { status: 404 });
    }

    // Fetch player character
    const character = await base44.entities.Character.get(character_id);
    if (!character) {
      return Response.json({ error: 'Character not found' }, { status: 404 });
    }

    // Fetch active session if provided
    let sessionContext = '';
    if (session_id) {
      const session = await base44.entities.GameSession.get(session_id);
      if (session) {
        sessionContext = `
Current quest context:
- Location: ${session.current_location || 'unknown'}
- Active quests: ${(session.active_quests || []).map(q => q.title || q.name).join(', ') || 'none'}
- Session chapter: ${session.chapter || 1}
- World state flags: ${JSON.stringify(session.plot_flags || {})}
`;
      }
    }

    // Build personality profile
    const personalityProfile = `
NPC Profile:
- Name: ${npc.name}${npc.title ? ` (${npc.title})` : ''}
- Race: ${npc.race || 'unknown'}
- Occupation: ${npc.occupation || 'commoner'}
- Alignment: ${npc.alignment}
- Personality Archetype: ${npc.personality_archetype}
- Personality Traits: ${npc.personality_traits || 'standard behavior'}
- Voice/Speech Style: ${npc.voice_style || 'casual'}
- Current Mood: ${npc.current_mood}
- Relationship with player: ${npc.relationship_with_player}/100 (${
  npc.relationship_with_player > 50 ? 'friendly ally' :
  npc.relationship_with_player > 10 ? 'acquaintance' :
  npc.relationship_with_player < -50 ? 'hostile enemy' :
  npc.relationship_with_player < -10 ? 'distrustful' : 'neutral'
})
${npc.backstory ? `- Backstory: ${npc.backstory}` : ''}
${npc.known_information?.length > 0 ? `- Known topics: ${npc.known_information.join(', ')}` : ''}
`;

    // Build player context
    const playerContext = `
Player Character:
- Name: ${character.name}
- Race: ${character.race}, Class: ${character.class} (Level ${character.level})
- Alignment: ${character.alignment || 'unknown'}
- Background: ${character.background || 'unknown'}
- Reputation: ${character.reputation || 0}
`;

    // Check for quest availability
    const questContext = npc.quest_giver && npc.available_quests?.length > 0
      ? `\n${npc.name} has quests available: ${npc.available_quests.join(', ')}`
      : '';

    // Recent dialogue context
    const recentDialogue = (npc.dialogue_history || [])
      .slice(-3)
      .map(d => `[${d.timestamp}] Player: "${d.player_message}" | NPC: "${d.npc_response}"`)
      .join('\n');

    const conversationHistory = recentDialogue 
      ? `\nRecent conversation:\n${recentDialogue}\n`
      : '';

    // Construct AI prompt
    const systemPrompt = `You are roleplaying as ${npc.name}, an NPC in a Dungeons & Dragons 5th Edition campaign.

${personalityProfile}

${playerContext}

${sessionContext}

${questContext}

${conversationHistory}

CRITICAL INSTRUCTIONS:
1. Stay completely in character as ${npc.name}
2. Match the personality archetype "${npc.personality_archetype}" and speak in a ${npc.voice_style || 'natural'} manner
3. Reflect current mood: ${npc.current_mood}
4. Respond based on relationship level (${npc.relationship_with_player}/100)
5. Consider alignment differences: you are ${npc.alignment}, player is ${character.alignment || 'unknown'}
6. Keep responses 2-4 sentences, immersive and in-character
7. Reference known information and backstory when relevant
8. DO NOT break character or narrate actions
9. Respond directly as the NPC speaking to ${character.name}

Player says: "${player_message}"

Generate ${npc.name}'s response:`;

    // Call LLM for dialogue generation
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: systemPrompt,
      model: 'claude_sonnet_4_6', // High quality model for nuanced personality
    });

    const npcResponse = typeof response === 'string' ? response : response.output || response.response || 'I have nothing to say.';

    // Update dialogue history
    const updatedHistory = [
      ...(npc.dialogue_history || []).slice(-9), // Keep last 10 exchanges
      {
        timestamp: new Date().toISOString(),
        player_message,
        npc_response: npcResponse,
        character_name: character.name,
      }
    ];

    await base44.asServiceRole.entities.NPC.update(npc_id, {
      dialogue_history: updatedHistory,
    });

    return Response.json({
      npc_response: npcResponse,
      npc_name: npc.name,
      npc_mood: npc.current_mood,
      relationship: npc.relationship_with_player,
    });

  } catch (error) {
    console.error('NPC Dialogue Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});