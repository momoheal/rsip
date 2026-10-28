import type { RsipPolicyInput } from '@shared/api.interface';

export interface RsipTemplate {
  id: string;
  name: string;
  type: RsipPolicyInput['type'] | 'mechanism';
  trigger: string | null;
  judge: string;
  description: string;
  mechanism: boolean;
}

export const RSIP_TEMPLATES: RsipTemplate[] = [
  {
    id: 'sleep-consistent',
    name: '规律作息（锚点）',
    type: 'semi_passive',
    trigger: '23:00 闹钟响',
    judge: '是否闹钟响后 30 分钟内上床？',
    description: '以固定闹钟为锚点的入睡触发，其他一切自动跟随',
    mechanism: false,
  },
  {
    id: 'wake-no-phone',
    name: '起床 30 分钟不碰手机',
    type: 'passive',
    trigger: null,
    judge: '是否起床后 30 分钟内没有使用手机娱乐功能？',
    description: '阻断「醒后即滑坡」的惯性起点',
    mechanism: false,
  },
  {
    id: 'before-bed-phone',
    name: '睡前 1 小时手机放客厅',
    type: 'passive',
    trigger: null,
    judge: '是否睡前 1 小时手机已放在客厅充电？',
    description: '物理阻断，靠环境不靠意志',
    mechanism: false,
  },
  {
    id: 'daily-walk',
    name: '每日下楼走 10 分钟',
    type: 'semi_passive',
    trigger: '晚饭吃完放下碗',
    judge: '是否放下碗后 30 分钟内下楼走了至少 10 分钟？',
    description: '低门槛运动锚点，挂在晚饭后面',
    mechanism: false,
  },
  {
    id: 'water-morning',
    name: '晨起一杯水',
    type: 'semi_passive',
    trigger: '起床',
    judge: '是否起床后 15 分钟内喝了一杯水？',
    description: '最简单的半被动型，用来验证树的运转',
    mechanism: false,
  },
  {
    id: 'clothes-basket',
    name: '换洗衣物入篮',
    type: 'semi_passive',
    trigger: '洗澡前',
    judge: '是否洗澡前换洗衣物已放进洗衣篮？',
    description: '家务类小杠杆，环境型改变',
    mechanism: false,
  },
  {
    id: 'desk-clean',
    name: '睡前桌面清空',
    type: 'semi_passive',
    trigger: '结束当天工作',
    judge: '是否结束时桌面只剩必需品？',
    description: '为第二天早晨制造「冷启动零阻力」',
    mechanism: false,
  },
  {
    id: 'no-sugar-drink',
    name: '不喝含糖饮料',
    type: 'passive',
    trigger: null,
    judge: '是否今天没有喝含糖饮料？',
    description: '饮食类被动型约束',
    mechanism: false,
  },
  {
    id: 'freeze-entry',
    name: '存人失地（冻结）',
    type: 'mechanism',
    trigger: null,
    judge: '',
    description: '机制型：进入「水密隔舱」冻结入口',
    mechanism: true,
  },
  {
    id: 'win-report',
    name: '赢麻了（喜报）',
    type: 'mechanism',
    trigger: null,
    judge: '',
    description: '机制型：发布一张阶段性喜报，记录高光时刻',
    mechanism: true,
  },
];

export interface GoalSuggestion {
  goalKeyword: RegExp;
  templates: string[];
}

export const GOAL_SUGGESTIONS: GoalSuggestion[] = [
  {
    goalKeyword: /睡|作息|熬夜|早起|起床/,
    templates: ['sleep-consistent', 'before-bed-phone', 'wake-no-phone'],
  },
  {
    goalKeyword: /手机|刷|短视频|游戏|上瘾/,
    templates: ['before-bed-phone', 'wake-no-phone', 'no-sugar-drink'],
  },
  {
    goalKeyword: /运动|锻炼|健身|减肥|体重/,
    templates: ['daily-walk', 'no-sugar-drink', 'water-morning'],
  },
  {
    goalKeyword: /学习|读书|写作|工作|效率|拖延/,
    templates: ['desk-clean', 'sleep-consistent', 'wake-no-phone'],
  },
  {
    goalKeyword: /家务|整洁|房间|收纳/,
    templates: ['clothes-basket', 'desk-clean', 'water-morning'],
  },
];

export function suggestTemplateIds(goal: string): string[] {
  for (const s of GOAL_SUGGESTIONS) {
    if (s.goalKeyword.test(goal)) return s.templates;
  }
  return ['water-morning', 'desk-clean', 'sleep-consistent'];
}
