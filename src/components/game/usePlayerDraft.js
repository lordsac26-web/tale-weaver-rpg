import { useEffect, useState } from 'react';

export default function usePlayerDraft(sessionId) {
  const key = `player-action-draft:${sessionId}`;
  const [value, setValue] = useState(() => localStorage.getItem(key) || '');
  useEffect(() => { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); }, [key, value]);
  return [value, setValue];
}