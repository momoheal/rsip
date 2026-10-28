import React from 'react';
import { Archive } from 'lucide-react';
import type { RsipDashboardArchivedTree } from '@shared/api.interface';
import SectionCard, { SectionEmpty } from './SectionCard';

interface ArchivedTreeListProps {
  archivedTrees: RsipDashboardArchivedTree[];
}

/** 归档树列表：名称 + 归档日期 + 节点数 */
const ArchivedTreeList: React.FC<ArchivedTreeListProps> = ({
  archivedTrees,
}) => {
  return (
    <SectionCard
      title="归档树"
      icon={<Archive size={16} />}
      hint="归档后节点退回手牌，内化进度保留"
    >
      {archivedTrees.length === 0 ? (
        <SectionEmpty text="还没有归档的树。归档一棵树后，它会出现在这里。" />
      ) : (
        <ul className="space-y-3">
          {archivedTrees.map((tree: RsipDashboardArchivedTree) => (
            <li
              key={tree.id}
              className="rounded-lg border border-border bg-muted/40 p-3"
            >
              <p className="break-words text-sm font-medium text-foreground">
                {tree.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/75">
                <span className="tabular-nums">
                  归档于 {tree.archivedAt.slice(0, 10)}
                </span>
                <span className="tabular-nums">{tree.nodeCount} 个节点</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

export default ArchivedTreeList;
