import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { RsipOverview } from '@shared/api.interface';
import { fetchOverview } from '@client/src/api/rsip';

interface UseRsipOverviewResult {
  overview: RsipOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRsipOverview(): UseRsipOverviewResult {
  const [overview, setOverview] = useState<RsipOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchOverview();
      setOverview(data);
      setError(null);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(message ?? '加载失败，请刷新重试');
      logger.error('加载 RSIP 总览失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { overview, loading, error, refresh };
}
