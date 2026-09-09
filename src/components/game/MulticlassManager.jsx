import React, { useEffect, useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { CLASSES } from './gameData';
import MulticlassClassPreview from './MulticlassClassPreview';
import MulticlassExpertiseEditor from './MulticlassExpertiseEditor';

export default function MulticlassManager({ character, onAuthoritativeUpdate }) {
  const [adding,setAdding]=useState(false); const [newClass,setNewClass]=useState('');
  const [validation,setValidation]=useState(null); const [expertise,setExpertise]=useState([]);
  const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const multiclass=character.multiclass||[];
  const primaryLevels=Math.max(1,Number(character.level||1)-multiclass.reduce((sum,entry)=>sum+Number(entry.levels||0),0));
  const proficient=Object.entries(character.skills||{}).filter(([,level])=>['proficient','expert',true].includes(level)).map(([name])=>name);

  useEffect(()=>{
    if(!newClass){setValidation(null);return;}
    let active=true;
    base44.functions.invoke('applyMulticlassLevel',{action:'preview',character_id:character.id,class_name:newClass,class_level:1})
      .then(response=>active&&setValidation(response.data))
      .catch(err=>active&&setValidation({ok:false,reason:err?.response?.data?.error||err.message}));
    return()=>{active=false;};
  },[character.id,newClass]);

  const addClass=async()=>{setSaving(true);setError('');try{
    const response=await base44.functions.invoke('applyMulticlassLevel',{action:'apply_class',character_id:character.id,class_name:newClass,expertise_choices:newClass==='Rogue'?expertise:[]});
    onAuthoritativeUpdate?.(response.data.character); setAdding(false); setNewClass(''); setExpertise([]);
  }catch(err){setError(err?.response?.data?.error||err.message);}finally{setSaving(false);}};
  const saveExpertise=async(choices,previous)=>{setSaving(true);setError('');try{
    const response=await base44.functions.invoke('applyMulticlassLevel',{action:'set_expertise',character_id:character.id,expertise_choices:choices,previous_choices:previous});
    onAuthoritativeUpdate?.({...character,skills:response.data.skills});
  }catch(err){setError(err?.response?.data?.error||err.message);}finally{setSaving(false);}};

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h3 className="font-fantasy text-lg" style={{color:'var(--brass-gold)'}}>Multiclassing</h3><span className="text-xs text-amber-100/60">Total Level: {character.level}</span></div>
    <ClassSummary label="Primary" className={character.class} levels={primaryLevels}/>
    {multiclass.map((entry,index)=><ClassSummary key={`${entry.class}-${index}`} label="Multiclass" className={entry.class} levels={entry.levels} subclass={entry.subclass}/>)}
    {multiclass.some(entry=>entry.class==='Rogue'&&Number(entry.levels)>=1)&&<MulticlassExpertiseEditor character={character} onSave={saveExpertise} saving={saving}/>}
    {adding?<div className="space-y-3">
      <Select value={newClass} onValueChange={value=>{setNewClass(value);setExpertise([]);setError('');}}><SelectTrigger className="select-fantasy"><SelectValue placeholder="Choose class..."/></SelectTrigger><SelectContent>{Object.keys(CLASSES).filter(name=>name!==character.class&&!multiclass.some(entry=>entry.class===name)).map(name=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
      <MulticlassClassPreview className={newClass} validation={validation}/>
      {newClass==='Rogue'&&<ExpertiseChoices skills={proficient} value={expertise} onChange={setExpertise}/>} {error&&<p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2"><Button onClick={addClass} disabled={saving||!validation?.ok||(newClass==='Rogue'&&(expertise.length!==2||expertise[0]===expertise[1]))} className="btn-fantasy flex-1">{saving?'Applying…':'Apply Class'}</Button><Button onClick={()=>{setAdding(false);setNewClass('');setError('');}} className="btn-fantasy flex-1">Cancel</Button></div>
    </div>:<button onClick={()=>setAdding(true)} className="w-full py-2 rounded-lg border border-dashed text-sm font-fantasy text-amber-200/70"><Plus className="w-4 h-4 inline mr-1"/>Add Multiclass</button>}
    <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-950/20 border border-purple-800/30"><Info className="w-4 h-4 text-purple-300 flex-shrink-0"/><p className="text-xs text-purple-200/70">Prerequisites and subclass levels are checked before any class is applied.</p></div>
  </div>;
}

function ClassSummary({label,className,levels,subclass}){const data=CLASSES[className]||{};return <div className="glass-panel-light rounded-lg p-3"><div className="font-fantasy text-sm text-amber-200">{label}: {className} {levels}{subclass?` · ${subclass}`:''}</div><p className="text-xs text-amber-100/60 mt-1">{data.description}</p><div className="mt-2">{Object.entries(data.features||{}).filter(([level])=>Number(level)<=Number(levels)).flatMap(([level,features])=>features.map(feature=><p key={`${level}-${feature}`} className="text-xs text-amber-100/70">Lv.{level} · {feature}</p>))}</div></div>;}
function ExpertiseChoices({skills,value,onChange}){return <div><p className="text-xs text-amber-100/70 mb-2">Choose exactly two proficient skills for Expertise.</p><div className="grid grid-cols-2 gap-2">{[0,1].map(index=><select key={index} value={value[index]||''} onChange={event=>onChange(current=>{const next=[...current];next[index]=event.target.value;return next;})} className="select-fantasy rounded px-2 py-2 text-xs"><option value="">Choose skill</option>{skills.map(name=><option key={name} value={name} disabled={value[1-index]===name}>{name}</option>)}</select>)}</div></div>;}