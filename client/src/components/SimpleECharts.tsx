import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface SimpleEChartsProps {
  option: EChartsOption;
  className?: string;
  theme?: string;
}

/**
 * 轻量 echarts React 绑定：直接 init + setOption。
 *
 * 不使用 echarts-for-react 的「临时实例 + finished 事件再重建」逻辑——
 * 该逻辑在 echarts 6 下空实例不再触发 finished，会导致永久空白。
 */
const SimpleECharts: React.FC<SimpleEChartsProps> = ({
  option,
  className,
  theme = 'ud',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const instance = echarts.init(containerRef.current, theme);
    instanceRef.current = instance;

    const handleResize = () => {
      instance.resize();
    };
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    instanceRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} className={className} />;
};

export default SimpleECharts;
