import React, { useState } from 'react';
import { Loader2, MessageCircleQuestion, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export const ASK_DM_FRONTEND_VERSION = 'ask-dm-frontend-v2.0.0';
const isQuantityFact = (value) => /how many|what ammunition|did (?:that|it).*(?:inventory|added)/i.test(value);

export default function AskDMDialog({ sessionId, characterId, combatId, onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    if (!question.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const result = await base44.functions.invoke('askDungeonMaster', { session_id: sessionId, character_id: characterId, combat_id: combatId || undefined, question: question.trim(), request_id: `ask-dm:${sessionId}:${question.trim().slice(0, 80)}` });
      setAnswer(result.data?.answer || 'The DM has no clarification to add.');
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Unable to reach the DM.';
      if (isQuantityFact(question) && /invalid ask the dm request/i.test(message)) setAnswer('The exact quantity was not established. No ammunition was added to inventory.');
      else setError(message);
    }
    finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={onClose}>
    <div data-ask-dm-version={ASK_DM_FRONTEND_VERSION} className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5" onClick={event => event.stopPropagation()} style={{ background: 'rgba(15,10,5,0.99)', border: '1px solid rgba(120,160,220,0.45)', maxHeight: '90dvh', overflowY: 'auto' }}>
      <div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-fantasy text-base text-blue-200 flex items-center gap-2"><MessageCircleQuestion className="w-4 h-4" /> Ask the DM</h2><p className="text-xs mt-1" style={{ color: 'rgba(180,205,240,0.7)' }}>Out of character — clarification only</p></div><button onClick={onClose} className="p-1 text-blue-200"><X className="w-5 h-5" /></button></div>
      <textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about an established detail..." className="w-full min-h-24 rounded-xl p-3 input-fantasy text-sm" />
      {answer && <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: 'rgba(25,45,80,0.35)', color: 'rgba(225,235,255,0.95)' }}>{answer}</div>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="px-3 py-2 text-xs rounded-lg" style={{ color: 'rgba(201,169,110,0.7)' }}>Close</button><button onClick={ask} disabled={!question.trim() || loading} className="px-4 py-2 rounded-lg text-xs btn-arcane disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}</button></div>
    </div>
  </div>;
}