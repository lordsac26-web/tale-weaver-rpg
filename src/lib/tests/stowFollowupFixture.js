export const quotedStowReply = 'the two guards that were killed in the last narration that i just investigated.';
export async function createStowFollowupFixture(base44, mode, variant, tracked) {
  const tag = `StowFollowupQA_${Date.now()}_${mode}_${variant}_${Math.random().toString(36).slice(2, 7)}`;
  const make = async (entity, values) => { const record = await base44.entities[entity].create(values); tracked.push({ entity, id: record.id }); return record; };
  const body = name => ({ name, quantity: 1, category: 'Corpse', alive: false, status: 'dead', weight: 110, volume_cubic_ft: 7, dimensions_ft: { width: 1.5, height: 1 }, is_identified: true });
  const character = await make('Character', { name: tag, race: 'Human', class: 'Ranger', level: 5, is_active: false, roll_mode: mode, hp_current: 40, hp_max: 40, xp: 15000,
    spell_slots: { level_2: 1 }, inventory: [{ name: 'Bag of Holding', quantity: 1, capacity_weight_lb: 500, capacity_volume_cubic_ft: 64, opening_width_ft: 2 }, { name: 'Arrows', quantity: 8 }], stowed_items: [], active_modifiers: [{ id: 'fixture-pwt', name: 'Pass without Trace', bonus: 10, concentration: true }], conditions: [{ name: 'Stealthed' }] });
  const session = await make('GameSession', { character_id: character.id, title: tag, is_active: false, in_combat: false, current_location: 'Maintenance tunnel', world_state: {} });
  const combat = await make('CombatLog', { session_id: session.id, character_id: character.id, location: session.current_location, is_active: false, result: 'victory', combatants: [1, 2].map(n => ({ ...body(`Cultist Guard ${n}`), id: `fixture-guard-${n}`, type: 'enemy', hp_current: 0, is_conscious: false, status: variant === 'missing-death' && n === 2 ? 'unverified' : 'dead' })) });
  await make('CombatLog', { session_id: session.id, character_id: character.id, location: session.current_location, is_active: false, result: 'victory', combatants: [{ ...body('Another Guard'), id: 'other-guard', type: 'enemy', hp_current: 0, is_conscious: false }] });
  const historical = { ...body('Ritual Overseer Corpse'), container: 'Bag of Holding', stow_request_id: `${tag}:older`, death_provenance: { combat_id: `${tag}:old`, combatant_id: 'old-overseer', enemy_name: 'Ritual Overseer', status: 'dead', hp: 0 } };
  const stowed = [historical];
  if (variant === 'already-stowed') stowed.push(...[1, 2].map(n => ({ ...body(`Cultist Guard ${n}'s Corpse`), container: 'Bag of Holding', stow_request_id: `${tag}:prior`, death_provenance: { combat_id: combat.id, combatant_id: `fixture-guard-${n}`, enemy_name: `Cultist Guard ${n}`, status: 'dead', hp: 0 } })));
  await base44.entities.Character.update(character.id, { stowed_items: stowed });
  const killId = `${tag}:kill`, sourceId = `${tag}:investigation`, requestId = `${tag}:stow`, action = 'stealthily put the two corpses in the bag of holding';
  const receipt = { id: requestId, request_id: requestId, source_story_request_id: sourceId, action_text: action, skill: 'Stealth', dc: 14, raw_d20: 14, all_rolls: [14], modifier_total: 17, final_total: 31, success: true, unified_story_skill_resolution: true, roll_origin: mode, at: new Date().toISOString() };
  const choices = ['Press deeper into the tunnel.', 'Listen at the junction.', 'Inspect the wall.', 'Watch the passage.'].map(text => ({ text, action_type: 'utility' }));
  const investigation = { request_id: sourceId, text: 'The two guards lie dead. You investigate them and find no logistical intel. The older bodies remain in your bag.', player_choice: 'Scavenge the fallen guards for logistical intel.', skill_check: { skill: 'Investigation', success: false, final_total: 3, dc: 14 }, choices, mechanics_status: 'complete' };
  const canonical = { request_id: sourceId, text: investigation.text, choices, skill_check: investigation.skill_check };
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical))))).map(x => x.toString(16).padStart(2, '0')).join('');
  investigation.choice_evidence = { response_payload_hash: hash };
  const kill = { request_id: killId, text: 'The two cultists collapse dead in the maintenance tunnel.', choices, authoritative_weapon_attack: { combat_id: combat.id } };
  if (variant === 'narrative-only') delete kill.authoritative_weapon_attack;
  await base44.entities.GameSession.update(session.id, { story_log: [kill, investigation], world_state: { __skill_check_receipts: [receipt] } });
  return { sessionId: session.id, characterId: character.id, sourceId, requestId, action, receipt, hash, combatId: combat.id };
}