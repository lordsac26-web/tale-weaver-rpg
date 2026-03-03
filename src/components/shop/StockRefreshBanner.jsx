import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function StockRefreshBanner({ lastRefresh, refreshDays = 3 }) {
  if (!lastRefresh) return null;

  const last = new Date(lastRefresh);
  const now = new Date();
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, Math.ceil(refreshDays - daysSince));
  const refreshedRecently = daysSince < 0.5; // within last 12 hours

  return (
    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
      style={{ background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.1)' }}>
      <RefreshCw className="w-3 h-3" style={{ color: refreshedRecently ? '#86efac' : 'rgba(180,140,90,0.35)' }} />
      <span style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
        {refreshedRecently
          ? 'Fresh stock just arrived'
          : daysLeft === 0
          ? 'Stock refresh due'
          : `Stock refreshes in ~${daysLeft}d`}
      </span>
    </div>
  );
}