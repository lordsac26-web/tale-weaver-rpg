export const AUDIT_DEPLOYMENT_ID = 'content-completeness-phase1-v2';

export const DOMAIN_NAMES = ['Race', 'Subclass', 'DnDClass', 'Feat', 'Spell', 'Equipment', 'MagicItem', 'VendorItem', 'Monster', 'DnDCondition'];

const field = (path, kind = 'text', direct = true) => ({ path, kind, direct });

export const DOMAIN_CONFIG = {
  Race: {
    display: [field('description'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { ability_score_increase: 'object', speed: 'positive_number', languages: 'array', traits: 'array' }, proposalField: 'description',
  },
  Subclass: {
    display: [field('description'), field('short_description'), field('subclass_flavor'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { class_name: 'text', features_by_level: 'object' }, proposalField: 'description',
  },
  DnDClass: {
    display: [field('description'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { hit_die: 'positive_number', primary_ability: 'text', saving_throw_proficiencies: 'array', features_by_level: 'object' }, proposalField: 'description',
  },
  Feat: {
    display: [field('description'), field('benefits', 'text_array'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { benefits: 'array', category: 'text', tags: 'array' }, proposalField: 'description',
  },
  Spell: {
    display: [field('description'), field('effect_summary'), field('visual_summary'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { level: 'nonnegative_number', school: 'text', casting_time: 'text', range: 'text', components: 'text', duration: 'text', classes: 'array', attack_type: 'text' }, proposalField: 'description',
  },
  Equipment: {
    display: [field('description'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { category: 'text', cost: 'text', weight: 'text_or_number', properties: 'array' }, proposalField: 'description',
  },
  MagicItem: {
    display: [field('description'), field('unidentified_description'), field('raw_data.desc', 'text', false), field('raw_data.description', 'text', false)],
    structured: { category: 'text', rarity: 'text', requires_attunement: 'boolean', modifiers: 'object' }, proposalField: 'description',
  },
  VendorItem: {
    display: [field('description'), field('effect')],
    structured: { category: 'text', rarity: 'text', base_price: 'positive_number', vendor_types: 'array' },
  },
  Monster: {
    display: [field('traits'), field('actions')],
    structured: { armor_class: 'text_or_number', hit_points: 'text_or_number', speed: 'text_or_number', str: 'text_or_number', dex: 'text_or_number', con: 'text_or_number', int: 'text_or_number', wis: 'text_or_number', cha: 'text_or_number', challenge: 'text_or_number' },
  },
  DnDCondition: {
    display: [field('description', 'text_array')],
    structured: { mechanical_effects: 'nonempty_object' },
  },
};