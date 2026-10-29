import React, { useEffect, useState } from 'react';
import { ChevronsUp, History, Pencil, Snowflake } from 'lucide-react';
import { toast } from 'sonner';
import type { RsipPolicy, RsipPolicyGroup, RsipTreeNode } from '@shared/api.interface';
import { assignPolicyGroup, safeApiCall, upgradePolicy } from '@client/src/api/rsip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { ScrollArea } from '@client/src/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import ProgressTrack from '@client/src/components/rsip/ProgressTrack';
import { getRarity } from '@client/src/components/rsip/rarity';
import LevelBadge from '@client/src/components/rsip/LevelBadge';
import { getUpgradeState } from '@client/src/components/rsip/upgrade';

const GROUP_NONE = 'none';

function countDescendants(node: RsipTreeNode): number {
  let total: number = 0;
  for (const child of node.children) {
    total += 1 + countDescendants(child);
  }
  return total;
}

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, children }) => (
  <div className="border-t border-border/60 py-2.5 first:border-t-0 first:pt-0">
    <dt className="text-xs text-muted-foreground/75">{label}</dt>
    <dd className="mt-0.5 break-words text-sm leading-relaxed text-foreground/85">
      {children}
    </dd>
  </div>
);

interface NodeDetailDialogProps {
  node: RsipTreeNode | null;
  onClose: () => void;
  onOpenRollbackLog?: () => void;
  /** 国策组列表，用于树上国策调整分组 */
  groups?: RsipPolicyGroup[];
  /** 分组调整成功后刷新总览 */
  onGroupChanged?: () => void;
  /** 编辑国策（含强化规则） */
  onEditPolicy?: (policy: RsipPolicy) => void;
  /** 升级成功后刷新总览 */
  onUpgraded?: () => void;
}

