import React, { useEffect, useMemo, useState } from 'react';
import type {
  RsipDayLevel,
  RsipOverview,
  RsipPolicyType,
  RsipReviewResult,
  RsipTree,
  RsipTreeNode,
  RsipVerdictInput,
} from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { logger } from '@lark-apaas/client-toolkit/logger';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import { extractErrorMessage, submitReview } from '@client/src/api/rsip';
import { cn } from '@client/src/lib/utils';
import MedicalDisclaimer from './MedicalDisclaimer';

type BinaryAnswer = 'yes' | 'no';
type NoRuling = 'violated' | 'legalized';

interface DueNode {
  nodeId: string;
  name: string;
  judge: string;
  trigger: string | null;
  type: RsipPolicyType;
  /** 分类图标 key，空则前端用默认图标（与 iconKey 二选一命中） */
  iconKey: string | null;
  templateId: string | null;
  depth: number;
  treeId: string;
  treeName: string;
  /** 真违反时会一起退回手牌的子孙节点数 */
  descendantCount: number;
  /** 自身 + 子孙当前连续点亮天数之和（真违反时清零；累计进度保留） */
  streakAtStake: number;
}

/** 子树规模：子孙节点数 + 自身与子孙的连续点亮天数之和 */
function measureSubtree(node: RsipTreeNode): {
  descendants: number;
  streak: number;
} {
  let descendants = 0;
  let streak: number = node.progress?.currentStreak ?? 0;
  node.children.forEach((child: RsipTreeNode) => {
    const sub = measureSubtree(child);
    descendants += 1 + sub.descendants;
    streak += sub.streak;
  });
  return { descendants, streak };
}

/** 收集总览里出现过的国策名称，用于把结算结果里的 policyId 显示成名字 */
function collectPolicyNames(overview: RsipOverview): Map<string, string> {
  const names = new Map<string, string>();
  const walk = (node: RsipTreeNode | null): void => {
    if (!node) return;
    names.set(node.policy.id, node.policy.name);
    node.children.forEach(walk);
  };
  overview.trees.forEach((tree: RsipTree) => walk(tree.root));
  overview.hand.forEach((item) => names.set(item.policy.id, item.policy.name));
  overview.precedents.forEach((policy) => names.set(policy.id, policy.name));
  return names;
}

const DAY_LEVELS: { value: RsipDayLevel; label: string }[] = [
  { value: 'small', label: '小赢' },
  { value: 'medium', label: '中赢' },
  { value: 'big', label: '大赢' },
];

interface DueGroup {
  treeId: string;
  treeName: string;
  nodes: DueNode[];
}

interface DailyReviewDialogProps {
  open: boolean;
  /** 总览（跨树结算：应结算节点按树分组） */
  overview: RsipOverview;
  onClose: () => void;
  /** 结算完成后回传结果（含本次触发的里程碑喜报） */
  onDone: (result: RsipReviewResult) => void;
  /** 有回滚时，从结果页直接进入崩塌复盘 */
  onOpenRollbackLog?: () => void;
}

/** 递归收集单棵树上今日应结算的节点：排除已退役与命中冻结的节点 */
function collectDueNodes(
  node: RsipTreeNode | null,
  treeId: string,
  treeName: string,
  depth: number,
  acc: DueNode[],
): void {
  if (!node) return;
  if (!node.policy.isRetired && !node.frozenBy) {
    const stake = measureSubtree(node);
    acc.push({
      descendantCount: stake.descendants,
      streakAtStake: stake.streak,
      nodeId: node.nodeId,
      name: node.policy.name,
      judge: node.policy.judge,
      trigger: node.policy.trigger,
      type: node.policy.type,
      iconKey: node.policy.iconKey,
      templateId: node.policy.templateId,
      depth,
      treeId,
      treeName,
    });
  }
  node.children.forEach((child: RsipTreeNode) =>
    collectDueNodes(child, treeId, treeName, depth + 1, acc),
  );
}

