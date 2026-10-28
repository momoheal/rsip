import React, { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { RsipPolicyGroup } from '@shared/api.interface';
import {
  createGroup,
  deleteGroup,
  safeApiCall,
  updateGroup,
} from '@client/src/api/rsip';
import { Badge } from '@client/src/components/ui/badge';
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
import { ScrollArea } from '@client/src/components/ui/scroll-area';

const GROUP_NAME_MAX = 50;

interface GroupManagerDialogProps {
  open: boolean;
  groups: RsipPolicyGroup[];
  onClose: () => void;
  /** 组增删改名后刷新总览 */
  onChanged: () => void;
}

const GroupManagerDialog: React.FC<GroupManagerDialogProps> = ({
  open,
  groups,
  onClose,
  onChanged,
}) => {
  const [newName, setNewName] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewName('');
    setCreating(false);
    setEditingId(null);
    setEditingName('');
    setConfirmingId(null);
    setPendingId(null);
  }, [open]);

  const validateName = (value: string): string | null => {
    const trimmed: string = value.trim();
    if (trimmed.length === 0) return '请填写组名称';
    if (trimmed.length > GROUP_NAME_MAX) {
      return `组名称不超过 ${GROUP_NAME_MAX} 字`;
    }
    return null;
  };

  const handleCreate = async (): Promise<void> => {
    const invalid: string | null = validateName(newName);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setCreating(true);
    const result = await safeApiCall(() => createGroup({ name: newName.trim() }));
    setCreating(false);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success('已新建分组');
    setNewName('');
    onChanged();
  };

  const startEdit = (group: RsipPolicyGroup): void => {
    setEditingId(group.id);
    setEditingName(group.name);
    setConfirmingId(null);
  };

  const handleRename = async (group: RsipPolicyGroup): Promise<void> => {
    const invalid: string | null = validateName(editingName);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setPendingId(group.id);
    const result = await safeApiCall(() =>
      updateGroup(group.id, { name: editingName.trim() }),
    );
    setPendingId(null);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success('分组已重命名');
    setEditingId(null);
    setEditingName('');
    onChanged();
  };

  const handleDelete = async (group: RsipPolicyGroup): Promise<void> => {
    setPendingId(group.id);
    const result = await safeApiCall(() => deleteGroup(group.id));
    setPendingId(null);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success('分组已删除');
    setConfirmingId(null);
    if (editingId === group.id) {
      setEditingId(null);
      setEditingName('');
    }
    onChanged();
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
          <DialogTitle>国策组管理</DialogTitle>
          <DialogDescription>
            跨树分类标签，只影响归类查看，不影响结算与回滚。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <form
            className="flex items-start gap-2"
            onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="min-w-0 flex-1">
              <Input
                value={newName}
                maxLength={GROUP_NAME_MAX}
                placeholder="新建组名称，例如：作息"
                aria-label="新建组名称"
                disabled={creating}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setNewName(event.target.value)
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                组名不超过 {GROUP_NAME_MAX} 字，同一个组可以包含不同树上的国策。
              </p>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={creating}
              aria-label="新建分组"
            >
              <Plus size={15} />
              {creating ? '创建中…' : '新建'}
            </Button>
          </form>

          {groups.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-foreground/20 p-6 text-center">
              <Tags size={24} className="mb-2 text-muted-foreground/45" />
              <p className="text-sm font-medium text-foreground/85">还没有分组</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                分组只用于归类与筛选，国策不分组也能正常结算。
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[45vh] pr-3">
              <ul className="divide-y divide-border">
                {groups.map((group: RsipPolicyGroup) => {
                  const isEditing: boolean = editingId === group.id;
                  const isPending: boolean = pendingId === group.id;
                  return (
                    <li
                      key={group.id}
                      className="py-2.5 first:pt-0 last:pb-0"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            maxLength={GROUP_NAME_MAX}
                            aria-label={`重命名分组 ${group.name}`}
                            disabled={isPending}
                            onChange={(
                              event: React.ChangeEvent<HTMLInputElement>,
                            ) => setEditingName(event.target.value)}
                          />
                          <Button
                            size="sm"
                            aria-label={`保存分组名称 ${group.name}`}
                            disabled={isPending}
                            onClick={() => void handleRename(group)}
                          >
                            <Check size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`取消重命名分组 ${group.name}`}
                            disabled={isPending}
                            onClick={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                          >
                            <X size={15} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Tags
                              size={14}
                              className="shrink-0 text-muted-foreground/75"
                            />
                            <span className="truncate text-sm text-foreground">
                              {group.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="shrink-0 px-1.5 text-[11px] font-normal tabular-nums text-muted-foreground"
                            >
                              {group.policyCount} 条
                            </Badge>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`重命名分组 ${group.name}`}
                              disabled={isPending}
                              onClick={() => startEdit(group)}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`删除分组 ${group.name}`}
                              disabled={isPending}
                              onClick={() => {
                                setConfirmingId(group.id);
                                if (editingId === group.id) setEditingId(null);
                              }}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                      )}

                      {confirmingId === group.id && (
                        <div className="mt-2 rounded-md border border-border bg-muted/50 p-2.5">
                          <p className="text-xs leading-relaxed text-foreground/70">
                            删除后组内国策变为未分组，国策本身不受影响。
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`确认删除分组 ${group.name}`}
                              disabled={isPending}
                              onClick={() => void handleDelete(group)}
                            >
                              确认删除
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`取消删除分组 ${group.name}`}
                              disabled={isPending}
                              onClick={() => setConfirmingId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            aria-label="关闭分组管理"
            onClick={onClose}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupManagerDialog;
