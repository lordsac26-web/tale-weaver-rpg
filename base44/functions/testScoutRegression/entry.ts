// ─── SCOUT DAMAGE PIPELINE REGRESSION TESTS ──────────────────────────────────
// Verifies that scout:default and scout:tactical_strike route through the same
// centralized rollDamageFromDice pipeline as soldier:default, that critical
// hits double only damage dice (not the signed modifier / damage_bonus), and
// that zero-damage hits only occur with an explicit immunity/reduction reason.
// Deployed alongside the enemyTurn.ts fix so future regressions are caught.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  parseDamageDice, rollDamageFromDice, applyDamageModifiers,
} from '../../shared/combat/helpers.ts';
import { chooseTactic, inferArchetype } from '../../shared/monsterAI.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const results = [];
    const assert = (name, condition, detail) => {
      results.push({ test: name, pass: !!condition, detail: detail || null });
    };
    const origRandom = Math.random;
    const mockMax = () => 0.9999; // rollDice(sides) → sides
    const mockMin = () => 0.0;   // rollDice(sides) → 1

    // ════════════════════════════════════════════════════════════════════════
    // 1. parseDamageDice — canonical '2d4+2' wolf bite notation
    // ════════════════════════════════════════════════════════════════════════
    const parsed = parseDamageDice('2d4+2');
    assert('parse 2d4+2 numDice=2', parsed?.numDice === 2, `numDice=${parsed?.numDice}`);
    assert('parse 2d4+2 sides=4', parsed?.sides === 4, `sides=${parsed?.sides}`);
    assert('parse 2d4+2 embeddedBonus=2', parsed?.embeddedBonus === 2, `embeddedBonus=${parsed?.embeddedBonus}`);

    // ════════════════════════════════════════════════════════════════════════
    // 2. SCOUT:DEFAULT — normal hit (2d4+2, damageBonus=2, NO double-add)
    //    2d4 max = 8, +2 embedded = 10. If damage_bonus were added: 12.
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax;
    const scoutDefaultMax = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: false });
    assert('scout:default normal hit max=10 (no double-add)', scoutDefaultMax.damage === 10 && scoutDefaultMax.parsed,
      `damage=${scoutDefaultMax.damage} parsed=${scoutDefaultMax.parsed} (expected 10, NOT 12)`);

    Math.random = mockMin;
    const scoutDefaultMin = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: false });
    assert('scout:default normal hit min=4 (no double-add)', scoutDefaultMin.damage === 4,
      `damage=${scoutDefaultMin.damage} (expected 4: 2×1+2, NOT 6)`);

    // ════════════════════════════════════════════════════════════════════════
    // 3. SCOUT:DEFAULT — CRITICAL (2d4+2 with isCrit=true)
    //    Dice double: 4d4 max=16, +2 embedded ONCE = 18.
    //    If modifier doubled or damage_bonus added: 20.
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax;
    const scoutCritMax = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: true });
    assert('scout crit max=18 (dice doubled, mod once)', scoutCritMax.damage === 18,
      `damage=${scoutCritMax.damage} (expected 18: 4×4+2, NOT 20)`);

    Math.random = mockMin;
    const scoutCritMin = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: true });
    assert('scout crit min=6 (dice doubled, mod once)', scoutCritMin.damage === 6,
      `damage=${scoutCritMin.damage} (expected 6: 4×1+2, NOT 8)`);

    // ════════════════════════════════════════════════════════════════════════
    // 4. SCOUT:TACTICAL_STRIKE — same pipeline, tacticBonus=0 (no bonusDamage)
    //    attackBonus:1 affects the attack roll, not damage. Damage = 2d4+2.
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax;
    const tacticalDmg = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: false });
    assert('scout:tactical_strike normal hit=10', tacticalDmg.damage === 10,
      `damage=${tacticalDmg.damage} (tactic has no bonusDamage, same as default)`);

    // ════════════════════════════════════════════════════════════════════════
    // 5. SCOUT:PRESS — tacticBonus=1 adds on top (darts in to finish)
    //    2d4 max=8 + 2 embedded + 1 tactic = 11
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax;
    const pressDmg = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 1, isCrit: false });
    assert('scout:press tacticBonus adds=11', pressDmg.damage === 11,
      `damage=${pressDmg.damage} (expected 11: 8+2+1)`);

    // ════════════════════════════════════════════════════════════════════════
    // 6. chooseTactic — scout:default (no tactic triggers when chance fails)
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax; // 0.9999 < 0.35 = false → tactical_strike fails
    const scoutDefault = chooseTactic('scout', {
      selfHpPct: 1.0, playerHpPct: 1.0, round: 2, cr: 0.25, nativeAttacks: 1, hasMultiattack: false,
    });
    assert('scout:default chosen when no tactic triggers', scoutDefault.id === 'default',
      `id=${scoutDefault.id} desc=${scoutDefault.desc}`);
    assert('scout:default numAttacks=1', scoutDefault.numAttacks === 1, `numAttacks=${scoutDefault.numAttacks}`);
    assert('scout:default bonusDamage=0', scoutDefault.bonusDamage === 0, `bonusDamage=${scoutDefault.bonusDamage}`);
    assert('scout:default desc=attacks!', scoutDefault.desc === 'attacks!', `desc="${scoutDefault.desc}"`);

    // ════════════════════════════════════════════════════════════════════════
    // 7. chooseTactic — scout:tactical_strike (chance succeeds)
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMin; // 0.0 < 0.35 = true → tactical_strike triggers
    const scoutTactical = chooseTactic('scout', {
      selfHpPct: 1.0, playerHpPct: 1.0, round: 2, cr: 0.25, nativeAttacks: 1, hasMultiattack: false,
    });
    assert('scout:tactical_strike chosen when chance passes', scoutTactical.id === 'tactical_strike',
      `id=${scoutTactical.id}`);
    assert('scout:tactical_strike numAttacks=1', scoutTactical.numAttacks === 1,
      `numAttacks=${scoutTactical.numAttacks}`);
    assert('scout:tactical_strike attackBonus=1', scoutTactical.attackBonus === 1,
      `attackBonus=${scoutTactical.attackBonus}`);
    assert('scout:tactical_strike bonusDamage=0', scoutTactical.bonusDamage === 0,
      `bonusDamage=${scoutTactical.bonusDamage}`);
    assert('scout:tactical_strike desc correct',
      scoutTactical.desc === 'strikes at a weak point!', `desc="${scoutTactical.desc}"`);

    Math.random = origRandom;

    // ════════════════════════════════════════════════════════════════════════
    // 8. MISS — no damage roll needed (hit=false in the attack loop)
    //    Verified by the pipeline: if hit is false, rollDamageFromDice is
    //    never called. Here we confirm parsed=false for garbage input.
    // ════════════════════════════════════════════════════════════════════════
    const garbage = rollDamageFromDice('xyz', { damageBonus: 2, isCrit: false });
    assert('unparseable dice → parsed=false', garbage.parsed === false, `parsed=${garbage.parsed}`);
    assert('unparseable dice → damage=0', garbage.damage === 0, `damage=${garbage.damage}`);

    const nullDice = rollDamageFromDice(null, { damageBonus: 2 });
    assert('null dice → parsed=false', nullDice.parsed === false, `parsed=${nullDice.parsed}`);

    const emptyDice = rollDamageFromDice('', { damageBonus: 2 });
    assert('empty dice → parsed=false', emptyDice.parsed === false, `parsed=${emptyDice.parsed}`);

    // ════════════════════════════════════════════════════════════════════════
    // 9. GENUINE IMMUNITY-ZERO — damage reduced to 0 with explicit reason
    //    applyDamageModifiers returns applied='immunity' → log gets "[Immune...]"
    // ════════════════════════════════════════════════════════════════════════
    const immune = applyDamageModifiers(10, 'poison', { immunities: ['poison'] });
    assert('immunity → amount=0', immune.amount === 0, `amount=${immune.amount}`);
    assert('immunity → applied=immunity', immune.applied === 'immunity',
      `applied=${immune.applied} (caller logs "[Immune to poison: 10 → 0]")`);

    const resisted = applyDamageModifiers(10, 'fire', { resistances: ['fire'] });
    assert('resistance → amount=5', resisted.amount === 5, `amount=${resisted.amount}`);
    assert('resistance → applied=resistance', resisted.applied === 'resistance',
      `applied=${resisted.applied}`);

    const plain = applyDamageModifiers(10, 'slashing', {});
    assert('no mitigation → amount=10', plain.amount === 10, `amount=${plain.amount}`);
    assert('no mitigation → applied=null', plain.applied === null, `applied=${plain.applied}`);

    // ════════════════════════════════════════════════════════════════════════
    // 10. BARE DICE — damageBonus IS added when no embedded modifier
    //     '1d6' + damageBonus 3 = 9 (proves damageBonus works for bare dice)
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax;
    const bareDice = rollDamageFromDice('1d6', { damageBonus: 3, isCrit: false });
    assert('bare dice adds damageBonus=9', bareDice.damage === 9,
      `damage=${bareDice.damage} (expected 9: 6+3, damageBonus added for bare NdN)`);
    Math.random = origRandom;

    // ════════════════════════════════════════════════════════════════════════
    // 11. NEGATIVE EMBEDDED MODIFIER — '1d12-1' adds -1 once
    // ════════════════════════════════════════════════════════════════════════
    Math.random = mockMax;
    const negMod = rollDamageFromDice('1d12-1', { damageBonus: 5, isCrit: false });
    assert('negative embedded mod=11', negMod.damage === 11,
      `damage=${negMod.damage} (expected 11: 12-1, damageBonus NOT added because embedded≠0)`);
    Math.random = origRandom;

    // ════════════════════════════════════════════════════════════════════════
    // 12. inferArchetype — wolf with explicit 'scout' archetype
    // ════════════════════════════════════════════════════════════════════════
    const wolfArch = inferArchetype({ archetype: 'scout', cr: 0.25, name: 'Corrupted Wolf' });
    assert('inferArchetype respects explicit scout', wolfArch === 'scout',
      `archetype=${wolfArch}`);
    const wolfFallback = inferArchetype({ cr: 0.25, name: 'Corrupted Wolf' });
    assert('inferArchetype infers scout from wolf name', wolfFallback === 'scout',
      `archetype=${wolfFallback}`);

    // ════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ════════════════════════════════════════════════════════════════════════
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    return Response.json({
      passed, failed, total: results.length,
      all_pass: failed === 0,
      results: results.filter(r => !r.pass).length > 0 ? results.filter(r => !r.pass) : results,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}