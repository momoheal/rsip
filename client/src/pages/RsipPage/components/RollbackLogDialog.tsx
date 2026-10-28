import React, { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
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

interface RollbackLogDialogProps {
  open: boolean;
  rollbacks: RsipRollbackEvent[];
  onClose: () => void;
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

const RollbackLogDialog: React.FC<RollbackLogDialogProps> = ({
  open,
  rollbacks,
  onClose,
}) => {
  const [keyword, setKeyword] = useState<string>('');
  const [range, setRange] = useState<RangeKey>('all');
  const [scale, setScale] = useState<ScaleKey>('all');

  const filtered = useMemo<RsipRollbackEvent[]>(() => {
    const normalized = keyword.trim().toLowerCase();
    return rollbacks
      .filter((event: RsipRollbackEvent) => {
        if (range !== 'all' && daysSince(event.occurredOn) > Number(range)) {
          return false;
        }
        if (scale === 'chain' && event.sweptCount < 1) {
          return false;
        }
        if (scale === 'single' && event.sweptCount !== 0) {
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
            崩塌是路径搜索的一部分。回滚的节点已回到手牌，内化进度保留。
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
                  {filtered.map((event: RsipRollbackEvent) => (
                    <li
                      key={event.id}
                      className="rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground/75">
                          {event.occurredOn}
                        </span>
                        <Badge
                          variant="outline"
                          className="px-1.5 text-[11px] font-normal text-muted-foreground tabular-nums"
                        >
                          连带熄灭 {event.sweptCount}
                        </Badge>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium text-foreground">
                        {event.triggerPolicyName}
                      </p>
                      {event.reasonScenario && (
                        <p className="mt-1 break-words text-xs leading-relaxed text-foreground/70">
                          {event.reasonScenario}
                        </p>
                      )}
                      {event.lesson && (
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                          教训：{event.lesson}
                        </p>
                      )}
                    </li>
                  ))}
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
