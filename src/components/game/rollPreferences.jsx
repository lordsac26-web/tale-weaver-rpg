// Roll preference helper — persists whether skill/combat checks are auto-rolled
// by the engine, or rolled manually by the player via the dice roller.
// Stored in localStorage so the choice survives reloads.

const STORAGE_KEY = 'taleweaver_manual_rolls';

export function getManualRollEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setManualRollEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    // Notify listeners in the same tab (storage event only fires across tabs)
    window.dispatchEvent(new CustomEvent('manual-roll-changed', { detail: enabled }));
  } catch {
    // ignore
  }
}