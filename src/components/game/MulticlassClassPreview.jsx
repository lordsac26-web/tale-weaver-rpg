import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { CLASSES } from './gameData';

export default function MulticlassClassPreview({ className, validation }) {
  if (!className) return null;
  const data = CLASSES[className] || {};
  return <div className="space-y-3 rounded-lg p-3 glass-panel-light">
    <div><div className="font-fantasy text-sm text-amber-200">{className}</div><p className="text-xs text-amber-100/70 mt-1">{data.description}</p></div>
    <div><div className="tavern-section-label mb-1">Prerequisites</div>{validation?.target?.checks?.map(check => <div key={check.label} className={`flex items-center gap-1 text-xs ${check.passed?'text-green-300':'text-red-300'}`}>{check.passed?<CheckCircle className="w-3 h-3"/>:<XCircle className="w-3 h-3"/>}{check.label}</div>)}</div>
    <div><div className="tavern-section-label mb-1">Level 1 grants</div>{(data.features?.[1]||[]).map(feature=><p key={feature} className="text-xs text-amber-100/70">• {feature}</p>)}</div>
    <p className="text-xs text-purple-200/70">Subclass unlock: {className} level {validation?.subclass_level || 3}.</p>
    {validation && !validation.ok && <p className="text-xs text-red-300">{validation.reason}</p>}
  </div>;
}