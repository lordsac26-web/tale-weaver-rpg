import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function CompositeActionPlan({ proposal }) {
  const plan=proposal?.composite_plan;
  if(!plan)return null;
  return <div data-composite-preflight="authoritative" data-rejected-writes={plan.writes ?? 0} aria-live="polite" className="space-y-3 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
    <div className="flex items-center gap-2 font-fantasy text-sm text-amber-200"><AlertTriangle className="h-4 w-4"/>Full plan validation</div>
    <ol className="space-y-1 text-sm text-fantasy-parchment-dim">{plan.plan?.children?.map((child,index)=><li key={child.key}>{index+1}. {child.action_type==='spell_cast'?`Cast ${child.spell_name}`:`Fire ${child.weapon_hint} at ${child.target_ref||'target'}`}</li>)}</ol>
    {plan.errors?.map(error=><p key={error.code} className="text-sm text-red-200">{error.message}</p>)}
    {!!plan.alternatives?.length&&<div className="space-y-2"><p className="font-fantasy text-xs uppercase tracking-widest text-amber-300">Legal alternatives</p>{plan.alternatives.map(option=><div key={option.label} className="rounded-lg border border-amber-800/40 bg-black/20 p-2"><p className="text-sm text-fantasy-parchment">{option.label}</p><p className="text-xs text-fantasy-parchment-dim">{option.consequence}</p></div>)}</div>}
  </div>;
}