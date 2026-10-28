import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { useRsipDashboard } from './useRsipDashboard';
import DashboardStatCards from './components/DashboardStatCards';
import TrendChart from './components/TrendChart';
import TreeProgressChart from './components/TreeProgressChart';
import GroupDistributionChart from './components/GroupDistributionChart';
import WinReportList from './components/WinReportList';
import RollbackList from './components/RollbackList';
import ArchivedTreeList from './components/ArchivedTreeList';
import DashboardSkeleton from './components/DashboardSkeleton';

const DashboardPage: React.FC = () => {
  const { dashboard, loading, error, refresh } = useRsipDashboard();

  const inNewUserProtection = React.useMemo<boolean>(() => {
    const first = dashboard?.firstUseDate;
    if (!first) return false;
    const days = Math.round(
      (Date.now() - Date.parse(first)) / 86400000,
    );
    return days >= 0 && days < 14;
  }, [dashboard?.firstUseDate]);

  const handleRetry = (): void => {
    void refresh();
  };

  return (
    <div className="rsip-table min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" aria-label="返回主视图" asChild>
            <Link to="/">
              <ArrowLeft size={16} />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-xl font-black tracking-wide text-foreground">仪表盘</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              多棵树 · 国策组 · 喜报的数据总览
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loading ? (
          <DashboardSkeleton />
        ) : !dashboard ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-foreground/85">
              {error ?? '暂无数据'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleRetry}
            >
              重新加载
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
                <p className="text-xs leading-relaxed text-foreground/70">
                  刷新失败：{error}（当前显示的是上次加载的数据）
                </p>
                <Button variant="ghost" size="sm" onClick={handleRetry}>
                  重试
                </Button>
              </div>
            )}

            <DashboardStatCards totals={dashboard.totals} />

            {inNewUserProtection && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="text-xs leading-relaxed text-foreground/85">
                  <p className="font-medium">新手保护期（前 14 天）</p>
                  <p className="mt-0.5">
                    这一阶段的数据受新鲜感和动机高峰影响，不代表稳态已经形成；
                    真正的目标是让根节点在 30 天里存活下来，而不是早期数字好看。
                  </p>
                </div>
              </div>
            )}

            <TrendChart daily={dashboard.daily} />

            <div className="grid gap-4 lg:grid-cols-2">
              <TreeProgressChart trees={dashboard.trees} />
              <GroupDistributionChart
                groups={dashboard.groups}
                totalCumulativeLitDays={
                  dashboard.totals.totalCumulativeLitDays
                }
              />
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-3">
              <WinReportList winReports={dashboard.recentWinReports} />
              <RollbackList rollbacks={dashboard.recentRollbacks} />
              <ArchivedTreeList archivedTrees={dashboard.archivedTrees} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
