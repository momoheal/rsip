import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Armchair,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  History,
  Layers,
  PartyPopper,
  Plus,
  Settings,
  Snowflake,
  Sprout,
  TreePine,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { useRsipOverview } from '@client/src/hooks/useRsipOverview';
import type {
  RsipDayLevel,
  RsipFreezeRecord,
  RsipNamedDay,
  RsipPolicy,
  RsipReviewResult,
  RsipTree,
  RsipTreeNode,
  RsipWinReport,
} from '@shared/api.interface';
import { archiveTree, safeApiCall } from '@client/src/api/rsip';
import OnboardingWizard from './components/OnboardingWizard';
import TreeView from './components/TreeView';
import TreeSwitcher from './components/TreeSwitcher';
import TreeCreateDialog from './components/TreeCreateDialog';
import TreeEditDialog from './components/TreeEditDialog';
import HandView from './components/HandView';
import NodeDetailDialog from './components/NodeDetailDialog';
import RollbackLogDialog from './components/RollbackLogDialog';
import DailyReviewDialog from './components/DailyReviewDialog';
import AttachFlowDialog from './components/AttachFlowDialog';
import FreezeReleaseDialog from './components/FreezeReleaseDialog';
import PolicyEditorDialog from './components/PolicyEditorDialog';
import TemplateLibraryDialog from './components/TemplateLibraryDialog';
import FreezeDialog from './components/FreezeDialog';
import SettingsDialog from './components/SettingsDialog';
import StatusBanner from './components/StatusBanner';
import GroupManagerDialog from './components/GroupManagerDialog';
import WinReportListDialog from './components/WinReportListDialog';
import WinReportCelebrateDialog from './components/WinReportCelebrateDialog';
import StatGem from '@client/src/components/rsip/StatGem';
import { RARITY_TIERS } from '@client/src/components/rsip/rarity';
import { cn } from '@client/src/lib/utils';

const DAY_LEVEL_LABEL: Record<RsipDayLevel, string> = {
  small: '小赢',
  medium: '中赢',
  big: '大赢',
};

const RULES: string[] = [
  '每棵树一个根，树可重命名、可归档',
  '每天最多挂 1 条新国策（跨树共用）',
  '判定只有「是 / 否」两个答案',
  '崩塌时内化进度保留，只回手牌',
  '状态不稳时可以冻结，存人失地',
];

