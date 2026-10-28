import type {
  RsipPolicyType,
  RsipUserPolicyType,
} from '@shared/api.interface';

const SHANGHAI_TZ = 'Asia/Shanghai';

const USER_POLICY_TYPES: RsipUserPolicyType[] = [
  'passive',
  'semi_passive',
  'active',
];

const POLICY_TYPES: RsipPolicyType[] = [
  'passive',
  'semi_passive',
  'active',
  'mechanism',
];

export function isUserPolicyType(value: string): value is RsipUserPolicyType {
  return (USER_POLICY_TYPES as string[]).includes(value);
}

export function isPolicyType(value: string): value is RsipPolicyType {
  return (POLICY_TYPES as string[]).includes(value);
}

export interface ShanghaiNow {
  date: string;
  time: string;
}

export function shanghaiNow(): ShanghaiNow {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHANGHAI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { date, time };
}

export function todayShanghai(): string {
  return shanghaiNow().date;
}

export function dateToShanghaiString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00+08:00`);
  return !Number.isNaN(parsed.getTime());
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00+08:00`).getTime();
  const b = new Date(`${to}T00:00:00+08:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function isWindowOpen(
  time: string,
  start: string,
  end: string,
): boolean {
  if (start <= end) {
    return time >= start && time <= end;
  }
  return time >= start || time <= end;
}

export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export interface PolicyDraftValidation {
  name: string;
  type: RsipUserPolicyType;
  trigger?: string | null;
  judge: string;
}

export function validatePolicyDraft(draft: PolicyDraftValidation): string {
  const name = draft.name.trim();
  if (name.length === 0) return '国策名称不能为空';
  if (name.length > 50) return '国策名称不能超过 50 字';
  if (!isUserPolicyType(draft.type)) {
    return '国策类型必须是被动型、半被动型或主动型';
  }
  const judge = draft.judge.trim();
  if (judge.length === 0) return '判定标准不能为空';
  if (judge.length > 200) return '判定标准不能超过 200 字';
  if (!/^(是否|有没有)/.test(judge)) {
    return '判定标准必须以「是否」或「有没有」开头的二元问句';
  }
  if (draft.type === 'semi_passive') {
    const trigger = (draft.trigger ?? '').trim();
    if (trigger.length === 0) return '半被动型国策必须填写触发条件';
    if (trigger.length > 200) return '触发条件不能超过 200 字';
  }
  return '';
}
