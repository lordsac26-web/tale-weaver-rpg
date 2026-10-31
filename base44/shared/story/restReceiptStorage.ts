// Keep the idempotency outcome, not entire historical Character snapshots with
// nested transaction ledgers. Replays hydrate current state without performing rest.
export function compactRestReceipt(receipt) {
  if (!receipt?.response) return receipt;
  const { character, session, ...response } = receipt.response;
  return { ...receipt, character_id: receipt.character_id || character?.id || session?.character_id,
    response, storage_version: 'rest-receipt-storage-v1.0.0' };
}
export function replayRestReceipt(receipt, character, session) {
  return { ...receipt.response, character, ...(session ? { session } : {}), already_processed: true };
}