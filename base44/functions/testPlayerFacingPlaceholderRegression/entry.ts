import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { humanizeStateToken, isUnresolvedStateToken, playerFacingLocationLabel, guardPlayerFacingStoryText } from '../../shared/story/playerFacingTextGuard.ts';
import { groundedFallbackChoices } from '../../shared/story/storyBootstrap.ts';

const PROTECTED_SESSION = '6a6825edd695bd65a4322256';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    const checks = [], check = (name, pass) => checks.push({ name, pass: !!pass });

    check('template_variable_detected', isUnresolvedStateToken('Return to {{objective_node}} at once.'));
    check('interpolation_detected', isUnresolvedStateToken('Approach ${objective_node} quietly.'));
    check('known_state_key_detected', isUnresolvedStateToken('at_objective_entry'));
    check('two_segment_state_key_detected', isUnresolvedStateToken('concealed_vantage'));
    check('generic_snake_token_detected', isUnresolvedStateToken('move_to_underworld_gate'));
    check('ordinary_prose_not_flagged', !isUnresolvedStateToken("The iron-grated tunnels beneath the Magistrate's district hum faintly."));
    check('humanize_strips_position_preposition', humanizeStateToken('at_objective_entry') === 'the objective entry');
    check('humanize_nested_preposition', humanizeStateToken('away_from_objective_entry') === 'the objective entry');
    const label = playerFacingLocationLabel('at_objective_entry');
    check('missing_display_name_falls_back_to_descriptive_prose', label === 'the objective entry' && !label.includes('_'));

    // Fixture: compose fallback choices for a scene node whose display name is
    // missing. The state key must never reach the composed choice text.
    const composed = groundedFallbackChoices({ location: 'at_objective_entry', requestId: 'placeholder-fixture-1', previousChoices: [], lastPlayerAction: '' });
    check('composed_choices_carry_no_raw_key', composed.length === 4 && composed.every((choice) => !isUnresolvedStateToken(choice.text)));
    check('composed_choices_use_descriptive_prose', composed.every((choice) => choice.text.includes('the objective entry')));

    // Commit guard: a candidate leaking tokens in every player-facing field is
    // repaired in place before the story entry can be written.
    const guarded = guardPlayerFacingStoryText({
      narrative: 'You reach {{at_objective_entry}} and study the approaches.',
      location_update: 'at_objective_entry',
      choices: [
        { text: 'Scan the approaches to at_objective_entry.', action_type: 'skill_check', skill_check: 'Perception', dc: 11 },
        { text: 'Hold position at ${objective_node}.', action_type: 'skill_check', skill_check: 'Insight', dc: 11 },
        { text: 'Recall the rites tied to at_objective_entry.', action_type: 'skill_check', skill_check: 'Arcana', dc: 12 },
        { text: 'Test the footing past at_objective_entry.', action_type: 'skill_check', skill_check: 'Acrobatics', dc: 12 },
      ],
    });
    check('guard_repairs_narrative', !isUnresolvedStateToken(guarded.result.narrative));
    check('guard_preserves_choice_mechanics', guarded.result.choices.every((choice) => choice.action_type === 'skill_check' && Number.isFinite(Number(choice.dc))));
    check('guard_repairs_all_choices', guarded.result.choices.every((choice) => !isUnresolvedStateToken(choice.text)));
    check('guard_repairs_location_label', !isUnresolvedStateToken(guarded.result.location_update) && guarded.result.location_update === 'the objective entry');
    check('guard_reports_each_repair', guarded.repairs.length >= 5);

    // Live backlog lint: the protected session's recent entries, scene labels,
    // and current location must never contain an unresolved token.
    const session = await base44.asServiceRole.entities.GameSession.get(PROTECTED_SESSION).catch(() => null);
    if (!session) {
      check('live_session_readable', false);
    } else {
      const lintTargets = [
        String(session.current_location || ''),
        ...(session.story_log || []).slice(-20).flatMap((entry) => [
          String(entry?.text || ''), String(entry?.scene_location || ''),
          ...(entry?.choices || []).map((choice) => String(choice?.text || '')),
        ]),
      ];
      const offending = lintTargets.filter((value) => isUnresolvedStateToken(value));
      check('live_backlog_free_of_unresolved_tokens', offending.length === 0);
    }

    const passed = checks.filter((row) => row.pass).length;
    return Response.json({
      all_pass: passed === checks.length, passed, failed: checks.length - passed, total: checks.length, checks,
      writes: 0, cleanup_verified: true, cleanup: [], fixtures_created: 0,
      coverage: 'placeholder_guard_contracts_plus_live_backlog_lint', player_facing_text_guard_version: 'player-facing-text-guard-v1.0.0',
    });
  } catch (error) {
    return Response.json({ error: error.message, all_pass: false }, { status: 500 });
  }
}