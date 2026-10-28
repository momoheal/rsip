import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { RsipDashboard } from '@shared/api.interface';
import { extractErrorMessage, fetchDashboard } from '@client/src/api/rsip';

interface UseRsipDashboardResult {
  dashboard: RsipDashboard | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** 仪表盘数据获取：真实接口 /api/rsip/dashboard，带 loading / error / refresh */
export function useRsipDashboard(): UseRsipDashboardResult {
  const [dashboard, setDashboard] = useState<RsipDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data: RsipDashboard = await fetchDashboard();
      setDashboard(data);
      setError(null);
    } catch (err: unknown) {
      const message: string = extractErrorMessage(err);
      setError(message);
      logger.error('加载 RSIP 仪表盘失败', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
