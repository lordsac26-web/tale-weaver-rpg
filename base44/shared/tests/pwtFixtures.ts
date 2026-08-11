export const PWT_FIXTURE_APPLIED_AT = '2026-08-10T01:10:46.874Z';

export const pwtCondition = (id, overrides = {}) => ({
  id: `cond_pwt_${id}`, name: 'pass without trace', display_name: 'Pass Without Trace', source: 'Pass without Trace',
  target_id: id, caster_id: id, applied_at: PWT_FIXTURE_APPLIED_AT, duration_type: 'timestamp',
  expires_at: '2026-08-10T02:10:46.874Z', concentration: true, ...overrides,
});

export const pwtModifier = (id, overrides = {}) => ({
  id: `mod_pwt_${id}`, source: 'Pass without Trace', effect: 'skill_bonus', skill: 'Stealth', bonus: 10,
  concentration: true, character_id: id, target_id: id, caster_id: id, applied_at: PWT_FIXTURE_APPLIED_AT,
  expires_at: '2026-08-10T02:10:46.874Z', ...overrides,
});

export const pwtConcentration = (id, overrides = {}) => ({
  spell_name: 'Pass without Trace', character_id: id, target_id: id, caster_id: id, concentration: true,
  request_id: `cast_${id}`, applied_at: PWT_FIXTURE_APPLIED_AT, expires_at: '2026-08-10T02:10:46.874Z', ...overrides,
});