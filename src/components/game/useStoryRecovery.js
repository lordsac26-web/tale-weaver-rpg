import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function useStoryRecovery({ sessionId, onRecovered }) {
  const [blocked, setBlocked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return {
    blocked, busy, error,
    observe(data) { setBlocked(data?.story_recovery || null); },
    capture(failure) {
      const data = failure?.response?.data || failure?.data || {};
      if (data.recovery_available || data.error_code === 'partial_mechanics_commit') { setBlocked(data); setError(''); return true; }
      return false;
    },
    async resolve() {
      if (busy) return;
      setBusy(true); setError('');
      try {
        const { data } = await base44.functions.invoke('reconcileStoryCommit', { session_id: sessionId });
        await onRecovered(data);
        setBlocked(null);
      } catch (failure) {
        setError(failure?.response?.data?.error || failure.message || 'Recovery could not finish. Your scene is still preserved.');
      } finally { setBusy(false); }
    },
  };
}