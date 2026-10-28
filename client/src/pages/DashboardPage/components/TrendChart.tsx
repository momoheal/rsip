import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BarChart3 } from 'lucide-react';
import type { RsipDashboardDailyPoint } from '@shared/api.interface';
import SimpleECharts from '@client/src/components/SimpleECharts';
import SectionCard, { SectionEmpty } from './SectionCard';
import './chartTheme';

const DAY_COUNT = 30;
const LIT_COLOR = '#ecb443';
const VIOLATED_COLOR = '#5b6b8a';

interface TrendChartProps {
  daily: RsipDashboardDailyPoint[];
}

function formatDate(date: Date): string {
  const year: number = date.getFullYear();
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 近 30 天结算趋势：点亮（amber）vs 违反（中性灰） */
const TrendChart: React.FC<TrendChartProps> = ({ daily }) => {
  const option = useMemo<EChartsOption>(() => {
    const byDate = new Map<string, RsipDashboardDailyPoint>();
    daily.forEach((point: RsipDashboardDailyPoint) => {
      byDate.set(point.date, point);
    });

    const labels: string[] = [];
    const litCounts: number[] = [];
    const violatedCounts: number[] = [];
    const today = new Date();

    for (let offset = DAY_COUNT - 1; offset >= 0; offset -= 1) {
      const date = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - offset,
      );
      const key: string = formatDate(date);
      const point: RsipDashboardDailyPoint | undefined = byDate.get(key);
      labels.push(key.slice(5));
      litCounts.push(point?.litCount ?? 0);
      violatedCounts.push(point?.violatedCount ?? 0);
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
        data: labels,
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#2a3040' } },
        axisLabel: {
          color: '#7c8397',
          fontSize: 10,
          interval: 4,
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
          name: '点亮',
          type: 'bar',
          data: litCounts,
          barMaxWidth: 10,
          itemStyle: { color: LIT_COLOR, borderRadius: [2, 2, 0, 0] },
        },
        {
          name: '违反',
          type: 'bar',
          data: violatedCounts,
          barMaxWidth: 10,
          itemStyle: { color: VIOLATED_COLOR, borderRadius: [2, 2, 0, 0] },
        },
      ],
    };
  }, [daily]);

  return (
    <SectionCard
      title="近 30 天结算趋势"
      icon={<BarChart3 size={16} />}
      hint="每日判定为满足 / 违反的节点数"
    >
      {daily.length === 0 ? (
        <SectionEmpty text="还没有结算记录。完成第一次每日结算后，这里会出现趋势。" />
      ) : (
        <SimpleECharts option={option} className="h-[300px] w-full" />
      )}
    </SectionCard>
  );
};

export default TrendChart;
