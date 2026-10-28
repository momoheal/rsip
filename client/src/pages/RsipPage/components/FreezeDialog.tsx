import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { Snowflake } from 'lucide-react';
import type {
  RsipFreezeInput,
  RsipOverview,
  RsipTree,
  RsipTreeNode,
} from '@shared/api.interface';
import { createFreeze, extractErrorMessage } from '@client/src/api/rsip';
import { Button } from '@client/src/components/ui/button';
import { Calendar } from '@client/src/components/ui/calendar';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
import { Label } from '@client/src/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@client/src/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@client/src/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Textarea } from '@client/src/components/ui/textarea';

interface FreezeDialogProps {
  open: boolean;
  overview: RsipOverview;
  /** 整树冻结时的默认目标树 */
  defaultTreeId?: string | null;
  onClose: () => void;
  onDone: () => void;
}

interface FlatNode {
  nodeId: string;
  name: string;
  depth: number;
}

interface TreeOption {
  tree: RsipTree;
  nodes: FlatNode[];
}

const MAX_FREEZE_DAYS = 14;

const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: '3', label: '3 天' },
  { value: '7', label: '7 天' },
  { value: '14', label: '14 天（上限）' },
  { value: 'custom', label: '自选日期' },
];

function flattenTree(
  node: RsipTreeNode | null,
  depth: number,
  acc: FlatNode[],
): FlatNode[] {
  if (!node) return acc;
  acc.push({ nodeId: node.nodeId, name: node.policy.name, depth });
  node.children.forEach((child: RsipTreeNode) =>
    flattenTree(child, depth + 1, acc),
  );
  return acc;
}

const freezeSchema = z
  .object({
    scope: z.enum(['whole', 'subtree']),
    treeId: z.string(),
    scopeNodeIds: z.array(z.string()),
    reason: z.string().trim().min(1, '请填写冻结事由').max(200, '事由不超过 200 字'),
    duration: z.enum(['3', '7', '14', 'custom']),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'whole' && value.treeId.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['treeId'],
        message: '请选择要冻结的树',
      });
    }
    if (value.scope === 'subtree' && value.scopeNodeIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['scopeNodeIds'],
        message: '请至少选择一个要冻结的节点',
      });
    }
    if (value.duration !== 'custom') return;
    if (!value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: '请选择开始日期',
      });
      return;
    }
    if (!value.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '请选择结束日期',
      });
      return;
    }
    const start = dayjs(value.startDate);
    const end = dayjs(value.endDate);
    if (end.isBefore(start)) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '结束日期不能早于开始日期',
      });
      return;
    }
    if (end.diff(start, 'day') + 1 > MAX_FREEZE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: `冻结期限最长 ${MAX_FREEZE_DAYS} 天（含首尾）`,
      });
    }
  });

type FreezeFormData = z.infer<typeof freezeSchema>;

const DEFAULT_VALUES: FreezeFormData = {
  scope: 'whole',
  treeId: '',
  scopeNodeIds: [],
  reason: '',
  duration: '7',
  startDate: '',
  endDate: '',
};

