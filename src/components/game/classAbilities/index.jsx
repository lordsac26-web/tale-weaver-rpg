// Barrel + registry mapping class names to their ability builder functions.
import { buildFighterAbilities } from './fighterAbilities';
import { buildBarbarianAbilities } from './barbarianAbilities';
import { buildPaladinAbilities } from './paladinAbilities';
import { buildRogueAbilities } from './rogueAbilities';
import { buildMonkAbilities } from './monkAbilities';
import { buildWizardAbilities } from './wizardAbilities';
import { buildBardAbilities } from './bardAbilities';
import { buildClericAbilities } from './clericAbilities';
import { buildDruidAbilities } from './druidAbilities';
import { buildSorcererAbilities } from './sorcererAbilities';
import { buildRangerAbilities } from './rangerAbilities';
import { buildArtificerAbilities } from './artificerAbilities';
import { buildWarlockAbilities } from './warlockAbilities';
import { buildFeatAbilities } from './featAbilities';
import { buildGenericSubclassAbilities } from './subclassAbilities';

// Maps Character.class → builder. Each builder takes a shared ctx and returns an array.
export const CLASS_ABILITY_BUILDERS = {
  Fighter: buildFighterAbilities,
  Barbarian: buildBarbarianAbilities,
  Paladin: buildPaladinAbilities,
  Rogue: buildRogueAbilities,
  Monk: buildMonkAbilities,
  Wizard: buildWizardAbilities,
  Bard: buildBardAbilities,
  Cleric: buildClericAbilities,
  Druid: buildDruidAbilities,
  Sorcerer: buildSorcererAbilities,
  Ranger: buildRangerAbilities,
  Artificer: buildArtificerAbilities,
  Warlock: buildWarlockAbilities,
};

export { buildFeatAbilities, buildGenericSubclassAbilities };