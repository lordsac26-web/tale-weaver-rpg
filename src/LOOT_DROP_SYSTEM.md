# Loot Drop System - Feature Documentation

## Overview
A comprehensive loot generation and collection system that creates randomized rewards based on monster challenge rating (CR), character level, and class affinity.

## Features

### 1. CR-Based Loot Generation
- **Backend Function:** `generateLoot`
- Generates loot appropriate to enemy challenge rating
- Scales coins and items based on CR tier
- Supports multiple enemies (scales loot by count)

### 2. Class Affinity System
- Items are biased toward the character's class
- Each class has keywords that increase drop chance
- Example: Fighters get more weapons/armor, Wizards get scrolls/staves

### 3. Rarity Tiers
- **Common** (beige) - Basic items, potions, gear
- **Uncommon** (green) - Magic items, +1 weapons
- **Rare** (blue) - Powerful magic items, rings
- **Very Rare** (purple) - High-level artifacts
- **Legendary** (orange) - Unique powerful items (Vorpal Sword, Ring of Wishes)

### 4. Enemy Type Modifiers
Different enemy types drop different loot:
- **Undead:** 50% coins, drops Holy Water/Silver Dust
- **Dragon:** 3× coins, drops Dragon Scale/Precious Gems
- **Demon:** 80% coins, drops Infernal Iron/Demon Ichor
- **Beast:** 30% coins, drops Hide/Claws/Teeth
- **Humanoid:** Normal coins, drops Weapon/Armor
- **Construct:** 20% coins, drops Scrap Metal/Parts
- **Elemental:** 10% coins, drops Elemental Core/Mana Crystal

## Component Usage

### LootDropGenerator Component

**Import:**
```javascript
import LootDropGenerator from '@/components/game/LootDropGenerator';
```

**Props:**
```javascript
{
  character: Character,      // Current character object
  enemy: {                   // Enemy/enemy group info
    name: string,            // Enemy name
    cr: number,              // Challenge rating
    type: string,            // Enemy type (undead, dragon, etc.)
    count: number            // Number of enemies
  },
  onClose: () => void,       // Close modal callback
  onComplete: (updates, loot) => void  // Collection callback
}
```

**Example Usage:**
```javascript
const [showLoot, setShowLoot] = useState(false);

// After combat ends
const handleCombatVictory = (enemies) => {
  setShowLoot(true);
};

// In JSX
{showLoot && (
  <LootDropGenerator
    character={character}
    enemy={{
      name: 'Ancient Red Dragon',
      cr: 24,
      type: 'dragon',
      count: 1
    }}
    onClose={() => setShowLoot(false)}
    onComplete={(updates, loot) => {
      // Update character with loot
      updateMutation.mutate({ 
        id: characterId, 
        data: updates 
      });
      setShowLoot(false);
    }}
  />
)}
```

## Backend Function

### generateLoot

**Endpoint:** `functions/generateLoot.js`

**Input Parameters:**
```javascript
{
  level: number,              // Character level (1-20)
  enemy_cr: number,           // Enemy challenge rating
  enemy_type: string,         // Enemy type
  num_enemies: number,        // Number of enemies defeated
  character_class: string     // Character's class (for affinity)
}
```

**Response:**
```javascript
{
  success: true,
  tier: 'medium',             // Loot tier (trivial/low/medium/high/legendary)
  cr_used: 5,                 // CR used for calculation
  coins: {
    gold: 45,
    silver: 120,
    copper: 300
  },
  items: [                    // Array of generated items
    {
      name: "Potion of Healing",
      type: "consumable",
      rarity: "common",
      effect: "Restore 2d4+2 HP",
      weight: 0.5,
      value: 50,
      quantity: 2
    }
  ],
  artifact: null,             // Legendary artifact (if rolled)
  summary: {
    total_gold_value: 120,
    item_count: 3,
    rarest_item: "rare",
    enemies_defeated: 1
  }
}
```

## Loot Tables

### Coin Ranges by Tier

| Tier | Level Range | Gold | Silver | Copper |
|------|-------------|------|--------|--------|
| Trivial | 1-4 | 0-5 | 5-20 | 10-50 |
| Low | 5-10 | 5-15 | 10-30 | 20-100 |
| Medium | 11-16 | 15-50 | 30-80 | 50-200 |
| High | 17-20 | 50-150 | 80-200 | 100-500 |
| Legendary | 20+ | 150-500 | 200-500 | 500-1000 |

### Item Count by CR

- **CR 0-4:** 1 item
- **CR 5-10:** 1d3 items
- **CR 11-16:** 1d4 items
- **CR 17+:** 2d3 items

### Class Affinity Keywords

