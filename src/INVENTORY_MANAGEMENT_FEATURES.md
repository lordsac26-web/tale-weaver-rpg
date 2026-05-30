# Inventory Management System - Feature Documentation

## Overview
A comprehensive inventory management screen with drag-and-drop organization, enhanced equipment slots, and integrated economy system.

## Features Implemented

### 1. Drag-and-Drop Item Organization
**Component:** `EnhancedInventoryGrid.jsx`
- Uses `@hello-pangea/dnd` for smooth drag-and-drop functionality
- Items can be reordered by dragging and dropping
- Visual feedback during drag operations (opacity change)
- Automatic save to character entity on reorder

**Usage:**
```javascript
<EnhancedInventoryGrid
  items={filteredItems}
  onEquip={handleEquip}
  onDelete={handleDelete}
  onUse={handleUse}
  onSell={setSellingItem}
  equippedSlots={equipped}
  onReorder={handleReorder}  // Saves new order to database
/>
```

### 2. Enhanced Equipment Slots
**Component:** `EnhancedEquipmentSlots.jsx`
- 9 equipment slots: Head, Neck, Chest, Hands, Ring 1, Ring 2, Feet, Weapon, Offhand
- Click empty slot to open item selector modal
- Click equipped item to unequip
- Visual indicators showing available items per slot
- Displays item bonuses (AC, Attack, Damage, Saves, Ability Scores)
- Beautiful fantasy-themed UI with glow effects

**Features:**
- **Item Selector Modal:** Shows all eligible items for the slot
- **Smart Filtering:** Automatically filters items by category/type
- **Bonus Display:** Shows all item modifiers in tooltip
- **Quick Unequip:** Hover to reveal unequip button

### 3. Sell/Discard Functionality
**Integration:** Connected to existing `SellItemModal`
- Quick sell button on item hover
- Sell from item details modal
- Automatic gold calculation and update
- Quantity selection for stackable items

**Economy Connection:**
- Uses existing vendor system
- Respects item value properties
- Updates character gold immediately

### 4. Inventory Page Enhancements
**Page:** `InventoryPage.jsx`

**New Features:**
- **Tab System:** Switch between Inventory and Equipment views
- **Filter Tabs:** All Items, Weapons, Armor, Consumables
- **Summary Stats:** Total items, weight, and value
- **Rarity Colors:** Items display with rarity-based borders
  - Common: Beige
  - Uncommon: Green
  - Rare: Blue
  - Very Rare: Purple
  - Legendary: Orange

**Layout:**
```
┌─────────────────────────────────────┐
│ Header (Gold + Encumbrance)         │
├─────────────────────────────────────┤
│ [Inventory Tab] [Equipment Tab]     │
├─────────────────────────────────────┤
│ Filter: [All] [Weapons] [Armor]...  │
├─────────────────────────────────────┤
│ Item Grid (Drag-and-Drop)           │
│ - Hover for quick actions           │
│ - Click for details                 │
│ - Drag to reorder                   │
└─────────────────────────────────────┘
```

## Component Architecture

### File Structure
```
components/inventory/
├── EnhancedInventoryGrid.jsx    # Main grid with D&D
├── EnhancedEquipmentSlots.jsx   # Equipment management
├── InventoryGrid.jsx            # Original grid (keep for fallback)
├── EncumbranceBar.jsx           # Weight tracking
├── GoldHeader.jsx               # Currency display
└── SellItemModal.jsx            # Selling interface

pages/
└── InventoryPage.jsx            # Main inventory screen
```

### Data Flow
```
User Action → Component Handler → Mutation → Database → Query Invalidation → UI Update
```

**Example: Equipping Item**
1. User clicks item in inventory
2. `handleEquip(item)` called
3. Mutation updates character.equipped
4. Query invalidates character data
5. UI re-renders with updated equipment

## Integration Points

### With Existing Systems
1. **Character Entity:** 
   - `inventory` array
   - `equipped` object
   - `gold`, `silver`, `copper`

2. **Vendor System:**
   - Sell modal uses existing vendor pricing
   - Connected to market/vendors

3. **Economy:**
   - Gold updates persist to character
   - Silver/copper conversion handled

### Backend Functions Used
- `base44.entities.Character.update()` - All item operations
- React Query mutations for optimistic updates

## Usage Guide

### Accessing the Inventory
```javascript
// Navigate from any page
navigate('/InventoryPage?character_id=CHARACTER_ID');

// Or use Link component
<Link to={`/InventoryPage?character_id=${character.id}`}>
  Open Inventory
</Link>
```

### Adding Items to Inventory
```javascript
// Update character entity
await base44.entities.Character.update(characterId, {
  inventory: [
    ...existingInventory,
    {
      name: "Longsword",
      category: "Weapon",
      type: "Martial Melee",
      weight: 3,
      value: 15,
      rarity: "common",
      icon: "⚔️",
      description: "A standard longsword",
      bonuses: {
        attack: 1,
        damage: 1
      }
    }
  ]
});
```

### Item Properties Reference
```javascript
{
  name: string,           // Required
  category: string,       // "Weapon", "Armor", "Consumable", etc.
  type: string,           // More specific: "Martial Melee", "Light Armor"
  weight: number,         // In pounds
  value: number,          // In gold pieces
  rarity: string,         // "common", "uncommon", "rare", "very_rare", "legendary"
  icon: string,           // Emoji or icon identifier
  description: string,    // Item description
  quantity: number,       // Stack size (default: 1)
  bonuses: {             // Equipment modifiers
    ac?: number,
    attack?: number,
    damage?: number,
    saving_throws?: number,
    ability_scores?: { strength?: number, ... }
  },
  properties: string[]    // Tags: ["Versatile", "Two-handed", etc.]
}
```

## Styling System

### Theme Integration
All components use the existing tavern theme:
- Font families: Cinzel, IM Fell English, EB Garamond
- Colors: Wood tones, brass, parchment
- Effects: Glass panels, glow effects, brass borders

### CSS Classes Used
- `font-fantasy` / `font-fantasy-deco` - Display fonts
- `font-body` - Body text
- `glass-panel` - Semi-transparent panels
- `fantasy-card` - Interactive cards with hover
- `badge-gold`, `badge-blood`, `badge-arcane` - Rarity badges

## Performance Considerations

1. **React Query Caching:** Character data cached, invalidates on changes
2. **Optimistic Updates:** UI responds immediately, syncs in background
3. **Drag-and-Drop:** Only reorders locally, saves on drop
4. **Modal Rendering:** Lazy rendered with AnimatePresence

## Future Enhancements

Potential additions:
- [ ] Item comparison panel
- [ ] Bulk sell/discard
- [ ] Search functionality
- [ ] Sorting options (by name, value, weight)
- [ ] Item crafting system
- [ ] Storage/chest system
- [ ] Trading between characters
- [ ] Item identification for magic items

## Troubleshooting

### Common Issues

**Drag-and-drop not working:**
- Ensure `@hello-pangea/dnd` is installed
- Check that `onReorder` callback is provided
- Verify items have unique `id` or `name` properties

**Equipment not updating:**
- Check character entity permissions (RLS)
- Verify mutation is successful in network tab
- Ensure query invalidation is happening

**Sell modal not appearing:**
- Check that `onSell` callback sets state correctly
- Verify `AnimatePresence` is wrapping the modal
- Ensure item has a `value` property

## Credits
- Drag-and-drop: `@hello-pangea/dnd`
- Animations: `framer-motion`
- Icons: `lucide-react`
- UI Components: shadcn/ui