import React, { useMemo, useState } from 'react';
import { History, NotebookPen, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { RsipRollbackEvent } from '@shared/api.interface';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { ScrollArea } from '@client/src/components/ui/scroll-area';
import { Textarea } from '@client/src/components/ui/textarea';
import { safeApiCall, updateRollbackNote } from '@client/src/api/rsip';

interface RollbackLogDialogProps {
  open: boolean;
  rollbacks: RsipRollbackEvent[];
  onClose: () => void;
  /** 复盘保存后刷新总览 */
  onChanged?: () => void;
}

type RangeKey = 'all' | '7' | '30';
type ScaleKey = 'all' | 'chain' | 'single';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '7', label: '近7天' },
  { key: '30', label: '近30天' },
];

const SCALE_OPTIONS: { key: ScaleKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'chain', label: '有连带' },
  { key: 'single', label: '仅自身' },
];

/**
 * 崩塌即调试器：原文给出的四个排查方向，外加「状态整体不稳 → 冻结」。
 * 点选后追加到教训里，用户可以继续改写。
 */
const DEBUG_DIRECTIONS: { label: string; lesson: string }[] = [
  { label: '要求过高', lesson: '要求过高 → 拆成两三条更小的国策' },
  { label: '累了就崩', lesson: '疲劳时崩 → 在它前面补一条防疲劳的国策' },
  { label: '忘了', lesson: '忘了 → 补一条提醒，或避开容易忘的状态' },
  { label: '根本做不到', lesson: '当前做不到 → 换成更合理的要求' },
  { label: '状态整体不稳', lesson: '整体状态不稳 → 下次先用水密隔舱冻结' },
];

/** 同一条国策崩塌达到这个次数，提示先绕过去 */
const REPEAT_THRESHOLD = 2;

