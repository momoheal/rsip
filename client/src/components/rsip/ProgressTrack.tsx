import React from 'react';
import { cn } from '@client/src/lib/utils';
import { getRarity } from './rarity';

interface ProgressTrackProps {
  cumulative: number;
  streak: number;
  compact?: boolean;
}

/**
 * 内化进度条：展示当前稀有度到下一档的进度；
 * 填充色随进度从灰阶过渡到琥珀。
 */
const ProgressTrack: React.FC<ProgressTrackProps> = ({
  cumulative,
  streak,
  compact = false,
}) => {
  const rarity = getRarity(cumulative);
  const fillClass =
    cumulative === 0
      ? 'bg-foreground/15'
      : cumulative < 7
        ? 'bg-gradient-to-r from-slate-500 to-slate-300'
        : cumulative < 21
          ? 'bg-gradient-to-r from-amber-600 to-amber-300'
          : 'bg-gradient-to-r from-amber-500 to-amber-200';
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10 shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.5)]">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            fillClass,
            cumulative >= 7 && 'shadow-[0_0_8px_hsl(40_90%_60%/0.6)]',
          )}
          style={{
            width: `${Math.max(rarity.ratio * 100, cumulative > 0 ? 6 : 0)}%`,
          }}
        />
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            累计 {cumulative} 天 · 连续 {streak} 天
          </span>
          <span className="tabular-nums">
            {rarity.next
              ? `距「${rarity.next.label}」${rarity.next.min - cumulative} 天`
              : '已达最高档'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProgressTrack;
