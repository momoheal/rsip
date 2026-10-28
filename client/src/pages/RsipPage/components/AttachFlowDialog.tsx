import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  RsipAttachInput,
  RsipOverview,
  RsipPolicy,
  RsipTreeNode,
  RsipTree,
  RsipUserPolicyType,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import PolicyIconPicker from './PolicyIconPicker';
import ProgressTrack from '@client/src/components/rsip/ProgressTrack';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  attachNode,
  createPolicy,
  extractErrorMessage,
} from '@client/src/api/rsip';

const NEW_POLICY_VALUE = '__new_policy__';
/** 建根选项前缀：值形如 root:<treeId> */
const ROOT_TARGET_PREFIX = 'root:';

interface FlatNode {
  nodeId: string;
  name: string;
  depth: number;
}

interface TreeOption {
  tree: RsipTree;
  nodes: FlatNode[];
}

interface AttachFlowDialogProps {
  open: boolean;
  overview: RsipOverview;
  onClose: () => void;
  onDone: () => void;
}

/** 递归扁平化树，depth 用于缩进展示 */
function flattenTree(
  node: RsipTreeNode | null,
  depth: number,
  acc: FlatNode[],
): void {
  if (!node) return;
  if (!node.policy.isRetired) {
    acc.push({ nodeId: node.nodeId, name: node.policy.name, depth });
  }
  node.children.forEach((child: RsipTreeNode) =>
    flattenTree(child, depth + 1, acc),
  );
}

/** 判断判定标准是否为二元问句（与编辑器校验一致） */
function isBinaryJudge(judge: string): boolean {
  const text: string = judge.trim();
  return text.startsWith('是否') || text.startsWith('有没有');
}

/** Select 返回 string，显式映射回用户可选类型 */
function toUserPolicyType(value: string): RsipUserPolicyType {
  if (value === 'semi_passive') return 'semi_passive';
  if (value === 'active') return 'active';
  return 'passive';
}

