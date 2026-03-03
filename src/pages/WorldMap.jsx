import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MapPin, Shield, Skull, RefreshCw, Coins, Info } from 'lucide-react';
import PortalModal from '@/components/travel/PortalModal';
import { WORLD_LOCATIONS } from '@/components/travel/portalData';

export default function WorldMap() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const characterId = urlParams.get('character_id');

  const [character, setCharacter] = useState(null);
  const [session, setSession] = useState(null);
  const [sanctionedPortals, setSanctionedPortals] = useState([]);
  const [sketchyPortals, setSketchyPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [travelLog, setTravelLog] = useState([]);
  const [filter, setFilter] = useState('all'); // all | sanctioned | sketchy
  const [hoveredLocation, setHoveredLocation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [sPortals, skPortals] = await Promise.all([
      base44.entities.SanctionedPortal.list('-created_date', 50),
      base44.entities.SketchyPortal.list('-created_date', 50),
    ]);
    setSanctionedPortals(sPortals);
    setSketchyPortals(skPortals);

    if (characterId) {
      const chars = await base44.entities.Character.filter({ id: characterId });
      if (chars[0]) setCharacter(chars[0]);
    }
    if (sessionId) {
      const sessions = await base44.entities.GameSession.filter({ id: sessionId });
      if (sessions[0]) setSession(sessions[0]);
    }
    setLoading(false);
  };

  const handleTravel = async ({ type, destination, cost, portal, complication }) => {
    const logEntry = {
      ts: Date.now(),
      portal: portal.name,
      destination,
      type,
      cost,
      complication: complication?.label,
    };
    setTravelLog(prev => [logEntry, ...prev].slice(0, 10));

    // Update character gold
    if (character && cost > 0) {
      const newGold = Math.max(0, (character.gold || 0) - cost);
      let updates = { gold: newGold };

      // Apply complication effects
      if (complication) {
        if (complication.effect === 'lose_gold') {
          updates.gold = Math.max(0, newGold - (complication.gold_lost || 0));
        }
        if (complication.effect === 'damage') {
          updates.hp_current = Math.max(0, (character.hp_current || 1) - (complication.damage_dealt || 0));
        }
        if (complication.effect === 'exhaustion') {
          const conditions = [...(character.conditions || [])];
          if (!conditions.find(c => c.name === 'exhausted')) {
            conditions.push({ name: 'exhausted', source: 'Portal Fatigue' });
            updates.conditions = conditions;
          }
        }
      }

      const updated = { ...character, ...updates };
      setCharacter(updated);
      await base44.entities.Character.update(character.id, updates);
    }

    // Update session location
    if (session && destination) {
      await base44.entities.GameSession.update(session.id, {
        current_location: destination,
      });
    }
  };

  // Group portals by city
  const portalsByCity = {};
  sanctionedPortals.forEach(p => {
    if (!portalsByCity[p.city]) portalsByCity[p.city] = { sanctioned: [], sketchy: [] };
    portalsByCity[p.city].sanctioned.push(p);
  });
  sketchyPortals.forEach(p => {
    if (!portalsByCity[p.city]) portalsByCity[p.city] = { sanctioned: [], sketchy: [] };
    portalsByCity[p.city].sketchy.push(p);
  });

  const currentLocation = session?.current_location || character?.current_location || 'Daggerford';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0a07' }}>
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#c9a96e' }} />
        <div className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>Consulting the arcane cartographers...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.9)', borderBottom: '1px solid rgba(180,140,90,0.15)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-fantasy font-bold text-base" style={{ color: '#c9a96e' }}>World Map & Portal Network</h1>
          {currentLocation && (
            <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
              Current location: <span style={{ color: 'rgba(201,169,110,0.7)' }}>{currentLocation}</span>
            </p>
          )}
        </div>
        {character && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(40,25,5,0.6)', border: '1px solid rgba(201,169,110,0.2)' }}>
            <Coins className="w-3.5 h-3.5" style={{ color: '#f0c040' }} />
            <span className="font-fantasy text-sm" style={{ color: '#f0c040' }}>{character.gold || 0}gp</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 px-4 py-2 flex-shrink-0"
        style={{ background: 'rgba(10,6,3,0.8)', borderBottom: '1px solid rgba(180,140,90,0.1)' }}>
        {[['all','All Portals'],['sanctioned','✦ Sanctioned'],['sketchy','💀 Sketchy']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-fantasy transition-all"
            style={filter === val ? {
              background: val === 'sketchy' ? 'rgba(50,10,80,0.8)' : 'rgba(60,40,5,0.8)',
              border: `1px solid ${val === 'sketchy' ? 'rgba(160,80,240,0.5)' : 'rgba(201,169,110,0.5)'}`,
              color: val === 'sketchy' ? '#c084fc' : '#f0c040',
            } : {
              background: 'rgba(15,10,5,0.5)',
              border: '1px solid rgba(180,140,90,0.15)',
              color: 'rgba(201,169,110,0.4)',
            }}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
          <Info className="w-3 h-3" /> Tap a portal to travel
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 overflow-hidden" style={{ minHeight: '300px' }}>
          {/* Parchment map background */}
          <div className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(40,28,8,0.9) 0%, rgba(25,16,4,0.95) 50%, rgba(35,22,5,0.9) 100%)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
            }} />

          {/* Grid lines (subtle map grid) */}
          <svg className="absolute inset-0 w-full h-full opacity-10" style={{ pointerEvents: 'none' }}>
            <defs>
              <pattern id="grid" width="8%" height="8%" patternUnits="objectBoundingBox">
                <path d="M 0 0 L 0 100% M 0 0 L 100% 0" stroke="rgba(201,169,110,0.3)" strokeWidth="0.5" fill="none" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Map label */}
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="font-fantasy-deco text-xs tracking-widest opacity-20" style={{ color: '#c9a96e' }}>THE SWORD COAST</div>
          </div>

          {/* Connection lines between sanctioned portals */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            {(filter === 'all' || filter === 'sanctioned') && sanctionedPortals.map(portal => 
              (portal.destination_hubs || []).map(destName => {
                const destPortal = sanctionedPortals.find(p => p.name === destName);
                if (!destPortal || destPortal.name <= portal.name) return null; // avoid duplicate lines
                return (
                  <line key={`${portal.name}-${destName}`}
                    x1={`${portal.map_x}%`} y1={`${portal.map_y}%`}
                    x2={`${destPortal.map_x}%`} y2={`${destPortal.map_y}%`}
                    stroke="rgba(201,169,110,0.2)" strokeWidth="1" strokeDasharray="4,4" />
                );
              })
            )}
            {(filter === 'all' || filter === 'sketchy') && sketchyPortals.map(portal =>
              (portal.destinations || []).map(destName => {
                const destPortal = sketchyPortals.find(p => p.name === destName);
                if (!destPortal || destPortal.name <= portal.name) return null;
                return (
                  <line key={`${portal.name}-${destName}`}
                    x1={`${portal.map_x}%`} y1={`${portal.map_y}%`}
                    x2={`${destPortal.map_x}%`} y2={`${destPortal.map_y}%`}
                    stroke="rgba(160,80,240,0.15)" strokeWidth="1" strokeDasharray="2,6" />
                );
              })
            )}
          </svg>

          {/* Location labels */}
          {WORLD_LOCATIONS.map(loc => (
            <div key={loc.name}
              className="absolute pointer-events-none"
              style={{ left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%, -50%)' }}>
              <div className="text-center">
                <div className="w-1.5 h-1.5 rounded-full mx-auto mb-1 opacity-30" style={{ background: '#c9a96e' }} />
                <div className="font-fantasy text-xs whitespace-nowrap opacity-25" style={{ color: '#c9a96e', fontSize: '0.6rem' }}>{loc.name}</div>
              </div>
            </div>
          ))}

          {/* Current location marker */}
          {WORLD_LOCATIONS.find(l => l.name === currentLocation) && (
            <div className="absolute" style={{
              left: `${WORLD_LOCATIONS.find(l => l.name === currentLocation)?.x || 33}%`,
              top: `${WORLD_LOCATIONS.find(l => l.name === currentLocation)?.y || 40}%`,
              transform: 'translate(-50%, -50%)',
            }}>
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-4 h-4 rounded-full border-2 border-green-400 bg-green-500/20" />
            </div>
          )}

          {/* Sanctioned Portal markers */}
          {(filter === 'all' || filter === 'sanctioned') && sanctionedPortals.map(portal => (
            <motion.button
              key={portal.id}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.3 }}
              onClick={() => { setSelectedPortal(portal); setSelectedType('sanctioned'); }}
              className="absolute"
              style={{ left: `${portal.map_x}%`, top: `${portal.map_y}%`, transform: 'translate(-50%, -50%)' }}>
              <motion.div
                animate={{ boxShadow: ['0 0 8px rgba(201,169,110,0.4)', '0 0 20px rgba(201,169,110,0.8)', '0 0 8px rgba(201,169,110,0.4)'] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: 'rgba(60,40,5,0.85)', border: '2px solid rgba(201,169,110,0.7)', cursor: 'pointer' }}>
                ✦
              </motion.div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap font-fantasy text-xs pointer-events-none opacity-0 hover:opacity-100"
                style={{ color: '#f0c040', fontSize: '0.55rem' }}>{portal.city}</div>
            </motion.button>
          ))}

          {/* Sketchy Portal markers */}
          {(filter === 'all' || filter === 'sketchy') && sketchyPortals.map(portal => (
            <motion.button
              key={portal.id}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.3 }}
              onClick={() => { setSelectedPortal(portal); setSelectedType('sketchy'); }}
              className="absolute"
              style={{ left: `${(portal.map_x || 33) + (Math.random() > 0.5 ? 1.5 : -1.5)}%`, top: `${(portal.map_y || 40) + 1.5}%`, transform: 'translate(-50%, -50%)' }}>
              <motion.div
                animate={{ boxShadow: ['0 0 6px rgba(140,60,220,0.4)', '0 0 16px rgba(140,60,220,0.7)', '0 0 6px rgba(140,60,220,0.4)'] }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: 'rgba(40,8,70,0.85)', border: '2px solid rgba(140,60,220,0.6)', cursor: 'pointer', fontSize: '0.75rem' }}>
                💀
              </motion.div>
            </motion.button>
          ))}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 rounded-xl px-3 py-2 space-y-1.5"
            style={{ background: 'rgba(10,6,3,0.8)', border: '1px solid rgba(180,140,90,0.15)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ fontFamily: 'EB Garamond, serif' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(201,169,110,0.6)', boxShadow: '0 0 6px rgba(201,169,110,0.4)' }} />
              <span style={{ color: '#f0c040' }}>Sanctioned (safe)</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ fontFamily: 'EB Garamond, serif' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(140,60,220,0.6)', boxShadow: '0 0 6px rgba(140,60,220,0.4)' }} />
              <span style={{ color: '#c084fc' }}>Sketchy (risky)</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ fontFamily: 'EB Garamond, serif' }}>
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#4ade80', background: 'rgba(74,222,128,0.2)' }} />
              <span style={{ color: '#86efac' }}>You are here</span>
            </div>
          </div>
        </div>

        {/* Portal List Sidebar */}
        <div className="w-full lg:w-80 flex flex-col overflow-hidden" style={{ borderLeft: '1px solid rgba(180,140,90,0.12)' }}>
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(10,6,3,0.8)' }}>
            <div className="font-fantasy text-sm" style={{ color: '#c9a96e' }}>Available Portals</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.35)', fontFamily: 'EB Garamond, serif' }}>
              {sanctionedPortals.length + sketchyPortals.length} portals discovered
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(filter === 'all' || filter === 'sanctioned') && sanctionedPortals.length > 0 && (
              <>
                <div className="font-fantasy text-xs tracking-widest px-1" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.62rem' }}>GUILD SANCTIONED</div>
                {sanctionedPortals.map(portal => (
                  <button key={portal.id} onClick={() => { setSelectedPortal(portal); setSelectedType('sanctioned'); }}
                    className="w-full text-left rounded-xl p-3 transition-all fantasy-card"
                    style={{ background: 'rgba(20,14,5,0.7)', border: '1px solid rgba(201,169,110,0.15)' }}>
                    <div className="flex items-start gap-2">
                      <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}
                        className="text-lg flex-shrink-0">✦</motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="font-fantasy text-sm font-semibold truncate" style={{ color: '#f0c040' }}>{portal.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.45)', fontFamily: 'EB Garamond, serif' }}>{portal.city}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs" style={{ color: '#86efac' }}>
                            <Shield className="w-2.5 h-2.5 inline mr-0.5" />Safe
                          </span>
                          <span className="text-xs" style={{ color: '#f0c040' }}>
                            <Coins className="w-2.5 h-2.5 inline mr-0.5" />{portal.cost_gp}gp
                          </span>
                          <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)' }}>
                            {(portal.destination_hubs || []).length} routes
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {(filter === 'all' || filter === 'sketchy') && sketchyPortals.length > 0 && (
              <>
                <div className="font-fantasy text-xs tracking-widest px-1 mt-2" style={{ color: 'rgba(192,132,252,0.4)', fontSize: '0.62rem' }}>UNAUTHORIZED</div>
                {sketchyPortals.map(portal => (
                  <button key={portal.id} onClick={() => { setSelectedPortal(portal); setSelectedType('sketchy'); }}
                    className="w-full text-left rounded-xl p-3 transition-all fantasy-card"
                    style={{ background: 'rgba(15,5,25,0.7)', border: '1px solid rgba(140,60,220,0.15)' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">💀</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-fantasy text-sm font-semibold truncate" style={{ color: '#c084fc' }}>{portal.name}</div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(192,132,252,0.45)', fontFamily: 'EB Garamond, serif' }}>{portal.operator_name}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs"
                            style={{ color: portal.safety_pct >= 70 ? '#86efac' : portal.safety_pct >= 50 ? '#fde68a' : '#fca5a5' }}>
                            <Skull className="w-2.5 h-2.5 inline mr-0.5" />{portal.safety_pct}%
                          </span>
                          <span className="text-xs" style={{ color: '#fb923c' }}>
                            <Coins className="w-2.5 h-2.5 inline mr-0.5" />{portal.cost_gp}gp
                          </span>
                          <span className="text-xs" style={{ color: 'rgba(192,132,252,0.35)' }}>
                            {(portal.destinations || []).length} routes
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {sanctionedPortals.length === 0 && sketchyPortals.length === 0 && (
              <div className="text-center py-10">
                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-10" style={{ color: '#c9a96e' }} />
                <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.3)' }}>No portals discovered yet.</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(201,169,110,0.2)', fontFamily: 'EB Garamond, serif' }}>
                  Portals are seeded from the Admin panel.
                </div>
              </div>
            )}

            {/* Travel Log */}
            {travelLog.length > 0 && (
              <div className="mt-4">
                <div className="font-fantasy text-xs tracking-widest px-1 mb-2" style={{ color: 'rgba(180,140,90,0.35)', fontSize: '0.62rem' }}>TRAVEL LOG</div>
                {travelLog.map((entry, i) => (
                  <div key={entry.ts} className="rounded-lg px-3 py-2 mb-1 text-xs"
                    style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.1)' }}>
                    <div style={{ color: entry.type === 'safe' ? '#86efac' : '#fca5a5', fontFamily: 'EB Garamond, serif' }}>
                      {entry.type === 'safe' ? '✓' : '⚠'} {entry.destination}
                    </div>
                    <div style={{ color: 'rgba(180,140,90,0.35)' }}>via {entry.portal} · -{entry.cost}gp</div>
                    {entry.complication && <div style={{ color: '#c084fc' }}>{entry.complication}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portal Modal */}
      <AnimatePresence>
        {selectedPortal && (
          <PortalModal
            portal={selectedPortal}
            type={selectedType}
            character={character}
            onClose={() => setSelectedPortal(null)}
            onTravel={(result) => { handleTravel(result); setSelectedPortal(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}