import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const CombatContext = createContext(null);

export function CombatProvider({ children, combatId, sessionId, characterId }) {
  const [combat, setCombat] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadCombat = async () => {
    if (!combatId) return;
    const logs = await base44.entities.CombatLog.filter({ id: combatId });
    if (logs[0]) setCombat(logs[0]);
  };

  useEffect(() => { loadCombat(); }, [combatId]);

  return (
    <CombatContext.Provider value={{ 
      combat, setCombat, loading, setLoading, reload: loadCombat 
    }}>
      {children}
    </CombatContext.Provider>
  );
}

export const useCombat = () => {
  const context = useContext(CombatContext);
  if (!context) throw new Error('useCombat must be used within CombatProvider');
  return context;
};