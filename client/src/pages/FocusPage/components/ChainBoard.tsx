import React from 'react';
import { Armchair, BellRing, Binoculars } from 'lucide-react';
import { cn } from '@client/src/lib/utils';
import { formationOf, type CtdpState } from '@client/src/store/ctdpEngine';

interface ChainBoardProps {
  state: CtdpState;
}

interface ChainTileProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  caption: string;
  emphasis?: boolean;
  className?: string;
}

const ChainTile: React.FC<ChainTileProps> = ({
  icon,
  title,
  value,
  caption,
  emphasis = false,
  className,
}) => (
  <div
    className={cn(
      emphasis
        ? 'rsip-panel rsip-panel-gilt p-4 shadow-[0_0_40px_-18px_var(--gold)]'
        : 'rsip-panel p-4',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {title}
    </div>
    <p
      className={
        emphasis
          ? 'mt-2 font-display text-4xl font-bold tabular-nums text-gold-soft sm:text-5xl'
          : 'mt-2 font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl'
      }
    >
      #{value}
    </p>
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
  </div>
);

/** 三条计数：主链（神圣座位）、预约链、侦查 */
const ChainBoard: React.FC<ChainBoardProps> = ({ state }) => {
  const { main, aux, scoutCount } = state;
  const formation = formationOf(main.count);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
      <ChainTile
        emphasis
        className="col-span-2 sm:col-span-1"
        icon={<Armchair size={14} className="text-gold-soft" />}
        title="主链 · 神圣座位"
        value={main.count}
        caption={`##${formation.groups} 任务组 · ###${formation.clusters} 任务群 · 最长 #${main.best}`}
      />
      <ChainTile
        icon={<BellRing size={14} className="text-frost" />}
        title="预约链"
        value={aux.count}
        caption={`最长 #${aux.best} · 判例 ${aux.precedents.length} 条`}
      />
      <ChainTile
        icon={<Binoculars size={14} />}
        title="侦查"
        value={scoutCount}
        caption="完成即可，不影响主链"
      />
    </div>
  );
};

export default ChainBoard;
