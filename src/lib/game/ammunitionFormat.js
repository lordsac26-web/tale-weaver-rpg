// Frontend mirror of base44/shared/ammunitionFormat.js (backend modules are not
// part of the client bundle; keep in lockstep with the backend module).
export const formatAuthoritativeAmmoLabel = (name, quantity) => `${name} — ${Math.max(0, Number(quantity) || 0)} remaining${Math.max(0, Number(quantity) || 0) === 0 ? ' (Depleted)' : ''}`;
export const formatAmmunitionProperty = (property) => {
  const value = String(property || '');
  const range = value.match(/^ammunition\s*\((?:range\s*)?([^)]+)\)$/i);
  return range ? `Ammunition · Range ${range[1]}` : value;
};