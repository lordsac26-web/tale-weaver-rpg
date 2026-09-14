export const ROLL_MODE_VERSION = 'persistent-roll-mode-v1.0.0';
export const ROLL_SURFACES = Object.freeze(['story_skill', 'story_attack', 'combat_attack', 'death_save']);

export const normalizeRollMode = (value) => value === 'player' ? 'player' : 'ai';
export const isPlayerRollMode = (value) => normalizeRollMode(value) === 'player';
export const shouldOpenPlayerRoll = ({ rollMode, surface }) => ROLL_SURFACES.includes(surface) && isPlayerRollMode(rollMode);