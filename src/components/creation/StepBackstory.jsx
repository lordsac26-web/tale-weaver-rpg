import React from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function StepBackstory({ character, set, backstoryPrompt, setBackstoryPrompt, onGenerate, generating }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Backstory</h2>
        <p className="text-amber-400/50 text-sm">Give your hero a history. Use AI to generate one or write your own.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-amber-400/80 text-xs uppercase tracking-widest block flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5" /> AI Prompt
          </label>
          <Textarea value={backstoryPrompt} onChange={e => setBackstoryPrompt(e.target.value)}
            placeholder={`Give the AI a direction... e.g. "A disgraced knight seeking redemption, haunted by a battle they fled from" or "Orphaned mage who discovered magic by accident while grieving"`}
            className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 h-32 text-sm" />
          <Button onClick={onGenerate} disabled={generating} className="w-full bg-purple-800/60 hover:bg-purple-700 border border-purple-600/50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
            {generating ? 'Weaving your tale...' : 'Generate Backstory'}
          </Button>
          <p className="text-slate-600 text-xs">Based on: {character.name || 'Hero'} · {character.race} {character.class} · {character.background}</p>
        </div>
        <div>
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Your Backstory</label>
          <Textarea value={character.backstory} onChange={e => set('backstory', e.target.value)}
            placeholder="Write or edit your character's backstory here..."
            className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 h-52 text-sm" />
          <p className="text-slate-600 text-xs mt-1">{character.backstory?.length || 0} characters</p>
        </div>
      </div>
    </div>
  );
}