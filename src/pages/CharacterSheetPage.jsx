import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, Save, Edit2, Check, X, RefreshCw, Scroll, Printer, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CLASSES, calcStatMod, calcModDisplay, PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP, CONDITIONS } from '@/components/game/gameData';
import InventoryTab from '@/components/game/InventoryTab';
import SpellbookTab from '@/components/game/SpellbookTab';

const SPELLCASTING_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'];
const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const STAT_ICONS = { strength: '💪', dexterity: '🏹', constitution: '❤️', intelligence: '📚', wisdom: '🔮', charisma: '✨' };

function EditableNumber({ value, onSave, min = 1, max = 30, color = '#e8d5b7', className = '', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { const v = Math.min(max, Math.max(min, parseInt(draft) || min)); onSave(v); setEditing(false); };
  if (editing) return (
    <input autoFocus type="number" value={draft} min={min} max={max}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className={`font-fantasy font-bold text-center w-16 bg-transparent border-b-2 outline-none ${className}`}
      style={{ color, borderColor: '#c9a96e', ...style }} />
  );
  return (
    <span className={`cursor-pointer group relative ${className}`} style={{ color, ...style }}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit">
      {value}
      <Edit2 className="w-2.5 h-2.5 inline ml-1 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: '#c9a96e' }} />
    </span>
  );
}

function EditableText({ value, onSave, placeholder = '', multiline = false, style = {}, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const commit = () => { onSave(draft); setEditing(false); };
  if (editing) {
    if (multiline) return (
      <textarea autoFocus rows={4} value={draft} placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        className={`w-full bg-transparent border rounded-lg p-2 outline-none resize-none text-sm ${className}`}
        style={{ color: '#e8d5b7', borderColor: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif', ...style }} />
    );
    return (
      <input autoFocus value={draft} placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className={`bg-transparent border-b outline-none text-sm ${className}`}
        style={{ color: '#e8d5b7', borderColor: 'rgba(201,169,110,0.4)', ...style }} />
    );
  }
  return (
    <span className={`cursor-pointer group relative ${className}`}
      onClick={() => { setDraft(value || ''); setEditing(true); }}
      style={style} title="Click to edit">
      {value || <span style={{ color: 'rgba(180,140,90,0.3)' }}>{placeholder}</span>}
      <Edit2 className="w-2.5 h-2.5 inline ml-1 opacity-0 group-hover:opacity-30 transition-opacity" style={{ color: '#c9a96e' }} />
    </span>
  );
}

export default function CharacterSheetPage() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const characterId = urlParams.get('character_id');
  const sessionId = urlParams.get('session_id');

  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | null
  const [tab, setTab] = useState('stats');
  const [exporting, setExporting] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    async function load() {
      if (!characterId) { navigate(createPageUrl('Home')); return; }
      const chars = await base44.entities.Character.filter({ id: characterId });
      if (chars[0]) setCharacter(chars[0]);
      setLoading(false);
    }
    load();
  }, [characterId]);

  const handleUpdate = async (updates) => {
    const updated = { ...character, ...updates };
    setCharacter(updated);
    setSaveStatus('saving');
    await base44.entities.Character.update(character.id, updates);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 1800);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!sheetRef.current || exporting) return;
    setExporting(true);
    try {
      const element = sheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0a0502',
        useCORS: true,
        allowTaint: true,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }
      pdf.save(`${character.name || 'Character'}-Sheet.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center parchment-bg">
      <div className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>Loading character...</div>
    </div>
  );
  if (!character) return (
    <div className="min-h-screen flex items-center justify-center parchment-bg">
      <div className="font-fantasy text-sm" style={{ color: '#fca5a5' }}>Character not found.</div>
    </div>
  );

  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
  const TABS = ['stats', 'skills', 'inventory', ...(isCaster ? ['spells'] : []), 'conditions', 'features'];

  return (
    <div className="min-h-screen parchment-bg" style={{ color: '#e8d5b7' }}>
      {/* Top Nav */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(8,5,2,0.96)', borderBottom: '1px solid rgba(180,140,90,0.15)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => sessionId ? navigate(createPageUrl('Game') + `?session_id=${sessionId}`) : navigate(createPageUrl('Home'))}
          className="flex items-center gap-1.5 text-sm font-fantasy transition-all"
          style={{ color: 'rgba(201,169,110,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
          <ChevronLeft className="w-4 h-4" />
          {sessionId ? 'Back to Game' : 'Home'}
        </button>

        <div className="flex items-center gap-2">
          <Scroll className="w-4 h-4" style={{ color: '#c9a96e' }} />
          <span className="font-fantasy font-bold text-sm" style={{ color: '#f0c040' }}>Character Sheet</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-fantasy">
          <button onClick={handlePrint} title="Print character sheet"
            className="p-1.5 rounded transition-all" style={{ color: 'rgba(201,169,110,0.5)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleExportPDF} disabled={exporting} title="Export as PDF"
            className="p-1.5 rounded transition-all" style={{ color: exporting ? 'rgba(180,140,90,0.3)' : 'rgba(201,169,110,0.5)' }}
            onMouseEnter={e => !exporting && (e.currentTarget.style.color = '#c9a96e')}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence mode="wait">
            {saveStatus === 'saving' && (
              <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1" style={{ color: 'rgba(201,169,110,0.6)' }}>
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
              </motion.span>
            )}
            {saveStatus === 'saved' && (
              <motion.span key="saved" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1" style={{ color: '#86efac' }}>
                <Check className="w-3 h-3" /> Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 pb-12 space-y-4" ref={sheetRef}>
        {/* Hero header */}
        <div className="rounded-2xl p-5 rune-border" style={{
          background: 'rgba(15,10,5,0.85)',
          border: '1px solid rgba(180,140,90,0.25)',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)'
        }}>
          <div className="flex items-start gap-4">
            {character.portrait ? (
              <img src={character.portrait} alt={character.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                style={{ border: '2px solid rgba(201,169,110,0.3)', boxShadow: '0 0 16px rgba(0,0,0,0.6)' }} />
            ) : (
              <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-3xl"
                style={{ background: 'rgba(40,25,8,0.8)', border: '2px solid rgba(201,169,110,0.2)' }}>
                {character.class === 'Wizard' ? '🧙' : character.class === 'Fighter' ? '⚔️' : character.class === 'Rogue' ? '🗡️' : character.class === 'Cleric' ? '✝️' : character.class === 'Ranger' ? '🏹' : character.class === 'Paladin' ? '🛡️' : '⚔️'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-fantasy-deco font-bold text-2xl text-glow-gold" style={{ color: '#f0c040' }}>
                <EditableText value={character.name} onSave={v => handleUpdate({ name: v })} placeholder="Name" />
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="badge-gold px-2 py-0.5 rounded-full text-xs font-fantasy">Lv {character.level}</span>
                <span className="text-sm italic" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
                  {character.race} {character.class}{character.subclass ? ` · ${character.subclass}` : ''}
                </span>
              </div>
              {character.alignment && (
                <div className="text-xs mt-1" style={{ color: 'rgba(180,150,100,0.4)', fontFamily: 'EB Garamond, serif' }}>
                  {character.alignment}{character.background ? ` · ${character.background}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-4">
            {[
              { label: 'HP', key: 'hp_current', max: character.hp_max, color: '#dc2626' },
              { label: 'HP Max', key: 'hp_max', color: '#dc2626' },
              { label: 'AC', key: 'armor_class', color: '#3b82f6' },
              { label: 'Speed', key: 'speed', color: '#d97706' },
              { label: 'Prof', key: null, display: `+${profBonus}`, color: '#c9a96e' },
              { label: 'Gold', key: 'gold', color: '#f0c040' },
              { label: 'Level', key: 'level', color: '#a78bfa', min: 1, max: 20 },
            ].map(({ label, key, display, color, min = 0, max = 999 }) => (
              <div key={label} className="stat-box rounded-xl p-2.5 text-center">
                <div className="font-fantasy font-bold text-lg" style={{ color }}>
                  {key ? <EditableNumber value={character[key] ?? 0} onSave={v => handleUpdate({ [key]: v })} min={min} max={max} color={color} /> : display}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto gap-1 pb-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-xs font-fantasy capitalize whitespace-nowrap transition-all flex-shrink-0"
              style={tab === t ? {
                background: 'rgba(80,50,10,0.6)',
                border: '1px solid rgba(201,169,110,0.45)',
                color: '#f0c040',
                boxShadow: '0 0 12px rgba(201,169,110,0.1)',
              } : {
                background: 'rgba(15,10,5,0.5)',
                border: '1px solid rgba(180,140,90,0.1)',
                color: 'rgba(180,150,100,0.45)',
              }}>
              {t === 'spells' ? '🔮 Spells' : t === 'stats' ? '⚔️ Stats' : t === 'skills' ? '🎯 Skills' : t === 'inventory' ? '🎒 Inventory' : t === 'conditions' ? '🌀 Status' : t === 'multiclass' ? '🎭 Multiclass' : '📜 Features'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(12,8,4,0.9)', border: '1px solid rgba(180,140,90,0.18)' }}>

            {/* STATS */}
            {tab === 'stats' && (
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {STATS.map(stat => {
                    const val = character[stat] || 10;
                    const mod = calcStatMod(val);
                    const saveProf = CLASSES[character.class]?.saves?.includes(stat);
                    const saveMod = mod + (saveProf ? profBonus : 0);
                    return (
                      <div key={stat} className="stat-box rounded-xl p-4 text-center">
                        <div className="text-xl mb-1">{STAT_ICONS[stat]}</div>
                        <div className="font-fantasy text-xs tracking-widest mb-1" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.62rem' }}>
                          {STAT_LABELS[stat]}
                        </div>
                        <div className="font-fantasy font-bold text-3xl mb-1">
                          <EditableNumber value={val} onSave={v => handleUpdate({ [stat]: v })} min={1} max={30} color="#e8d5b7" />
                        </div>
                        <div className="font-fantasy font-bold text-sm mb-1"
                          style={{ color: mod >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(mod)}</div>
                        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                          Save {calcModDisplay(saveMod)}
                          {saveProf && <span style={{ color: 'rgba(201,169,110,0.6)' }}> ●</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl p-3 stat-box text-center">
                  <span style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif' }}>Proficiency Bonus: </span>
                  <span className="font-fantasy font-bold" style={{ color: '#f0c040' }}>+{profBonus}</span>
                </div>
              </div>
            )}

            {/* SKILLS */}
            {tab === 'skills' && (
              <div className="p-5 space-y-0.5">
                {Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => {
                  const statMod = calcStatMod(character[stat] || 10);
                  const profLevel = character.skills?.[skill];
                  // Support boolean true (legacy), 'proficient', and 'expert'
                  const bonus = profLevel === 'expert' ? profBonus * 2 : (profLevel === 'proficient' || profLevel === true) ? profBonus : 0;
                  const total = statMod + bonus;
                  const profOptions = [undefined, 'proficient', 'expert'];
                  const nextProf = profOptions[(profOptions.indexOf(profLevel) + 1) % 3];
                  return (
                    <div key={skill} className="flex items-center justify-between py-2 px-3 rounded-lg transition-all group"
                      style={{ borderBottom: '1px solid rgba(180,140,90,0.06)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,20,8,0.5)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            const newSkills = { ...(character.skills || {}), [skill]: nextProf };
                            if (!nextProf) delete newSkills[skill];
                            handleUpdate({ skills: newSkills });
                          }}
                          title={profLevel === 'expert' ? 'Expert (click to remove)' : profLevel === 'proficient' ? 'Proficient (click for Expert)' : 'Not proficient (click to add)'}
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
                          style={{
                            background: profLevel === 'expert' ? '#f0c040' : profLevel === 'proficient' ? '#86efac' : 'rgba(80,60,30,0.4)',
                            border: '1px solid ' + (profLevel === 'expert' ? 'rgba(240,192,64,0.6)' : profLevel === 'proficient' ? 'rgba(134,239,172,0.5)' : 'rgba(80,60,30,0.3)'),
                            boxShadow: profLevel ? '0 0 5px ' + (profLevel === 'expert' ? 'rgba(240,192,64,0.4)' : 'rgba(134,239,172,0.3)') : 'none'
                          }} />
                        <span className="text-sm" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem' }}>{skill}</span>
                        <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)' }}>({STAT_LABELS[stat]})</span>
                      </div>
                      <span className="font-fantasy font-bold text-sm"
                        style={{ color: total >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(total)}</span>
                    </div>
                  );
                })}
                <div className="text-xs mt-3 pt-2" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif', borderTop: '1px solid rgba(180,140,90,0.08)' }}>
                  Click the dot next to a skill to toggle: none → proficient → expert
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {tab === 'inventory' && (
              <div className="p-5"><InventoryTab character={character} onUpdate={handleUpdate} /></div>
            )}

            {/* SPELLS */}
            {tab === 'spells' && (
              <div className="p-5"><SpellbookTab character={character} onUpdateCharacter={handleUpdate} /></div>
            )}

            {/* CONDITIONS */}
            {tab === 'conditions' && (
              <div className="p-5 space-y-2">
                {(character.conditions || []).length === 0 ? (
                  <div className="text-center py-10 font-fantasy text-sm" style={{ color: '#86efac', textShadow: '0 0 12px rgba(134,239,172,0.3)' }}>
                    ✓ No active conditions
                  </div>
                ) : (
                  (character.conditions || []).map((cond, i) => {
                    const name = typeof cond === 'string' ? cond : cond.name;
                    const condData = CONDITIONS[name?.toLowerCase()] || {};
                    return (
                      <div key={i} className="p-3 rounded-xl flex items-start justify-between gap-2"
                        style={{ background: 'rgba(20,10,5,0.6)', border: '1px solid rgba(180,100,50,0.2)' }}>
                        <div>
                          <div className="font-fantasy text-sm" style={{ color: '#fca5a5' }}>{condData.icon} {name}</div>
                          <div className="text-xs mt-1" style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif' }}>{condData.description}</div>
                        </div>
                        <button onClick={() => handleUpdate({ conditions: (character.conditions || []).filter((_, j) => j !== i) })}
                          className="p-1 rounded transition-colors flex-shrink-0" style={{ color: 'rgba(180,100,100,0.4)' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,100,100,0.4)'}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* FEATURES */}
            {tab === 'features' && (
              <div className="p-5 space-y-3">
                {(character.features || []).length === 0 ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>No features recorded</div>
                ) : (
                  (character.features || []).map((feat, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.12)' }}>
                      <div className="text-sm" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif' }}>{feat}</div>
                    </div>
                  ))
                )}
                {character.backstory && (
                  <div className="mt-4">
                    <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.65rem' }}>BACKSTORY</div>
                    <div className="p-4 rounded-xl leading-relaxed text-sm"
                      style={{ background: 'rgba(15,10,4,0.7)', border: '1px solid rgba(180,140,90,0.12)', color: 'rgba(232,213,183,0.7)', fontFamily: 'IM Fell English, serif', lineHeight: '1.8' }}>
                      <EditableText value={character.backstory} onSave={v => handleUpdate({ backstory: v })}
                        placeholder="No backstory written yet..." multiline
                        style={{ width: '100%', color: 'rgba(232,213,183,0.8)', fontFamily: 'IM Fell English, serif' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; color: black; }
          .parchment-bg { background: white !important; }
          [style*="background: rgba"] { background: white !important; }
          [style*="color: rgba"] { color: black !important; }
          [style*="color: #"] { color: black !important; }
          .stat-box { border: 1px solid #ccc !important; background: white !important; }
          * { box-shadow: none !important; }
          .sticky { position: static; }
          button { display: none; }
        }
      `}</style>
    </div>
  );
}