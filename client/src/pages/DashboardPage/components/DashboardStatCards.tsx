import React from 'react';
import type { RsipDashboardTotals } from '@shared/api.interface';

interface DashboardStatCardsProps {
  totals: RsipDashboardTotals;
}

interface StatCardProps {
  label: string;
  value: number;
  aux?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, aux }) => {
  return (
    <div className="rsip-panel p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-gold-soft">
        {value}
      </p>
      {aux && (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground/75">{aux}</p>
      )}
    </div>
  );
};

/** 统计卡片区：8 张，响应式 2 / 4 列 */
const DashboardStatCards: React.FC<DashboardStatCardsProps> = ({ totals }) => {
  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      data-ai-section-type="card-stat"
    >
      <StatCard
        label="活跃树"
        value={totals.activeTreeCount}
        aux={`已归档 ${totals.archivedTreeCount} 棵`}
      />
      <StatCard
        label="在树国策"
        value={totals.onTreePolicyCount}
        aux={`手牌 ${totals.handPolicyCount} 条`}
      />
      <StatCard
        label="判例库"
        value={totals.precedentCount}
        aux={`国策组 ${totals.groupCount} 个`}
      />
      <StatCard
        label="累计点亮天数"
        value={totals.totalCumulativeLitDays}
        aux="全部国策求和"
      />
      <StatCard
        label="最长连续点亮"
        value={totals.maxCurrentStreak}
        aux="天"
      />
      <StatCard
        label="连续清洁结算"
        value={totals.cleanReviewStreak}
        aux="天 · 按时且无回滚"
      />
      <StatCard
        label="崩塌次数"
        value={totals.rollbackCount}
        aux={`冻结 ${totals.freezeCount} 次`}
      />
      <StatCard
        label="喜报数"
        value={totals.winReportCount}
        aux="手动 + 里程碑"
      />
    </div>
  );
};

export default DashboardStatCards;
