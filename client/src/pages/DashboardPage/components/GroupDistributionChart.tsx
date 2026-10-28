import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { Tags } from 'lucide-react';
import type { RsipDashboardGroupStat } from '@shared/api.interface';
import SimpleECharts from '@client/src/components/SimpleECharts';
import SectionCard, { SectionEmpty } from './SectionCard';
import './chartTheme';

interface GroupDistributionChartProps {
  groups: RsipDashboardGroupStat[];
  /** 全部国策累计点亮天数之和，用于推导未分组桶 */
  totalCumulativeLitDays: number;
}

interface GroupBucket {
  name: string;
  value: number;
  color: string;
}

const GROUPED_COLOR = '#ecb443';
const UNGROUPED_COLOR = '#5b6b8a';

/** 国策组点亮分布：按组累计点亮天数 + 未分组桶 */
const GroupDistributionChart: React.FC<GroupDistributionChartProps> = ({
  groups,
  totalCumulativeLitDays,
}) => {
  const option = useMemo<EChartsOption>(() => {
    const groupedDays: number = groups.reduce(
      (sum: number, group: RsipDashboardGroupStat) =>
        sum + group.totalCumulativeLitDays,
      0,
    );
    const ungroupedDays: number = Math.max(
      0,
      totalCumulativeLitDays - groupedDays,
    );

    const buckets: GroupBucket[] = groups.map(
      (group: RsipDashboardGroupStat) => ({
        name: group.name,
        value: group.totalCumulativeLitDays,
        color: GROUPED_COLOR,
      }),
    );
    if (ungroupedDays > 0) {
      buckets.push({
        name: '未分组',
        value: ungroupedDays,
        color: UNGROUPED_COLOR,
      });
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: '#9aa1b4', fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 16, bottom: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: buckets.map((bucket: GroupBucket) => bucket.name),
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#2a3040' } },
        axisLabel: {
          color: '#9aa1b4',
          fontSize: 10,
          interval: 0,
          formatter: (value: string) =>
            value.length > 6 ? `${value.slice(0, 6)}…` : value,
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        axisLabel: { color: '#7c8397', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2230' } },
      },
      series: [
        {
          name: '累计点亮天数',
          type: 'bar',
          barMaxWidth: 28,
          data: buckets.map((bucket: GroupBucket) => ({
            value: bucket.value,
            itemStyle: {
              color: bucket.color,
              borderRadius: [2, 2, 0, 0],
            },
          })),
        },
      ],
    };
  }, [groups, totalCumulativeLitDays]);

  return (
    <SectionCard
      title="国策组点亮分布"
      icon={<Tags size={16} />}
      hint="按组统计累计点亮天数"
    >
      {groups.length === 0 ? (
        <SectionEmpty text="还没有国策组。创建分组并归类国策后，这里会显示分布。" />
      ) : (
        <SimpleECharts option={option} className="h-[300px] w-full" />
      )}
    </SectionCard>
  );
};

export default GroupDistributionChart;
