import * as echarts from 'echarts';

/**
 * 仪表盘图表主题（名称固定为 ud，供 ReactECharts theme="ud" 使用）。
 * 色板：牌桌深色底 + 琥珀金点缀，不使用红色系。
 */
const NEUTRAL_TEXT = '#9aa1b4';
const NEUTRAL_AXIS = '#2a3040';
const NEUTRAL_SPLIT = '#1d2230';

const dashboardTheme = {
  color: ['#ecb443', '#5b6b8a', '#3c4760', '#d97706', '#64748b'],
  backgroundColor: 'transparent',
  tooltip: {
    backgroundColor: '#161b26',
    borderColor: '#2f3648',
    textStyle: { color: '#ece6d8', fontSize: 12 },
  },
  textStyle: {
    color: NEUTRAL_TEXT,
    fontSize: 12,
  },
  legend: {
    textStyle: {
      color: NEUTRAL_TEXT,
      fontSize: 11,
    },
  },
  categoryAxis: {
    axisLine: { show: true, lineStyle: { color: NEUTRAL_AXIS } },
    axisTick: { show: false, lineStyle: { color: NEUTRAL_AXIS } },
    axisLabel: { color: '#7c8397', fontSize: 10 },
    splitLine: { show: false, lineStyle: { color: NEUTRAL_SPLIT } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#7c8397', fontSize: 10 },
    splitLine: { show: true, lineStyle: { color: NEUTRAL_SPLIT } },
  },
};

echarts.registerTheme('ud', dashboardTheme);
