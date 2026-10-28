import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type {
  RsipLeverageSource,
  RsipPolicy,
  RsipPolicyGroup,
  RsipPolicyInput,
  RsipUserPolicyType,
} from '@shared/api.interface';
import { createPolicy, extractErrorMessage, updatePolicy } from '@client/src/api/rsip';
import { Button } from '@client/src/components/ui/button';
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
import { Input } from '@client/src/components/ui/input';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import PolicyIconPicker from './PolicyIconPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

interface PolicyEditorDialogProps {
  open: boolean;
  initial: RsipPolicy | null;
  onClose: () => void;
  onSaved: () => void;
  /** 国策组列表，用于编辑时选择分组 */
  groups?: RsipPolicyGroup[];
}

const GROUP_NONE = 'none';

const TYPE_OPTIONS: { value: RsipUserPolicyType; label: string }[] = [
  { value: 'passive', label: '被动型' },
  { value: 'semi_passive', label: '半被动型' },
  { value: 'active', label: '主动型' },
];

const LEVERAGE_OPTIONS: { value: RsipLeverageSource; label: string }[] = [
  { value: 'causal_chain', label: '因果链' },
  { value: 'behavior_inertia', label: '行为惯性' },
  { value: 'environment', label: '环境' },
  { value: 'physical_posture', label: '物理姿势' },
  { value: 'physiological', label: '生理本能' },
  { value: 'math_structure', label: '数学结构' },
];

const policySchema = z
  .object({
    name: z.string().trim().min(1, '请填写国策名称').max(50, '名称不超过 50 字'),
    type: z.enum(['passive', 'semi_passive', 'active']),
    trigger: z.string(),
    judge: z
      .string()
      .trim()
      .min(1, '请填写判定标准')
      .max(80, '判定标准不超过 80 字')
      .regex(
        /^(是否|有没有)/,
        '判定标准必须以『是否』或『有没有』开头的二元问句',
      ),
    /** 国策组 id，GROUP_NONE 表示不分组 */
    groupId: z.string(),
    /** v1.1 杠杆来源 */
    leverage: z.enum([
      'causal_chain',
      'behavior_inertia',
      'environment',
      'physical_posture',
      'physiological',
      'math_structure',
    ]),
    /** v1.1 相关性：是否作用于有效干预节点 */
    relevant: z.enum(['true', 'false']),
  })
  .superRefine((value, ctx) => {
    if (value.type !== 'semi_passive') return;
    if (value.trigger.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['trigger'],
        message: '半被动型必须填写触发条件',
      });
      return;
    }
    if (value.trigger.trim().length > 60) {
      ctx.addIssue({
        code: 'custom',
        path: ['trigger'],
        message: '触发条件不超过 60 字',
      });
    }
  });

type PolicyFormData = z.infer<typeof policySchema>;

function toFormValues(initial: RsipPolicy | null): PolicyFormData {
  const type: RsipUserPolicyType =
    initial && initial.type !== 'mechanism' ? initial.type : 'passive';
  return {
    name: initial?.name ?? '',
    type,
    trigger: initial?.trigger ?? '',
    judge: initial?.judge ?? '',
    groupId: initial?.groupId ?? GROUP_NONE,
    leverage: initial?.leverage ?? 'causal_chain',
    relevant: initial?.relevant === false ? 'false' : 'true',
  };
}

const PolicyEditorDialog: React.FC<PolicyEditorDialogProps> = ({
  open,
  initial,
  onClose,
  onSaved,
  groups,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [iconKey, setIconKey] = useState<string | null>(
    initial?.iconKey ?? null,
  );
  const groupOptions: RsipPolicyGroup[] = groups ?? [];
  const prevOpenRef = useRef<boolean>(false);

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: toFormValues(initial),
  });

  const policyType: RsipUserPolicyType = form.watch('type');

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      form.reset(toFormValues(initial));
      setIconKey(initial?.iconKey ?? null);
    }
    prevOpenRef.current = open;
  }, [open, initial, form]);

  const handleSubmit = form.handleSubmit(async (data: PolicyFormData) => {
    const input: RsipPolicyInput = {
      name: data.name,
      type: data.type,
      trigger: data.type === 'semi_passive' ? data.trigger : null,
      judge: data.judge,
      templateId: initial?.templateId ?? null,
      groupId: data.groupId === GROUP_NONE ? null : data.groupId,
      iconKey,
      leverage: data.leverage,
      relevant: data.relevant === 'true',
    };
    setSubmitting(true);
    try {
      if (initial) {
        await updatePolicy(initial.id, input);
        toast.success('国策已更新');
      } else {
        await createPolicy(input);
        toast.success('国策已创建');
      }
      onSaved();
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PolicyIcon
              policy={{ iconKey, templateId: initial?.templateId ?? null }}
              size={32}
            />
            {initial ? '编辑国策' : '新建国策'}
          </DialogTitle>
          <DialogDescription>
            国策要小到最摆烂的一天也能做到；判定标准必须是能二元回答的问句。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    国策名称{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：睡前 1 小时手机放客厅"
                      maxLength={50}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">图标</p>
              <PolicyIconPicker value={iconKey} onChange={setIconKey} />
              <p className="text-xs text-muted-foreground">
                图标会显示在手牌、树节点与每日结算里，挑一个一眼能认出的。
              </p>
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    类型{' '}
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
                        <SelectValue placeholder="请选择类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TYPE_OPTIONS.map(
                        (option: { value: RsipUserPolicyType; label: string }) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    被动型靠环境阻断；半被动型挂在固定触发点上；主动型需定时投入。
                  </p>
                  {policyType === 'active' && (
                    <div className="mt-1.5 space-y-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                      <p className="font-medium">主动型国策有两个固有缺陷：</p>
                      <p>1. 时间公地悲剧：触发时间模糊，「什么时候做」会被一路推到最后。</p>
                      <p>2. 选项堆积：每条主动国策都是常驻待办，数量越多越消耗决策负荷。</p>
                      <p className="text-muted-foreground">建议优先改写为被动/半被动型；主动型全局最多 3 条。</p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    触发条件{' '}
                    {policyType === 'semi_passive' ? (
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    ) : null}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：23:00 闹钟响"
                      disabled={policyType !== 'semi_passive'}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {policyType === 'semi_passive'
                      ? '填写一个已经每天固定发生的事件，让国策自动跟随。'
                      : '仅半被动型需要触发条件。'}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="judge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    判定标准{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="是否…？" maxLength={80} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    以「是否」或「有没有」开头的二元问句，答案只能是「是 / 否」。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leverage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    杠杆来源{' '}
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
                        <SelectValue placeholder="这条国策借的是什么能量" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEVERAGE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    好国策是放大器，借因果链/惯性/环境/姿势/本能/数学结构的力量，而不是靠意志力。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="relevant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>相关性</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value: string) => field.onChange(value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="是否作用于有效干预节点" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">相关（能影响宏观稳态）</SelectItem>
                      <SelectItem value="false">不相关（只在微观尺度徒劳）</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    「在沙发上硬扛手机」是不相关的；改变进门后的动作才是相关的。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {groupOptions.length > 0 && (
              <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>国策组</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: string) => field.onChange(value)}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="选择国策组">
                          <SelectValue placeholder="不分组" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={GROUP_NONE}>不分组</SelectItem>
                        {groupOptions.map((group: RsipPolicyGroup) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      分组是跨树的分类标签，只影响筛选查看，不影响结算与回滚。
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '保存中…' : initial ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PolicyEditorDialog;
