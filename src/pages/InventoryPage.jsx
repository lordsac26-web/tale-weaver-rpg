import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Package, Sword, Shield, Trash2 } from 'lucide-react';
import InventoryGrid from '@/components/inventory/InventoryGrid';
import EncumbranceBar from '@/components/inventory/EncumbranceBar';
import { motion } from 'framer-motion';

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const characterId = searchParams.get('character_id');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all'); // all, weapons, armor, consumables

  const { data: character, isLoading } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => base44.entities.Character.get(characterId),
    enabled: !!characterId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Character.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId] }),
  });

  if (!characterId) {
    return (
      <div className="min-h-screen parchment-bg flex items-center justify-center">
        <p style={{ color: 'rgba(201,169,110,0.5)' }}>No character selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen parchment-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const inventory = character?.inventory || [];
  const equipped = character?.equipped || {};

  const filteredItems = inventory.filter(item => {
    const cat = (item.category || '').toLowerCase();
    if (filter === 'weapons') return cat.includes('weapon');
    if (filter === 'armor') return cat.includes('armor');
    if (filter === 'consumables') return cat.includes('potion') || cat.includes('consumable');
    return true;
  });

  const handleEquip = (item) => {
    const cat = (item.category || '').toLowerCase();
    let slot = null;
    
    if (cat.includes('weapon')) slot = 'weapon';
    else if (cat.includes('armor')) slot = 'chest';
    else if (cat.includes('shield')) slot = 'offhand';
    else if (cat.includes('helmet') || cat.includes('head')) slot = 'head';
    else if (cat.includes('gloves') || cat.includes('hands')) slot = 'hands';
    else if (cat.includes('boots') || cat.includes('feet')) slot = 'feet';
    else if (cat.includes('ring')) slot = equipped.ring1 ? 'ring2' : 'ring1';
    else if (cat.includes('amulet') || cat.includes('neck')) slot = 'neck';

    if (!slot) return;

    const isCurrentlyEquipped = equipped[slot]?.name === item.name;
    const newEquipped = { ...equipped };
    
    if (isCurrentlyEquipped) {
      delete newEquipped[slot];
    } else {
      newEquipped[slot] = item;
    }

    updateMutation.mutate({ 
      id: characterId, 
      data: { equipped: newEquipped } 
    });
  };

  const handleDelete = (item) => {
    const newInventory = inventory.filter(i => i.name !== item.name || i !== item);
    updateMutation.mutate({ 
      id: characterId, 
      data: { inventory: newInventory } 
    });
  };

  const handleUse = (item) => {
    // Consumable logic would go here
    const newInventory = inventory.map(i => {
      if (i === item && i.quantity > 1) {
        return { ...i, quantity: i.quantity - 1 };
      }
      return i;
    }).filter(i => i !== item || i.quantity > 0);

    updateMutation.mutate({ 
      id: characterId, 
      data: { inventory: newInventory } 
    });
  };

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(180,140,90,0.2)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Package className="w-5 h-5" style={{ color: '#f0c040' }} />
        <div className="flex-1">
          <h1 className="font-fantasy-deco font-bold text-base text-glow-gold" style={{ color: '#f0c040' }}>
            Inventory
          </h1>
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            {character?.name}'s belongings
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Encumbrance Bar */}
          <EncumbranceBar character={character} />

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All Items', icon: Package },
              { key: 'weapons', label: 'Weapons', icon: Sword },
              { key: 'armor', label: 'Armor', icon: Shield },
              { key: 'consumables', label: 'Consumables', icon: Package },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-4 py-2 rounded-lg font-fantasy text-sm transition-all flex items-center gap-2"
                style={filter === key ? {
                  background: 'rgba(60,40,10,0.8)',
                  border: '1px solid rgba(201,169,110,0.5)',
                  color: '#f0c040',
                } : {
                  background: 'rgba(20,13,5,0.5)',
                  border: '1px solid rgba(180,140,90,0.15)',
                  color: 'rgba(180,140,90,0.5)',
                }}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Inventory Grid */}
          <InventoryGrid
            items={filteredItems}
            onEquip={handleEquip}
            onDelete={handleDelete}
            onUse={handleUse}
            equippedSlots={equipped}
          />
        </div>
      </div>
    </div>
  );
}