const NodeDetailDialog: React.FC<NodeDetailDialogProps> = ({
  node,
  onClose,
  onOpenRollbackLog,
  groups,
  onGroupChanged,
  onEditPolicy,
  onUpgraded,
}) => {
  const [groupValue, setGroupValue] = useState<string>(GROUP_NONE);
  const [assigning, setAssigning] = useState<boolean>(false);
  const [confirmingUpgrade, setConfirmingUpgrade] = useState<boolean>(false);
  const [upgrading, setUpgrading] = useState<boolean>(false);

  const nodeId: string | null = node ? node.nodeId : null;
  const policyGroupId: string | null = node ? node.policy.groupId : null;

  useEffect(() => {
    setGroupValue(policyGroupId ?? GROUP_NONE);
    setAssigning(false);
  }, [nodeId, policyGroupId]);

  useEffect(() => {
    setConfirmingUpgrade(false);
    setUpgrading(false);
  }, [nodeId]);

  if (!node) {
    return null;
  }

  const { policy, progress, frozenBy, pendingRelease } = node;
  const descendantCount: number = countDescendants(node);
  const upgrade = getUpgradeState(policy, progress);
  const groupOptions: RsipPolicyGroup[] = groups ?? [];
  const currentGroupName: string = policyGroupId
    ? (groupOptions.find((group: RsipPolicyGroup) => group.id === policyGroupId)
        ?.name ?? '未分组')
    : '未分组';

  const handleGroupChange = async (value: string): Promise<void> => {
    const nextGroupId: string | null = value === GROUP_NONE ? null : value;
    setGroupValue(value);
    setAssigning(true);
    const result = await safeApiCall(() =>
      assignPolicyGroup(policy.id, { groupId: nextGroupId }),
    );
    setAssigning(false);
    if ('message' in result) {
      toast.error(result.message);
      setGroupValue(policyGroupId ?? GROUP_NONE);
      return;
    }
    toast.success('分组已调整');
    onGroupChanged?.();
  };

  const handleUpgrade = async (): Promise<void> => {
    setUpgrading(true);
    const result = await safeApiCall(() => upgradePolicy(policy.id));
    setUpgrading(false);
    setConfirmingUpgrade(false);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success(`已升到 +${result.data.level ?? 0}，之后的结算按新门槛判定`);
    onUpgraded?.();
  };

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 pr-6 text-base">
            <PolicyIcon policy={policy} size={44} />
            <span className="truncate">{policy.name}</span>
          </DialogTitle>
          <DialogDescription>
            {node.parentNodeId === null ? '根节点 · 当前国策树的起点' : '树上节点'}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-1.5">
            <PolicyTypeBadge type={policy.type} />
            <LevelBadge policy={policy} />
            <span
              data-rarity={getRarity(progress?.cumulativeLitDays ?? 0).key}
              className="rsip-rar-text inline-flex items-center rounded-md border border-[var(--rar)]/40 bg-[var(--rar-soft)] px-1.5 py-0.5 text-[11px] font-semibold"
            >
              {getRarity(progress?.cumulativeLitDays ?? 0).label}
            </span>
            {policy.isRetired && (
              <Badge
                variant="outline"
                className="px-1.5 text-[11px] font-normal text-muted-foreground"
              >
                已退役 · 永久合法化
              </Badge>
            )}
            {pendingRelease && (
              <Badge
                variant="outline"
                className="px-1.5 text-[11px] font-normal text-muted-foreground"
              >
                待解冻重判
              </Badge>
            )}
            {frozenBy && (
              <Badge
                variant="outline"
                className="gap-1 px-1.5 text-[11px] font-normal text-muted-foreground"
              >
                <Snowflake size={11} />
                已冻结 至 {frozenBy.endDate}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <dl className="text-sm">
            <DetailRow label="判定标准">{policy.judge}</DetailRow>
            <DetailRow label="触发条件">
              {policy.trigger ?? '无（常驻生效）'}
            </DetailRow>
            <DetailRow label="强化等级">
              {upgrade ? (
                <div className="space-y-1.5">
                  <p>
                    <span className="font-display font-bold tabular-nums text-gold-soft">
                      +{upgrade.level}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      每升一级：{upgrade.stepText ?? '未填写'}
                    </span>
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {upgrade.level === 0
                      ? '当前门槛：判定标准里的基础门槛。'
                      : `当前门槛：基础门槛平移 ${upgrade.level} 档（${upgrade.stepText ?? '每档平移'} × ${upgrade.level}）。`}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    本级已连续点亮 {Math.min(upgrade.daysAtLevel, upgrade.needed)} /{' '}
                    {upgrade.needed} 天
                    {upgrade.ready
                      ? '，可以升级。'
                      : `，再连续点亮 ${upgrade.needed - upgrade.daysAtLevel} 天可升级。`}
                  </p>
                  {upgrade.ready && !confirmingUpgrade && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-gold/50 text-gold-soft hover:bg-gold/10"
                      onClick={() => setConfirmingUpgrade(true)}
                    >
                      <ChevronsUp />
                      升级到 +{upgrade.level + 1}
                    </Button>
                  )}
                  {confirmingUpgrade && (
                    <div className="space-y-2 rounded-md border border-gold/30 bg-gold/5 p-2.5">
                      <p className="text-xs leading-relaxed text-foreground/85">
                        升到 +{upgrade.level + 1} 后，判定门槛再平移一档（{upgrade.stepText}），
                        本级天数从 0 重新计。没做到时可以在结算里选「降回 +0」，
                        节点和子国策都留在树上。
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={upgrading}
                          onClick={() => void handleUpgrade()}
                        >
                          {upgrading ? '升级中…' : '确认升级'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={upgrading}
                          onClick={() => setConfirmingUpgrade(false)}
                        >
                          先不升
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  未设置强化规则（可在编辑国策里开启）
                </span>
              )}
            </DetailRow>
            <DetailRow label="所属组">{currentGroupName}</DetailRow>
            {groupOptions.length > 0 && (
              <DetailRow label="调整分组">
                <div className="flex items-center gap-2">
                  <Select
                    value={groupValue}
                    disabled={assigning}
                    onValueChange={(value: string) => {
                      void handleGroupChange(value);
                    }}
                  >
                    <SelectTrigger
                      className="w-full max-w-56"
                      aria-label={`调整所属分组 ${policy.name}`}
                    >
                      <SelectValue placeholder="不分组" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GROUP_NONE}>不分组</SelectItem>
                      {groupOptions.map((group: RsipPolicyGroup) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assigning && (
                    <span className="shrink-0 text-xs text-muted-foreground/75">
                      保存中…
                    </span>
                  )}
                </div>
              </DetailRow>
            )}
            <DetailRow label="挂树日期">
              <span className="tabular-nums">{node.attachedOn}</span>
            </DetailRow>
            <DetailRow label="内化进度">
              {progress ? (
                <div>
                  <ProgressTrack
                    cumulative={progress.cumulativeLitDays}
                    streak={progress.currentStreak}
                  />
                  <p className="mt-1 text-xs text-muted-foreground/75">
                    最近点亮：
                    <span className="tabular-nums">
                      {progress.lastLitDate ?? '—'}
                    </span>
                  </p>
                </div>
              ) : (
                <span className="text-muted-foreground">未点亮过</span>
              )}
            </DetailRow>
            <DetailRow label="冻结状态">
              {frozenBy
                ? `已冻结，至 ${frozenBy.endDate} 解冻重判`
                : '未冻结'}
            </DetailRow>
            <DetailRow label="子节点">
              <span className="tabular-nums">{node.children.length} 个直接子节点</span>
              <span className="ml-2 text-xs text-muted-foreground/75 tabular-nums">
                含后代共 {descendantCount} 个
              </span>
            </DetailRow>
          </dl>
        </ScrollArea>

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="查看崩塌日志"
            onClick={() => onOpenRollbackLog?.()}
          >
            <History />
            查看崩塌日志
          </Button>
          {onEditPolicy && (
            <Button
              variant="outline"
              size="sm"
              aria-label={`编辑国策 ${policy.name}`}
              onClick={() => onEditPolicy(policy)}
            >
              <Pencil />
              编辑国策
            </Button>
          )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="关闭国策详情"
            onClick={onClose}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NodeDetailDialog;
