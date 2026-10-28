import React from 'react';
import { cn } from '@client/src/lib/utils';

type GemTone = 'streak' | 'total' | 'idle' | 'empty';

interface StatGemProps {
  value: React.ReactNode;
  tone: GemTone;
  /** 宝石边长 px */
  size?: number;
  /** 读屏文本，如「连续 9 天」 */
  label: string;
  className?: string;
}

/** 卡牌角落的六边形数值宝石（连续天数 / 累计天数） */
const StatGem: React.FC<StatGemProps> = ({
  value,
  tone,
  size = 34,
  label,
  className,
}) => {
  const fontSize: number = Math.round(size * 0.42);
  return (
    <span
      className={cn('rsip-gem', className)}
      data-tone={tone}
      style={{ '--gem-size': `${size}px`, fontSize } as React.CSSProperties}
      role="img"
      aria-label={label}
      title={label}
    >
      {value}
    </span>
  );
};

export default StatGem;
