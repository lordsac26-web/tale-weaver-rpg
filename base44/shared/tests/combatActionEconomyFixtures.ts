// Combat action-economy fixtures — drive the real player_attack handler and
// persistence layer against a private in-memory store. No live records are read
// or written; every assertion runs over the mock store.
import { handlePlayerAttack } from '../combat/playerAttack.ts';
import { expireTimedCombatantConditions, COMBAT_TIMED_CONDITIONS_VERSION } from '../combat/timedConditions.ts';
import { getActionsPerTurn } from '../combat/helpers.ts';

const clone = (value) => structuredClone(value);

function entityStore(initialRows) {
  const rows = initialRows.map((row) => ({ ...clone(row), updated_date: row.updated_date || 'v1' }));
  let version = 1;
  const stamp = (row) => { version += 1; row.updated_date = `v${version}`; };
  return {
    rows,
    staleFirstRead: null,
    staleReadServed: false,
    async get(id) {
      if (this.staleFirstRead && !this.staleReadServed) { this.staleReadServed = true; return clone(this.staleFirstRead); }
      const row = rows.find((entry) => entry.id === id);
      return row ? clone(row) : null;
    },
    async update(id, patch) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) throw new Error(`fixture row missing: ${id}`);
      Object.assign(row, clone(patch));
      stamp(row);
      return clone(row);
    },
    async updateMany(query, change) {
      const row = rows.find((entry) => entry.id === query.id);
      if (!row) return { success: false, updated: 0, has_more: false };
      if (query.updated_date && row.updated_date !== query.updated_date) return { success: true, updated: 0, has_more: false };
      Object.assign(row, clone((change && change.$set) || {}));
      stamp(row);
      return { success: true, updated: 1, has_more: false };
    },
  };
}

const pwtFixture = { name: 'pass without trace', display_name: 'Pass Without Trace', source: 'Pass without Trace', concentration: true, duration_type: 'game_elapsed', expiration_rule: 'game_time', start_game_time_seconds: 259218, duration_seconds: 3600, expires_game_time_seconds: 262818 };

const rangerFixture = () => ({
  id: 'fixture-character', created_by_id: 'fixture-user', name: "Craig's Ranger", race: 'Human', class: 'Ranger', subclass: 'Hunter', level: 5,
  strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 14, charisma: 10,
  proficiency_bonus: 3, hp_current: 59, hp_max: 59, armor_class: 22, conditions: [], active_modifiers: [],
  features: [], feats: [], inventory: [], spells_known: [], spells_prepared: [], spell_slots: {},
  class_choices: {}, long_rest_abilities: {}, xp: 100, updated_date: 'v1',
});

const rosterFixture = ({ playerConditions = [], liveHp = 22, liveXp = 50, deadXp = 25 } = {}) => [
  { id: 'fixture-character', type: 'player', name: "Craig's Ranger", hp_current: 59, hp_max: 59, ac: 22, is_conscious: true, conditions: clone(playerConditions) },
  { id: 'enemy_dead', type: 'enemy', name: 'Magistrate Guard', hp_current: 0, hp_max: 22, ac: 16, is_conscious: false, xp: deadXp, conditions: [] },
  { id: 'enemy_live', type: 'enemy', name: 'Magistrate Guard Reinforcement', hp_current: liveHp, hp_max: 22, ac: 16, is_conscious: true, xp: liveXp, conditions: [] },
];

const combatFixture = ({ roster = [], worldState = {}, logEntries = [], overrides = {} } = {}) => ({
  id: 'fixture-combat', session_id: 'fixture-session', is_active: true, result: 'ongoing',
  round: 3, current_turn_index: 0, xp_awarded: false, location: 'Administrative Corridor',
  combatants: roster, log_entries: logEntries,
  world_state: { actions_used_this_turn: 0, attacks_used_this_action: 0, __receipts: [], ...worldState },
  ...overrides,
});

const sessionFixture = () => ({
  id: 'fixture-session', character_id: 'fixture-character', in_combat: true,
  combat_state: { combat_id: 'fixture-combat' },
  world_state: { elapsed_game_seconds: 264618, elapsed_hours: 73.505 },
  story_log: [], current_location: 'Administrative Corridor', updated_date: 'v1',
});

const shortsword = () => ({ name: 'Shortsword', damage_dice: '1d6', damage_type: 'piercing', type: 'melee', properties: ['finesse'] });

