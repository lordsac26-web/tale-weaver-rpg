const ISSUER = 'stale-choice-transition-guard-v1';
const encoder = new TextEncoder();
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
const decode = (value) => {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};
const equalBytes = (left, right) => left.length === right.length && left.reduce((match, value, index) => match | (value ^ right[index]), 0) === 0;

async function signingKey({ scope, receipt, character }) {
  const material = JSON.stringify({ issuer: ISSUER, character_id: scope.characterId, session_id: scope.sessionId, request_id: receipt?.request_id, receipt_key: scope.receiptKey, receipt, owner_id: character?.created_by_id || null, character_created: character?.created_date || null });
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(material));
  return crypto.subtle.importKey('raw', digest, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createStaleChoiceApplyToken({ scope, receipt, character, expectedHashes, classification, proposalHash }) {
  const payload = { issuer: ISSUER, exp: Date.now() + 15 * 60 * 1000, nonce: crypto.randomUUID(), character_id: scope.characterId, session_id: scope.sessionId, request_id: receipt?.request_id, receipt_key: scope.receiptKey, expected_hashes: expectedHashes, classification, proposal_hash: proposalHash };
  const body = encode(encoder.encode(JSON.stringify(payload)));
  const key = await signingKey({ scope, receipt, character });
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return `${body}.${encode(signature)}`;
}

export async function verifyStaleChoiceApplyToken({ token, scope, receipt, character, allowExpired = false }) {
  const [body, signaturePart, extra] = String(token || '').split('.');
  if (!body || !signaturePart || extra) return { ok: false, error: 'Invalid apply token.', status: 409 };
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(decode(body))); } catch { return { ok: false, error: 'Invalid apply token.', status: 409 }; }
  const key = await signingKey({ scope, receipt, character });
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  let supplied;
  try { supplied = decode(signaturePart); } catch { return { ok: false, error: 'Invalid apply token.', status: 409 }; }
  if (!equalBytes(expected, supplied)) return { ok: false, error: 'Invalid apply token signature.', status: 409 };
  if (payload.issuer !== ISSUER || payload.character_id !== scope.characterId || payload.session_id !== scope.sessionId || payload.request_id !== receipt?.request_id || payload.receipt_key !== scope.receiptKey) return { ok: false, error: 'Apply token scope mismatch.', status: 409 };
  if (!allowExpired && Number(payload.exp) <= Date.now()) return { ok: false, error: 'Apply token expired.', status: 409 };
  return { ok: true, payload };
}