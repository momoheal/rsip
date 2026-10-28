/**
 * 可强化国策（强化等级 +N，v1.2）：每升一级把时间门槛平移一档，本级连续点亮达到门槛后
 * 只提示「可升级」，由用户手动确认。等级只影响判定门槛的说明，不改变结算与回滚逻辑。
 */
import type { RsipPolicy, RsipProgress } from '@shared/api.interface';

export interface UpgradeState {
  level: number;
  stepText: string | null;
  /** 本级需要连续点亮的天数 */
  needed: number;
  /** 本级已连续点亮天数 */
  daysAtLevel: number;
  /** 达到门槛，可手动升级 */
  ready: boolean;
}

/** 未设置强化规则返回 null */
export function getUpgradeState(
  policy: RsipPolicy,
  progress: RsipProgress | null,
): UpgradeState | null {
  if (!policy.upgradable || !policy.upgradeAfterStreak) return null;
  const streak: number = progress?.currentStreak ?? 0;
  const daysAtLevel: number = Math.max(0, streak - (policy.levelStreakBase ?? 0));
  return {
    level: policy.level ?? 0,
    stepText: policy.stepText ?? null,
    needed: policy.upgradeAfterStreak,
    daysAtLevel,
    ready: daysAtLevel >= policy.upgradeAfterStreak,
  };
}

/** 强化等级 > 0 时的显示文本，例如「+2」 */
export function levelLabel(policy: RsipPolicy): string | null {
  const level: number = policy.level ?? 0;
  return policy.upgradable && level > 0 ? `+${level}` : null;
}
