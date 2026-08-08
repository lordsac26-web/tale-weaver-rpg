export function updateBookkeepingSlot({ slots, level, maxSlots, usedSlots, slotIndex, orientation = 'availableFirst', operation = 'toggle', intent = 'bookkeeping', resolveEffect = false }) {
  if (intent === 'cast' || resolveEffect) {
    throw new Error('Mechanical spell casts must use an authoritative resolver');
  }
  let nextUsed;
  if (operation === 'use') nextUsed = usedSlots + 1;
  else if (operation === 'restore') nextUsed = Math.max(0, usedSlots - 1);
  else nextUsed = orientation === 'usedFirst'
    ? (slotIndex < usedSlots ? slotIndex : slotIndex + 1)
    : (slotIndex < maxSlots - usedSlots ? usedSlots + 1 : Math.max(0, usedSlots - 1));
  return { ...slots, [`level_${level}`]: Math.max(0, Math.min(maxSlots, nextUsed)) };
}

export function resetBookkeepingSlots({ intent = 'bookkeeping', resolveEffect = false } = {}) {
  if (intent === 'cast' || resolveEffect) {
    throw new Error('Mechanical spell casts must use an authoritative resolver');
  }
  return {};
}