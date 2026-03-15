import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, User, TrendingUp, Package, Sparkles, Heart, Shield, Zap } from 'lucide-react';
import { PROFICIENCY_BY_LEVEL, calcStatMod, calcModDisplay, SKILL_STAT_MAP } from '@/components/game/gameData';
import { getSpellSlotsForLevel, getSpellcastingAbility } from '@/components/game/spellData';
import EncumbranceBar from '@/components/inventory/EncumbranceBar';
import { motion } from 'framer-motion';

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_ABBR = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

export default function CharacterSheetFull() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const characterId = searchParams.get('character_id');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('stats'); // stats, features, inventory, spells

  const { data: character, isLoading } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => base44.entities.Character.get(characterId),
    enabled: !!characterId,
  });

  if (!characterId) {
    return <div className="min-h-screen parchment-bg flex items-center justify-center" style={{ color: 'rgba(201,169,110,0.5)' }}>No character selected</div>;
  }

  if (isLoading || !character) {
    return (
      <div className="min-h-screen parchment-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
  const spellcastingAbility = getSpellcastingAbility(character.class, character.subclass);
  const spellSlots = spellcastingAbility ? getSpellSlotsForLevel(character.class, character.level) : null;

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(180,140,90,0.2)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <User className="w-5 h-5" style={{ color: '#f0c040' }} />
        <div className="flex-1">
          <h1 className="font-fantasy-deco font-bold text-base text-glow-gold" style={{ color: '#f0c040' }}>
            {character.name}
          </h1>
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            Level {character.level} {character.race} {character.class}
          </p>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0"
        style={{ background: 'rgba(10,6,3,0.9)', borderBottom: '1px solid rgba(180,140,90,0.1)' }}>
        <StatPill label="HP" value={`${character.hp_current}/${character.hp_max}`} icon={<Heart className="w-3 h-3" />} color="#dc2626" />
        <StatPill label="AC" value={character.armor_class || 10} icon={<Shield className="w-3 h-3" />} color="#3b82f6" />
        <StatPill label="Prof" value={`+${profBonus}`} icon={<Zap className="w-3 h-3" />} color="#f59e0b" />
        <StatPill label="Speed" value={`${character.speed || 30} ft`} color="#22c55e" />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.85)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
        {[
          { key: 'stats', label: 'Stats & Skills', icon: TrendingUp },
          { key: 'features', label: 'Features', icon: Sparkles },
          { key: 'inventory', label: 'Inventory', icon: Package },
          { key: 'spells', label: 'Spells', icon: Sparkles },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="px-4 py-2 rounded-lg font-fantasy text-sm transition-all flex items-center gap-2"
            style={activeTab === key ? {
              background: 'rgba(60,40,10,0.8)',
              borderBottom: '2px solid #f0c040',
              color: '#f0c040',
            } : {
              color: 'rgba(180,140,90,0.5)',
            }}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'stats' && <StatsTab character={character} profBonus={profBonus} />}
          {activeTab === 'features' && <FeaturesTab character={character} />}
          {activeTab === 'inventory' && <InventoryTab character={character} characterId={characterId} />}
          {activeTab === 'spells' && <SpellsTab character={character} spellSlots={spellSlots} />}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, icon, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0"
      style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.15)' }}>
      {icon && <span style={{ color }}>{icon}</span>}
      <div className="text-xs">
        <div style={{ color: 'rgba(180,140,90,0.5)' }}>{label}</div>
        <div className="font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{value}</div>
      </div>
    </div>
  );
}

