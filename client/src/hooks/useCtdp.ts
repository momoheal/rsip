import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ctdpEngine, type CtdpState } from '@client/src/store/ctdpEngine';

/**
 * CTDP 专注状态：每秒推进一次（预约超时、专注到点），并把剩余时间暴露给页面。
 * completedNo 为刚刚自动完成的主链节点号，页面消费后调用 clearCompleted。
 */
export function useCtdp() {
  // 首次读取也要推进：页面关着时到点的专注，打开时照样弹出完成提示
  const [initial] = useState(() => ctdpEngine.sync());
  const [state, setState] = useState<CtdpState>(initial.state);
  const [now, setNow] = useState<number>(() => Date.now());
  const [completedNo, setCompletedNo] = useState<number | null>(initial.completedNo);

  useEffect(() => {
    const tick = (): void => {
      const result = ctdpEngine.sync();
      setState(result.state);
      setNow(Date.now());
      if (result.completedNo !== null) setCompletedNo(result.completedNo);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    // 其他标签页改动了专注数据时同步
    const onStorage = (event: StorageEvent): void => {
      if (event.key === 'rsip-ctdp-v1') tick();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /** 执行一个引擎操作；出错时提示而不抛出 */
  const run = useCallback((action: () => CtdpState): boolean => {
    try {
      setState(action());
      setNow(Date.now());
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
      return false;
    }
  }, []);

  const clearCompleted = useCallback(() => setCompletedNo(null), []);

  return { state, now, completedNo, clearCompleted, run };
}
