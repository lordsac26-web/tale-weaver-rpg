// Shared dice + stat helpers used by combat backend functions.
export const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
export const rollD20 = () => Math.floor(Math.random() * 20) + 1;
export const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;
export const condName = (c) => (typeof c === 'string' ? c : c?.name);