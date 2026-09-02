import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { campRestReducer, createCampRestState, createRestSubmissionGate } from '../../../base44/shared/rest/campRestFlow';

export default function useCampRestFlow({ sessionId, maxHitDice, onRest, onClose, onBusyChange }) {
  const [state, dispatch] = useReducer(campRestReducer, undefined, createCampRestState);
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);
  const gateRef = useRef(createRestSubmissionGate());

  const busy = state.step === 'submitting';
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  const selectRest = useCallback((restType, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const requestId = `rest:${sessionId}:${restType}:${crypto.randomUUID()}`;
    dispatch({ type: 'SELECT', restType, requestId });
  }, [sessionId]);

  const submit = useCallback(async (event) => {
    const requestId = state.requestId;
    const restType = state.restType;
    if (!requestId || !restType) return;
    const outcome = await gateRef.current.run(event, async () => {
      dispatch({ type: state.step === 'error' ? 'RETRY' : 'SUBMIT' });
      return onRest(restType, Math.min(hitDiceToSpend, maxHitDice), requestId);
    });
    if (outcome.duplicate) return;
    dispatch({ type: 'SUCCESS', result: outcome.value });
  }, [hitDiceToSpend, maxHitDice, onRest, state.requestId, state.restType, state.step]);

  const submitSafely = useCallback((event) => {
    submit(event).catch((error) => dispatch({ type: 'ERROR', error: error?.message || 'The server did not confirm the rest. Retry with the same request.' }));
  }, [submit]);

  const close = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (gateRef.current.isSubmitting()) return;
    dispatch({ type: 'RESET' });
    onBusyChange?.(false);
    onClose();
  }, [onBusyChange, onClose]);

  return { state, busy, hitDiceToSpend, setHitDiceToSpend, selectRest, submit: submitSafely, close };
}