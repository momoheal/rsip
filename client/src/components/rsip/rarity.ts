/**
 * 卡牌稀有度：由国策内化天数（cumulativeLitDays，永不清零）决定。
 * 阈值对齐里程碑喜报（连续 7/21/100、累计 30/100/365），只做视觉分级，不参与任何判定。
 */
export type RsipRarity =
  | 'blank'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

interface RarityTier {
  key: RsipRarity;
  label: string;
  /** 达到该档所需的最低累计天数 */
  min: number;
}

export const RARITY_TIERS: RarityTier[] = [
  { key: 'blank', label: '未点亮', min: 0 },
  { key: 'common', label: '普通', min: 1 },
  { key: 'uncommon', label: '精良', min: 7 },
  { key: 'rare', label: '稀有', min: 21 },
  { key: 'epic', label: '史诗', min: 100 },
  { key: 'legendary', label: '传说', min: 365 },
];

export interface RarityInfo {
  key: RsipRarity;
  label: string;
  /** 下一档；已是最高档为 null */
  next: { label: string; min: number } | null;
  /** 当前档到下一档的进度 0–1（最高档为 1） */
  ratio: number;
}

export function getRarity(cumulative: number): RarityInfo {
  let index = 0;
  RARITY_TIERS.forEach((tier: RarityTier, i: number) => {
    if (cumulative >= tier.min) index = i;
  });
  const current: RarityTier = RARITY_TIERS[index];
  const nextTier: RarityTier | undefined = RARITY_TIERS[index + 1];
  if (!nextTier) {
    return { key: current.key, label: current.label, next: null, ratio: 1 };
  }
  const span: number = nextTier.min - current.min;
  return {
    key: current.key,
    label: current.label,
    next: { label: nextTier.label, min: nextTier.min },
    ratio: Math.min(Math.max((cumulative - current.min) / span, 0), 1),
  };
}
