import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { TreePine } from 'lucide-react';
import type { RsipDashboardTreeStat } from '@shared/api.interface';
import SimpleECharts from '@client/src/components/SimpleECharts';
import SectionCard, { SectionEmpty } from './SectionCard';
import './chartTheme';

interface TreeProgressChartProps {
  trees: RsipDashboardTreeStat[];
}

/** 各树进度：水平条形图，节点数 vs 累计点亮天数 */
const TreeProgressChart: React.FC<TreeProgressChartProps> = ({ trees }) => {
  const chartHeight: number = Math.max(300, trees.length * 44 + 96);

  const option = useMemo<EChartsOption>(() => {
    // ECharts 类目轴自下而上绘制，反转后第一棵树显示在顶部
    const ordered: RsipDashboardTreeStat[] = [...trees].reverse();
    const names: string[] = ordered.map(
      (tree: RsipDashboardTreeStat) => tree.name,
    );

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
      grid: { left: 8, right: 24, top: 12, bottom: 48, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        axisLabel: { color: '#7c8397', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2230' } },
      },
      yAxis: {
        type: 'category',
        data: names,
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#2a3040' } },
        axisLabel: { color: '#9aa1b4', fontSize: 11 },
      },
      series: [
        {
          name: '节点数',
          type: 'bar',
          data: ordered.map((tree: RsipDashboardTreeStat) => tree.nodeCount),
          barMaxWidth: 12,
          itemStyle: { color: '#5b6b8a', borderRadius: [0, 2, 2, 0] },
        },
        {
          name: '累计点亮天数',
          type: 'bar',
          data: ordered.map(
            (tree: RsipDashboardTreeStat) => tree.totalCumulativeLitDays,
          ),
          barMaxWidth: 12,
          itemStyle: { color: '#ecb443', borderRadius: [0, 2, 2, 0] },
        },
      ],
    };
  }, [trees]);

  return (
    <SectionCard
      title="各树进度"
      icon={<TreePine size={16} />}
      hint="每棵树的节点数与累计点亮天数"
    >
      {trees.length === 0 ? (
        <SectionEmpty text="还没有国策树。建一棵树后，这里会显示各树的进度。" />
      ) : (
        <div style={{ height: `${chartHeight}px` }} className="w-full">
          <SimpleECharts option={option} className="h-full w-full" />
        </div>
      )}
    </SectionCard>
  );
};

export default TreeProgressChart;
