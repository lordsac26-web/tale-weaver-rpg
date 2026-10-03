import { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import createStowFollowupState from '@/lib/stowFollowupState';

export default function useStoryStowClarification({ sessionId, onConfirmed }) {
  const callback = useRef(onConfirmed); callback.current = onConfirmed;
  const [, render] = useState(0);
  const controller = useMemo(() => createStowFollowupState({ sessionId, storage: localStorage,
    invoke: payload => base44.functions.invoke('confirmStoryStowClarification', payload),
    onChange: () => render(x => x + 1), onConfirmed: data => callback.current?.(data) }), [sessionId]);
  const state = controller.getState();
  return { controller, state, pending: !!state.data && !state.finished, install: controller.install, restore: controller.restore, submit: controller.submit, dismiss: controller.dismiss };
}