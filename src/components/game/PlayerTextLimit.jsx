import React from 'react';
import { PLAYER_TEXT_LIMIT, playerTextCount, validatePlayerText } from '@/lib/playerText';

export default function PlayerTextLimit({ value }) {
  const count = playerTextCount(value);
  if (count < PLAYER_TEXT_LIMIT - 1000) return null;
  const validation = validatePlayerText(value, true);
  return <div className="mt-1 font-body text-sm text-fantasy-parchment-dim" role={validation.ok ? 'status' : 'alert'}>
    {count.toLocaleString('en-US')} / 8,000 characters{!validation.ok && <p>{validation.error}</p>}
  </div>;
}