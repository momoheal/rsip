import React from 'react';
import type { RsipPolicy } from '@shared/api.interface';
import { cn } from '@client/src/lib/utils';
import { levelLabel } from './upgrade';

interface LevelBadgeProps {
  policy: RsipPolicy;
  className?: string;
}

/** 强化等级徽记「+N」；等级为 0 或未设置强化规则时不渲染 */
const LevelBadge: React.FC<LevelBadgeProps> = ({ policy, className }) => {
  const label: string | null = levelLabel(policy);
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-gold/60 bg-black/50 px-1.5 py-px font-display text-[11px] leading-tight font-bold tabular-nums text-gold-soft shadow-[0_0_10px_-3px_var(--gold)] backdrop-blur-sm',
        className,
      )}
      title={`强化等级 ${label}`}
      aria-label={`强化等级 ${label}`}
    >
      {label}
    </span>
  );
};

export default LevelBadge;
