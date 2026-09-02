export const CAMP_REST_TRANSITION_VERSION = 'camp-rest-transition-v2.5.0';

export const createCampRestState = () => ({
  step: 'choose_type',
  restType: null,
  requestId: null,
  result: null,
  error: null,
});

export function campRestReducer(state, event) {
  switch (event.type) {
    case 'SELECT':
      return { ...state, step: event.restType === 'long' ? 'confirm_long_rest' : 'confirm_short_rest', restType: event.restType, requestId: event.requestId, result: null, error: null };
    case 'SUBMIT':
      return state.requestId ? { ...state, step: 'submitting', error: null } : state;
    case 'SUCCESS':
      return { ...state, step: 'success', result: event.result, error: null };
    case 'ERROR':
      return { ...state, step: 'error', error: event.error || 'The rest could not be confirmed.', result: null };
    case 'RETRY':
      return state.requestId ? { ...state, step: 'submitting', error: null } : state;
    case 'RESET':
      return createCampRestState();
    default:
      return state;
  }
}

export function consumeRestConfirmationEvent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

export function createRestSubmissionGate() {
  let submitting = false;
  return {
    isSubmitting: () => submitting,
    run: async (event, operation) => {
      consumeRestConfirmationEvent(event);
      if (submitting) return { duplicate: true };
      submitting = true;
      try {
        return { duplicate: false, value: await operation() };
      } finally {
        submitting = false;
      }
    },
  };
}

export const CAMP_REST_MOBILE_CONTRACT = Object.freeze({
  viewport: '100dvh',
  intrinsicStacking: true,
  singleScrollOwner: true,
  safeAreaPadding: true,
});