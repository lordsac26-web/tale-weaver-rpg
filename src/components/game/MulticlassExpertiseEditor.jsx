import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function MulticlassExpertiseEditor({ character, onSave, saving }) {
  const proficient=Object.entries(character.skills||{}).filter(([,level])=>['proficient','expert',true].includes(level)).map(([name])=>name);
  const current=proficient.filter(name=>character.skills?.[name]==='expert').slice(0,2);
  const [first,setFirst]=useState(current[0]||'');
  const [second,setSecond]=useState(current[1]||'');
  const valid=first&&second&&first!==second;
  return <div className="glass-panel-light rounded-lg p-3 space-y-2">
    <div className="font-fantasy text-xs text-amber-200">Rogue Expertise</div>
    <p className="text-xs text-amber-100/60">Choose exactly two proficient skills. Expertise doubles your proficiency bonus.</p>
    <div className="grid grid-cols-2 gap-2">{[[first,setFirst],[second,setSecond]].map(([value,set],index)=><select key={index} value={value} onChange={e=>set(e.target.value)} className="select-fantasy rounded px-2 py-2 text-xs"><option value="">Choose skill</option>{proficient.map(name=><option key={name} value={name} disabled={(index===0?second:first)===name}>{name}</option>)}</select>)}</div>
    <Button disabled={!valid||saving} onClick={()=>onSave([first,second],current)} className="btn-fantasy w-full">{saving?'Saving…':'Save Expertise'}</Button>
  </div>;
}