const FreezeDialog: React.FC<FreezeDialogProps> = ({
  open,
  overview,
  defaultTreeId,
  onClose,
  onDone,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const prevOpenRef = useRef<boolean>(false);

  const treeOptions: TreeOption[] = overview.trees.map((tree: RsipTree) => ({
    tree,
    nodes: flattenTree(tree.root, 0, []),
  }));
  const hasNodes: boolean = treeOptions.some(
    (option: TreeOption) => option.nodes.length > 0,
  );

  const defaultValues: FreezeFormData = useMemo<FreezeFormData>(() => {
    const fallbackTreeId: string =
      defaultTreeId ?? overview.trees[0]?.id ?? '';
    return { ...DEFAULT_VALUES, treeId: fallbackTreeId };
  }, [defaultTreeId, overview.trees]);

  const form = useForm<FreezeFormData>({
    resolver: zodResolver(freezeSchema),
    defaultValues,
  });

  const scope = form.watch('scope');
  const duration = form.watch('duration');

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      form.reset(defaultValues);
    }
    prevOpenRef.current = open;
  }, [open, form, defaultValues]);

  const handleSubmit = form.handleSubmit(async (data: FreezeFormData) => {
    if (!hasNodes) return;
    const isCustom: boolean = data.duration === 'custom';
    const startDate: string = isCustom
      ? data.startDate
      : dayjs().format('YYYY-MM-DD');
    const endDate: string = isCustom
      ? data.endDate
      : dayjs()
          .add(Number(data.duration) - 1, 'day')
          .format('YYYY-MM-DD');
    const input: RsipFreezeInput = {
      scopeWholeTree: data.scope === 'whole',
      treeId: data.scope === 'whole' ? data.treeId : null,
      scopeNodeIds: data.scope === 'whole' ? [] : data.scopeNodeIds,
      reason: data.reason,
      startDate,
      endDate,
    };
    setSubmitting(true);
    try {
      await createFreeze(input);
      toast.success('冻结已生效');
      onDone();
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Snowflake size={16} className="text-muted-foreground/75" />
            冻结（水密隔舱）
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            冻结不是失败，是「存人失地，人地皆存」：先保住人，再重判这块地。冻结期内
            所选国策不进结算列表，解冻日一次性重判——满足即恢复，不满足才回滚。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {hasNodes ? null : (
              <p className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground/70">
                没有可冻结的国策：树上还没有节点。
              </p>
            )}

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    冻结范围{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value: string) => field.onChange(value)}
                      className="gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="whole" id="freeze-scope-whole" />
                        <Label
                          htmlFor="freeze-scope-whole"
                          className="text-sm font-normal text-foreground/85"
                        >
                          整棵树
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="subtree" id="freeze-scope-subtree" />
                        <Label
                          htmlFor="freeze-scope-subtree"
                          className="text-sm font-normal text-foreground/85"
                        >
                          指定子树
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {scope === 'whole' ? (
              <FormField
                control={form.control}
                name="treeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>要冻结的树</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: string) => field.onChange(value)}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="选择要冻结的树">
                          <SelectValue placeholder="请选择要冻结的树" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {overview.trees.map((tree: RsipTree) => (
                          <SelectItem key={tree.id} value={tree.id}>
                            {tree.name}（{tree.nodeCount} 个节点）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      整树冻结 = 这棵树上的全部活跃节点一起进隔舱。
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {scope === 'subtree' && hasNodes ? (
              <FormField
                control={form.control}
                name="scopeNodeIds"
                render={({ field }) => {
                  const selected: string[] = field.value;
                  const toggle = (nodeId: string): void => {
                    field.onChange(
                      selected.includes(nodeId)
                        ? selected.filter((id: string) => id !== nodeId)
                        : [...selected, nodeId],
                    );
                  };
                  return (
                    <FormItem>
                      <FormLabel>要冻结的节点</FormLabel>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                        {treeOptions.map((option: TreeOption) =>
                          option.nodes.length === 0 ? null : (
                            <div key={option.tree.id} className="py-1">
                              <p className="px-1 text-xs text-muted-foreground/75">
                                {option.tree.name}
                              </p>
                              {option.nodes.map((node: FlatNode) => {
                                const checkboxId: string = `freeze-node-${node.nodeId}`;
                                return (
                                  <div
                                    key={node.nodeId}
                                    className="flex items-center gap-2 py-1"
                                  >
                                    <Checkbox
                                      id={checkboxId}
                                      checked={selected.includes(node.nodeId)}
                                      onCheckedChange={() => toggle(node.nodeId)}
                                    />
                                    <Label
                                      htmlFor={checkboxId}
                                      className="flex-1 cursor-pointer truncate text-sm font-normal text-foreground/85"
                                      style={{ paddingLeft: node.depth * 12 }}
                                    >
                                      {node.name}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          ),
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        子树的全部后代一同冻结。
                      </p>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ) : null}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    事由{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="例如：项目上线周作息被动打乱，先保人不保树"
                      rows={3}
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {field.value.length} / 200
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    冻结期限{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value: string) => field.onChange(value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择期限" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DURATION_OPTIONS.map(
                        (option: { value: string; label: string }) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    从今天起算，最长 {MAX_FREEZE_DAYS} 天（含首尾）。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {duration === 'custom' ? (
              <div className="flex flex-wrap gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>开始日期</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start font-normal"
                            >
                              {field.value
                                ? dayjs(field.value).format('YYYY-MM-DD')
                                : '请选择日期'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value
                                ? dayjs(field.value).toDate()
                                : undefined
                            }
                            onSelect={(date: Date | undefined) =>
                              field.onChange(
                                date ? dayjs(date).format('YYYY-MM-DD') : '',
                              )
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>结束日期</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start font-normal"
                            >
                              {field.value
                                ? dayjs(field.value).format('YYYY-MM-DD')
                                : '请选择日期'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value
                                ? dayjs(field.value).toDate()
                                : undefined
                            }
                            onSelect={(date: Date | undefined) =>
                              field.onChange(
                                date ? dayjs(date).format('YYYY-MM-DD') : '',
                              )
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={submitting || !hasNodes}>
                {submitting ? '提交中…' : '发起冻结'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default FreezeDialog;