const AttachFlowDialog: React.FC<AttachFlowDialogProps> = ({
  open,
  overview,
  onClose,
  onDone,
}) => {
  const today = overview.today;

  const [step, setStep] = useState<number>(0);
  const [source, setSource] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<RsipUserPolicyType>('passive');
  const [newTrigger, setNewTrigger] = useState<string>('');
  const [newJudge, setNewJudge] = useState<string>('');
  const [newIconKey, setNewIconKey] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState<boolean>(false);
  const [parentTarget, setParentTarget] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSource('');
    setNewName('');
    setNewType('passive');
    setNewTrigger('');
    setNewJudge('');
    setNewIconKey(null);
    setShowErrors(false);
    setParentTarget('');
    setSubmitting(false);
    setErrorText(null);
  }, [open, today.date]);

  const treeOptions = useMemo<TreeOption[]>(() => {
    return overview.trees.map((tree: RsipTree): TreeOption => {
      const acc: FlatNode[] = [];
      flattenTree(tree.root, 0, acc);
      return { tree, nodes: acc };
    });
  }, [overview.trees]);

  /** 无根的树：可以提供「为这棵树建根」 */
  const rootlessTrees = useMemo<RsipTree[]>(() => {
    return overview.trees.filter((tree: RsipTree) => tree.root === null);
  }, [overview.trees]);

  const hasAnyNode: boolean = useMemo<boolean>(() => {
    return treeOptions.some((option: TreeOption) => option.nodes.length > 0);
  }, [treeOptions]);

  const hasMaturePolicy: boolean = useMemo<boolean>(() => {
    const handMature: boolean = overview.hand.some(
      (item) => (item.progress?.cumulativeLitDays ?? 0) > 3,
    );
    if (handMature) return true;
    const walk = (node: RsipTreeNode | null): boolean => {
      if (!node) return false;
      if ((node.progress?.cumulativeLitDays ?? 0) > 3) return true;
      return node.children.some((child: RsipTreeNode) => walk(child));
    };
    return overview.trees.some((tree: RsipTree) => walk(tree.root));
  }, [overview.hand, overview.trees]);

  const blockers = useMemo<string[]>(() => {
    const reasons: string[] = [];
    if (!today.reviewCompleted) reasons.push('尚未完成今日结算');
    if (today.hadRollbackToday) reasons.push('今日有回滚，新增入口今天不开放');
    if (today.attachUsedToday) reasons.push('今日已挂载过 1 条国策（每天限 1 条）');
    if (!hasMaturePolicy) reasons.push('还没有国策内化超过 3 天');
    return reasons;
  }, [today, hasMaturePolicy]);

  const locked: boolean = !today.canAttachToday || blockers.length > 0;
  const isCreating: boolean = source === NEW_POLICY_VALUE;

  const nameError: string | null =
    newName.trim().length === 0
      ? '请填写国策名称'
      : newName.trim().length > 50
        ? '名称不超过 50 字'
        : null;
  const triggerError: string | null =
    newType === 'semi_passive' && newTrigger.trim().length === 0
      ? '半被动型必须填写触发条件'
      : null;
  const judgeError: string | null = isBinaryJudge(newJudge)
    ? null
    : '判定标准需以「是否」或「有没有」开头的二元问句';

  const stepOneValid: boolean = isCreating
    ? !nameError && !triggerError && !judgeError
    : source.length > 0;
  const stepTwoValid: boolean = parentTarget.length > 0;

  const handleNext = (): void => {
    if (!stepOneValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep(1);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!stepTwoValid) {
      setErrorText('请选择挂载位置');
      return;
    }
    setErrorText(null);
    setSubmitting(true);
    try {
      let targetPolicyId: string = isCreating ? '' : source;
      if (isCreating) {
        const created: RsipPolicy = await createPolicy({
          name: newName.trim(),
          type: newType,
          trigger: newType === 'semi_passive' ? newTrigger.trim() : null,
          judge: newJudge.trim(),
          iconKey: newIconKey,
        });
        targetPolicyId = created.id;
      }
      const isRootTarget: boolean = parentTarget.startsWith(ROOT_TARGET_PREFIX);
      const payload: RsipAttachInput = {
        policyId: targetPolicyId,
        parentNodeId: isRootTarget ? null : parentTarget,
        treeId: isRootTarget
          ? parentTarget.slice(ROOT_TARGET_PREFIX.length)
          : null,
      };
      await attachNode(payload);
      toast.success('已挂上，明天结算见');
      onDone();
      onClose();
    } catch (error) {
      const message: string = extractErrorMessage(error);
      logger.error('挂载国策失败', message);
      toast.error(message);
      setErrorText(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderCreateForm = (): React.ReactNode => (
    <div className="mt-3 space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="attach-new-name" className="text-xs text-foreground/70">
          国策名称
        </Label>
        <Input
          id="attach-new-name"
          value={newName}
          maxLength={60}
          placeholder="例如：早上不看手机"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setNewName(event.target.value)
          }
        />
        {showErrors && nameError && (
          <p className="text-xs text-foreground/70">{nameError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-foreground/70">图标</Label>
        <PolicyIconPicker value={newIconKey} onChange={setNewIconKey} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-foreground/70">类型</Label>
        <Select
          value={newType}
          onValueChange={(value: string) =>
            setNewType(toUserPolicyType(value))
          }
        >
          <SelectTrigger className="w-full" aria-label="国策类型">
            <SelectValue placeholder="选择类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="passive">被动型（无条件禁止某个动作）</SelectItem>
            <SelectItem value="semi_passive">
              半被动型（由触发条件引起）
            </SelectItem>
            <SelectItem value="active">
              主动型（需要主动投入时间，树上最多 3 条）
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {newType === 'semi_passive' && (
        <div className="space-y-1.5">
          <Label
            htmlFor="attach-new-trigger"
            className="text-xs text-foreground/70"
          >
            触发条件
          </Label>
          <Input
            id="attach-new-trigger"
            value={newTrigger}
            maxLength={100}
            placeholder="例如：想打开短视频时"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setNewTrigger(event.target.value)
            }
          />
          {showErrors && triggerError && (
            <p className="text-xs text-foreground/70">{triggerError}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="attach-new-judge" className="text-xs text-foreground/70">
          判定标准
        </Label>
        <Input
          id="attach-new-judge"
          value={newJudge}
          maxLength={120}
          placeholder="例如：是否在触发后 5 分钟内离开"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setNewJudge(event.target.value)
          }
        />
        {newJudge.trim().length > 0 && judgeError && (
          <p className="text-xs text-foreground/70">{judgeError}</p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          写成可以用「是 / 否」直接回答的一句问句。
        </p>
      </div>
    </div>
  );

  const renderStepOne = (): React.ReactNode => (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        从手牌里挑一条，或者新建一条。今天只能挂 1 条。
      </p>

      <RadioGroup
        className="gap-2"
        aria-label="选择要挂载的国策"
        value={source}
        onValueChange={(value: string) => setSource(value)}
      >
        {overview.hand
          .filter((item) => !item.policy.isRetired)
          .map((item) => (
            <div
              key={item.policy.id}
              className="flex items-start gap-2 rounded-lg border border-border p-3"
            >
              <RadioGroupItem
                value={item.policy.id}
                id={`attach-hand-${item.policy.id}`}
                className="mt-1"
              />
              <PolicyIcon policy={item.policy} size={32} />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`attach-hand-${item.policy.id}`}
                  className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground"
                >
                  {item.policy.name}
                  <PolicyTypeBadge type={item.policy.type} />
                </Label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.policy.judge}
                </p>
                <div className="mt-2">
                  <ProgressTrack
                    compact
                    cumulative={item.progress?.cumulativeLitDays ?? 0}
                    streak={item.progress?.currentStreak ?? 0}
                  />
                </div>
              </div>
            </div>
          ))}
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <RadioGroupItem
            value={NEW_POLICY_VALUE}
            id="attach-new-policy"
          />
          <Label
            htmlFor="attach-new-policy"
            className="text-sm font-medium text-foreground"
          >
            新建一条国策
          </Label>
        </div>
      </RadioGroup>

      {isCreating && renderCreateForm()}

      {overview.hand.length === 0 && !isCreating && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          手牌是空的，先新建一条。
        </p>
      )}
    </div>
  );

  const renderStepTwo = (): React.ReactNode => (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        选择挂载位置：可以挂在任意一棵树的已点亮国策下；没有根的树可以先挂根。
      </p>

      <RadioGroup
        className="gap-3"
        aria-label="选择挂载位置"
        value={parentTarget}
        onValueChange={(value: string) => setParentTarget(value)}
      >
        {rootlessTrees.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">为某棵树建根</p>
            {rootlessTrees.map((tree: RsipTree) => (
              <div
                key={tree.id}
                className="flex items-center gap-2 rounded-lg border border-border p-3"
              >
                <RadioGroupItem
                  value={`${ROOT_TARGET_PREFIX}${tree.id}`}
                  id={`attach-root-${tree.id}`}
                />
                <Label
                  htmlFor={`attach-root-${tree.id}`}
                  className="flex-1 text-sm text-foreground"
                >
                  {tree.name}
                  <span className="ml-1.5 text-xs text-muted-foreground/75">暂无根</span>
                </Label>
              </div>
            ))}
          </div>
        )}

        {treeOptions.map((option: TreeOption) =>
          option.nodes.length > 0 ? (
            <div key={option.tree.id} className="space-y-2">
              <p className="text-xs text-muted-foreground">{option.tree.name}</p>
              {option.nodes.map((node: FlatNode) => (
                <div
                  key={node.nodeId}
                  className="flex items-center gap-2 rounded-lg border border-border p-3"
                  style={{ marginLeft: node.depth * 16 }}
                >
                  <RadioGroupItem
                    value={node.nodeId}
                    id={`attach-parent-${node.nodeId}`}
                  />
                  <Label
                    htmlFor={`attach-parent-${node.nodeId}`}
                    className="text-sm text-foreground"
                  >
                    {node.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : null,
        )}
      </RadioGroup>

      {!hasAnyNode && rootlessTrees.length === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          还没有可挂载的位置：先建一棵树，或等已有树挂上根国策。
        </p>
      )}

      <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        这条国策将来熄灭时，它的所有子国策会一起退回手牌（内化进度保留）。
      </div>

      {errorText && (
        <p className="text-xs leading-relaxed text-foreground/70">{errorText}</p>
      )}
    </div>
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
          <DialogTitle className="text-xl font-semibold">每日新增</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {today.date} · 每天最多新增 1 条国策，挂在已点亮的节点下。
          </DialogDescription>
        </DialogHeader>

        {locked ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                今天暂不能新增国策
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                {(blockers.length > 0
                  ? blockers
                  : ['当前不满足新增条件']
                ).map((reason: string) => (
                  <li key={reason}>· {reason}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                新增入口在你完成一次没有回滚的结算、且有国策内化超过 3 天后开放。
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {step === 0 ? renderStepOne() : renderStepTwo()}

            <DialogFooter>
              {step === 0 ? (
                <>
                  <Button variant="ghost" onClick={onClose}>
                    取消
                  </Button>
                  <Button onClick={handleNext} disabled={!stepOneValid}>
                    下一步
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    上一步
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !stepTwoValid}
                  >
                    {submitting ? '挂载中…' : '确认挂载'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttachFlowDialog;