```javascript
{
  fighter:   ['weapon', 'armor', 'belt', 'strength', 'shield'],
  barbarian: ['weapon', 'belt', 'strength', 'giant'],
  paladin:   ['weapon', 'armor', 'protection', 'holy'],
  ranger:    ['bow', 'archery', 'boots', 'cloak', 'arrow'],
  rogue:     ['boots', 'cloak', 'lockpicks', 'dagger', 'displacement'],
  monk:      ['boots', 'speed', 'cloak', 'belt'],
  wizard:    ['scroll', 'wand', 'staff', 'fireball', 'magic'],
  sorcerer:  ['scroll', 'wand', 'staff', 'fireball', 'magic'],
  warlock:   ['scroll', 'wand', 'staff', 'magic', 'necklace'],
  bard:      ['scroll', 'cloak', 'protection', 'wand'],
  cleric:    ['healing', 'holy', 'protection', 'amulet'],
  druid:     ['healing', 'hide', 'cloak', 'staff'],
  artificer: ['wand', 'scrap', 'mechanical', 'gear', 'staff'],
}
```

## Integration Examples

### 1. Combat Victory Integration

```javascript
// In your combat component
const handleVictory = async (defeatedEnemies) => {
  // Show loot modal for first enemy (or combine all)
  const primaryEnemy = defeatedEnemies[0];
  setShowLootDrop(true);
};
```

### 2. Manual Loot Generation

```javascript
// Generate loot without combat
const generateLootManually = async () => {
  const result = await base44.functions.invoke('generateLoot', {
    level: character.level,
    enemy_cr: 5,
    enemy_type: 'humanoid',
    num_enemies: 1,
    character_class: character.class
  });
  
  console.log('Generated loot:', result.data);
};
```

### 3. Custom Loot Tables

Extend the system by modifying `functions/generateLoot.js`:

```javascript
// Add custom items
const customItems = [
  {
    name: 'Homebrew Item',
    type: 'custom',
    rarity: 'rare',
    effect: 'Custom effect',
    weight: 1,
    value: 500
  }
];

// Add to existing pools
LOOT_TABLES.rareItems.push(...customItems);
```

## UI Flow

```
1. Combat Ends
   ↓
2. Show LootDropGenerator Modal
   ↓
3. Click "Generate Loot"
   ↓
4. Backend generates loot based on CR
   ↓
5. Display coins and items with rarity colors
   ↓
6. Player selects items to collect
   ↓
7. Click "Collect Loot"
   ↓
8. Update character entity
   ↓
9. Show collection confirmation
   ↓
10. Close modal
```

## Styling

### Rarity Colors
```javascript
const RARITY_COLORS = {
  common: { 
    border: 'rgba(180,140,90,0.3)', 
    text: '#e8d5b7' 
  },
  uncommon: { 
    border: 'rgba(40,160,80,0.5)', 
    text: '#86efac',
    glow: '0 0 12px rgba(40,160,80,0.3)'
  },
  rare: { 
    border: 'rgba(60,100,220,0.6)', 
    text: '#93c5fd',
    glow: '0 0 16px rgba(60,100,220,0.4)'
  },
  very_rare: { 
    border: 'rgba(150,90,230,0.6)', 
    text: '#c4b5fd',
    glow: '0 0 20px rgba(150,90,230,0.4)'
  },
  legendary: { 
    border: 'rgba(200,100,50,0.8)', 
    text: '#fbbf24',
    glow: '0 0 24px rgba(200,100,50,0.5)'
  },
};
```

## Best Practices

### 1. Balance Considerations
- Higher CR = better loot, but scale appropriately
- Use `num_enemies` to scale for groups
- Consider campaign power level when adjusting tables

### 2. Performance
- Loot generation is fast (<100ms)
- Modal renders only when needed
- Uses React Query for character updates

### 3. User Experience
- Auto-select all items by default
- Show clear rarity indicators
- Provide regenerate option
- Confirm collection with toast notification

## Troubleshooting

### Common Issues

**Loot not generating:**
- Check backend function is deployed
- Verify enemy_cr is a valid number
- Ensure character object is passed

**Items not appearing in inventory:**
- Verify `onComplete` callback updates character
- Check React Query invalidation
- Ensure inventory array is properly merged

**Class affinity not working:**
- Verify character.class matches affinity keys
- Check case sensitivity (lowercase comparison)

## Future Enhancements

Potential additions:
- [ ] Loot chest system (stored for later)
- [ ] Party loot distribution
- [ ] Custom loot tables per campaign
- [ ] Item identification for magic items
- [ ] Loot history tracking
- [ ] Achievement system for rare drops
- [ ] Seasonal/event-specific loot tables

## Credits
- Backend: `functions/generateLoot.js`
- Frontend: `components/game/LootDropGenerator.jsx`
- Icons: `lucide-react`
- Animations: `framer-motion