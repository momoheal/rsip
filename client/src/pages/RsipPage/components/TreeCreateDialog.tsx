import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TreePine } from 'lucide-react';
import type { RsipHandItem } from '@shared/api.interface';
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
import { Textarea } from '@client/src/components/ui/textarea';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import ProgressTrack from '@client/src/components/rsip/ProgressTrack';
import { createTree, safeApiCall } from '@client/src/api/rsip';

interface TreeCreateDialogProps {
  open: boolean;
  /** 手牌（根国策候选来源） */
  hand: RsipHandItem[];
  /** 是否满足建树门槛（与挂载一致） */
  canAttachToday: boolean;
  onClose: () => void;
  /** 创建成功后刷新总览 */
  onDone: () => void;
}

const GATE_REASONS: string[] = [
  '今日已完成结算',
  '今日没有回滚',
  '已有国策内化超过 3 天',
  '当日新增名额尚未使用（全局跨树共用 1 次）',
];

const TreeCreateDialog: React.FC<TreeCreateDialogProps> = ({
  open,
  hand,
  canAttachToday,
  onClose,
  onDone,
}) => {
  const [name, setName] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [rootPolicyId, setRootPolicyId] = useState<string>('');
  const [tier, setTier] = useState<'normal' | 'elite'>('normal');
  const [showErrors, setShowErrors] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setGoal('');
    setRootPolicyId('');
    setTier('normal');
    setShowErrors(false);
    setSubmitting(false);
    setErrorText(null);
  }, [open]);

  const candidates: RsipHandItem[] = hand.filter(
    (item: RsipHandItem) =>
      !item.policy.isRetired && item.policy.type !== 'active',
  );

  const nameError: string | null =
    name.trim().length === 0
      ? '请填写树名称'
      : name.trim().length > 100
        ? '树名称不超过 100 字'
        : null;
  const goalError: string | null =
    goal.trim().length > 200 ? '大目标不超过 200 字' : null;
  const rootError: string | null =
    rootPolicyId.length === 0 ? '请选择一条根国策' : null;

  const invalid: boolean =
    !canAttachToday || !!nameError || !!goalError || !!rootError;

  const handleSubmit = async (): Promise<void> => {
    if (!canAttachToday) return;
    if (nameError || goalError || rootError) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setErrorText(null);
    setSubmitting(true);
    const result = await safeApiCall(() =>
      createTree({
        name: name.trim(),
        goal: goal.trim().length > 0 ? goal.trim() : null,
        rootPolicyId,
        tier,
      }),
    );
    setSubmitting(false);
    if ('message' in result) {
      toast.error(result.message);
      setErrorText(result.message);
      return;
    }
    toast.success('树已创建');
    onDone();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <TreePine size={16} className="text-muted-foreground/75" />
            新建国策树
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            从手牌里挑一条最不可能失败的国策做根。建树与挂载共用同一个每日新增名额。
          </DialogDescription>
        </DialogHeader>

        {!canAttachToday && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">
              今天暂不能建树
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {GATE_REASONS.map((reason: string) => (
                <li key={reason}>· {reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              门槛与每日新增一致，满足后可建树。
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tree-name" className="text-xs text-foreground/70">
              树名称
            </Label>
            <Input
              id="tree-name"
              value={name}
              maxLength={120}
              placeholder="例如：作息与专注"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setName(event.target.value)
              }
            />
            {showErrors && nameError && (
              <p className="text-xs text-foreground/70">{nameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tree-goal" className="text-xs text-foreground/70">
              大目标（可选）
            </Label>
            <Textarea
              id="tree-goal"
              value={goal}
              rows={2}
              maxLength={240}
              placeholder="这棵树想解决的那件事"
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setGoal(event.target.value)
              }
            />
            {showErrors && goalError && (
              <p className="text-xs text-foreground/70">{goalError}</p>
            )}
          </div>

          <div className="space-y-1.5 rounded-lg border border-border bg-muted/50 p-3">
            <Label className="text-xs text-foreground/70">树类型</Label>
            <RadioGroup
              className="mt-1 gap-2"
              aria-label="选择树类型"
              value={tier}
              onValueChange={(v) => setTier(v as 'normal' | 'elite')}
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="normal" id="tier-normal" className="mt-0.5" />
                <Label htmlFor="tier-normal" className="text-xs leading-relaxed text-foreground/85">
                  <span className="font-medium">普通树</span>：任何状态下都可挂，包括疲惫、碎片时间。
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="elite" id="tier-elite" className="mt-0.5" />
                <Label htmlFor="tier-elite" className="text-xs leading-relaxed text-foreground/85">
                  <span className="font-medium">精锐树</span>：只在状态最佳时启用；同一时刻仅一棵，
                  崩了会由最好的普通树继位。
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-foreground/70">根国策</Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              根不允许主动型。它将成为整棵树唯一的上游。
            </p>
            <RadioGroup
              className="gap-2"
              aria-label="选择根国策"
              value={rootPolicyId}
              onValueChange={(value: string) => setRootPolicyId(value)}
            >
              {candidates.map((item: RsipHandItem) => (
                <div
                  key={item.policy.id}
                  className="flex items-start gap-2 rounded-lg border border-border p-3"
                >
                  <RadioGroupItem
                    value={item.policy.id}
                    id={`tree-root-${item.policy.id}`}
                    className="mt-1"
                  />
                  <PolicyIcon policy={item.policy} size={32} />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={`tree-root-${item.policy.id}`}
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
            </RadioGroup>
            {candidates.length === 0 && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                手牌里还没有可用作根的国策（主动型不能做根）。
              </p>
            )}
            {showErrors && rootError && (
              <p className="text-xs text-foreground/70">{rootError}</p>
            )}
          </div>

          {errorText && (
            <p className="text-xs leading-relaxed text-foreground/70">
              {errorText}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || invalid}
          >
            {submitting ? '创建中…' : '建树'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TreeCreateDialog;
