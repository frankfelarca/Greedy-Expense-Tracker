import { useState, useEffect } from 'react';

export function useCountdownTo(isoDate) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isoDate) return;
    const target = new Date(isoDate).getTime();
    if (target <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isoDate]);

  if (!isoDate) return { countdown: null, isExpired: false };

  const target = new Date(isoDate).getTime();
  const diff = target - now;

  if (diff <= 0) return { countdown: null, isExpired: true };

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return { countdown: parts.join(' '), isExpired: false };
}
