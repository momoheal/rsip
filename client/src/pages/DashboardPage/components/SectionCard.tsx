import React from 'react';
import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}

/** 仪表盘区块卡片外壳：统一圆角 / 边框 / 内边距 / 标题行 */
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  hint,
  children,
}) => {
  return (
    <section className="rsip-panel p-4">
      <div className="flex items-center gap-2">
        <span className="text-gold-soft/80" aria-hidden="true">
          {icon}
        </span>
        <h2 className="font-serif text-sm font-bold text-foreground">{title}</h2>
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
};

interface SectionEmptyProps {
  text: string;
}

/** 区块空态：虚框 + 平铺中性文案 */
export const SectionEmpty: React.FC<SectionEmptyProps> = ({ text }) => {
  return (
    <div className="rounded-lg border border-dashed border-foreground/20 px-4 py-8 text-center">
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
};

export default SectionCard;
