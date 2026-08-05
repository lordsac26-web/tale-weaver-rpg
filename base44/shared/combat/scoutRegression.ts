import { parseDamageDice, rollDamageFromDice, applyDamageModifiers } from './helpers.ts';
import { chooseTactic, inferArchetype } from '../monsterAI.ts';

export function runScoutRegressionSuite() {
  const results = [];
  const assert = (test, pass, detail) => results.push({ test, pass: !!pass, detail });
  const originalRandom = Math.random;
  const max = () => 0.9999;
  const min = () => 0;
  try {
    const parsed = parseDamageDice('2d4+2');
    assert('parse 2d4+2 numDice=2', parsed?.numDice === 2, `numDice=${parsed?.numDice}`);
    assert('parse 2d4+2 sides=4', parsed?.sides === 4, `sides=${parsed?.sides}`);
    assert('parse 2d4+2 embeddedBonus=2', parsed?.embeddedBonus === 2, `embeddedBonus=${parsed?.embeddedBonus}`);
    Math.random = max;
    const normalMax = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: false });
    assert('scout:default normal hit max=10 (no double-add)', normalMax.damage === 10 && normalMax.parsed, `damage=${normalMax.damage}`);
    Math.random = min;
    const normalMin = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: false });
    assert('scout:default normal hit min=4 (no double-add)', normalMin.damage === 4, `damage=${normalMin.damage}`);
    Math.random = max;
    const critMax = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: true });
    assert('scout crit max=18 (dice doubled, mod once)', critMax.damage === 18, `damage=${critMax.damage}`);
    Math.random = min;
    const critMin = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: true });
    assert('scout crit min=6 (dice doubled, mod once)', critMin.damage === 6, `damage=${critMin.damage}`);
    Math.random = max;
    const tactical = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 0, isCrit: false });
    assert('scout:tactical_strike normal hit=10', tactical.damage === 10, `damage=${tactical.damage}`);
    const press = rollDamageFromDice('2d4+2', { damageBonus: 2, tacticBonus: 1, isCrit: false });
    assert('scout:press tacticBonus adds=11', press.damage === 11, `damage=${press.damage}`);
    const defaultTactic = chooseTactic('scout', { selfHpPct: 1, playerHpPct: 1, round: 2, cr: 0.25, nativeAttacks: 1, hasMultiattack: false });
    assert('scout:default chosen when no tactic triggers', defaultTactic.id === 'default', `id=${defaultTactic.id}`);
    assert('scout:default numAttacks=1', defaultTactic.numAttacks === 1, `numAttacks=${defaultTactic.numAttacks}`);
    assert('scout:default bonusDamage=0', defaultTactic.bonusDamage === 0, `bonusDamage=${defaultTactic.bonusDamage}`);
    assert('scout:default desc=attacks!', defaultTactic.desc === 'attacks!', `desc=${defaultTactic.desc}`);
    Math.random = min;
    const tacticalTactic = chooseTactic('scout', { selfHpPct: 1, playerHpPct: 1, round: 2, cr: 0.25, nativeAttacks: 1, hasMultiattack: false });
    assert('scout:tactical_strike chosen when chance passes', tacticalTactic.id === 'tactical_strike', `id=${tacticalTactic.id}`);
    assert('scout:tactical_strike numAttacks=1', tacticalTactic.numAttacks === 1, `numAttacks=${tacticalTactic.numAttacks}`);
    assert('scout:tactical_strike attackBonus=1', tacticalTactic.attackBonus === 1, `attackBonus=${tacticalTactic.attackBonus}`);
    assert('scout:tactical_strike bonusDamage=0', tacticalTactic.bonusDamage === 0, `bonusDamage=${tacticalTactic.bonusDamage}`);
    assert('scout:tactical_strike desc correct', tacticalTactic.desc === 'strikes at a weak point!', `desc=${tacticalTactic.desc}`);
    const garbage = rollDamageFromDice('xyz', { damageBonus: 2, isCrit: false });
    assert('unparseable dice → parsed=false', garbage.parsed === false, `parsed=${garbage.parsed}`);
    assert('unparseable dice → damage=0', garbage.damage === 0, `damage=${garbage.damage}`);
    assert('null dice → parsed=false', rollDamageFromDice(null, { damageBonus: 2 }).parsed === false);
    assert('empty dice → parsed=false', rollDamageFromDice('', { damageBonus: 2 }).parsed === false);
    const immune = applyDamageModifiers(10, 'poison', { immunities: ['poison'] });
    assert('immunity → amount=0', immune.amount === 0, `amount=${immune.amount}`);
    assert('immunity → applied=immunity', immune.applied === 'immunity', `applied=${immune.applied}`);
    const resisted = applyDamageModifiers(10, 'fire', { resistances: ['fire'] });
    assert('resistance → amount=5', resisted.amount === 5, `amount=${resisted.amount}`);
    assert('resistance → applied=resistance', resisted.applied === 'resistance', `applied=${resisted.applied}`);
    assert('no mitigation → amount=10', applyDamageModifiers(10, 'slashing', {}).amount === 10);
    assert('no mitigation → applied=null', applyDamageModifiers(10, 'slashing', {}).applied === null);
    Math.random = max;
    assert('bare dice adds damageBonus=9', rollDamageFromDice('1d6', { damageBonus: 3, isCrit: false }).damage === 9);
    assert('negative embedded mod=11', rollDamageFromDice('1d12-1', { damageBonus: 5, isCrit: false }).damage === 11);
    assert('inferArchetype respects explicit scout', inferArchetype({ archetype: 'scout', cr: 0.25, name: 'Corrupted Wolf' }) === 'scout');
    assert('inferArchetype infers scout from wolf name', inferArchetype({ cr: 0.25, name: 'Corrupted Wolf' }) === 'scout');
  } finally {
    Math.random = originalRandom;
  }
  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;
  return { passed, failed, total: results.length, all_pass: failed === 0, results: failed ? results.filter((result) => !result.pass) : results };
}