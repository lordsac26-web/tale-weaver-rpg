const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const parseObject = (value) => {
  if (isObject(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const contractScore = (value) => ['mode','character_id','characterId','session_id','sessionId','combat_log_id','combat_id','combatLogId','combatId','request_id','requestId'].filter((key) => value?.[key] !== undefined).length;
const safeFieldName = (key) => !/(authorization|auth|token|secret|password|cookie|credential)/i.test(String(key));
const cleanString = (value) => typeof value === 'string' ? value.trim() : value;

export const PWT_HIDE_AUDIT_EXPECTED_FIELDS = {
  mode: 'dry_run | apply (optional; defaults to dry_run)',
  character_id: 'Character ID',
  session_id: 'GameSession ID',
  combat_log_id: 'CombatLog ID',
  request_id: 'Unique idempotency request ID',
};

export function normalizePwtHideAuditRequest(rawBody) {
  const root = parseObject(rawBody) || {};
  const candidates = [];
  const queue = [{ value: root, path: '$', depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    candidates.push(current);
    if (current.depth >= 3) continue;
    for (const key of ['data', 'body', 'json']) {
      const child = parseObject(current.value?.[key]);
      if (child) queue.push({ value: child, path: `${current.path}.${key}`, depth: current.depth + 1 });
    }
  }
  candidates.sort((a, b) => contractScore(b.value) - contractScore(a.value));
  const selected = candidates[0] || { value: root, path: '$' };
  const source = selected.value;
  const normalized = {
    mode: cleanString(source.mode) || 'dry_run',
    character_id: cleanString(source.character_id ?? source.characterId),
    session_id: cleanString(source.session_id ?? source.sessionId),
    combat_log_id: cleanString(source.combat_log_id ?? source.combat_id ?? source.combatLogId ?? source.combatId),
    request_id: cleanString(source.request_id ?? source.requestId),
    expected_hashes: source.expected_hashes ?? source.expectedHashes ?? null,
  };
  return {
    normalized,
    diagnostics: {
      selected_path: selected.path,
      received_field_names: Object.keys(source).filter(safeFieldName).sort(),
      normalized_values: {
        mode: normalized.mode || null,
        character_id: normalized.character_id || null,
        session_id: normalized.session_id || null,
        combat_log_id: normalized.combat_log_id || null,
        request_id: normalized.request_id || null,
      },
    },
  };
}