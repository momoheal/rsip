import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { RsipTree, RsipTreeUpdateInput } from '@shared/api.interface';
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
import { Textarea } from '@client/src/components/ui/textarea';
import { safeApiCall, updateTree } from '@client/src/api/rsip';

interface TreeEditDialogProps {
  open: boolean;
  /** 要编辑的树；为 null 时不渲染内容 */
  tree: RsipTree | null;
  onClose: () => void;
  /** 保存成功后刷新总览 */
  onDone: () => void;
}

const TreeEditDialog: React.FC<TreeEditDialogProps> = ({
  open,
  tree,
  onClose,
  onDone,
}) => {
  const [name, setName] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [showErrors, setShowErrors] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(tree?.name ?? '');
    setGoal(tree?.goal ?? '');
    setShowErrors(false);
    setSubmitting(false);
    setErrorText(null);
  }, [open, tree?.id, tree?.name, tree?.goal]);

  const nameError: string | null =
    name.trim().length === 0
      ? '请填写树名称'
      : name.trim().length > 100
        ? '树名称不超过 100 字'
        : null;
  const goalError: string | null =
    goal.trim().length > 200 ? '大目标不超过 200 字' : null;
  const invalid: boolean = !!nameError || !!goalError || !tree;

  const handleSubmit = async (): Promise<void> => {
    if (!tree) return;
    if (nameError || goalError) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setErrorText(null);

    const patch: RsipTreeUpdateInput = {};
    const nextName: string = name.trim();
    const nextGoal: string = goal.trim();
    if (nextName !== tree.name) patch.name = nextName;
    if (nextGoal !== (tree.goal ?? '')) patch.goal = nextGoal.length > 0 ? nextGoal : null;
    if (patch.name === undefined && patch.goal === undefined) {
      onClose();
      return;
    }

    setSubmitting(true);
    const result = await safeApiCall(() => updateTree(tree.id, patch));
    setSubmitting(false);
    if ('message' in result) {
      toast.error(result.message);
      setErrorText(result.message);
      return;
    }
    toast.success('树已更新');
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">编辑国策树</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            改名或调整大目标不影响树上的节点、内化进度与判定逻辑。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tree-edit-name" className="text-xs text-foreground/70">
              树名称
            </Label>
            <Input
              id="tree-edit-name"
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
            <Label htmlFor="tree-edit-goal" className="text-xs text-foreground/70">
              大目标（可选）
            </Label>
            <Textarea
              id="tree-edit-goal"
              value={goal}
              rows={3}
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
            {submitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TreeEditDialog;