/** 从首次使用日到今天是第几天（含首日）；未开局返回 null */
function daysSince(firstUseDate: string | null, today: string): number | null {
  if (!firstUseDate) return null;
  const start: number = Date.parse(`${firstUseDate}T00:00:00`);
  const end: number = Date.parse(`${today}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(Math.round((end - start) / 86400000) + 1, 1);
}

interface ToolbarButtonProps {
  label?: string;
  icon: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  /** 传入则渲染为路由链接 */
  to?: string;
}

const TOOLBAR_BUTTON_CLASS =
  'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/8 hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  label,
  icon,
  ariaLabel,
  onClick,
  to,
}) => {
  const content = (
    <>
      {icon}
      {label && <span className="hidden lg:inline">{label}</span>}
    </>
  );
  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} title={label} className={TOOLBAR_BUTTON_CLASS}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={label ?? ariaLabel}
      className={TOOLBAR_BUTTON_CLASS}
    >
      {content}
    </button>
  );
};

interface ResourceTileProps {
  label: string;
  value: number;
  tone: 'streak' | 'total' | 'empty';
  caption: string;
}

/** 回合资源格：宝石 + 名称 + 状态 */
const ResourceTile: React.FC<ResourceTileProps> = ({
  label,
  value,
  tone,
  caption,
}) => (
  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background/40 p-2.5">
    <StatGem value={value} tone={tone} size={34} label={`${label} ${value}`} />
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-xs font-semibold',
          tone === 'empty' ? 'text-foreground/60' : 'text-foreground',
        )}
      >
        {caption}
      </p>
    </div>
  </div>
);

interface BottomCalloutProps {
  text: string;
  actionLabel: string;
  onAction: () => void;
}

/** 底部引导条 */
const BottomCallout: React.FC<BottomCalloutProps> = ({
  text,
  actionLabel,
  onAction,
}) => (
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/25 bg-background/90 p-4 backdrop-blur-md">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-2">
      <p className="text-sm text-foreground/85">{text}</p>
      <button
        type="button"
        className="rsip-endturn min-h-9 px-5 text-sm"
        data-ready="true"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  </div>
);

/** 在全部树里按 nodeId 查找节点（详情弹窗随总览刷新） */
function findTreeNode(trees: RsipTree[], nodeId: string | null): RsipTreeNode | null {
  if (!nodeId) return null;
  const walk = (node: RsipTreeNode | null): RsipTreeNode | null => {
    if (!node) return null;
    if (node.nodeId === nodeId) return node;
    for (const child of node.children) {
      const found: RsipTreeNode | null = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const tree of trees) {
    const found: RsipTreeNode | null = walk(tree.root);
    if (found) return found;
  }
  return null;
}

const RsipPage: React.FC = () => {
  const { overview, loading, error, refresh } = useRsipOverview();
  const [view, setView] = useState<'tree' | 'hand'>('tree');
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [reviewOpen, setReviewOpen] = useState<boolean>(false);
  const [attachOpen, setAttachOpen] = useState<boolean>(false);
  const [freezeOpen, setFreezeOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [templateOpen, setTemplateOpen] = useState<boolean>(false);
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [rollbackLogOpen, setRollbackLogOpen] = useState<boolean>(false);
  const [treeCreateOpen, setTreeCreateOpen] = useState<boolean>(false);
  const [treeEditOpen, setTreeEditOpen] = useState<boolean>(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState<boolean>(false);
  const [winReportOpen, setWinReportOpen] = useState<boolean>(false);
  const [celebrateOpen, setCelebrateOpen] = useState<boolean>(false);
  const [releaseOpen, setReleaseOpen] = useState<boolean>(false);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<RsipPolicy | null>(null);
  const [editingTree, setEditingTree] = useState<RsipTree | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RsipTree | null>(null);
  const [archiving, setArchiving] = useState<boolean>(false);
  const [celebrateReports, setCelebrateReports] = useState<RsipWinReport[]>([]);

  const detailNode = useMemo<RsipTreeNode | null>(
    () => findTreeNode(overview?.trees ?? [], detailNodeId),
    [overview, detailNodeId],
  );

  const pendingReleaseFreeze = useMemo<RsipFreezeRecord | null>(() => {
    if (!overview) return null;
    return (
      overview.freezes.find(
        (record: RsipFreezeRecord) => !record.released && record.needsRelease,
      ) ?? null
    );
  }, [overview]);

  /** 选中的树；树失效时回退到第一棵 */
  const selectedTree = useMemo<RsipTree | null>(() => {
    const trees: RsipTree[] = overview?.trees ?? [];
    if (trees.length === 0) return null;
    const found: RsipTree | undefined = trees.find(
      (tree: RsipTree) => tree.id === selectedTreeId,
    );
    return found ?? trees[0];
  }, [overview, selectedTreeId]);

  const handleRefresh = async (): Promise<void> => {
    await refresh();
  };
  const openEditor = (policy: RsipPolicy): void => {
    setEditingPolicy(policy);
    setEditorOpen(true);
  };

  const openTreeEditor = (tree: RsipTree): void => {
    setEditingTree(tree);
    setTreeEditOpen(true);
  };

  const handleReviewDone = (result: RsipReviewResult): void => {
    // 里程碑喜报由同一次结算事务写入，随结果返回后直接弹庆祝
    if (result.newWinReports.length > 0) {
      setCelebrateReports(result.newWinReports);
      setCelebrateOpen(true);
    }
    void handleRefresh();
  };

  const confirmArchive = async (): Promise<void> => {
    if (!archiveTarget) return;
    setArchiving(true);
    const result = await safeApiCall(() => archiveTree(archiveTarget.id));
    setArchiving(false);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success('树已归档');
    setArchiveTarget(null);
    await handleRefresh();
  };

  if (loading) {
    return (
      <div className="rsip-table min-h-screen">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i: number) => (
              <Skeleton key={i} className="h-60 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rsip-table flex min-h-screen flex-col items-center justify-center px-4">
        <p className="text-sm text-foreground/85">{error ?? '暂无数据'}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void handleRefresh()}
        >
          重试
        </Button>
      </div>
    );
  }

  const { settings, today, trees, hand, precedents, groups, rollbacks } =
    overview;
  const needsOnboarding = !settings.onboarded;

  const reviewButtonLabel = today.reviewCompleted ? '查看结算' : '开始结算';
  const namedDays: RsipNamedDay[] = overview.namedDays ?? [];
  const collapseCountByPolicy = new Map<string, number>();
  rollbacks.forEach((event) => {
    collapseCountByPolicy.set(
      event.triggerPolicyId,
      (collapseCountByPolicy.get(event.triggerPolicyId) ?? 0) + 1,
    );
  });
  const dayNumber: number | null = daysSince(overview.firstUseDate, today.date);

  return (
    <div className="rsip-table min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="rsip-gem hidden sm:inline-flex"
              data-tone="streak"
              style={{ '--gem-size': '40px' } as React.CSSProperties}
              aria-hidden="true"
            >
              <TreePine size={18} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg font-black tracking-wide text-foreground sm:text-xl">
                RSIP
                <span className="hidden sm:inline">
                  <span className="mx-1.5 text-gold/70">·</span>
                  自控力操作系统
                </span>
              </h1>
              <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">
                小国策 · 每天只加一个 · 崩塌是路径搜索的一部分
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-border bg-card/70 p-0.5">
              <ToolbarButton
                label="专注"
                icon={<Armchair size={15} />}
                to="/focus"
                ariaLabel="打开 CTDP 专注"
              />
              <ToolbarButton
                label="喜报"
                icon={<PartyPopper size={15} />}
                onClick={() => setWinReportOpen(true)}
                ariaLabel="打开喜报"
              />
              <ToolbarButton
                label="仪表盘"
                icon={<BarChart3 size={15} />}
                to="/dashboard"
                ariaLabel="打开仪表盘"
              />
              <ToolbarButton
                label="模板库"
                icon={<BookOpen size={15} />}
                onClick={() => setTemplateOpen(true)}
                ariaLabel="打开模板库"
              />
              <ToolbarButton
                label="冻结"
                icon={<Snowflake size={15} />}
                onClick={() => setFreezeOpen(true)}
                ariaLabel="发起冻结"
              />
              <ToolbarButton
                icon={<Settings size={15} />}
                onClick={() => setSettingsOpen(true)}
                ariaLabel="打开设置"
              />
            </div>
            <button
              type="button"
              className="rsip-endturn flex min-h-9 items-center gap-1.5 px-3 text-sm sm:px-5"
              data-ready={today.windowOpen && !today.reviewCompleted}
              data-done={today.reviewCompleted}
              onClick={() => setReviewOpen(true)}
              aria-label={reviewButtonLabel}
            >
              <ClipboardCheck size={16} />
              <span className="hidden sm:inline">{reviewButtonLabel}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-4">
            <StatusBanner
              overview={overview}
              onOpenReview={() => setReviewOpen(true)}
              onOpenRelease={() => setReleaseOpen(true)}
              onOpenFreeze={() => setFreezeOpen(true)}
              onOpenAttach={() => setAttachOpen(true)}
            />

            <div className="rsip-seg flex gap-1">
              <button
                type="button"
                onClick={() => setView('tree')}
                aria-pressed={view === 'tree'}
                className="rsip-seg-btn flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-foreground/70 transition-all hover:text-foreground aria-pressed:text-primary-foreground"
              >
                <TreePine size={15} />
                国策树
              </button>
              <button
                type="button"
                onClick={() => setView('hand')}
                aria-pressed={view === 'hand'}
                className="rsip-seg-btn flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-foreground/70 transition-all hover:text-foreground aria-pressed:text-primary-foreground"
              >
                <Layers size={15} />
                手牌
                {hand.length > 0 && (
                  <span className="rounded-full bg-black/20 px-1.5 font-display text-[11px] tabular-nums">
                    {hand.length}
                  </span>
                )}
              </button>
            </div>

            {view === 'tree' ? (
              <div className="space-y-3">
                {/* 多棵树：切换 / 重命名 / 归档，树视图只渲染选中树的根 */}
                <TreeSwitcher
                  trees={trees}
                  selectedTreeId={selectedTree?.id ?? null}
                  onSelect={(treeId: string) => setSelectedTreeId(treeId)}
                  onCreateTree={() => setTreeCreateOpen(true)}
                  onEditTree={openTreeEditor}
                  onArchiveTree={(tree: RsipTree) => setArchiveTarget(tree)}
                />
                <TreeView
                  root={selectedTree?.root ?? null}
                  hasTrees={trees.length > 0}
                  onNodeClick={(node: RsipTreeNode) => setDetailNodeId(node.nodeId)}
                />
              </div>
            ) : (
              <HandView
                hand={hand}
                precedents={precedents}
                onEditPolicy={openEditor}
                groups={groups}
                onManageGroups={() => setGroupManagerOpen(true)}
                collapseCountByPolicy={collapseCountByPolicy}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-card/60"
                onClick={() => {
                  setEditingPolicy(null);
                  setEditorOpen(true);
                }}
                aria-label="新建国策"
              >
                <Plus size={15} />
                新建国策
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-card/60"
                onClick={() => setAttachOpen(true)}
                aria-label="挂载国策"
              >
                <Sprout size={15} />
                挂载国策
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-card/60"
                onClick={() => setRollbackLogOpen(true)}
                aria-label="查看崩塌日志"
              >
                <History size={15} />
                崩塌日志{rollbacks.length > 0 ? ` · ${rollbacks.length}` : ''}
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <section
              className="rsip-panel rsip-panel-gilt p-4"
              aria-label="今日状态"
            >
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] tracking-[0.25em] text-gold-soft/80">
                    今日回合
                  </p>
                  <p className="mt-1 font-serif text-2xl font-black text-foreground">
                    {dayNumber !== null ? `第 ${dayNumber} 天` : '尚未开局'}
                  </p>
                </div>
                <p className="pb-1 text-xs tabular-nums text-muted-foreground">
                  {today.date}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ResourceTile
                  label="应结算"
                  value={today.dueCount}
                  tone={today.dueCount > 0 ? 'streak' : 'empty'}
                  caption={today.reviewCompleted ? '已完成' : '未完成'}
                />
                <ResourceTile
                  label="新增名额"
                  value={today.canAttachToday ? 1 : 0}
                  tone={today.canAttachToday ? 'total' : 'empty'}
                  caption={today.canAttachToday ? '可用' : '未开放'}
                />
              </div>

              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-foreground/70">
                <div className="flex items-center justify-between">
                  <dt>结算窗口</dt>
                  <dd className="flex items-center gap-1.5 tabular-nums text-foreground">
                    {today.windowOpen && (
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold"
                        title="窗口已开启"
                      />
                    )}
                    {settings.reviewWindowStart} - {settings.reviewWindowEnd}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>国策树</dt>
                  <dd className="tabular-nums text-foreground">
                    {trees.length} 棵
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>手牌</dt>
                  <dd className="tabular-nums text-foreground">
                    {hand.length} 张
                  </dd>
                </div>
              </dl>
            </section>

            {namedDays.length > 0 && (
              <section className="rsip-panel p-4" aria-label="命名日">
                <h2 className="rsip-ornament font-serif text-xs font-bold tracking-[0.2em] text-gold-soft/90">
                  赢麻了 · 命名日
                </h2>
                <ul className="mt-3 space-y-2">
                  {namedDays.slice(0, 5).map((day: RsipNamedDay) => (
                    <li key={day.date} className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {day.date.slice(5)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground/85">
                        {day.title}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px]',
                          day.level === 'big'
                            ? 'bg-gold/25 text-gold-soft'
                            : day.level === 'medium'
                              ? 'bg-gold/12 text-gold-soft/85'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {DAY_LEVEL_LABEL[day.level]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rsip-panel p-4" aria-label="规则速览">
              <h2 className="rsip-ornament font-serif text-xs font-bold tracking-[0.2em] text-gold-soft/90">
                规则速览
              </h2>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-foreground/70">
                {RULES.map((rule: string) => (
                  <li key={rule} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-gold/70" />
                    {rule}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rsip-panel p-4" aria-label="卡牌稀有度">
              <h2 className="rsip-ornament font-serif text-xs font-bold tracking-[0.2em] text-gold-soft/90">
                稀有度 · 累计点亮天数
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {RARITY_TIERS.map((tier) => (
                  <li
                    key={tier.key}
                    data-rarity={tier.key}
                    className="flex items-center gap-2"
                  >
                    <span className="h-3.5 w-2.5 rounded-[3px] border border-[var(--rar)] bg-[var(--rar-soft)] shadow-[0_0_8px_var(--rar-glow)]" />
                    <span className="rsip-rar-text font-semibold">
                      {tier.label}
                    </span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {tier.min === 0 ? '0' : `${tier.min}+`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>

      {needsOnboarding && !wizardOpen && (
        <BottomCallout
          text="还没有国策树。完成新手引导，挂上你的第一条根国策。"
          actionLabel="开始引导"
          onAction={() => setWizardOpen(true)}
        />
      )}

      {!needsOnboarding && trees.length === 0 && !wizardOpen && (
        <BottomCallout
          text="当前没有国策树。从手牌里挑一条最不可能失败的国策做根。"
          actionLabel="创建你的第一棵国策树"
          onAction={() => setTreeCreateOpen(true)}
        />
      )}

      <OnboardingWizard
        open={wizardOpen}
        onComplete={() => {
          setWizardOpen(false);
          void handleRefresh();
        }}
      />

      <DailyReviewDialog
        open={reviewOpen}
        overview={overview}
        onClose={() => setReviewOpen(false)}
        onDone={handleReviewDone}
        onOpenRollbackLog={() => setRollbackLogOpen(true)}
      />

      <AttachFlowDialog
        open={attachOpen}
        overview={overview}
        onClose={() => setAttachOpen(false)}
        onDone={() => void handleRefresh()}
      />

      <FreezeReleaseDialog
        open={releaseOpen}
        overview={overview}
        freeze={pendingReleaseFreeze}
        onClose={() => setReleaseOpen(false)}
        onDone={() => void handleRefresh()}
      />

      <FreezeDialog
        open={freezeOpen}
        overview={overview}
        defaultTreeId={selectedTree?.id ?? null}
        onClose={() => setFreezeOpen(false)}
        onDone={() => void handleRefresh()}
      />

      <PolicyEditorDialog
        open={editorOpen}
        initial={editingPolicy}
        groups={groups}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void handleRefresh()}
      />

      <TemplateLibraryDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onAdded={() => void handleRefresh()}
        onOpenFreeze={() => setFreezeOpen(true)}
        onOpenWinReport={() => setWinReportOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => void handleRefresh()}
      />

      <NodeDetailDialog
        node={detailNode}
        groups={groups}
        onGroupChanged={() => void handleRefresh()}
        onUpgraded={() => void handleRefresh()}
        onEditPolicy={(policy: RsipPolicy) => {
          setDetailNodeId(null);
          openEditor(policy);
        }}
        onClose={() => setDetailNodeId(null)}
        onOpenRollbackLog={() => setRollbackLogOpen(true)}
      />

      <RollbackLogDialog
        open={rollbackLogOpen}
        rollbacks={rollbacks}
        onClose={() => setRollbackLogOpen(false)}
        onChanged={() => void handleRefresh()}
      />

      <TreeCreateDialog
        open={treeCreateOpen}
        hand={hand}
        canAttachToday={today.canAttachToday}
        onClose={() => setTreeCreateOpen(false)}
        onDone={() => void handleRefresh()}
      />

      <TreeEditDialog
        open={treeEditOpen}
        tree={editingTree}
        onClose={() => setTreeEditOpen(false)}
        onDone={() => void handleRefresh()}
      />

      <GroupManagerDialog
        open={groupManagerOpen}
        groups={groups}
        onClose={() => setGroupManagerOpen(false)}
        onChanged={() => void handleRefresh()}
      />

      <WinReportListDialog
        open={winReportOpen}
        winReports={overview.winReports}
        onClose={() => setWinReportOpen(false)}
        onCreated={() => void handleRefresh()}
      />

      <WinReportCelebrateDialog
        open={celebrateOpen}
        reports={celebrateReports}
        onClose={() => setCelebrateOpen(false)}
      />

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(next: boolean) => {
          if (!next && !archiving) setArchiveTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              归档这棵树
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {archiveTarget?.name ?? ''}：树上国策将退回手牌，内化进度保留。
              归档后可在仪表盘查看。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={archiving}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void confirmArchive()}
              disabled={archiving}
            >
              {archiving ? '归档中…' : '归档'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RsipPage;
