import React from 'react';
import { Tags } from 'lucide-react';
import type { RsipPolicy, RsipProgress } from '@shared/api.interface';
import { cn } from '@client/src/lib/utils';
import { useCardTilt } from '@client/src/hooks/useCardTilt';
import { getIconOption, getPolicyIconKey } from './policy-icons';
import { TYPE_META } from './PolicyTypeBadge';
import { getRarity } from './rarity';
import ProgressTrack from './ProgressTrack';
import StatGem from './StatGem';

interface PolicyCardProps {
  policy: RsipPolicy;
  progress: RsipProgress | null;
  /** 所属国策组名称 */
  groupName?: string | null;
  /** 右上角额外标记，如「曾上树」 */
  tag?: string | null;
  /** 卡牌底部操作区 */
  actions?: React.ReactNode;
  /** 退役卡（判例库）：去饱和展示退役原因 */
  retired?: boolean;
  /** 入场动画延迟 ms */
  dealDelay?: number;
  className?: string;
}

/**
 * 国策卡（竖版）：插画区 + 名称横幅 + 类型行 + 规则文本框 + 底部宝石。
 * 稀有度（边框色 / 闪卡光泽）由内化天数决定。
 */
const PolicyCard: React.FC<PolicyCardProps> = ({
  policy,
  progress,
  groupName,
  tag,
  actions,
  retired = false,
  dealDelay = 0,
  className,
}) => {
  const tilt = useCardTilt<HTMLDivElement>();
  const cumulative: number = progress?.cumulativeLitDays ?? 0;
  const streak: number = progress?.currentStreak ?? 0;
  const rarity = getRarity(cumulative);
  const icon = getIconOption(getPolicyIconKey(policy));
  const { Icon } = icon;
  const typeMeta = TYPE_META[policy.type];

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className={cn('rsip-card rsip-deal flex flex-col', className)}
      data-rarity={rarity.key}
      data-interactive="true"
      data-retired={retired ? 'true' : undefined}
      style={{ '--delay': `${dealDelay}ms` } as React.CSSProperties}
    >
      <div className="rsip-card-foil" aria-hidden="true" />
      <div className="rsip-card-glare" aria-hidden="true" />

      {/* 插画区 */}
      <div
        className="rsip-art relative h-28 overflow-hidden rounded-t-[12px]"
        style={{ '--hue': String(icon.hue) } as React.CSSProperties}
      >
        <div className="relative z-[1] flex h-full items-center justify-center">
          <Icon
            size={52}
            strokeWidth={1.6}
            className="text-white/90"
            style={{ filter: 'drop-shadow(0 4px 10px hsl(0 0% 0% / 0.5))' }}
            aria-hidden="true"
          />
        </div>
        <div className="absolute top-2 left-2 z-[4]">
          <StatGem
            value={streak}
            tone={streak > 0 ? 'streak' : 'idle'}
            size={36}
            label={`连续 ${streak} 天`}
          />
        </div>
        <div className="absolute top-2.5 right-2.5 z-[4] flex flex-col items-end gap-1">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/85 backdrop-blur-sm"
            title={typeMeta.label}
          >
            {typeMeta.icon}
          </span>
        </div>
        <span className="rsip-rar-text absolute bottom-1.5 left-1/2 z-[4] -translate-x-1/2 text-[10px] font-semibold tracking-[0.3em]">
          {rarity.label}
        </span>
      </div>

      {/* 名称横幅 */}
      <div className="rsip-banner px-3 py-2 text-center">
        <h3 className="truncate font-serif text-[15px] font-bold text-foreground">
          {policy.name}
        </h3>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-3 pt-2 pb-3">
        {/* 类型行 */}
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span>{typeMeta.label}</span>
          {groupName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5">
                <Tags size={10} />
                {groupName}
              </span>
            </>
          )}
          {tag && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-gold-soft">{tag}</span>
            </>
          )}
        </div>

        {/* 规则文本框 */}
        <div className="rsip-textbox flex-1 space-y-1.5 px-2.5 py-2 text-xs leading-relaxed">
          {retired ? (
            <p className="break-words text-foreground/80">
              {policy.retireReason ?? '未填写退役原因'}
            </p>
          ) : (
            <>
              <p className="break-words text-foreground/90">{policy.judge}</p>
              <p className="break-words text-muted-foreground">
                <span className="text-gold-soft/80">触发 </span>
                {policy.trigger ?? '常驻生效'}
              </p>
            </>
          )}
        </div>

        {!retired && (
          <>
            <ProgressTrack cumulative={cumulative} streak={streak} compact />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <StatGem
                  value={cumulative}
                  tone={cumulative > 0 ? 'total' : 'empty'}
                  size={30}
                  label={`累计 ${cumulative} 天`}
                />
                <span className="text-[10px] leading-tight text-muted-foreground">
                  累计
                  <br />
                  {rarity.next
                    ? `距${rarity.next.label} ${rarity.next.min - cumulative} 天`
                    : '最高档'}
                </span>
              </div>
              {actions && (
                <div className="relative z-[5] flex shrink-0 items-center gap-1">
                  {actions}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="rsip-card-inner" aria-hidden="true" />
    </div>
  );
};

export default PolicyCard;
