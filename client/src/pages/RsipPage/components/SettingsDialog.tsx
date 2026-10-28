import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import type { RsipSettingsInput, RsipUserSettings } from '@shared/api.interface';
import { extractErrorMessage, updateSettings } from '@client/src/api/rsip';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

interface SettingsDialogProps {
  open: boolean;
  settings: RsipUserSettings;
  onClose: () => void;
  onSaved: () => void;
}

const HOURS: string[] = Array.from(
  { length: 24 },
  (_item: unknown, index: number) => String(index).padStart(2, '0'),
);

const MINUTES: string[] = ['00', '15', '30', '45'];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const settingsSchema = z
  .object({
    reviewWindowStart: z.string().regex(TIME_PATTERN, '请选择开始时间'),
    reviewWindowEnd: z.string().regex(TIME_PATTERN, '请选择结束时间'),
  })
  .superRefine((value, ctx) => {
    if (value.reviewWindowStart === value.reviewWindowEnd) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewWindowEnd'],
        message: '结束时间不能与开始时间相同',
      });
    }
  });

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SplitTime {
  hour: string;
  minute: string;
}

function splitTime(value: string): SplitTime {
  const [hour = '00', minute = '00'] = value.split(':');
  return { hour, minute };
}

function joinTime(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

function toFormValues(settings: RsipUserSettings): SettingsFormData {
  return {
    reviewWindowStart: settings.reviewWindowStart,
    reviewWindowEnd: settings.reviewWindowEnd,
  };
}

interface TimeSelectPairProps {
  hour: string;
  minute: string;
  label: string;
  onChange: (value: string) => void;
}

const TimeSelectPair: React.FC<TimeSelectPairProps> = ({
  hour,
  minute,
  label,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={hour}
        onValueChange={(next: string) => onChange(joinTime(next, minute))}
      >
        <FormControl>
          <SelectTrigger aria-label={`${label}小时`}>
            <SelectValue placeholder="时" />
          </SelectTrigger>
        </FormControl>
        <SelectContent className="max-h-64">
          {HOURS.map((item: string) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span aria-hidden="true" className="text-sm text-muted-foreground/75">
        :
      </span>
      <Select
        value={minute}
        onValueChange={(next: string) => onChange(joinTime(hour, next))}
      >
        <SelectTrigger className="w-20" aria-label={`${label}分钟`}>
          <SelectValue placeholder="分" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((item: string) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  settings,
  onClose,
  onSaved,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const prevOpenRef = useRef<boolean>(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(settings),
  });

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      form.reset(toFormValues(settings));
    }
    prevOpenRef.current = open;
  }, [open, settings, form]);

  const handleSubmit = form.handleSubmit(async (data: SettingsFormData) => {
    const input: RsipSettingsInput = {
      reviewWindowStart: data.reviewWindowStart,
      reviewWindowEnd: data.reviewWindowEnd,
    };
    setSubmitting(true);
    try {
      await updateSettings(input);
      toast.success('结算窗口已更新');
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
            <Clock size={16} className="text-muted-foreground/75" />
            设置
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            结算窗口决定每天什么时候提醒你逐条回答。窗口可以跨零点
            （如 22:30 - 01:00）；窗口外仍可手动结算，会记一次迟到。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <FormField
                control={form.control}
                name="reviewWindowStart"
                render={({ field }) => {
                  const time: SplitTime = splitTime(field.value);
                  return (
                    <FormItem className="flex-1">
                      <FormLabel>
                        结算窗口开始{' '}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FormLabel>
                      <TimeSelectPair
                        hour={time.hour}
                        minute={time.minute}
                        label="结算窗口开始"
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="reviewWindowEnd"
                render={({ field }) => {
                  const time: SplitTime = splitTime(field.value);
                  return (
                    <FormItem className="flex-1">
                      <FormLabel>
                        结算窗口结束{' '}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </FormLabel>
                      <TimeSelectPair
                        hour={time.hour}
                        minute={time.minute}
                        label="结算窗口结束"
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              默认 21:30 - 23:30。当天没结算不会被判负，国策保持点亮，连续漏结算会另作提示。
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '保存中…' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
