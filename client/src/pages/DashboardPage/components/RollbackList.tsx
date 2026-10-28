import React from 'react';
import { History } from 'lucide-react';
import type { RsipRollbackEvent } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';
import SectionCard, { SectionEmpty } from './SectionCard';

interface RollbackListProps {
  rollbacks: RsipRollbackEvent[];
}

/** 崩塌记录：中性文案，不做灾难化表达 */
const RollbackList: React.FC<RollbackListProps> = ({ rollbacks }) => {
  return (
    <SectionCard
      title="崩塌记录"
      icon={<History size={16} />}
      hint="崩塌是路径搜索的一部分，内化进度保留"
    >
      {rollbacks.length === 0 ? (
        <SectionEmpty text="还没有崩塌记录。没有崩塌不代表成功，有崩塌也不代表失败。" />
      ) : (
        <ul className="space-y-3">
          {rollbacks.map((event: RsipRollbackEvent) => (
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
              <p className="mt-1.5 break-words text-sm font-medium text-foreground">
                {event.triggerPolicyName}
              </p>
              {event.reasonScenario && (
                <p className="mt-1 break-words text-xs leading-relaxed text-foreground/70">
                  {event.reasonScenario}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

export default RollbackList;
