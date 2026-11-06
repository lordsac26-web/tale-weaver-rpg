import { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import groundedClarificationController from '@/lib/game/groundedClarificationController';

export default function useGroundedClarification({ sessionId, characterId, onResolved }) {
  const resolved = useRef(onResolved);
  resolved.current = onResolved;
  const controller = useMemo(() => groundedClarificationController({sessionId,characterId,
    invoke:(name,payload)=>base44.functions.invoke(name,payload),storage:localStorage,
    onResolved:data=>resolved.current(data)}), [sessionId,characterId]);
  const [snapshot,setSnapshot] = useState(controller.snapshot);
  useEffect(() => {
    setSnapshot(controller.snapshot());
    const unsubscribe=controller.subscribe(setSnapshot);
    controller.restore().catch(error => {
      // Keep any local pending attempt visible if restoration cannot reach the server.
      console.error('Clarification restore failed', error);
    });
    return unsubscribe;
  }, [controller]);
  return {...snapshot,install:controller.install,submit:controller.submit,
    acceptCommitted:data=>resolved.current(data),setReply:controller.setReply,cancel:controller.cancel};
}