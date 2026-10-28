import {
  Apple,
  BookOpen,
  Briefcase,
  Droplets,
  Dumbbell,
  Heart,
  Moon,
  PiggyBank,
  Smartphone,
  Target,
  Home,
  type LucideIcon,
} from 'lucide-react';

/** 国策图标分类 key（与原 jpg 方案保持同一套 key，便于数据兼容） */
export type RsipIconKey =
  | 'sleep'
  | 'phone'
  | 'exercise'
  | 'water'
  | 'diet'
  | 'chores'
  | 'desk'
  | 'study'
  | 'calm'
  | 'money'
  | 'target';

interface IconOption {
  label: string;
  Icon: LucideIcon;
  /** 渐变背景（Tailwind 类） */
  gradient: string;
  /** 卡牌插画区主色相（HSL hue），与 gradient 同色系 */
  hue: number;
}

export const ICON_BY_KEY: Record<RsipIconKey, IconOption> = {
  sleep: {
    label: '作息',
    Icon: Moon,
    gradient: 'from-indigo-500 to-indigo-600',
    hue: 239,
  },
  phone: {
    label: '屏幕',
    Icon: Smartphone,
    gradient: 'from-slate-500 to-slate-600',
    hue: 215,
  },
  exercise: {
    label: '运动',
    Icon: Dumbbell,
    gradient: 'from-emerald-500 to-emerald-600',
    hue: 160,
  },
  water: {
    label: '喝水',
    Icon: Droplets,
    gradient: 'from-sky-500 to-sky-600',
    hue: 199,
  },
  diet: {
    label: '饮食',
    Icon: Apple,
    gradient: 'from-rose-500 to-rose-600',
    hue: 345,
  },
  chores: {
    label: '家务',
    Icon: Home,
    gradient: 'from-amber-500 to-amber-600',
    hue: 38,
  },
  desk: {
    label: '桌面',
    Icon: Briefcase,
    gradient: 'from-zinc-500 to-zinc-600',
    hue: 185,
  },
  study: {
    label: '学习',
    Icon: BookOpen,
    gradient: 'from-violet-500 to-violet-600',
    hue: 262,
  },
  calm: {
    label: '情绪',
    Icon: Heart,
    gradient: 'from-pink-500 to-pink-600',
    hue: 330,
  },
  money: {
    label: '储蓄',
    Icon: PiggyBank,
    gradient: 'from-lime-500 to-lime-600',
    hue: 84,
  },
  target: {
    label: '目标',
    Icon: Target,
    gradient: 'from-blue-500 to-blue-600',
    hue: 217,
  },
};

/** 模板 id → 图标 key（供未显式设置 iconKey 的国策回退） */
export const TEMPLATE_ICON_MAP: Record<string, RsipIconKey> = {
  'sleep-consistent': 'sleep',
  'before-bed-phone': 'phone',
  'wake-no-phone': 'phone',
  'daily-walk': 'exercise',
  'water-morning': 'water',
  'clothes-basket': 'chores',
  'desk-clean': 'desk',
  'no-sugar-drink': 'diet',
};

/** 国策图标：优先 policy.iconKey，其次模板映射，最后默认 */
export function getPolicyIconKey(policy: {
  iconKey?: string | null;
  templateId?: string | null;
}): RsipIconKey {
  if (policy.iconKey !== null && policy.iconKey !== undefined) {
    if (policy.iconKey in ICON_BY_KEY) {
      return policy.iconKey as RsipIconKey;
    }
  }
  return getTemplateIconKey(policy.templateId ?? null);
}

/** 模板图标：命中映射返回对应 key，否则默认 target */
export function getTemplateIconKey(templateId: string | null): RsipIconKey {
  if (templateId && templateId in TEMPLATE_ICON_MAP) {
    return TEMPLATE_ICON_MAP[templateId];
  }
  return 'target';
}

/** 获取图标渲染选项 */
export function getIconOption(key: RsipIconKey): IconOption {
  return ICON_BY_KEY[key];
}

/** 全部图标选项（供 picker 选择） */
export const ICON_OPTIONS: { key: RsipIconKey; label: string }[] = (
  Object.keys(ICON_BY_KEY) as RsipIconKey[]
).map((key) => ({ key, label: ICON_BY_KEY[key].label }));
