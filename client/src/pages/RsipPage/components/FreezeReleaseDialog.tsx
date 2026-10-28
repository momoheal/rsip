import React, { useEffect, useMemo, useState } from 'react';
import type {
  RsipFreezeRecord,
  RsipFreezeReleaseInput,
  RsipFreezeReleaseResult,
  RsipOverview,
  RsipPolicyType,
  RsipTree,
  RsipTreeNode,
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
import { Label } from '@client/src/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { extractErrorMessage, releaseFreeze } from '@client/src/api/rsip';
import MedicalDisclaimer from './MedicalDisclaimer';

type ReleaseVerdict = 'satisfied' | 'violated';

interface ScopeNode {
  nodeId: string;
  name: string;
  judge: string;
  type: RsipPolicyType;
  depth: number;
}

interface FreezeReleaseDialogProps {
  open: boolean;
  overview: RsipOverview;
  freeze: RsipFreezeRecord | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * 收集冻结范围内的待重判节点。
 * 整树冻结取全部节点；指定子树时，命中节点及其后代都在范围内。
 */
function collectScopeNodes(
  node: RsipTreeNode | null,
  depth: number,
  ancestorInScope: boolean,
  scopeIds: Set<string>,
  wholeTree: boolean,
  acc: ScopeNode[],
): void {
  if (!node) return;
  const inScope: boolean =
    ancestorInScope || wholeTree || scopeIds.has(node.nodeId);
  if (inScope && !node.policy.isRetired) {
    acc.push({
      nodeId: node.nodeId,
      name: node.policy.name,
      judge: node.policy.judge,
      type: node.policy.type,
      depth,
    });
  }
  node.children.forEach((child: RsipTreeNode) =>
    collectScopeNodes(child, depth + 1, inScope, scopeIds, wholeTree, acc),
  );
}

const FreezeReleaseDialog: React.FC<FreezeReleaseDialogProps> = ({
  open,
  overview,
  freeze,
  onClose,
  onDone,
}) => {
  const [answers, setAnswers] = useState<Record<string, ReleaseVerdict>>({});
  const [result, setResult] = useState<RsipFreezeReleaseResult | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const scopeNodes = useMemo<ScopeNode[]>(() => {
    if (!freeze) return [];
    const acc: ScopeNode[] = [];
    const scopeIds = new Set<string>(freeze.scopeNodeIds);
    /** 整树冻结：指定 treeId 时只取该树；旧记录（treeId 为 null）取全部树 */
    const wholeTreeIds: string[] = freeze.scopeWholeTree
      ? freeze.treeId !== null
        ? [freeze.treeId]
        : overview.trees.map((tree: RsipTree) => tree.id)
      : [];
    overview.trees.forEach((tree: RsipTree) => {
      const wholeTree: boolean = wholeTreeIds.includes(tree.id);
      collectScopeNodes(tree.root, 0, false, scopeIds, wholeTree, acc);
    });
    return acc;
  }, [freeze, overview.trees]);

  const scopeTreeName: string | null = useMemo<string | null>(() => {
    if (!freeze || !freeze.scopeWholeTree || freeze.treeId === null) return null;
    const tree: RsipTree | undefined = overview.trees.find(
      (item: RsipTree) => item.id === freeze.treeId,
    );
    return tree?.name ?? null;
  }, [freeze, overview.trees]);

  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setResult(null);
    setSubmitting(false);
    setErrorText(null);
  }, [open, freeze?.id]);

  const unansweredCount: number = scopeNodes.filter(
    (node: ScopeNode) => !answers[node.nodeId],
  ).length;

  const handleAnswer = (nodeId: string, value: string): void => {
    const verdict: ReleaseVerdict =
      value === 'violated' ? 'violated' : 'satisfied';
    setAnswers((prev: Record<string, ReleaseVerdict>) => ({
      ...prev,
      [nodeId]: verdict,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!freeze) return;
    if (unansweredCount > 0) {
      setErrorText(`还有 ${unansweredCount} 条国策未重判`);
      return;
    }
    setErrorText(null);
    setSubmitting(true);
    try {
      const verdicts: RsipFreezeReleaseInput['verdicts'] = [];
      scopeNodes.forEach((node: ScopeNode) => {
        verdicts.push({
          nodeId: node.nodeId,
          verdict:
            answers[node.nodeId] === 'violated' ? 'violated' : 'satisfied',
        });
      });
      const data: RsipFreezeReleaseResult = await releaseFreeze(freeze.id, {
        verdicts,
      });
      setResult(data);
    } catch (error) {
      const message: string = extractErrorMessage(error);
      logger.error('解除冻结失败', message);
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
          <p className="text-sm font-medium text-foreground">重判完成</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            冻结已解除，未违反的国策保持点亮，明天起恢复正常结算。
          </p>
        </div>

        {result.rolledBackPolicies.length > 0 ? (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">有国策退回手牌</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {result.rolledBackPolicies.map((name: string) => (
                <li key={name}>· {name}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              回滚是路径搜索的一部分。内化进度保留，重挂到树上即可继续累积。
            </p>
            <MedicalDisclaimer className="mt-3" />
          </div>
        ) : (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-foreground">没有国策退回手牌</p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => {
              onDone();
              onClose();
            }}
          >
            完成
          </Button>
        </DialogFooter>
      </div>
    );
  };

  const renderForm = (): React.ReactNode => (
    <>
      <div className="space-y-3">
        {scopeNodes.length === 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            本次冻结范围内没有需要重判的国策。
          </div>
        )}

        {scopeNodes.map((node: ScopeNode) => (
          <div
            key={node.nodeId}
            className="rounded-lg border border-border p-4"
            style={{ marginLeft: node.depth * 12 }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {node.name}
              </span>
              <PolicyTypeBadge type={node.type} />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              判定标准：{node.judge}
            </p>
            <RadioGroup
              className="mt-3 flex flex-wrap gap-4"
              aria-label={`解冻重判 ${node.name}`}
              value={answers[node.nodeId] ?? ''}
              onValueChange={(value: string) =>
                handleAnswer(node.nodeId, value)
              }
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="satisfied"
                  id={`release-satisfied-${node.nodeId}`}
                />
                <Label
                  htmlFor={`release-satisfied-${node.nodeId}`}
                  className="text-sm text-foreground/85"
                >
                  满足（保持点亮）
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="violated"
                  id={`release-violated-${node.nodeId}`}
                />
                <Label
                  htmlFor={`release-violated-${node.nodeId}`}
                  className="text-sm text-foreground/85"
                >
                  违反（退回手牌，连带子树）
                </Label>
              </div>
            </RadioGroup>
          </div>
        ))}
      </div>

      {errorText && (
        <p className="text-xs leading-relaxed text-foreground/70">{errorText}</p>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          稍后重判
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? '提交中…' : '提交重判'}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">解冻重判</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            冻结期结束，一次性重判范围内的国策。满足的保持点亮，违反的退回手牌。
            今天不做重判会自动顺延 1 天。
          </DialogDescription>
        </DialogHeader>

        {!freeze ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              当前没有待重判的冻结记录。
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              {freeze.scopeWholeTree
                ? `范围：整树${scopeTreeName ? ` · ${scopeTreeName}` : ''}`
                : '范围：指定子树'}{' '}
              · {freeze.startDate} 至 {freeze.endDate}
              {freeze.reason.length > 0 ? ` · 事由：${freeze.reason}` : ''}
            </div>
            {result ? renderResult() : renderForm()}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FreezeReleaseDialog;