function StatsTab({ character, profBonus }) {
  return (
    <div className="space-y-4">
      {/* Ability Scores */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">ABILITY SCORES</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {STATS.map(stat => {
            const value = character[stat] || 10;
            const mod = calcStatMod(value);
            return (
              <div key={stat} className="stat-box rounded-lg p-3 text-center">
                <div className="text-xs mb-1" style={{ color: 'rgba(180,140,90,0.5)' }}>
                  {STAT_ABBR[stat]}
                </div>
                <div className="font-fantasy font-bold text-2xl" style={{ color: '#f0c040' }}>
                  {value}
                </div>
                <div className="text-sm font-fantasy" style={{ color: mod >= 0 ? '#86efac' : '#fca5a5' }}>
                  {calcModDisplay(mod)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">SKILLS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => {
            const isProficient = character.skills?.[skill];
            const hasExpertise = character.skills?.[`${skill}_expertise`];
            const statMod = calcStatMod(character[stat] || 10);
            const bonus = statMod + (isProficient ? profBonus * (hasExpertise ? 2 : 1) : 0);
            
            return (
              <div key={skill} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: isProficient ? 'rgba(40,25,8,0.6)' : 'rgba(10,6,3,0.4)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ 
                      background: isProficient ? 'rgba(240,192,64,0.3)' : 'rgba(80,50,10,0.2)',
                      border: `1px solid ${isProficient ? '#f0c040' : 'rgba(180,140,90,0.2)'}`,
                      color: isProficient ? '#f0c040' : 'rgba(180,140,90,0.4)'
                    }}>
                    {hasExpertise ? '★' : isProficient ? '●' : '○'}
                  </div>
                  <span className="text-sm" style={{ color: '#e8d5b7' }}>{skill}</span>
                </div>
                <span className="font-fantasy text-sm" style={{ color: bonus >= 0 ? '#86efac' : '#fca5a5' }}>
                  {calcModDisplay(bonus)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saving Throws */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">SAVING THROWS</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STATS.map(stat => {
            const isProficient = character.saving_throws?.[stat];
            const statMod = calcStatMod(character[stat] || 10);
            const bonus = statMod + (isProficient ? profBonus : 0);
            
            return (
              <div key={stat} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: isProficient ? 'rgba(40,25,8,0.6)' : 'rgba(10,6,3,0.4)' }}>
                <span className="text-sm" style={{ color: '#e8d5b7' }}>{STAT_ABBR[stat]}</span>
                <span className="font-fantasy text-sm" style={{ color: bonus >= 0 ? '#86efac' : '#fca5a5' }}>
                  {calcModDisplay(bonus)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeaturesTab({ character }) {
  const features = character.features || [];
  const feats = character.feats || [];
  const conditions = character.conditions || [];
  const modifiers = character.active_modifiers || [];

  return (
    <div className="space-y-4">
      {/* Class Features */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">CLASS FEATURES</h3>
        {features.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>No features yet</p>
        ) : (
          <div className="space-y-2">
            {features.map((feat, idx) => (
              <div key={idx} className="px-3 py-2 rounded-lg" style={{ background: 'rgba(40,25,8,0.5)' }}>
                <span className="text-sm font-fantasy" style={{ color: '#e8d5b7' }}>{feat}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feats */}
      {feats.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
          <h3 className="tavern-section-label mb-3">FEATS</h3>
          <div className="space-y-2">
            {feats.map((feat, idx) => (
              <div key={idx} className="px-3 py-2 rounded-lg" style={{ background: 'rgba(60,40,120,0.3)', border: '1px solid rgba(140,80,220,0.3)' }}>
                <span className="text-sm font-fantasy" style={{ color: '#c084fc' }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Modifiers */}
      {modifiers.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
          <h3 className="tavern-section-label mb-3">ACTIVE MODIFIERS</h3>
          <div className="space-y-2">
            {modifiers.map((mod, idx) => (
              <div key={idx} className="px-3 py-2 rounded-lg flex items-center justify-between"
                style={{ background: 'rgba(40,80,140,0.3)', border: '1px solid rgba(80,140,220,0.3)' }}>
                <span className="text-sm" style={{ color: '#93c5fd' }}>{mod.name || mod.source}</span>
                <span className="text-sm font-fantasy" style={{ color: '#86efac' }}>
                  {mod.value > 0 ? '+' : ''}{mod.value} {mod.applies_to}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
          <h3 className="tavern-section-label mb-3">CONDITIONS</h3>
          <div className="flex flex-wrap gap-2">
            {conditions.map((cond, idx) => (
              <div key={idx} className="px-2 py-1 rounded-lg text-xs font-fantasy"
                style={{ background: 'rgba(120,20,10,0.4)', border: '1px solid rgba(200,60,40,0.4)', color: '#fca5a5' }}>
                {typeof cond === 'string' ? cond : cond.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryTab({ character, characterId }) {
  const queryClient = useQueryClient();
  const inventory = character.inventory || [];
  const equipped = character.equipped || {};

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Character.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId] }),
  });

  const handleDelete = (item) => {
    const newInventory = inventory.filter(i => i !== item);
    updateMutation.mutate({ id: characterId, data: { inventory: newInventory } });
  };

  return (
    <div className="space-y-4">
      <EncumbranceBar character={character} />

      {/* Equipped Items */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">EQUIPPED</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(equipped).map(([slot, item]) => (
            <div key={slot} className="px-3 py-2 rounded-lg" style={{ background: 'rgba(60,40,10,0.5)', border: '1px solid rgba(201,169,110,0.3)' }}>
              <div className="text-xs mb-1" style={{ color: 'rgba(180,140,90,0.5)' }}>{slot}</div>
              <div className="text-sm font-fantasy truncate" style={{ color: '#e8d5b7' }}>{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* All Items */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">ALL ITEMS</h3>
        {inventory.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'rgba(180,140,90,0.4)' }}>
            No items in inventory
          </p>
        ) : (
          <div className="space-y-2">
            {inventory.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(20,13,5,0.6)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon || '📦'}</span>
                  <div>
                    <div className="text-sm font-fantasy" style={{ color: '#e8d5b7' }}>
                      {item.name}
                      {item.quantity > 1 && <span className="ml-1.5 text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>×{item.quantity}</span>}
                    </div>
                    {item.weight > 0 && (
                      <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>
                        {item.weight * (item.quantity || 1)} lb
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(item)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'rgba(252,165,165,0.6)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SpellsTab({ character, spellSlots }) {
  const spellsKnown = character.spells_known || [];
  const spellsPrepared = character.spells_prepared || [];
  const slotsUsed = character.spell_slots || {};

  if (!spellSlots) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
        <p className="text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>
          This class does not have spellcasting
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Spell Slots */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">SPELL SLOTS</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {spellSlots.map((max, idx) => {
            if (max === 0) return null;
            const level = idx + 1;
            const used = slotsUsed[`level_${level}`] || 0;
            const remaining = max - used;

            return (
              <div key={level} className="stat-box rounded-lg p-2 text-center">
                <div className="text-xs mb-1" style={{ color: 'rgba(180,140,90,0.5)' }}>
                  Level {level}
                </div>
                <div className="font-fantasy font-bold text-lg" style={{ color: remaining > 0 ? '#93c5fd' : '#78716c' }}>
                  {remaining}/{max}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prepared Spells */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">PREPARED SPELLS</h3>
        {spellsPrepared.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(180,140,90,0.4)' }}>No spells prepared</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {spellsPrepared.map((spell, idx) => (
              <div key={idx} className="px-2.5 py-1.5 rounded-lg text-sm font-fantasy"
                style={{ background: 'rgba(60,40,120,0.4)', border: '1px solid rgba(140,80,220,0.3)', color: '#c084fc' }}>
                {spell}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Known Spells */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <h3 className="tavern-section-label mb-3">KNOWN SPELLS</h3>
        {spellsKnown.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(180,140,90,0.4)' }}>No spells learned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {spellsKnown.map((spell, idx) => (
              <div key={idx} className="px-2.5 py-1.5 rounded-lg text-sm"
                style={{ 
                  background: spellsPrepared.includes(spell) ? 'rgba(60,40,120,0.4)' : 'rgba(30,20,10,0.5)',
                  border: `1px solid ${spellsPrepared.includes(spell) ? 'rgba(140,80,220,0.3)' : 'rgba(180,140,90,0.15)'}`,
                  color: spellsPrepared.includes(spell) ? '#c084fc' : 'rgba(201,169,110,0.6)'
                }}>
                {spell}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}