const DailyReviewDialog: React.FC<DailyReviewDialogProps> = ({
  open,
  overview,
  onClose,
  onDone,
  onOpenRollbackLog,
}) => {
  const today = overview.today;
  const settings = overview.settings;

  const [answers, setAnswers] = useState<Record<string, BinaryAnswer>>({});
  const [rulings, setRulings] = useState<Record<string, NoRuling>>({});
  const [result, setResult] = useState<RsipReviewResult | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [dayTitle, setDayTitle] = useState<string>('');
  const [dayLevel, setDayLevel] = useState<RsipDayLevel>('small');

  // 结算提交前的快照：结果页要把 policyId 显示成名字，提交后国策可能已不在树上
  const policyNames = useMemo<Map<string, string>>(
    () => collectPolicyNames(overview),
    [overview],
  );
  const nameOf = (policyId: string): string =>
    policyNames.get(policyId) ?? '未知国策';

  /** 今天发布的喜报标题，作为命名的快捷候选 */
  const todayWinTitles = useMemo<string[]>(
    () =>
      overview.winReports
        .filter((report) => report.createdAt.slice(0, 10) === today.date)
        .map((report) => report.title)
        .slice(0, 4),
    [overview.winReports, today.date],
  );

  const dueNodes = useMemo<DueNode[]>(() => {
    const acc: DueNode[] = [];
    overview.trees.forEach((tree: RsipTree) => {
      collectDueNodes(tree.root, tree.id, tree.name, 0, acc);
    });
    return acc;
  }, [overview.trees]);

  /** 按树分组，用于跨树结算时分区展示 */
  const dueGroups = useMemo<DueGroup[]>(() => {
    const map = new Map<string, DueGroup>();
    dueNodes.forEach((node: DueNode) => {
      const group: DueGroup | undefined = map.get(node.treeId);
      if (group) {
        group.nodes.push(node);
        return;
      }
      map.set(node.treeId, {
        treeId: node.treeId,
        treeName: node.treeName,
        nodes: [node],
      });
    });
    return Array.from(map.values());
  }, [dueNodes]);

  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setRulings({});
    setResult(null);
    setErrorText(null);
    setSubmitting(false);
    setDayTitle('');
    setDayLevel('small');
  }, [open, today.date]);

  const noNodes: DueNode[] = dueNodes.filter(
    (node: DueNode) => answers[node.nodeId] === 'no',
  );
  const unansweredCount: number = dueNodes.filter(
    (node: DueNode) => !answers[node.nodeId],
  ).length;
  const missingRuling: boolean = noNodes.some(
    (node: DueNode) => !rulings[node.nodeId],
  );
  const submitBlocked: boolean =
    (dueNodes.length > 0 && unansweredCount > 0) || missingRuling;

  const handleOpenChange = (next: boolean): void => {
    if (next) return;
    if (result) onDone(result);
    onClose();
  };

  const handleAnswer = (nodeId: string, value: string): void => {
    const nextAnswer: BinaryAnswer = value === 'yes' ? 'yes' : 'no';
    setAnswers((prev: Record<string, BinaryAnswer>) => ({
      ...prev,
      [nodeId]: nextAnswer,
    }));
    if (nextAnswer === 'yes') {
      setRulings((prev: Record<string, NoRuling>) => {
        const next: Record<string, NoRuling> = { ...prev };
        delete next[nodeId];
        return next;
      });
    }
  };

  const handleRuling = (nodeId: string, value: string): void => {
    const nextRuling: NoRuling = value === 'violated' ? 'violated' : 'legalized';
    setRulings((prev: Record<string, NoRuling>) => ({
      ...prev,
      [nodeId]: nextRuling,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    setErrorText(null);
    if (dueNodes.length > 0 && unansweredCount > 0) {
      setErrorText(`还有 ${unansweredCount} 条国策未判定`);
      return;
    }
    if (missingRuling) {
      setErrorText('答「否」的国策需要先选择处理方式');
      return;
    }

    const verdicts: RsipVerdictInput[] = [];
    dueNodes.forEach((node: DueNode) => {
      if (answers[node.nodeId] === 'no') {
        verdicts.push({
          nodeId: node.nodeId,
          verdict: rulings[node.nodeId] === 'violated' ? 'violated' : 'legalized',
        });
        return;
      }
      verdicts.push({ nodeId: node.nodeId, verdict: 'satisfied' });
    });

    setSubmitting(true);
    try {
      const data: RsipReviewResult = await submitReview({
        verdicts,
        late: !today.windowOpen,
        dayTitle: dayTitle.trim() ? dayTitle.trim() : null,
        dayLevel: dayTitle.trim() ? dayLevel : null,
      });
      setResult(data);
    } catch (error) {
      const message: string = extractErrorMessage(error);
      logger.error('提交结算失败', message);
      setErrorText(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderResult = (): React.ReactNode => {
    if (!result) return null;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">结算完成</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {result.date} 的判定已记录{today.reviewLate || !today.windowOpen
              ? '（记作补结算）'
              : ''}
            。
          </p>
        </div>

        {result.hadRollback ? (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">有国策退回手牌</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {result.rolledBackPolicies.map((policyId: string) => (
                <li key={policyId}>· {nameOf(policyId)}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              回滚是路径搜索的一部分。内化进度保留，重挂到树上即可继续累积。
              崩塌也是调试器：记下触发场景，下一轮就知道该拆小、补前置，还是先绕过去。
            </p>
            {onOpenRollbackLog && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  onDone(result);
                  onClose();
                  onOpenRollbackLog();
                }}
              >
                去复盘这次崩塌
              </Button>
            )}
            <MedicalDisclaimer className="mt-3" />
          </div>
        ) : (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">今日没有国策退回手牌</p>
          </div>
        )}

        {result.retiredPolicies.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">已永久合法化</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {result.retiredPolicies.map((policyId: string) => (
                <li key={policyId}>· {nameOf(policyId)}（退役并收进判例库）</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          {result.canAttachToday
            ? '今日新增入口已开放，可以从手牌挑一条挂到树上。'
            : '今日新增入口未开放（需清洁结算，且有国策内化进度超过 3 天）。'}
        </div>
      </div>
    );
  };

  const renderForm = (): React.ReactNode => (
    <>
      {dueNodes.length === 0 && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          今天没有需要结算的国策。仍然可以提交一次空结算，用来记录今天已查看过。
        </div>
      )}

      <div className="space-y-4">
        {dueGroups.map((group: DueGroup) => (
          <div key={group.treeId} className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              {group.treeName}
            </p>
            {group.nodes.map((node: DueNode) => {
          const answer: BinaryAnswer | undefined = answers[node.nodeId];
          const ruling: NoRuling | undefined = rulings[node.nodeId];
          return (
            <div
              key={node.nodeId}
              className={cn(
                'rounded-lg border p-4 transition-all duration-300',
                answer === 'yes'
                  ? 'border-gold/50 bg-gold/5 shadow-[0_0_22px_-10px_var(--gold)]'
                  : answer === 'no'
                    ? 'border-foreground/25 bg-muted/40'
                    : 'border-border bg-card/50',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <PolicyIcon
                  policy={{ iconKey: node.iconKey, templateId: node.templateId }}
                  size={32}
                />
                <span className="text-sm font-medium text-foreground">
                  {node.name}
                </span>
                <PolicyTypeBadge type={node.type} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                判定标准：{node.judge}
              </p>
              {node.trigger && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  触发条件：{node.trigger}
                </p>
              )}

              <RadioGroup
                className="mt-3 flex flex-wrap gap-2"
                aria-label={`今日 ${node.name} 判定`}
                value={answer ?? ''}
                onValueChange={(value: string) =>
                  handleAnswer(node.nodeId, value)
                }
              >
                <div className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-1.5 transition-colors has-[[data-state=checked]]:border-gold/60 has-[[data-state=checked]]:bg-gold/15">
                  <RadioGroupItem
                    value="yes"
                    id={`review-yes-${node.nodeId}`}
                  />
                  <Label
                    htmlFor={`review-yes-${node.nodeId}`}
                    className="text-sm text-foreground/85"
                  >
                    是
                  </Label>
                </div>
                <div className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-1.5 transition-colors has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-foreground/10">
                  <RadioGroupItem value="no" id={`review-no-${node.nodeId}`} />
                  <Label
                    htmlFor={`review-no-${node.nodeId}`}
                    className="text-sm text-foreground/85"
                  >
                    否
                  </Label>
                </div>
              </RadioGroup>

              {answer === 'no' && (
                <div className="mt-3 rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-foreground/70">
                    这条国策今天不成立，接下来怎么处理？
                  </p>
                  <RadioGroup
                    className="mt-2 gap-2"
                    aria-label={`${node.name} 处理方式`}
                    value={ruling ?? ''}
                    onValueChange={(value: string) =>
                      handleRuling(node.nodeId, value)
                    }
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        value="violated"
                        id={`review-violated-${node.nodeId}`}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`review-violated-${node.nodeId}`}
                        className="text-xs leading-relaxed text-foreground/85"
                      >
                        真违反了（这条国策与它的子国策退回手牌，内化进度保留）
                      </Label>
                    </div>
                    {ruling === 'violated' && (
                      <p className="ml-6 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {node.descendantCount > 0
                          ? `会连带 ${node.descendantCount} 条子国策一起退回手牌；`
                          : '只有这一条退回手牌；'}
                        合计 {node.streakAtStake} 天连续点亮清零，累计天数保留。
                      </p>
                    )}
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        value="legalized"
                        id={`review-legalized-${node.nodeId}`}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`review-legalized-${node.nodeId}`}
                        className="text-xs leading-relaxed text-foreground/85"
                      >
                        永久合法化（退役进判例库，不影响子国策）
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
          );
            })}
          </div>
        ))}
      </div>

      <section
        aria-label="今日命名"
        className="space-y-2.5 rounded-lg border border-gold/25 bg-gold/5 p-4"
      >
        <div>
          <p className="font-serif text-sm font-bold text-gold-soft">
            赢麻了 · 给今天命名（可选）
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            用今天最大的一件好事命名，再定个级。之后可以在喜报里翻看。
          </p>
        </div>
        <Input
          value={dayTitle}
          maxLength={40}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setDayTitle(event.target.value)
          }
          placeholder="例如：搞定高数第三章胜利日"
          aria-label="今日命名"
        />
        {todayWinTitles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {todayWinTitles.map((title: string) => (
              <button
                key={title}
                type="button"
                onClick={() => setDayTitle(`${title}日`)}
                className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-foreground/75 transition-colors hover:border-gold/50 hover:text-gold-soft"
              >
                {title}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5" role="radiogroup" aria-label="今日定级">
          {DAY_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={dayLevel === level.value}
              disabled={!dayTitle.trim()}
              onClick={() => setDayLevel(level.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40',
                dayLevel === level.value
                  ? 'border-gold/60 bg-gold/15 text-gold-soft'
                  : 'border-border text-foreground/70 hover:border-foreground/30',
              )}
            >
              {level.label}
            </button>
          ))}
        </div>
      </section>

      {errorText && (
        <p className="text-xs leading-relaxed text-foreground/70">{errorText}</p>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || submitBlocked}>
          {submitting ? '提交中…' : '提交结算'}
        </Button>
      </DialogFooter>
    </>
  );

  const renderCompleted = (): React.ReactNode => (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">今日结算已完成</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {today.date} 的判定已记录{today.reviewLate ? '（补结算）' : ''}。
          明天结算窗口开启后再来。
        </p>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {today.hadRollbackToday
          ? '今日有国策退回手牌。回滚是路径搜索的一部分，明天照常结算即可。'
          : '今日没有国策退回手牌。'}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">每日结算</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {today.date} · 逐条回答今天的国策是否成立。答「否」时再说明是真违反，
            还是这条国策本来就该永久合法化。
          </DialogDescription>
        </DialogHeader>

        {!today.windowOpen && !result && (
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            当前不在结算窗口（{settings.reviewWindowStart}-
            {settings.reviewWindowEnd}），本次结算会记录为补结算。
          </div>
        )}

        {result
          ? renderResult()
          : today.reviewCompleted
            ? renderCompleted()
            : renderForm()}

        {result && (
          <DialogFooter>
            <Button
              onClick={() => {
                onDone(result);
                onClose();
              }}
            >
              完成
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DailyReviewDialog;
