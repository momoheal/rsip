import React from 'react';
import { Crown, Snowflake, TreePine } from 'lucide-react';
import type { RsipTreeNode } from '@shared/api.interface';
import { TYPE_META } from '@client/src/components/rsip/PolicyTypeBadge';
import {
  getIconOption,
  getPolicyIconKey,
} from '@client/src/components/rsip/policy-icons';
import ProgressTrack from '@client/src/components/rsip/ProgressTrack';
import StatGem from '@client/src/components/rsip/StatGem';
import LevelBadge from '@client/src/components/rsip/LevelBadge';
import { getUpgradeState } from '@client/src/components/rsip/upgrade';
import { getRarity } from '@client/src/components/rsip/rarity';
import { useCardTilt } from '@client/src/hooks/useCardTilt';
import { cn } from '@client/src/lib/utils';

function isLit(node: RsipTreeNode): boolean {
  return node.progress !== null && node.progress.cumulativeLitDays > 0;
}

interface TreeNodeCardProps {
  node: RsipTreeNode;
  isRoot: boolean;
  onNodeClick: (node: RsipTreeNode) => void;
}

/** 牌桌上的国策卡：点亮呼吸光晕、冻结冰霜、待重判虚线脉冲 */
const TreeNodeCard: React.FC<TreeNodeCardProps> = ({
  node,
  isRoot,
  onNodeClick,
}) => {
  const { policy, progress, frozenBy, pendingRelease } = node;
  const tilt = useCardTilt<HTMLDivElement>();
  const lit: boolean = isLit(node);
  const cumulative: number = progress?.cumulativeLitDays ?? 0;
  const streak: number = progress?.currentStreak ?? 0;
  const rarity = getRarity(cumulative);
  const icon = getIconOption(getPolicyIconKey(policy));
  const { Icon } = icon;
  const typeMeta = TYPE_META[policy.type];
  const upgradeReady: boolean = getUpgradeState(policy, progress)?.ready ?? false;

  return (
    <div className="relative flex flex-col items-center">
      {isRoot && (
        <span className="mb-1.5 flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold-soft shadow-[0_0_14px_-4px_var(--gold)]">
          <Crown size={12} />根
        </span>
      )}
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className={cn(
          'rsip-card rsip-deal w-[136px] shrink-0 sm:w-[176px]',
          lit && 'rsip-lit',
          frozenBy && 'rsip-frost',
          pendingRelease && 'rsip-pending',
        )}
        data-rarity={rarity.key}
        data-interactive="true"
      >
        <div className="rsip-card-foil" aria-hidden="true" />
        <div className="rsip-card-glare" aria-hidden="true" />
        <button
          type="button"
          aria-label={`查看国策 ${policy.name}`}
          onClick={() => onNodeClick(node)}
          className="relative z-[5] block w-full rounded-[12px] text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div
            className="rsip-art flex h-16 items-center justify-center rounded-t-[12px]"
            style={{ '--hue': String(icon.hue) } as React.CSSProperties}
          >
            <Icon
              size={30}
              strokeWidth={1.7}
              className="relative z-[1] text-white/90"
              style={{ filter: 'drop-shadow(0 3px 6px hsl(0 0% 0% / 0.5))' }}
              aria-hidden="true"
            />
          </div>
          <span className="absolute top-1.5 left-1.5">
            <StatGem
              value={streak}
              tone={streak > 0 ? 'streak' : 'idle'}
              size={30}
              label={`连续 ${streak} 天`}
            />
          </span>
          <span
            className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/85"
            title={typeMeta.label}
          >
            {typeMeta.icon}
          </span>
          <LevelBadge policy={policy} className="absolute top-9 right-2" />

          <div className="rsip-banner px-2 py-1.5 text-center">
            <p className="line-clamp-2 min-h-[2.5em] font-serif text-[13px] leading-tight font-bold text-foreground sm:text-sm">
              {policy.name}
            </p>
          </div>

          <div className="space-y-1.5 px-2.5 pt-1.5 pb-2.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="rsip-rar-text font-semibold tracking-[0.2em]">
                {rarity.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                累计 {cumulative} 天
              </span>
            </div>
            <ProgressTrack cumulative={cumulative} streak={streak} compact />
            {(frozenBy || pendingRelease || policy.isRetired || upgradeReady) && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {frozenBy && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-300/15 px-1.5 py-0.5 text-[10px] text-sky-200">
                    <Snowflake size={10} />
                    <span className="tabular-nums">至 {frozenBy.endDate}</span>
                  </span>
                )}
                {pendingRelease && (
                  <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold-soft">
                    待解冻重判
                  </span>
                )}
                {upgradeReady && (
                  <span className="rounded-full border border-gold/40 px-1.5 py-0.5 text-[10px] text-gold-soft">
                    可升级
                  </span>
                )}
                {policy.isRetired && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    已退役
                  </span>
                )}
              </div>
            )}
          </div>
        </button>
        <div className="rsip-card-inner" aria-hidden="true" />
      </div>
    </div>
  );
};

interface TreeBranchProps {
  node: RsipTreeNode;
  isRoot?: boolean;
  onNodeClick: (node: RsipTreeNode) => void;
}

const TreeBranch: React.FC<TreeBranchProps> = ({
  node,
  isRoot = false,
  onNodeClick,
}) => {
  const lit: boolean = isLit(node);
  return (
    <div className="flex flex-col items-center">
      <TreeNodeCard node={node} isRoot={isRoot} onNodeClick={onNodeClick} />
      {node.children.length > 0 && (
        <>
          <div
            className={cn('rsip-tree-stem', lit && 'rsip-line-lit')}
            aria-hidden="true"
          />
          <div className="rsip-tree-children">
            {node.children.map((child: RsipTreeNode) => (
              <div
                key={child.nodeId}
                className={cn(
                  'rsip-tree-child',
                  lit && isLit(child) && 'rsip-line-lit',
                )}
              >
                <TreeBranch node={child} onNodeClick={onNodeClick} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface TreeViewProps {
  /** 选中树的根节点；树没有根时为 null */
  root: RsipTreeNode | null;
  /** 是否存在任何一棵树，用于区分「该树无根」与「完全没有树」 */
  hasTrees: boolean;
  onNodeClick: (node: RsipTreeNode) => void;
}

const TreeView: React.FC<TreeViewProps> = ({ root, hasTrees, onNodeClick }) => {
  if (!root) {
    return (
      <div className="rsip-board flex min-h-72 flex-col items-center justify-center p-8 text-center sm:p-10">
        <div className="mb-4 flex h-24 w-[68px] items-center justify-center rounded-xl border-2 border-dashed border-gold/30 bg-gold/5">
          <TreePine size={26} className="text-gold/50" />
        </div>
        {hasTrees ? (
          <>
            <p className="font-serif text-base font-bold text-foreground">
              这棵树还没有根
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              根国策熄灭或尚未挂根。完成一次清洁结算后，从手牌里挑最不可能失败的一条做根。
            </p>
          </>
        ) : (
          <>
            <p className="font-serif text-base font-bold text-foreground">
              牌桌还空着
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              完成新手引导，打出你的第一张根国策。
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rsip-board w-full overflow-x-auto">
      <div className="flex w-max min-w-full justify-center px-4 py-6 sm:px-8 sm:py-8">
        <TreeBranch node={root} isRoot onNodeClick={onNodeClick} />
      </div>
    </div>
  );
};

export default TreeView;
