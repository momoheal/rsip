import React from 'react';
import { Skeleton } from '@client/src/components/ui/skeleton';

/** 仪表盘加载骨架：统计卡片 + 图表 + 列表 */
const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index: number) => (
          <Skeleton key={index} className="h-[92px] w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[372px] w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[372px] w-full rounded-lg" />
        <Skeleton className="h-[372px] w-full rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((index: number) => (
          <Skeleton key={index} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
};

export default DashboardSkeleton;
