import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SessionContext = createContext(null);

export function SessionProvider({ children, sessionId }) {
  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [narrative, setNarrative] = useState([]);
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadState = async () => {
    if (!sessionId) return;
    
    const sessions = await base44.entities.GameSession.filter({ id: sessionId });
    const sess = sessions[0];
    if (!sess) return;
    setSession(sess);

    const chars = await base44.entities.Character.filter({ id: sess.character_id });
    setCharacter(chars[0] || null);

    if (sess.story_log?.length > 0) {
      const restored = sess.story_log.slice(-10).map(e => ({ type: 'narration', text: e.text }));
      setNarrative(restored);
      const lastEntry = sess.story_log[sess.story_log.length - 1];
      if (lastEntry?.choices?.length > 0) setChoices(lastEntry.choices);
    }
    
    setLoading(false);
  };

  useEffect(() => { loadState(); }, [sessionId]);

  return (
    <SessionContext.Provider value={{ 
      session, character, narrative, choices, 
      setSession, setCharacter, setNarrative, setChoices,
      loading, reload: loadState 
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
};