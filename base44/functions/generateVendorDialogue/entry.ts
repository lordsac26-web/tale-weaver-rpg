import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { vendor_name, vendor_type, vendor_personality, vendor_description, context, item_name, item_description, character_name, character_class, character_gold } = await req.json();

    const contextPrompts = {
      greeting: `Generate a short, immersive greeting (2-3 sentences max) from this vendor when a player enters their shop. Stay strictly in character. Be colorful and personality-driven.`,
      browse:   `The player is browsing. Generate a brief, in-character comment from the vendor noticing them browsing (1-2 sentences). Can be curious, suspicious, welcoming, or quirky.`,
      buy:      `The player just bought "${item_name}" (${item_description}). Generate a short in-character reaction from the vendor (1-2 sentences). Reference the specific item naturally.`,
      sell:     `The player wants to sell "${item_name}". Generate the vendor's in-character response to inspecting this item (1-2 sentences). Reflect their expertise and personality.`,
      haggle_intro: `The player wants to haggle for "${item_name}" (listed at ${item_description}gp). Generate the vendor's opening haggle response (2-3 sentences). Show their personality — reluctant, amused, calculating, etc.`,
      haggle_win: `The player successfully haggled. Generate a short in-character concession speech (1-2 sentences). Vendor sounds mildly annoyed but respects the player's skill.`,
      haggle_fail: `The haggling attempt failed. Generate the vendor's dismissive or amused rejection (1-2 sentences). Stay in character.`,
      no_gold: `The player doesn't have enough gold for "${item_name}". Generate a sympathetic or condescending in-character response (1 sentence).`,
    };

    const prompt = `You are roleplaying as a fantasy RPG vendor with the following details:
Name: ${vendor_name}
Type: ${vendor_type}
Personality: ${vendor_personality}
Shop Description: ${vendor_description}
The player's name is ${character_name || 'the adventurer'}, a ${character_class || 'traveler'} with ${character_gold || 0} gold pieces.

${contextPrompts[context] || contextPrompts.greeting}

Respond ONLY with the vendor's spoken dialogue or narration. No meta-commentary. Keep it under 3 sentences. Use fantasy flavor language appropriate to the vendor's personality and setting.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });

    return Response.json({ dialogue: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});