function todayStr(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function daysSince(dateStr: string): number {
  const ms = Date.parse(todayStr()) - Date.parse(dateStr);
  return Math.floor(ms / 86400000);
}

/** sweptCount 含触发节点自身；连带 = 其余被一起摘下的子孙 */
function chainedCount(event: RsipRollbackEvent): number {
  return Math.max(event.sweptCount - 1, 0);
}

interface NoteEditorProps {
  event: RsipRollbackEvent;
  onSaved: () => void;
  onCancel: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ event, onSaved, onCancel }) => {
  const [scenario, setScenario] = useState<string>(event.reasonScenario ?? '');
  const [lesson, setLesson] = useState<string>(event.lesson ?? '');
  const [saving, setSaving] = useState<boolean>(false);

  const appendDirection = (text: string): void => {
    setLesson((prev: string) => {
      if (prev.includes(text)) return prev;
      return prev.trim() ? `${prev.trim()}；${text}` : text;
    });
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    const result = await safeApiCall(() =>
      updateRollbackNote(event.id, {
        reasonScenario: scenario.trim() || null,
        lesson: lesson.trim() || null,
      }),
    );
    setSaving(false);
    if ('message' in result) {
      toast.error(result.message);
      return;
    }
    toast.success('复盘已记下');
    onSaved();
  };

  return (
    <div className="mt-3 space-y-2.5 border-t border-border pt-3">
      <div className="space-y-1">
        <label
          htmlFor={`scenario-${event.id}`}
          className="text-[11px] text-muted-foreground"
        >
          直接触发场景
        </label>
        <Input
          id={`scenario-${event.id}`}
          value={scenario}
          maxLength={200}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setScenario(e.target.value)
          }
          placeholder="例如：加班到 1 点，回家直接躺下"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">调试方向（可多选）</p>
        <div className="flex flex-wrap gap-1.5">
          {DEBUG_DIRECTIONS.map((direction) => (
            <button
              key={direction.label}
              type="button"
              onClick={() => appendDirection(direction.lesson)}
              className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-foreground/75 transition-colors hover:border-gold/50 hover:text-gold-soft"
            >
              {direction.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label
          htmlFor={`lesson-${event.id}`}
          className="text-[11px] text-muted-foreground"
        >
          教训 / 下一轮怎么改
        </label>
        <Textarea
          id={`lesson-${event.id}`}
          value={lesson}
          maxLength={500}
          rows={3}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setLesson(e.target.value)
          }
          placeholder="例如：主动型放在下班后风险高，改成午休时段"
          className="text-xs"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存复盘'}
        </Button>
      </div>
    </div>
  );
};

const RollbackLogDialog: React.FC<RollbackLogDialogProps> = ({
  open,
  rollbacks,
  onClose,
  onChanged,
}) => {
  const [keyword, setKeyword] = useState<string>('');
  const [range, setRange] = useState<RangeKey>('all');
  const [scale, setScale] = useState<ScaleKey>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  /** 每条国策累计崩塌次数，用于「农村包围城市」提示 */
  const collapseCountByPolicy = useMemo<Map<string, number>>(() => {
    const counts = new Map<string, number>();
    rollbacks.forEach((event: RsipRollbackEvent) => {
      counts.set(
        event.triggerPolicyId,
        (counts.get(event.triggerPolicyId) ?? 0) + 1,
      );
    });
    return counts;
  }, [rollbacks]);

  const unreviewedCount: number = rollbacks.filter(
    (event: RsipRollbackEvent) => !event.reasonScenario && !event.lesson,
  ).length;

  const filtered = useMemo<RsipRollbackEvent[]>(() => {
    const normalized = keyword.trim().toLowerCase();
    return rollbacks
      .filter((event: RsipRollbackEvent) => {
        if (range !== 'all' && daysSince(event.occurredOn) > Number(range)) {
          return false;
        }
        if (scale === 'chain' && chainedCount(event) < 1) {
          return false;
        }
        if (scale === 'single' && chainedCount(event) !== 0) {
          return false;
        }
        if (normalized) {
          const haystack = [
            event.triggerPolicyName,
            event.reasonScenario ?? '',
            event.lesson ?? '',
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(normalized)) {
            return false;
          }
        }
        return true;
      })
      .sort(
        (a: RsipRollbackEvent, b: RsipRollbackEvent) =>
          Date.parse(b.occurredOn) - Date.parse(a.occurredOn),
      );
  }, [rollbacks, keyword, range, scale]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) {
          setEditingId(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History size={16} className="text-muted-foreground/75" />
            崩塌日志
          </DialogTitle>
          <DialogDescription>
            崩塌是最高效的调试器：它说明这条路径还维持得不够自然。回滚的节点已回到手牌，内化进度保留。
          </DialogDescription>
        </DialogHeader>

        {rollbacks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-foreground/20 px-4 py-8 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              还没有崩塌记录——没有崩塌不代表成功，有崩塌也不代表失败，都是路径搜索。
            </p>
          </div>
        ) : (
          <>
            {unreviewedCount > 0 && (
              <p className="rounded-md border border-gold/25 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-foreground/80">
                有 {unreviewedCount} 次崩塌还没复盘。花一分钟记下触发场景，下一轮就知道该拆小、补前置，还是先绕过去。
              </p>
            )}
            <div className="space-y-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/75"
                />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索国策名、原因或教训"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1">
                  {RANGE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.key}
                      variant={range === opt.key ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setRange(opt.key)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {SCALE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.key}
                      variant={scale === opt.key ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setScale(opt.key)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <ScrollArea className="max-h-[52vh] pr-2">
              {filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed border-foreground/20 px-4 py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    没有符合筛选条件的崩塌记录。
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {filtered.map((event: RsipRollbackEvent) => {
                    const chained: number = chainedCount(event);
                    const repeat: number =
                      collapseCountByPolicy.get(event.triggerPolicyId) ?? 1;
                    const reviewed: boolean = Boolean(
                      event.reasonScenario || event.lesson,
                    );
                    return (
                      <li
                        key={event.id}
                        className="rounded-lg border border-border bg-muted/40 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground/75">
                            {event.occurredOn}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {repeat >= REPEAT_THRESHOLD && (
                              <Badge
                                variant="outline"
                                className="px-1.5 text-[11px] font-normal text-gold-soft tabular-nums"
                              >
                                第 {repeat} 次崩塌
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="px-1.5 text-[11px] font-normal text-muted-foreground tabular-nums"
                            >
                              {chained > 0 ? `连带 ${chained} 条` : '仅自身'}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-foreground">
                          {event.triggerPolicyName}
                        </p>
                        {event.reasonScenario && (
                          <p className="mt-1 break-words text-xs leading-relaxed text-foreground/70">
                            场景：{event.reasonScenario}
                          </p>
                        )}
                        {event.lesson && (
                          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                            教训：{event.lesson}
                          </p>
                        )}
                        {repeat >= REPEAT_THRESHOLD && (
                          <p className="mt-2 rounded-md bg-background/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                            这条国策已经崩塌 {repeat} 次，说明它在当前的边界条件里还格格不入。
                            不必死磕：先去点亮几条简单的「农村」国策，等整体状态改善后再回来。
                          </p>
                        )}
                        {editingId === event.id ? (
                          <NoteEditor
                            event={event}
                            onCancel={() => setEditingId(null)}
                            onSaved={() => {
                              setEditingId(null);
                              onChanged?.();
                            }}
                          />
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-2 h-7 px-2 text-xs text-muted-foreground hover:text-gold-soft"
                            onClick={() => setEditingId(event.id)}
                          >
                            <NotebookPen size={13} />
                            {reviewed ? '修改复盘' : '复盘'}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>

            <p className="text-[11px] text-muted-foreground/75">
              共 {filtered.length} / {rollbacks.length} 条记录
            </p>
          </>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            aria-label="关闭崩塌日志"
            onClick={onClose}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RollbackLogDialog;
