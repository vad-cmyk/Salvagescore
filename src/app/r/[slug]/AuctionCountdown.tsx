'use client';

import { useEffect, useState } from 'react';

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function calcTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function AuctionCountdown({ auctionDate }: { auctionDate: string }) {
  const target = new Date(auctionDate);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calcTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
    // target is derived from a prop string — stable for the component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionDate]);

  const isEnded = timeLeft === null;
  const daysPast = Math.floor((Date.now() - target.getTime()) / 86400000);

  return (
    <div className={`rounded-xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
      isEnded
        ? 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]'
        : timeLeft!.days === 0
        ? 'border-[rgba(255,80,80,0.35)] bg-[rgba(255,80,80,0.06)]'
        : 'border-[rgba(255,180,0,0.3)] bg-[rgba(255,180,0,0.05)]'
    }`}>
      <div className={`text-xs font-semibold uppercase tracking-widest ${
        isEnded ? 'text-[#888]' : timeLeft!.days === 0 ? 'text-[#ff6b6b]' : 'text-[#f5b800]'
      }`}>
        {isEnded ? 'Auction Ended' : 'Auction Countdown'}
      </div>

      {isEnded ? (
        <p className="text-sm text-[#888]">
          {daysPast === 0
            ? 'Ended today'
            : daysPast === 1
            ? 'Ended yesterday'
            : `Ended ${daysPast} days ago`}
        </p>
      ) : (
        <div className="flex items-center gap-1 font-mono text-lg font-semibold text-[#F0EDE8] tabular-nums">
          {timeLeft!.days > 0 && (
            <>
              <span>{timeLeft!.days}d</span>
              <span className="opacity-40 mx-0.5">·</span>
            </>
          )}
          <span>{pad(timeLeft!.hours)}h</span>
          <span className="opacity-40 mx-0.5">·</span>
          <span>{pad(timeLeft!.minutes)}m</span>
          <span className="opacity-40 mx-0.5">·</span>
          <span>{pad(timeLeft!.seconds)}s</span>
        </div>
      )}
    </div>
  );
}
