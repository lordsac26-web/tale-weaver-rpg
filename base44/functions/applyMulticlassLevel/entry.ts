import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { applyRogueExpertise, buildMulticlassClassUpdates, MULTICLASS_RULES_VERSION, SUBCLASS_LEVEL, validateMulticlassApplication } from '../../shared/multiclassRules.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json();
    const character = await base44.asServiceRole.entities.Character.get(payload.character_id);
    if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Character not found' }, { status: 404 });
    const action = payload.action || 'preview';
    const className = String(payload.class_name || '');
    const subclass = String(payload.subclass || '');

    if (action === 'preview' || action === 'validate') {
      const validation = validateMulticlassApplication(character, className, subclass, Number(payload.class_level || 1));
      return Response.json({ ...validation, class_name: className, subclass_level: SUBCLASS_LEVEL[className], rules_version: MULTICLASS_RULES_VERSION });
    }

    if (action === 'set_expertise') {
      if (!(character.multiclass || []).some(entry => entry?.class === 'Rogue' && Number(entry.levels || 0) >= 1) && character.class !== 'Rogue') return Response.json({ error: 'Rogue Expertise requires Rogue level 1.' }, { status: 400 });
      const expertise = applyRogueExpertise(character.skills || {}, payload.expertise_choices, payload.previous_choices || []);
      if (!expertise.ok) return Response.json({ error: expertise.reason }, { status: 400 });
      await base44.asServiceRole.entities.Character.update(character.id, { skills: expertise.skills });
      return Response.json({ success: true, skills: expertise.skills, expertise_choices: expertise.choices, rules_version: MULTICLASS_RULES_VERSION });
    }

    if (action !== 'apply_class') return Response.json({ error: 'Unsupported action' }, { status: 400 });
    if (!className || className === character.class || (character.multiclass || []).some(entry => entry?.class === className)) return Response.json({ error: 'Choose a new class not already on this character.' }, { status: 400 });
    const plan = buildMulticlassClassUpdates(character, className, payload.expertise_choices || [], subclass);
    if (!plan.ok) return Response.json({ error: plan.reason, validation: plan }, { status: 400 });
    await base44.asServiceRole.entities.Character.update(character.id, plan.updates);
    return Response.json({ success: true, character: { ...character, ...plan.updates }, granted_features: plan.granted_features, rules_version: MULTICLASS_RULES_VERSION });
  } catch (error) {
    return Response.json({ error: error.message || 'Multiclass update failed' }, { status: 500 });
  }
}