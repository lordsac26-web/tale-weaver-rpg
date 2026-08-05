import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handleEnemyTurn } from '../../shared/combat/enemyTurn.ts';

const QA_PREFIX = 'SkeletonQA_';
const LIVE_IDS = new Set(['6a729f241b7f02695adac319', '6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);

const withRandom = async (value, work) => {
  const original = Math.random;
  Math.random = () => value;
  try { return await work(); } finally { Math.random = original; }
};

export default async function testSkeletonEnemyTurnRegression(req) {
  const fixtures = [];
  const results = [];
  const cleanup = [];
  let output = null;
  let status = 200;
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const createFixture = async (label) => {
      const token = `${QA_PREFIX}${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const character = await base44.entities.Character.create({
        name: `${token}_Hero`, race: 'Human', class: 'Fighter', level: 1,
        hp_max: 40, hp_current: 40, armor_class: 13, inventory: [], conditions: [], active_modifiers: [], is_active: false,
      });
      const session = await base44.asServiceRole.entities.GameSession.create({
        character_id: character.id, title: `${token}_Session`, in_combat: true, combat_state: {}, is_active: false,
      });
      const skeleton = {
        id: `${token}_Skeleton`, type: 'enemy', name: 'Skeleton', archetype: 'soldier', cr: '1/4',
        hp_current: 13, hp_max: 13, is_conscious: true, armor_class: 13, ac: 13,
        damage_dice: '1d6+2', damage_bonus: 2, attack_bonus: 5, num_attacks: 1, multiattack: 'Two shortsword attacks', damage_type: 'piercing', conditions: [],
      };
      const combat = await base44.asServiceRole.entities.CombatLog.create({
        session_id: session.id, character_id: character.id, round: 1, current_turn_index: 1, is_active: true, result: 'ongoing',
        combatants: [{ id: character.id, type: 'player', name: character.name, hp_current: 40, hp_max: 40, ac: 13, is_conscious: true, conditions: [] }, skeleton],
        initiative_order: [{ id: character.id, name: character.name, initiative: 10 }, { id: skeleton.id, name: skeleton.name, initiative: 11 }], log_entries: [], world_state: {},
      });
      await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });
      fixtures.push({ character: character.id, session: session.id, combat: combat.id });
      return { character, session, combat };
    };

    const runCase = async (name, randomValue, verify) => {
      const fixture = await createFixture(name);
      const response = await withRandom(randomValue, () => handleEnemyTurn({ base44, session_id: fixture.session.id, combat_id: fixture.combat.id }));
      const body = await response.json();
      const afterCombat = await base44.asServiceRole.entities.CombatLog.get(fixture.combat.id);
      const afterCharacter = await base44.asServiceRole.entities.Character.get(fixture.character.id);
      const entry = afterCombat.log_entries.at(-1);
      results.push({ name, pass: verify({ body, afterCombat, afterCharacter, entry }), detail: { body, entry, hp: afterCharacter.hp_current } });
      return fixture;
    };

    const normal = await runCase('CR 1/4 soldier ignores legacy multiattack metadata', 0.9, ({ body, afterCombat, afterCharacter, entry }) =>
      body.log_entry?.action === 'soldier:default' && entry.hit && entry.damage >= 3 && entry.damage <= 8 && entry.attack_count === 1 && entry.damage_dice === '1d6+2' && entry.damage_rolls?.[0]?.rolls?.[0] === 6 && entry.damage_rolls?.[0]?.embedded_modifier === 2 && entry.raw_damage === 8 && !entry.text.includes('takes no damage') && afterCharacter.hp_current === 32 && afterCombat.combatants.find(c => c.type === 'player')?.hp_current === 32 && afterCombat.current_turn_index === 0
    );
    const replay = await handleEnemyTurn({ base44, session_id: normal.session.id, combat_id: normal.combat.id });
    const replayBody = await replay.json();
    results.push({ name: 'duplicate enemy turn is skipped after initiative advances', pass: replayBody.skipped === true, detail: replayBody });

    await runCase('normal miss preserves HP', 0, ({ body, afterCharacter, entry }) =>
      !entry.hit && entry.damage === 0 && afterCharacter.hp_current === 40 && body.next_turn_index === 0
    );
    await runCase('critical doubles dice only', 0.9999, ({ afterCharacter, entry }) =>
      entry.hit && entry.critical && entry.damage === 14 && entry.damage_rolls?.[0]?.rolls?.length === 2 && entry.damage_rolls?.[0]?.embedded_modifier === 2 && afterCharacter.hp_current === 26
    );

    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) {
    status = 500;
    output = { error: error.message || 'Skeleton regression failed', results };
  } finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) {
      for (const [entity, id] of [['CombatLog', fixture.combat], ['GameSession', fixture.session], ['Character', fixture.character]]) {
        if (!id || LIVE_IDS.has(id)) continue;
        let deleted = false;
        let verified_absent = false;
        try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
        try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
        cleanup.push({ entity, id, deleted, verified_absent });
      }
    }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  if (!cleanupPassed) status = 500;
  return Response.json({ ...(output || { error: 'Skeleton regression did not produce a result' }), cleanup, cleanup_passed: cleanupPassed }, { status });
}