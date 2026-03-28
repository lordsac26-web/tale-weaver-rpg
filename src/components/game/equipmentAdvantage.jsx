/**
 * Equipment-based advantage/disadvantage for skill checks.
 *
 * D&D 5e items that grant advantage on specific checks:
 *  - Boots of Elvenkind → advantage on Dexterity (Stealth) checks
 *  - Cloak of Elvenkind → advantage on Dexterity (Stealth) checks to hide
 *  - Mithral armor      → removes stealth disadvantage (not advantage, but cancel)
 *  - Eyes of the Eagle   → advantage on Perception checks (sight)
 *
 * This module inspects equipped items (by name + magic_properties) and returns
 * { advantage: bool, disadvantage: bool, sources: string[] } for a given skill.
 */

// Lowercase item-name fragments → which skills get advantage
const ITEM_ADVANTAGE_MAP = [
  { pattern: 'boots of elvenkind',   skill: 'Stealth',    type: 'advantage', label: 'Boots of Elvenkind' },
  { pattern: 'cloak of elvenkind',   skill: 'Stealth',    type: 'advantage', label: 'Cloak of Elvenkind' },
  { pattern: 'eyes of the eagle',    skill: 'Perception',  type: 'advantage', label: 'Eyes of the Eagle' },
  { pattern: 'eyes of minute seeing', skill: 'Investigation', type: 'advantage', label: 'Eyes of Minute Seeing' },
  { pattern: 'stone of good luck',   skill: '*',           type: 'advantage', label: 'Stone of Good Luck' }, // luckstone: +1 to checks (we model as advantage for simplicity)
  { pattern: 'ring of free action',  skill: 'Athletics',   type: 'advantage', label: 'Ring of Free Action' },
  { pattern: 'gloves of thievery',   skill: 'Sleight of Hand', type: 'advantage', label: 'Gloves of Thievery' },
  { pattern: 'hat of disguise',      skill: 'Deception',   type: 'advantage', label: 'Hat of Disguise' },
];

// Heavy / medium armor with stealth disadvantage (unless mithral)
function armorCausesStealthDisadvantage(equipped) {
  const armor = equipped?.armor;
  if (!armor) return false;
  const type = (armor.armor_type || '').toLowerCase();
  if (type !== 'heavy' && type !== 'medium') return false;
  // Mithral cancels stealth disadvantage
  const props = armor.magic_properties || [];
  if (props.includes('mithral')) return false;
  const name = (armor.name || '').toLowerCase();
  if (name.includes('mithral')) return false;
  // Medium armor only causes disadvantage if it's scale mail, half plate, breastplate does NOT
  // Per 5e PHB: chain shirt and breastplate do NOT impose stealth disadvantage
  if (type === 'medium') {
    const stealthDisNames = ['scale mail', 'half plate', 'hide'];
    return stealthDisNames.some(n => name.includes(n));
  }
  return true; // heavy always
}

/**
 * Check all equipped items for advantage/disadvantage on a given skill.
 * @param {object} equipped - character.equipped object (slot → item)
 * @param {string} skillName - e.g. "Stealth", "Perception"
 * @returns {{ advantage: boolean, disadvantage: boolean, sources: string[] }}
 */
export function getEquipmentAdvantage(equipped, skillName) {
  if (!equipped || !skillName) return { advantage: false, disadvantage: false, sources: [] };

  const result = { advantage: false, disadvantage: false, sources: [] };
  const normalSkill = skillName.trim();

  // Check each equipped item against the advantage map
  const allItems = Object.values(equipped).filter(Boolean);
  for (const item of allItems) {
    if (!item || typeof item !== 'object') continue;
    const itemName = (item.name || '').toLowerCase();

    for (const rule of ITEM_ADVANTAGE_MAP) {
      if (rule.skill !== '*' && rule.skill !== normalSkill) continue;
      if (!itemName.includes(rule.pattern)) continue;

      if (rule.type === 'advantage') {
        result.advantage = true;
        result.sources.push(rule.label);
      } else if (rule.type === 'disadvantage') {
        result.disadvantage = true;
        result.sources.push(rule.label);
      }
    }
  }

  // Armor stealth disadvantage
  if (normalSkill === 'Stealth' && armorCausesStealthDisadvantage(equipped)) {
    result.disadvantage = true;
    result.sources.push(`${equipped.armor?.name || 'Heavy/Medium Armor'} (stealth penalty)`);
  }

  return result;
}

/**
 * Roll a d20 with advantage or disadvantage.
 * Returns { roll: number, allRolls: number[], hadAdvantage: bool, hadDisadvantage: bool }
 */
export function rollD20WithAdvantage(advantage, disadvantage) {
  const roll1 = Math.floor(Math.random() * 20) + 1;

  // Advantage and disadvantage cancel each other out (5e rule)
  if (advantage && disadvantage) {
    return { roll: roll1, allRolls: [roll1], hadAdvantage: false, hadDisadvantage: false };
  }

  if (advantage) {
    const roll2 = Math.floor(Math.random() * 20) + 1;
    return { roll: Math.max(roll1, roll2), allRolls: [roll1, roll2], hadAdvantage: true, hadDisadvantage: false };
  }

  if (disadvantage) {
    const roll2 = Math.floor(Math.random() * 20) + 1;
    return { roll: Math.min(roll1, roll2), allRolls: [roll1, roll2], hadAdvantage: false, hadDisadvantage: true };
  }

  return { roll: roll1, allRolls: [roll1], hadAdvantage: false, hadDisadvantage: false };
}