const makeWorld = ({ combatOpts = {}, characterOverrides = {} } = {}) => {
  const stores = {
    CombatLog: entityStore([combatFixture(combatOpts)]),
    Character: entityStore([{ ...rangerFixture(), ...characterOverrides }]),
    GameSession: entityStore([sessionFixture()]),
  };
  return { db: { asServiceRole: { entities: stores } }, stores };
};

const attack = async (world, { requestId, targetId = 'enemy_live' }) => {
  const response = await handlePlayerAttack({
    base44: world.db,
    session_id: 'fixture-session',
    combat_id: 'fixture-combat',
    character_id: 'fixture-character',
    request_id: requestId,
    roll_d20: () => 11,
    payload: { target_id: targetId, weapon: shortsword(), modifiers: {} },
  });
  return { status: response.status, body: await response.json() };
};

export default async function combatActionEconomyFixtures() {
  const results = [];
  const check = (name, pass) => results.push({ name, pass: !!pass });

  // ── Extra Attack budget: decrements exactly once per attack ──
  check('extra attack grants exactly two attacks per turn', getActionsPerTurn(rangerFixture()) === 2);
  const worldA = makeWorld({ combatOpts: { roster: rosterFixture() } });
  const first = await attack(worldA, { requestId: 'atk-1' });
  const rowAfterFirst = await worldA.stores.CombatLog.get('fixture-combat');
  const liveAfterFirst = rowAfterFirst.combatants.find((entry) => entry.id === 'enemy_live');
  check('first attack hits and decrements the budget exactly once', first.status === 200 && first.body.hit === true
    && rowAfterFirst.world_state.actions_used_this_turn === 1 && rowAfterFirst.world_state.attacks_used_this_action === 1
    && first.body.actions_remaining === 1 && first.body.action_ledger?.attacks_remaining === 1);
  check('first attack damage applied exactly once', liveAfterFirst.hp_current === 22 - first.body.damage && rowAfterFirst.log_entries.length === 1);
  const second = await attack(worldA, { requestId: 'atk-2' });
  const rowAfterSecond = await worldA.stores.CombatLog.get('fixture-combat');
  const liveAfterSecond = rowAfterSecond.combatants.find((entry) => entry.id === 'enemy_live');
  check('second attack exhausts the budget exactly once', second.status === 200 && second.body.actions_remaining === 0
    && rowAfterSecond.world_state.attacks_used_this_action === 0
    && rowAfterSecond.world_state.last_attack_sequence?.attacks_used_this_action === 2);
  check('turn advances past the player and skips the dead combatant', rowAfterSecond.current_turn_index === 2
    && rowAfterSecond.world_state.actions_used_this_turn === 0 && second.body.action_ledger?.turn_index === 2);
  check('second attack damage applied exactly once', liveAfterSecond.hp_current === 22 - first.body.damage - second.body.damage
    && rowAfterSecond.log_entries.length === 2);

  // ── Replay refusal: the same receipt id inside the same turn ──
  const replay = await attack(worldA, { requestId: 'atk-1' });
  const rowAfterReplay = await worldA.stores.CombatLog.get('fixture-combat');
  check('repeated identical submission refused zero-write', replay.status === 409
    && replay.body.error_code === 'attack_already_resolved' && replay.body.writes === 0);
  check('replay never appends a duplicate log entry', rowAfterReplay.log_entries.filter((entry) => entry.request_id === 'atk-1').length === 1
    && rowAfterReplay.log_entries.length === 2);
  check('replay applies no damage', rowAfterReplay.combatants.find((entry) => entry.id === 'enemy_live').hp_current === liveAfterSecond.hp_current);

  // ── Loop guard: budget spent while the turn is still the player's (the drifted state) ──
  const worldB = makeWorld({ combatOpts: { roster: rosterFixture(), worldState: { actions_used_this_turn: 2, attacks_used_this_action: 2, attacks_remaining: 0 } } });
  const capped = await attack(worldB, { requestId: 'atk-3' });
  const rowAfterCap = await worldB.stores.CombatLog.get('fixture-combat');
  check('no third attack resolves once the budget is spent', capped.status === 409
    && capped.body.error_code === 'no_attacks_remaining' && rowAfterCap.log_entries.length === 0
    && rowAfterCap.combatants.find((entry) => entry.id === 'enemy_live').hp_current === 22);

  // ── Stale read: a write lands between the handler's read and its commit ──
  const a0Entry = { round: 3, actor: "Craig's Ranger", action: 'attack', target: 'Magistrate Guard', request_id: 'atk-a0', hit: true, damage: 10, text: 'fixture: the earlier attack killed the guard' };
  const worldC = makeWorld({ combatOpts: {
    roster: rosterFixture(),
    logEntries: [a0Entry],
    worldState: { actions_used_this_turn: 1, attacks_used_this_action: 1, attacks_remaining: 1 },
    overrides: { current_turn_index: 1, updated_date: 'r9' },
  } });
  worldC.stores.CombatLog.staleFirstRead = combatFixture({
    roster: rosterFixture(),
    worldState: { actions_used_this_turn: 0, attacks_used_this_action: 0 },
    overrides: { current_turn_index: 1, updated_date: 'r8' },
  });
  const staleAttack = await attack(worldC, { requestId: 'atk-b1' });
  const rowAfterStale = await worldC.stores.CombatLog.get('fixture-combat');
  check('stale read detected and the ledger reconciled from the authoritative record', staleAttack.status === 200
    && rowAfterStale.current_turn_index === 2 && rowAfterStale.world_state.actions_used_this_turn === 0
    && staleAttack.body.action_ledger?.turn_index === 2 && staleAttack.body.action_ledger?.reconciled_from_interleaved_write === true);
  check('reconciliation preserves the interleaved log entry', rowAfterStale.log_entries.some((entry) => entry.request_id === 'atk-a0')
    && rowAfterStale.log_entries.some((entry) => entry.request_id === 'atk-b1') && rowAfterStale.log_entries.length === 2);
  check('reconciliation applies the new damage exactly once', rowAfterStale.combatants.find((entry) => entry.id === 'enemy_live').hp_current === 22 - staleAttack.body.damage);

  // ── Timed conditions lapse against the game clock ──
  const futurePwt = { ...pwtFixture, expires_game_time_seconds: 999999 };
  const notYet = expireTimedCombatantConditions({ combatants: [{ id: 'p', name: 'P', type: 'player', conditions: [futurePwt] }], session: sessionFixture() });
  check('unexpired game-time condition stays attached', notYet.expired.length === 0 && notYet.combatants[0].conditions.length === 1);
  const worldD = makeWorld({ combatOpts: { roster: rosterFixture({ playerConditions: [pwtFixture, { name: 'alerted', source: 'story' }] }) } });
  const pwtAttack = await attack(worldD, { requestId: 'atk-pwt' });
  const rowAfterPwt = await worldD.stores.CombatLog.get('fixture-combat');
  const playerAfterPwt = rowAfterPwt.combatants.find((entry) => entry.id === 'fixture-character');
  check('expired pass without trace lapses at persist time', pwtAttack.status === 200
    && playerAfterPwt.conditions.length === 1 && playerAfterPwt.conditions[0].name === 'alerted'
    && (rowAfterPwt.world_state.expired_conditions || [])[0]?.condition === 'Pass Without Trace');

  // ── Victory closes combat with the handoff and XP ──
  const worldE = makeWorld({ combatOpts: { roster: rosterFixture({ liveHp: 1 }) } });
  const kill = await attack(worldE, { requestId: 'atk-kill' });
  const rowAfterKill = await worldE.stores.CombatLog.get('fixture-combat');
  const sessionAfterKill = await worldE.stores.GameSession.get('fixture-session');
  const characterAfterKill = await worldE.stores.Character.get('fixture-character');
  check('final blow closes the combat', kill.status === 200 && kill.body.combat_ended === true
    && kill.body.result === 'victory' && rowAfterKill.is_active === false && rowAfterKill.result === 'victory');
  check('victory handoff ends the session combat link', sessionAfterKill.in_combat === false
    && Object.keys(sessionAfterKill.combat_state || {}).length === 0);
  check('victory xp awarded exactly once', characterAfterKill.xp === 175 && rowAfterKill.xp_awarded === true);

  return {
    all_pass: results.every((entry) => entry.pass),
    passed: results.filter((entry) => entry.pass).length,
    failed: results.filter((entry) => !entry.pass).length,
    total: results.length,
    results,
    timed_conditions_version: COMBAT_TIMED_CONDITIONS_VERSION,
    live_data_touched: false,
  };
}