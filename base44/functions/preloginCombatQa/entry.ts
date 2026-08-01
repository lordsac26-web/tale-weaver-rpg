import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { handleEnemyTurn } from '../../shared/combat/enemyTurn.ts';
import { handleDeathSave } from '../../shared/combat/turnActions.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const created = { characters: [], sessions: [], logs: [] };
  const originalRandom = Math.random;
  try {
    const makeCharacter = async (name: string, hp: number) => {
      const c = await base44.asServiceRole.entities.Character.create({
        name, class: 'Ranger', race: 'Human', level: 5,
        hp_current: hp, hp_max: 44, armor_class: 16,
        strength: 12, dexterity: 18, constitution: 14,
        intelligence: 10, wisdom: 16, charisma: 10,
        proficiency_bonus: 3, conditions: [], active_modifiers: [],
        death_saves_success: 0, death_saves_failure: 0,
      });
      created.characters.push(c.id); return c;
    };
    const makeSession = async (characterId: string, label: string) => {
      const s = await base44.asServiceRole.entities.GameSession.create({
        title: `QA ${label}`, character_id: characterId, is_active: true,
        in_combat: true, combat_state: {}, story_log: [],
      });
      created.sessions.push(s.id); return s;
    };
    const makeLog = async (sessionId: string, combatants: any[]) => {
      const l = await base44.asServiceRole.entities.CombatLog.create({
        session_id: sessionId, is_active: true, result: 'ongoing', round: 1,
        current_turn_index: 0, combatants,
        initiative_order: combatants.map(c => ({ id: c.id, name: c.name, initiative: c.initiative_total })),
        log_entries: [], world_state: { actions_used_this_turn: 0 }, xp_awarded: false,
      });
      created.logs.push(l.id);
      await base44.asServiceRole.entities.GameSession.update(sessionId, { in_combat: true, combat_state: { combat_id: l.id } });
      return l;
    };

    // Test 1: low-CR skeleton remains single-attack and knockout keeps combat linked.
    const c1 = await makeCharacter('QA Prelogin Knockout', 1);
    const s1 = await makeSession(c1.id, 'Knockout');
    const player1 = { id: c1.id, name: c1.name, type: 'player', hp_current: 1, hp_max: 44, ac: 16, is_conscious: true, conditions: [] };
    const skeleton = { id: 'qa_skeleton', name: 'Skeleton', type: 'enemy', hp_current: 16, hp_max: 16, ac: 13, attack_bonus: 5, damage_dice: '1d6', damage_bonus: 2, cr: 0.25, archetype: 'brute', num_attacks: 1, initiative_total: 20, conditions: [], is_conscious: true };
    const l1 = await makeLog(s1.id, [skeleton, player1]);
    Math.random = () => 0.95;
    const knockRes = await handleEnemyTurn({ base44, session_id: s1.id, combat_id: l1.id, character_id: c1.id, payload: {} });
    const knock = await knockRes.json();
    const knockLog = await base44.asServiceRole.entities.CombatLog.get(l1.id);
    const knockSession = await base44.asServiceRole.entities.GameSession.get(s1.id);
    if (!knock.player_at_zero_hp || !knockLog.is_active || !knockSession.in_combat || knockSession.combat_state?.combat_id !== l1.id) {
      throw new Error(`Knockout/link test failed: ${JSON.stringify({ knock, active: knockLog.is_active, session: knockSession.combat_state })}`);
    }
    if (!String(knock.log_entry?.action || '').startsWith('soldier:')) throw new Error(`Skeleton was not re-inferred safely: ${knock.log_entry?.action}`);
    if ((String(knock.log_entry?.text || '').match(/Skeleton hits/g) || []).length > 1) throw new Error('CR 1/4 skeleton made multiple attacks');

    // Test 2: third death-save failure atomically closes combat and session.
    await base44.asServiceRole.entities.Character.update(c1.id, { hp_current: 0, death_saves_success: 0, death_saves_failure: 2 });
    Math.random = () => 0; // natural 1 => terminal failures
    const deathRes = await handleDeathSave({ base44, session_id: s1.id, combat_id: l1.id, character_id: c1.id, payload: {} });
    const death = await deathRes.json();
    const deathLog = await base44.asServiceRole.entities.CombatLog.get(l1.id);
    const deathSession = await base44.asServiceRole.entities.GameSession.get(s1.id);
    if (!death.character_dead || deathLog.is_active || deathLog.result !== 'defeat' || deathSession.in_combat || Object.keys(deathSession.combat_state || {}).length) {
      throw new Error(`Atomic defeat test failed: ${JSON.stringify({ death, active: deathLog.is_active, result: deathLog.result, session: deathSession.combat_state })}`);
    }

    // Test 3: stale brute Necromancer under Silence uses one physical fallback.
    const c2 = await makeCharacter('QA Prelogin Silence', 44);
    const s2 = await makeSession(c2.id, 'Silence');
    const player2 = { id: c2.id, name: c2.name, type: 'player', hp_current: 44, hp_max: 44, ac: 16, is_conscious: true, conditions: [] };
    const necro = { id: 'qa_necromancer', name: 'Necromancer', type: 'enemy', hp_current: 20, hp_max: 20, ac: 12, attack_bonus: 4, damage_dice: '1d8', damage_bonus: 1, cr: 1, archetype: 'brute', attack_type: 'melee', num_attacks: 1, initiative_total: 20, conditions: [{ name: 'silenced', source: 'story' }], is_conscious: true };
    const l2 = await makeLog(s2.id, [necro, player2]);
    Math.random = () => 0.95;
    const silenceRes = await handleEnemyTurn({ base44, session_id: s2.id, combat_id: l2.id, character_id: c2.id, payload: {} });
    const silence = await silenceRes.json();
    if (silence.log_entry?.action !== 'spellcaster:silenced_physical_fallback') throw new Error(`Silence fallback failed: ${silence.log_entry?.action}`);
    if ((String(silence.log_entry?.text || '').match(/Necromancer hits/g) || []).length > 1) throw new Error('Silenced CR1 caster made multiple attacks');

    return Response.json({ success: true, tests: {
      low_cr_knockout: { action: knock.log_entry.action, player_at_zero: knock.player_at_zero_hp, session_link_preserved: true },
      atomic_defeat: { character_dead: death.character_dead, combat_result: deathLog.result, session_cleared: !deathSession.in_combat },
      silence_fallback: { action: silence.log_entry.action, text: silence.log_entry.text },
    }, created });
  } catch (error) {
    return Response.json({ success: false, error: error.message, created }, { status: 500 });
  } finally {
    Math.random = originalRandom;
    for (const id of created.logs.reverse()) await base44.asServiceRole.entities.CombatLog.delete(id).catch(() => {});
    for (const id of created.sessions.reverse()) await base44.asServiceRole.entities.GameSession.delete(id).catch(() => {});
    for (const id of created.characters.reverse()) await base44.asServiceRole.entities.Character.delete(id).catch(() => {});
  }
});
