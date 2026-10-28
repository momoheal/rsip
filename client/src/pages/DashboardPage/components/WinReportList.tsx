import React from 'react';
import { PartyPopper } from 'lucide-react';
import type { RsipWinReport } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';
import SectionCard, { SectionEmpty } from './SectionCard';

interface WinReportListProps {
  winReports: RsipWinReport[];
}

/** 喜报时间线：amber 点缀，新在前 */
const WinReportList: React.FC<WinReportListProps> = ({ winReports }) => {
  return (
    <SectionCard
      title="喜报"
      icon={<PartyPopper size={16} />}
      hint="里程碑自动生成与手动发布"
    >
      {winReports.length === 0 ? (
        <SectionEmpty text="还没有喜报。里程碑达到时自动生成，也可以随时手动写一条。" />
      ) : (
        <ul className="space-y-3">
          {winReports.map((report: RsipWinReport) => (
            <li
              key={report.id}
              className="rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className="border-amber-400/30 bg-amber-400/10 px-1.5 text-[11px] font-normal text-amber-300"
                >
                  {report.source === 'manual' ? '手动' : '里程碑'}
                </Badge>
                <span className="text-xs tabular-nums text-muted-foreground/75">
                  {report.createdAt.slice(0, 10)}
                </span>
              </div>
              <div className="mt-1.5 flex items-start gap-1.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                  aria-hidden="true"
                />
                <p className="break-words text-sm font-medium text-foreground">
                  {report.title}
                </p>
              </div>
              {report.content && (
                <p className="mt-1 break-words text-xs leading-relaxed text-foreground/70">
                  {report.content}
                </p>
              )}
              {report.relatedPolicyName && (
                <p className="mt-1 break-words text-xs text-muted-foreground/75">
                  关联国策：{report.relatedPolicyName}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

export default WinReportList;
