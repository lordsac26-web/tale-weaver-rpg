const FULL=[[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF=[[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const WARLOCK=[[1],[2],[0,2],[0,2],[0,0,2],[0,0,2],[0,0,0,2],[0,0,0,2],[0,0,0,0,2],[0,0,0,0,2],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4]];
const TABLES={Wizard:FULL,Sorcerer:FULL,Bard:FULL,Cleric:FULL,Druid:FULL,Paladin:HALF,Ranger:HALF,Artificer:HALF,Warlock:WARLOCK};
const FULL_CLASSES=new Set(['Wizard','Sorcerer','Bard','Cleric','Druid']);
const HALF_CLASSES=new Set(['Paladin','Ranger']);
const isThird=(entry)=>['Fighter','Rogue'].includes(entry.className)&&/eldritch knight|arcane trickster/i.test(entry.subclass||'');
const isCaster=(entry)=>!!TABLES[entry.className]||isThird(entry);
const contribution=(entry)=>FULL_CLASSES.has(entry.className)?entry.levels:entry.className==='Artificer'?Math.ceil(entry.levels/2):HALF_CLASSES.has(entry.className)?Math.floor(entry.levels/2):isThird(entry)?Math.floor(entry.levels/3):0;

export function getCharacterClassBreakdown(character={}){
  const secondary=Array.isArray(character.multiclass)?character.multiclass.filter((entry)=>entry?.class&&Number(entry.levels)>0):[];
  const total=Math.max(1,Number(character.level)||1),secondaryLevels=secondary.reduce((sum,entry)=>sum+Number(entry.levels||0),0);
  return [{className:character.class,subclass:character.subclass||'',levels:Math.max(1,total-secondaryLevels),primary:true},...secondary.map((entry)=>({className:entry.class,subclass:entry.subclass||'',levels:Number(entry.levels),primary:false}))].filter((entry)=>entry.className);
}

export function deriveCanonicalSpellSlots(character={}){
  const classes=getCharacterClassBreakdown(character),casters=classes.filter(isCaster),standard=casters.filter((entry)=>entry.className!=='Warlock'),warlocks=casters.filter((entry)=>entry.className==='Warlock');
  let slots=[];let derivation='no_spellcasting';
  if(standard.length===1){const entry=standard[0],effective=isThird(entry)?Math.floor(entry.levels/3):entry.levels;slots=(isThird(entry)?FULL:TABLES[entry.className])?.[Math.max(0,effective-1)]||[];derivation=`single ${entry.className} ${entry.levels}`;}
  else if(standard.length>1){const casterLevel=Math.min(20,standard.reduce((sum,entry)=>sum+contribution(entry),0));slots=casterLevel>0?(FULL[casterLevel-1]||[]):[];derivation=`multiclass caster level ${casterLevel}`;}
  if(warlocks.length){const level=warlocks.reduce((sum,entry)=>sum+entry.levels,0),pact=WARLOCK[Math.min(20,level)-1]||[];slots=Array.from({length:Math.max(slots.length,pact.length)},(_,index)=>(slots[index]||0)+(pact[index]||0));derivation+=`${standard.length?' + ':''}Warlock ${level}`;}
  return {class_breakdown:classes,max_slots:slots,derivation,storage_semantics:'used_counts',restored_representation:{}};
}

export const getMaxSlotsForLevel=(character,slotLevel)=>deriveCanonicalSpellSlots(character).max_slots[Number(slotLevel)-1]||0;