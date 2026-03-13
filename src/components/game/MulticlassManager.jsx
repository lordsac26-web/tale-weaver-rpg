import React, { useState } from 'react';
import { CLASSES } from './gameData';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MulticlassManager({ character, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newClass, setNewClass] = useState('');
  const [newSubclass, setNewSubclass] = useState('');

  const multiclass = character.multiclass || [];
  const totalLevels = character.level + multiclass.reduce((sum, mc) => sum + (mc.levels || 1), 0);

  const handleAdd = () => {
    if (!newClass) return;
    const updated = [
      ...multiclass,
      { class: newClass, subclass: newSubclass || '', levels: 1 }
    ];
    onUpdate({ multiclass: updated });
    setNewClass('');
    setNewSubclass('');
    setAdding(false);
  };

  const handleRemove = (index) => {
    const updated = multiclass.filter((_, i) => i !== index);
    onUpdate({ multiclass: updated });
  };

  const handleLevelChange = (index, delta) => {
    const updated = [...multiclass];
    updated[index].levels = Math.max(1, (updated[index].levels || 1) + delta);
    onUpdate({ multiclass: updated });
  };

  const handlePrimaryLevelChange = (delta) => {
    onUpdate({ level: Math.max(1, character.level + delta) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-fantasy text-lg" style={{ color: 'var(--brass-gold)' }}>
          Multiclassing
        </h3>
        <div className="text-xs" style={{ color: 'rgba(201,169,110,0.5)' }}>
          Total Level: {totalLevels}
        </div>
      </div>

      {/* Primary Class */}
      <div className="glass-panel-light rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-fantasy text-sm" style={{ color: 'var(--brass-gold)' }}>
            {character.class} {character.subclass && `(${character.subclass})`}
          </div>
          <div className="text-xs badge-gold px-2 py-0.5 rounded">Primary</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'rgba(201,169,110,0.6)' }}>Level:</span>
          <button onClick={() => handlePrimaryLevelChange(-1)}
            className="px-2 py-0.5 rounded text-xs btn-fantasy"
            disabled={character.level <= 1}>−</button>
          <span className="font-fantasy text-sm px-2" style={{ color: '#f0c040' }}>{character.level}</span>
          <button onClick={() => handlePrimaryLevelChange(1)}
            className="px-2 py-0.5 rounded text-xs btn-fantasy">+</button>
        </div>
      </div>

      {/* Multiclass Classes */}
      {multiclass.map((mc, idx) => (
        <div key={idx} className="glass-panel-light rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-fantasy text-sm" style={{ color: 'var(--brass-gold)' }}>
              {mc.class} {mc.subclass && `(${mc.subclass})`}
            </div>
            <button onClick={() => handleRemove(idx)}
              className="p-1 rounded text-xs hover:bg-red-900/30 transition-colors"
              style={{ color: 'rgba(252,165,165,0.7)' }}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(201,169,110,0.6)' }}>Level:</span>
            <button onClick={() => handleLevelChange(idx, -1)}
              className="px-2 py-0.5 rounded text-xs btn-fantasy"
              disabled={mc.levels <= 1}>−</button>
            <span className="font-fantasy text-sm px-2" style={{ color: '#f0c040' }}>{mc.levels}</span>
            <button onClick={() => handleLevelChange(idx, 1)}
              className="px-2 py-0.5 rounded text-xs btn-fantasy">+</button>
          </div>
        </div>
      ))}

      {/* Add New Multiclass */}
      {adding ? (
        <div className="glass-panel-light rounded-lg p-3 space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(201,169,110,0.6)' }}>Class</label>
            <Select value={newClass} onValueChange={setNewClass}>
              <SelectTrigger className="select-fantasy">
                <SelectValue placeholder="Choose class..." />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CLASSES)
                  .filter(c => c !== character.class && !multiclass.find(mc => mc.class === c))
                  .map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {newClass && CLASSES[newClass]?.subclasses?.length > 0 && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgba(201,169,110,0.6)' }}>Subclass (Optional)</label>
              <Select value={newSubclass} onValueChange={setNewSubclass}>
                <SelectTrigger className="select-fantasy">
                  <SelectValue placeholder="Choose subclass..." />
                </SelectTrigger>
                <SelectContent>
                  {CLASSES[newClass].subclasses.map(sc => (
                    <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleAdd} className="btn-fantasy flex-1" disabled={!newClass}>
              Add Class
            </Button>
            <Button onClick={() => { setAdding(false); setNewClass(''); setNewSubclass(''); }}
              className="btn-fantasy flex-1"
              style={{ background: 'rgba(60,20,20,0.5)' }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-2 rounded-lg border border-dashed text-sm font-fantasy transition-all"
          style={{ borderColor: 'rgba(201,169,110,0.3)', color: 'rgba(201,169,110,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.6)'; e.currentTarget.style.color = '#c9a96e'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)'; e.currentTarget.style.color = 'rgba(201,169,110,0.6)'; }}>
          <Plus className="w-4 h-4 inline mr-1" /> Add Multiclass
        </button>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(60,30,100,0.2)', border: '1px solid rgba(140,80,220,0.2)' }}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(192,132,252,0.6)' }} />
        <p className="text-xs" style={{ color: 'rgba(192,132,252,0.5)' }}>
          Multiclassing combines features from multiple classes. HP, proficiency bonus, and spell slots are calculated based on total character level.
        </p>
      </div>
    </div>
  );
}