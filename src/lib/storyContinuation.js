// Retain one attempted action until its authoritative story pair is accepted.
// A transport retry reuses the same payload and roll, not a new player action.
export default function createStoryContinuation(invoke) {
  let pending = null;
  return {
    begin(key, makeId) {
      if (pending?.key === key) return pending.id;
      if (pending) throw new Error('An earlier action is unresolved. Retry that exact action before choosing a different one.');
      pending = { key, id: makeId(), receipt: null, payload: null };
      return pending.id;
    },
    remember(id, resolution) { if (pending?.id === id) pending.receipt = resolution; },
    receipt(id) { return pending?.id === id ? pending.receipt : null; },
    async send(id, buildPayload) {
      if (!pending || pending.id !== id) throw new Error('The continuation request does not match the pending action.');
      // Cache the construction too: replay must not repeat pre-casts/consumables.
      if (!pending.payload) pending.payload = Promise.resolve().then(buildPayload);
      return invoke(await pending.payload);
    },
    accepted(id) { if (pending?.id === id) pending = null; },
    cancelled(id) { if (pending?.id === id && !pending.receipt && !pending.payload) pending = null; },
  };
}