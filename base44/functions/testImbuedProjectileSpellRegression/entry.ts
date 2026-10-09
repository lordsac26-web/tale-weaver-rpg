import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { classifyImbuedProjectileSpell, IMBUED_PROJECTILE_SPELL_VERSION } from '../../shared/story/imbuedProjectileSpell.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const tests = [
    {
      name: 'silence-imbued arrow detected with target_ref',
      text: 'Initiate an ambush by targeting the ritual leader with a precise, silence-imbued arrow to prevent them from casting further necrotic wards.',
      weapon_attack: { target_ref: 'Ritual Leader', weapon_hint: 'Longbow', attack_mode: 'ranged' },
      expect: { detected: true, spell: 'Silence', targetRef: 'Ritual Leader' },
    },
    {
      name: 'silenced arrow detected',
      text: 'Fire a silenced arrow at the necromancer.',
      weapon_attack: { target_ref: 'Necromancer', weapon_hint: 'Longbow', attack_mode: 'ranged' },
      expect: { detected: true, spell: 'Silence', targetRef: 'Necromancer' },
    },
    {
      name: 'arrow of silence detected',
      text: 'Loose an arrow of silence at the cultist leader.',
      weapon_attack: { target_ref: 'Cultist Leader', weapon_hint: 'Longbow', attack_mode: 'ranged' },
      expect: { detected: true, spell: 'Silence', targetRef: 'Cultist Leader' },
    },
    {
      name: 'plain weapon attack not detected',
      text: 'Fire an arrow at the goblin.',
      weapon_attack: { target_ref: 'Goblin', weapon_hint: 'Longbow', attack_mode: 'ranged' },
      expect: null,
    },
    {
      name: 'spell cast text not detected as imbued',
      text: 'Cast Silence centered on the ritual circle.',
      weapon_attack: null,
      expect: null,
    },
    {
      name: 'silence-imbued without target_ref returns error',
      text: 'Fire a silence-imbued arrow.',
      weapon_attack: { target_ref: null, weapon_hint: 'Longbow', attack_mode: 'ranged' },
      expect: { detected: true, spell: 'Silence', error: 'No target_ref on the weapon_attack contract to anchor the imbued spell.' },
    },
  ];

  const results = tests.map((test) => {
    const classification = classifyImbuedProjectileSpell(test.text, test.weapon_attack);
    const passed = test.expect === null
      ? classification === null
      : classification?.detected === test.expect.detected
        && classification?.spell === test.expect.spell
        && (test.expect.targetRef ? classification?.targetRef === test.expect.targetRef : true)
        && (test.expect.error ? classification?.error === test.expect.error : true);
    return { name: test.name, passed, classification, expect: test.expect };
  });

  const allPass = results.every((r) => r.passed);
  return Response.json({
    suite: 'imbued-projectile-spell',
    version: IMBUED_PROJECTILE_SPELL_VERSION,
    all_pass: allPass,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    total: results.length,
    results,
  });
}