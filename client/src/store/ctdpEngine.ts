/**
 * CTDP 链式时延协议（第一代方法）本地引擎。
 *
 * 三个核心原理：
 * - 神圣座位：触发约定的标志（如戴上蓝色帽子）就必须以最好的状态专注满一段时间；
 *   每次成功记一个节点 #N，一次失败整条主链清零。
 * - 下必为例：任何疑似违规只有两个选项 —— 判违规（链清零），或判允许（从此永久允许，记入判例）。
 * - 线性时延：预约链。发出预约信号后，必须在 15 分钟内（留 30 秒缓冲）坐上神圣座位；
 *   超时同样适用下必为例。
 *
 * 外加原文的「侦查任务」：专注 5 分钟即算完成，进入状态可转为主链专注，放弃不影响主链。
 *
 * 专注是单设备上的即时行为，按 PRD F15（本地优先）只存 localStorage，本地 / 平台模式通用。
 * 它只是 RSIP 国策树下的一个子工具，不参与国策结算。
 */

/** 兵种：原文的任务单元分类 */
export type CtdpUnitKind =
  | 'assault'
  | 'recon'
  | 'command'
  | 'service'
  | 'engineer'
  | 'mess';

export const UNIT_KINDS: { key: CtdpUnitKind; label: string; hint: string }[] = [
  { key: 'assault', label: '突击', hint: '学习 / 实验 / 读论文' },
  { key: 'recon', label: '侦查', hint: '信息搜集' },
  { key: 'command', label: '指挥', hint: '制定计划' },
  { key: 'service', label: '特勤', hint: '处理杂事' },
  { key: 'engineer', label: '工程', hint: '运动锻炼' },
  { key: 'mess', label: '炊事', hint: '备餐做饭' },
];

export type CtdpChainKey = 'main' | 'aux';

export interface CtdpPrecedent {
  id: string;
  text: string;
  createdAt: string;
}

export interface CtdpChain {
  /** 当前链长 #N */
  count: number;
  /** 历史最长 */
  best: number;
  /** 清零次数 */
  resets: number;
  /** 判例：已永久允许的情况 */
  precedents: CtdpPrecedent[];
}

export interface CtdpSession {
  id: string;
  /** main = 主链专注；scout = 侦查任务 */
  kind: 'main' | 'scout';
  unit: CtdpUnitKind;
  goal: string;
  /** 毫秒时间戳 */
  startedAt: number;
  durationMin: number;
  /** 本次专注是否由预约触发 */
  fromReservation: boolean;
}

export interface CtdpReservation {
  id: string;
  createdAt: number;
  /** 截止时刻（毫秒）：预约时长减去 30 秒缓冲 */
  deadline: number;
}

export interface CtdpSettings {
  /** 神圣座位：触发主链的标志 */
  seat: string;
  /** 预约信号 */
  signal: string;
  focusMinutes: number;
  reserveMinutes: number;
  scoutMinutes: number;
}

export type CtdpLogResult =
  | 'done'
  | 'reset'
  | 'precedent'
  | 'scout_done'
  | 'scout_dropped';

export interface CtdpLogEntry {
  id: string;
  at: string;
  chain: CtdpChainKey | 'scout';
  result: CtdpLogResult;
  /** 完成时的节点号 / 清零前的链长 */
  chainNo: number;
  unit: CtdpUnitKind | null;
  goal: string;
  note: string | null;
}

/** 等待下必为例裁决的事件 */
export interface CtdpPendingRuling {
  chain: CtdpChainKey;
  /** 主链：专注中出现的疑似违规；预约链：预约超时 */
  reason: 'suspect' | 'overdue';
}

export interface CtdpState {
  settings: CtdpSettings;
  main: CtdpChain;
  aux: CtdpChain;
  scoutCount: number;
  active: CtdpSession | null;
  reservation: CtdpReservation | null;
  pendingRuling: CtdpPendingRuling | null;
  log: CtdpLogEntry[];
}

const STORAGE_KEY = 'rsip-ctdp-v1';
const LOG_LIMIT = 60;
/** 原文的二次信号缓冲：15 分钟预约，14 分 30 秒内必须开始 */
const RESERVE_BUFFER_MS = 30_000;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyChain(): CtdpChain {
  return { count: 0, best: 0, resets: 0, precedents: [] };
}

