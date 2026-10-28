import React from 'react';
import { History } from 'lucide-react';
import {
  UNIT_KINDS,
  type CtdpLogEntry,
  type CtdpUnitKind,
} from '@client/src/store/ctdpEngine';

interface FocusLogProps {
  log: CtdpLogEntry[];
}

const UNIT_LABEL: Record<CtdpUnitKind, string> = Object.fromEntries(
  UNIT_KINDS.map((unit) => [unit.key, unit.label]),
) as Record<CtdpUnitKind, string>;

function describe(entry: CtdpLogEntry): string {
  const chainName = entry.chain === 'main' ? '主链' : entry.chain === 'aux' ? '预约链' : '侦查';
  switch (entry.result) {
    case 'done':
      return entry.chain === 'main'
        ? `主链 #${entry.chainNo} 完成`
        : `预约链 #${entry.chainNo} 履约`;
    case 'reset':
      return `${chainName}在 #${entry.chainNo} 清零${entry.note ? `（${entry.note}）` : ''}`;
    case 'precedent':
      return `${chainName}新判例：允许「${entry.note ?? ''}」`;
    case 'scout_done':
      return `侦查 #${entry.chainNo} 完成`;
    case 'scout_dropped':
      return '侦查提前结束（不影响主链）';
    default:
      return chainName;
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

/** 最近的专注记录 */
const FocusLog: React.FC<FocusLogProps> = ({ log }) => (
  <section className="rsip-panel p-4" aria-label="专注记录">
    <h2 className="flex items-center gap-2 font-serif text-sm font-bold text-foreground">
      <History size={15} className="text-gold-soft/80" />
      最近记录
    </h2>
    {log.length === 0 ? (
      <p className="mt-3 text-xs text-muted-foreground">
        还没有记录。第一次成功的专注会成为主链的创世区块 #1。
      </p>
    ) : (
      <ul className="mt-3 divide-y divide-border">
        {log.slice(0, 12).map((entry: CtdpLogEntry) => (
          <li key={entry.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <span
              className={
                entry.result === 'done' || entry.result === 'scout_done'
                  ? 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold'
                  : 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60'
              }
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground/85">{describe(entry)}</p>
              {(entry.goal || entry.unit) && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {entry.unit ? `${UNIT_LABEL[entry.unit]}单元` : ''}
                  {entry.goal ? ` · ${entry.goal}` : ''}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatTime(entry.at)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default FocusLog;
