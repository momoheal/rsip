import React from 'react';

interface CountdownRingProps {
  /** 剩余毫秒 */
  remainingMs: number;
  /** 总时长毫秒 */
  totalMs: number;
  label: string;
  /** 环的色调：gold = 专注，frost = 预约 */
  tone?: 'gold' | 'frost';
}

export function formatClock(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const SIZE = 200;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** 倒计时环：剩余比例用描边长度表示，数字用宝石字体 */
const CountdownRing: React.FC<CountdownRingProps> = ({
  remainingMs,
  totalMs,
  label,
  tone = 'gold',
}) => {
  const ratio: number = totalMs > 0 ? Math.min(Math.max(remainingMs / totalMs, 0), 1) : 0;
  const color: string = tone === 'gold' ? 'var(--gold)' : 'var(--frost)';
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      role="timer"
      aria-label={`${label}，剩余 ${formatClock(remainingMs)}`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="hsl(224 15% 18%)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          style={{
            transition: 'stroke-dashoffset 1s linear',
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-4xl font-bold tabular-nums text-foreground">
          {formatClock(remainingMs)}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
};

export default CountdownRing;
