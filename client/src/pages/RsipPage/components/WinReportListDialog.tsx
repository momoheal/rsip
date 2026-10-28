import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PartyPopper, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import type {
  RsipMilestoneType,
  RsipWinReport,
} from '@shared/api.interface';
import { createWinReport, safeApiCall } from '@client/src/api/rsip';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
import { Input } from '@client/src/components/ui/input';
import { ScrollArea } from '@client/src/components/ui/scroll-area';
import { Textarea } from '@client/src/components/ui/textarea';

const MILESTONE_LABELS: Record<RsipMilestoneType, string> = {
  streak_7: '连续点亮 7 天',
  streak_21: '连续点亮 21 天',
  streak_100: '连续点亮 100 天',
  cumulative_30: '累计点亮 30 天',
  cumulative_100: '累计点亮 100 天',
  cumulative_365: '累计点亮 365 天',
  clean_7: '连续清洁结算 7 天',
  clean_30: '连续清洁结算 30 天',
};

function milestoneLabel(type: RsipMilestoneType | null): string | null {
  if (!type) return null;
  return MILESTONE_LABELS[type] ?? null;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const reportSchema = z.object({
  title: z.string().trim().min(1, '请填写标题').max(100, '标题不超过 100 字'),
  content: z
    .string()
    .trim()
    .min(1, '请填写正文')
    .max(2000, '正文不超过 2000 字'),
});

type ReportFormData = z.infer<typeof reportSchema>;

const EMPTY_FORM: ReportFormData = { title: '', content: '' };

interface WinReportListDialogProps {
  open: boolean;
  winReports: RsipWinReport[];
  onClose: () => void;
  /** 手动发布成功后刷新总览 */
  onCreated: () => void;
}

const WinReportListDialog: React.FC<WinReportListDialogProps> = ({
  open,
  winReports,
  onClose,
  onCreated,
}) => {
  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    form.reset(EMPTY_FORM);
  }, [open, form]);

  const handleSubmit = form.handleSubmit(async (data: ReportFormData) => {
    setSubmitting(true);
    const result = await safeApiCall(() =>
      createWinReport({
        title: data.title.trim(),
        content: data.content.trim(),
      }),
    );
    setSubmitting(false);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success('喜报已发布');
    form.reset(EMPTY_FORM);
    setComposerOpen(false);
    onCreated();
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
          <DialogTitle className="flex items-center gap-1.5">
            <PartyPopper size={16} className="text-amber-500" />
            喜报
          </DialogTitle>
          <DialogDescription>
            里程碑自动生成与手动发布的高光记录，只做记录，不参与判定。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Button
              variant={composerOpen ? 'outline' : 'secondary'}
              size="sm"
              aria-label={composerOpen ? '收起写喜报' : '写喜报'}
              aria-expanded={composerOpen}
              onClick={() => setComposerOpen((prev: boolean) => !prev)}
            >
              <PenLine size={15} />
              {composerOpen ? '收起' : '写喜报'}
            </Button>
          </div>

          {composerOpen && (
            <Form {...form}>
              <form
                onSubmit={handleSubmit}
                className="rounded-lg border border-border bg-muted/50 p-4"
              >
                <div className="flex flex-col gap-3">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          标题{' '}
                          <span
                            aria-hidden="true"
                            className="text-destructive"
                          >
                            *
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：连续两周按时结算"
                            maxLength={100}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          正文{' '}
                          <span
                            aria-hidden="true"
                            className="text-destructive"
                          >
                            *
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="记下这件事本身：发生了什么、做了什么调整。"
                            className="min-h-24 bg-card"
                            maxLength={2000}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="取消写喜报"
                      disabled={submitting}
                      onClick={() => {
                        form.reset(EMPTY_FORM);
                        setComposerOpen(false);
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      aria-label="发布喜报"
                      disabled={submitting}
                    >
                      {submitting ? '发布中…' : '发布'}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          )}

          {winReports.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-foreground/20 p-6 text-center">
              <PartyPopper size={24} className="mb-2 text-muted-foreground/45" />
              <p className="text-sm font-medium text-foreground/85">暂无喜报</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                达成里程碑时会自动记录，也可以随时手动写一条。
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[42vh] pr-3">
              <ul className="divide-y divide-border">
                {winReports.map((report: RsipWinReport) => {
                  const label: string | null = milestoneLabel(
                    report.milestoneType,
                  );
                  return (
                    <li
                      key={report.id}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {report.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1.5 text-[11px] font-normal text-muted-foreground"
                        >
                          {report.source === 'milestone' ? '里程碑' : '手动'}
                        </Badge>
                        {label && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-amber-400/30 px-1.5 text-[11px] font-normal text-amber-300"
                          >
                            {label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 break-words text-xs leading-relaxed text-foreground/70">
                        {report.content}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/75">
                        {report.relatedPolicyName && (
                          <span className="truncate">
                            相关国策：{report.relatedPolicyName}
                          </span>
                        )}
                        <span className="tabular-nums">
                          {formatCreatedAt(report.createdAt)}
                        </span>
                      </div>
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
            aria-label="关闭喜报列表"
            onClick={onClose}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WinReportListDialog;