function defaultState(): CtdpState {
  return {
    settings: {
      seat: '深呼吸三次，戴上专注帽',
      signal: '打一个响指',
      focusMinutes: 60,
      reserveMinutes: 15,
      scoutMinutes: 5,
    },
    main: emptyChain(),
    aux: emptyChain(),
    scoutCount: 0,
    active: null,
    reservation: null,
    pendingRuling: null,
    log: [],
  };
}

function load(): CtdpState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<CtdpState>;
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      main: { ...base.main, ...(parsed.main ?? {}) },
      aux: { ...base.aux, ...(parsed.aux ?? {}) },
    };
  } catch {
    return defaultState();
  }
}

function save(state: CtdpState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用（隐私模式等）时只保留内存态
  }
}

function pushLog(state: CtdpState, entry: Omit<CtdpLogEntry, 'id' | 'at'>): void {
  state.log.unshift({ ...entry, id: uid('log'), at: new Date().toISOString() });
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

function bump(chain: CtdpChain): number {
  chain.count += 1;
  chain.best = Math.max(chain.best, chain.count);
  return chain.count;
}

export function sessionEndsAt(session: CtdpSession): number {
  return session.startedAt + session.durationMin * 60_000;
}

/** 三三制：3 个 # 组成 ##，3 个 ## 组成 ### */
export function formationOf(count: number): { groups: number; clusters: number } {
  return { groups: Math.floor(count / 3), clusters: Math.floor(count / 9) };
}

/**
 * 按当前时间推进状态：预约超时 → 待裁决；专注到点 → 自动记节点。
 * 返回是否发生变化，以及本次自动完成的主链节点号（用于庆祝）。
 */
function advance(state: CtdpState, now: number): { changed: boolean; completedNo: number | null } {
  let changed = false;
  let completedNo: number | null = null;

  if (state.reservation && !state.active && now > state.reservation.deadline) {
    state.reservation = null;
    if (!state.pendingRuling) {
      state.pendingRuling = { chain: 'aux', reason: 'overdue' };
    }
    changed = true;
  }

  const session = state.active;
  if (session && now >= sessionEndsAt(session) && !state.pendingRuling) {
    if (session.kind === 'main') {
      completedNo = bump(state.main);
      pushLog(state, {
        chain: 'main',
        result: 'done',
        chainNo: completedNo,
        unit: session.unit,
        goal: session.goal,
        note: null,
      });
    } else {
      state.scoutCount += 1;
      pushLog(state, {
        chain: 'scout',
        result: 'scout_done',
        chainNo: state.scoutCount,
        unit: session.unit,
        goal: session.goal,
        note: null,
      });
    }
    state.active = null;
    changed = true;
  }

  return { changed, completedNo };
}

function mutate<T>(fn: (state: CtdpState) => T): { state: CtdpState; value: T } {
  const state = load();
  advance(state, Date.now());
  const value = fn(state);
  save(state);
  return { state, value };
}

export const ctdpEngine = {
  /** 读取并按当前时间推进；completedNo 非空表示刚刚自动完成一个主链节点 */
  sync(): { state: CtdpState; completedNo: number | null } {
    const state = load();
    const { changed, completedNo } = advance(state, Date.now());
    if (changed) save(state);
    return { state, completedNo };
  },

  updateSettings(input: Partial<CtdpSettings>): CtdpState {
    return mutate((state) => {
      const next = { ...state.settings, ...input };
      next.seat = next.seat.trim().slice(0, 60) || state.settings.seat;
      next.signal = next.signal.trim().slice(0, 40) || state.settings.signal;
      next.focusMinutes = Math.min(Math.max(Math.round(next.focusMinutes), 5), 180);
      next.reserveMinutes = Math.min(Math.max(Math.round(next.reserveMinutes), 1), 60);
      next.scoutMinutes = Math.min(Math.max(Math.round(next.scoutMinutes), 1), 15);
      state.settings = next;
    }).state;
  },

  /** 发出预约信号：必须在预约时长（减 30 秒缓冲）内坐上神圣座位 */
  reserve(): CtdpState {
    return mutate((state) => {
      if (state.pendingRuling) throw new Error('先完成待处理的判例裁决');
      if (state.active) throw new Error('正在专注中');
      if (state.reservation) throw new Error('已有一个预约在倒计时');
      const now = Date.now();
      state.reservation = {
        id: uid('rsv'),
        createdAt: now,
        deadline: now + state.settings.reserveMinutes * 60_000 - RESERVE_BUFFER_MS,
      };
    }).state;
  },

  /** 坐上神圣座位（或开始侦查）。有预约时视为履约，预约链 +1 */
  start(kind: 'main' | 'scout', unit: CtdpUnitKind, goal: string): CtdpState {
    return mutate((state) => {
      if (state.pendingRuling) throw new Error('先完成待处理的判例裁决');
      if (state.active) throw new Error('正在专注中');
      const fromReservation = state.reservation !== null;
      if (state.reservation) {
        const no = bump(state.aux);
        pushLog(state, {
          chain: 'aux',
          result: 'done',
          chainNo: no,
          unit,
          goal: goal.trim(),
          note: null,
        });
        state.reservation = null;
      }
      state.active = {
        id: uid('ses'),
        kind,
        unit,
        goal: goal.trim().slice(0, 60),
        startedAt: Date.now(),
        durationMin:
          kind === 'main' ? state.settings.focusMinutes : state.settings.scoutMinutes,
        fromReservation,
      };
    }).state;
  },

  /** 侦查进入状态：原地转为主链专注，时长按主链计（从侦查开始时算起） */
  promoteScout(): CtdpState {
    return mutate((state) => {
      const session = state.active;
      if (!session || session.kind !== 'scout') throw new Error('当前不是侦查任务');
      session.kind = 'main';
      session.durationMin = state.settings.focusMinutes;
    }).state;
  },

  /** 结束侦查：到点前结束也不影响主链 */
  endScout(): CtdpState {
    return mutate((state) => {
      const session = state.active;
      if (!session || session.kind !== 'scout') throw new Error('当前不是侦查任务');
      const elapsedMin = (Date.now() - session.startedAt) / 60_000;
      const done = elapsedMin >= state.settings.scoutMinutes;
      if (done) state.scoutCount += 1;
      pushLog(state, {
        chain: 'scout',
        result: done ? 'scout_done' : 'scout_dropped',
        chainNo: state.scoutCount,
        unit: session.unit,
        goal: session.goal,
        note: null,
      });
      state.active = null;
    }).state;
  },

  /** 专注中出现疑似违规 / 想取消预约：进入下必为例裁决 */
  raiseSuspect(chain: CtdpChainKey): CtdpState {
    return mutate((state) => {
      if (chain === 'main' && !state.active) throw new Error('当前没有在专注');
      if (chain === 'aux' && !state.reservation) throw new Error('当前没有预约');
      state.pendingRuling = { chain, reason: 'suspect' };
    }).state;
  },

  /** 撤回裁决（例如只是误点），回到原状态 */
  dismissSuspect(): CtdpState {
    return mutate((state) => {
      if (state.pendingRuling?.reason === 'suspect') state.pendingRuling = null;
    }).state;
  },

  /**
   * 下必为例裁决：
   * - reset：链清零，下次从 #1 开始（主链会同时结束当前专注；预约链会撤销当前预约）
   * - precedent：判允许，记入判例，从此该情况永久允许；当前专注 / 预约继续
   */
  rule(decision: 'reset' | 'precedent', behavior: string): CtdpState {
    return mutate((state) => {
      const pending = state.pendingRuling;
      if (!pending) throw new Error('没有待裁决的事件');
      const chain: CtdpChain = pending.chain === 'main' ? state.main : state.aux;
      const text = behavior.trim().slice(0, 60);
      const session = state.active;

      if (decision === 'precedent') {
        if (!text) throw new Error('判允许需要写清是什么情况');
        if (!chain.precedents.some((p) => p.text === text)) {
          chain.precedents.push({ id: uid('pre'), text, createdAt: new Date().toISOString() });
        }
        pushLog(state, {
          chain: pending.chain,
          result: 'precedent',
          chainNo: chain.count,
          unit: session?.unit ?? null,
          goal: session?.goal ?? '',
          note: text,
        });
        state.pendingRuling = null;
        // 预约超时被判允许：这次预约视为已处理，不计入链长
        return;
      }

      pushLog(state, {
        chain: pending.chain,
        result: 'reset',
        chainNo: chain.count,
        unit: session?.unit ?? null,
        goal: session?.goal ?? '',
        note: text || null,
      });
      chain.count = 0;
      chain.resets += 1;
      if (pending.chain === 'main') state.active = null;
      if (pending.chain === 'aux') state.reservation = null;
      state.pendingRuling = null;
    }).state;
  },

  /** 清空全部专注数据（设置保留） */
  resetAll(): CtdpState {
    const base = defaultState();
    const state = load();
    const next: CtdpState = { ...base, settings: state.settings };
    save(next);
    return next;
  },
};
