export const PROTECTED_DND_IDS = ['6a6825cd07a490fa70a46852','6a6825edd695bd65a4322256','6a7b8eea6d9cd7ede8b2d63b','6a767f23ec36fe219063ae49','6a77463582a26b50018110ea','6a7b9c44a9bae229fdacf232','6a7bb0f5bdee868a04599bd6'];

export const hashValue = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const readProtectedDndState = (db) => Promise.all([
  db.entities.Character.get(PROTECTED_DND_IDS[0]),
  db.entities.GameSession.get(PROTECTED_DND_IDS[1]),
  db.entities.CombatLog.get(PROTECTED_DND_IDS[2]).catch(() => null),
  db.entities.CombatLog.get(PROTECTED_DND_IDS[3]).catch(() => null),
  db.entities.CombatLog.get(PROTECTED_DND_IDS[4]).catch(() => null),
  db.entities.CombatLog.get(PROTECTED_DND_IDS[5]).catch(() => null),
  db.entities.CombatLog.get(PROTECTED_DND_IDS[6]).catch(() => null),
]);