import { clarificationReplyPayload, clarificationNeedsReply, GROUNDED_CLARIFICATION_SUBMIT_VERSION } from '@/lib/game/groundedClarificationContract';

export default function groundedClarificationController({sessionId,characterId,invoke,storage,onResolved}) {
  const key=`grounded-clarification:${sessionId}`;
  let state=null,busy=false,error='',listener=()=>{};
  try { state=JSON.parse(storage.getItem(key)||'null'); } catch { state=null; }
  const snapshot=()=>({state,busy,error,pending:!!state,version:GROUNDED_CLARIFICATION_SUBMIT_VERSION});
  const emit=()=>{ if(state) storage.setItem(key,JSON.stringify(state)); else storage.removeItem(key); listener(snapshot()); };
  const install=data=>{state={original:data,data,reply:''};error='';emit();};
  const keep=data=>{state={...state,data:{...state.data,...data},original:{...state.original,
    ...(data.clarification_intent_id?{clarification_intent_id:data.clarification_intent_id,request_id:data.request_id}:{} )}};};
  return {snapshot,subscribe(fn){listener=fn;return()=>{listener=()=>{};};},install,
    setReply(reply){if(state){state={...state,reply};emit();}},
    async restore(){
      if(!sessionId||!characterId||busy)return;
      const {data}=await invoke('evaluatePlayerAction',{session_id:sessionId,character_id:characterId,clarification_operation:'restore'});
      if(data?.clarification_required&&!busy){
        if(state?.data?.clarification_intent_id===data.clarification_intent_id)keep(data);
        else state={original:data,data,reply:state?.reply || ''};
        emit();
      }
    },
    async submit(reply=state?.reply||'',selectedId=''){
      if(!state||busy)return false;
      const text=String(reply||'').trim();
      if(!text||Array.from(text).length>8000){error='Enter a reply of 1 to 8,000 characters.';emit();return false;}
      state={...state,reply:text};busy=true;error='';emit();
      try {
        const payload=clarificationReplyPayload({state,sessionId,characterId,reply:text,selectedId});
        const {data}=await invoke('evaluatePlayerAction',payload);
        if(clarificationNeedsReply(data)){
          keep(data);error=data.error||data.reasoning||'Your reply did not resolve the selection. Type one of the listed full names; the original action is saved.';return false;
        }
        await onResolved(data);
        state=null;return true;
      } catch(err){
        error=`${err?.response?.data?.error||err.message||'The selection could not be saved.'} Your original action and reply are preserved. Retry this selection or type the listed full name.`;
        return false;
      } finally {busy=false;emit();}
    },
    async cancel(){
      if(busy)return;
      if(state?.data?.clarification_kind==='bag_transfer'){
        busy=true;error='';emit();
        try{await invoke('evaluatePlayerAction',{session_id:sessionId,character_id:characterId,clarification_operation:'cancel',clarification_intent_id:state.data.clarification_intent_id});state=null;}
        catch(err){error=err?.response?.data?.error||err.message;}
        finally{busy=false;emit();}
      }else{state=null;error='';emit();}
    }
  };
}