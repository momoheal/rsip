/* 前后端共享的类型写在这里 */

/* ===================== RSIP 自控力操作系统 ===================== */

/** 国策类型：被动 / 半被动 / 主动 / 机制 */
export type RsipPolicyType =
  | 'passive'
  | 'semi_passive'
  | 'active'
  | 'mechanism';

/** 用户可创建的国策类型（机制型仅来自模板库展示，v0.5 开放） */
export type RsipUserPolicyType = 'passive' | 'semi_passive' | 'active';

/** v1.1 杠杆来源：国策借的是什么能量 */
export type RsipLeverageSource =
  | 'causal_chain' // 因果链
  | 'behavior_inertia' // 行为惯性
  | 'environment' // 环境
  | 'physical_posture' // 物理姿势
  | 'physiological' // 生理本能
  | 'math_structure'; // 数学结构

/** v1.1 国策树层级：精锐 / 普通 */
export type RsipTreeTier = 'elite' | 'normal';

/**
 * 结算判定：成立 / 违反 / 永久合法化 / 降回 +0
 * downgraded（v1.2）：强化等级 > 0 的国策答「否」时可选，等级归零、节点留树、不级联（仅本地模式）
 */
export type RsipVerdict = 'satisfied' | 'violated' | 'legalized' | 'downgraded';

export interface RsipPolicy {
  id: string;
  name: string;
  type: RsipPolicyType;
  /** 半被动型触发条件，其余类型为 null */
  trigger: string | null;
  /** 二元判定标准（是否…？句式） */
  judge: string;
  templateId: string | null;
  /** 分类图标 key（sleep/phone/exercise 等），空则前端用默认图标 */
  iconKey: string | null;
  /** 所属国策组（跨树分类标签），未分组为 null */
  groupId: string | null;
  /** v1.1 杠杆来源（机制型为 null） */
  leverage: RsipLeverageSource | null;
  /** v1.1 是否作用于有效干预节点（相关/不相关），null 表示未判定 */
  relevant: boolean | null;
  /** v1.2 是否可强化（+N）；平台后端暂未提供时缺省 = 否 */
  upgradable?: boolean;
  /** v1.2 当前强化等级，0 = 基础门槛 */
  level?: number;
  /** v1.2 每升一级的门槛平移，例如「起床时间提前 15 分钟」 */
  stepText?: string | null;
  /** v1.2 本级连续点亮多少天可升级 */
  upgradeAfterStreak?: number | null;
  /** v1.2 上次升级时的 currentStreak，本级天数 = currentStreak − 该值 */
  levelStreakBase?: number;
  isRetired: boolean;
  retireReason: string | null;
  createdAt: string;
}

export interface RsipProgress {
  policyId: string;
  /** 历史累计点亮天数，永不清零 */
  cumulativeLitDays: number;
  /** 当前连续点亮天数，回滚/违反归零 */
  currentStreak: number;
  lastLitDate: string | null;
}

export interface RsipTreeNode {
  nodeId: string;
  policyId: string;
  treeId: string;
  parentNodeId: string | null;
  /** 挂树日期 YYYY-MM-DD */
  attachedOn: string;
  policy: RsipPolicy;
  progress: RsipProgress | null;
  /** 命中的未解冻冻结 */
  frozenBy: { freezeId: string; endDate: string } | null;
  /** 该节点是否在解冻重判待办中 */
  pendingRelease: boolean;
  children: RsipTreeNode[];
}

/** 手牌项：未挂树的国策 */
export interface RsipHandItem {
  policy: RsipPolicy;
  progress: RsipProgress | null;
  /** 是否曾被挂树并点亮过（有历史） */
  everLit: boolean;
}

/** 国策树（多棵树）：一棵树一个根 */
export interface RsipTree {
  id: string;
  name: string;
  goal: string | null;
  /** v1.1 精锐 / 普通树 */
  tier: RsipTreeTier;
  archived: boolean;
  archivedAt: string | null;
  /** 活跃节点数（含根） */
  nodeCount: number;
  /** 根节点；根崩塌或未建根时为 null */
  root: RsipTreeNode | null;
}

/** v1.1 不可逃逸区诊断记录（F1 产出） */
export interface RsipDiagnosis {
  id: string;
  treeId: string | null;
  /** 负面稳态描述 */
  negativeStableState: string;
  /** 回溯链（从稳态起点逐步向前） */
  backtraceChain: string[];
  /** 选中的有效干预节点 */
  effectiveInterventionNode: string;
  createdAt: string;
}

/** 国策组：跨树分类标签，不改变回滚与结算逻辑 */
export interface RsipPolicyGroup {
  id: string;
  name: string;
  policyCount: number;
}

/** 里程碑类型 */
export type RsipMilestoneType =
  | 'streak_7'
  | 'streak_21'
  | 'streak_100'
  | 'cumulative_30'
  | 'cumulative_100'
  | 'cumulative_365'
  | 'clean_7'
  | 'clean_30';

/** 喜报：手动发布或里程碑自动生成 */
export interface RsipWinReport {
  id: string;
  title: string;
  content: string;
  source: 'manual' | 'milestone';
  milestoneType: RsipMilestoneType | null;
  relatedPolicyId: string | null;
  relatedPolicyName: string | null;
  createdAt: string;
}

export interface RsipRollbackEvent {
  id: string;
  occurredOn: string;
  triggerPolicyId: string;
  triggerPolicyName: string;
  sweptCount: number;
  reasonScenario: string | null;
  lesson: string | null;
}

export interface RsipFreezeRecord {
  id: string;
  scopeWholeTree: boolean;
  /** 整树冻结针对的树；子树冻结为 null */
  treeId: string | null;
  scopeNodeIds: string[];
  reason: string;
  startDate: string;
  endDate: string;
  released: boolean;
  releasedOn: string | null;
  /** 是否需要今天执行解冻重判 */
  needsRelease: boolean;
}

export interface RsipUserSettings {
  reviewWindowStart: string;
  reviewWindowEnd: string;
  onboarded: boolean;
}

/** 今日运行时状态 */
export interface RsipTodayStatus {
  /** 业务时区（Asia/Shanghai）当天日期 YYYY-MM-DD */
  date: string;
  /** 结算窗口是否开启（按窗口时间与服务器当前时间判断） */
  windowOpen: boolean;
  /** 今日结算是否已完成 */
  reviewCompleted: boolean;
  reviewLate: boolean;
  hadRollbackToday: boolean;
  /** 今日应结算的国策数 */
  dueCount: number;
  /** 今日是否已挂载节点 */
  attachUsedToday: boolean;
  /** 是否满足新增入口条件（结算完成 + 无回滚 + 有国策内化进度 > 3 天） */
  canAttachToday: boolean;
  /** 连续漏结算天数 */
  missedReviewDays: number;
  /** 是否存在待解冻重判的冻结 */
  hasPendingRelease: boolean;
}

export interface RsipOverview {
  settings: RsipUserSettings;
  today: RsipTodayStatus;
  /** 全部未归档的国策树 */
  trees: RsipTree[];
  /** 已完成引导但没有任何树有根（待重建） */
  needsRootRebuild: boolean;
  hand: RsipHandItem[];
  /** 判例库：已永久合法化退役的国策 */
  precedents: RsipPolicy[];
  /** 国策组列表 */
  groups: RsipPolicyGroup[];
  /** 喜报列表（最近 20 条，新在前） */
  winReports: RsipWinReport[];
  freezes: RsipFreezeRecord[];
  rollbacks: RsipRollbackEvent[];
  /** v1.1 诊断记录列表 */
  diagnoses: RsipDiagnosis[];
  /** v1.1 首次使用日期（用于新手保护期判定），未引导为 null */
  firstUseDate: string | null;
  /** v1.2「赢麻了」每日命名（最近 14 天，新在前）；平台后端暂未提供时缺省 */
  namedDays?: RsipNamedDay[];
}

/** v1.2「赢麻了」当天定级 */
export type RsipDayLevel = 'small' | 'medium' | 'big';

/** v1.2 用当天最大的喜报给这一天命名 */
export interface RsipNamedDay {
  date: string;
  title: string;
  level: RsipDayLevel;
}

/* ---------- 请求 ---------- */

export interface RsipPolicyInput {
  name: string;
  type: RsipUserPolicyType;
  trigger?: string | null;
  judge: string;
  templateId?: string | null;
  iconKey?: string | null;
  groupId?: string | null;
  /** v1.1 杠杆来源 */
  leverage?: RsipLeverageSource | null;
  /** v1.1 相关性 */
  relevant?: boolean | null;
  /** v1.2 强化规则：关闭时等级归零 */
  upgradable?: boolean;
  stepText?: string | null;
  upgradeAfterStreak?: number | null;
}

export interface RsipOnboardingInput {
  bigGoal: string;
  /** 候选国策（≥3 条，含根） */
  candidates: RsipPolicyInput[];
  /** 根国策在 candidates 中的下标 */
  rootIndex: number;
  /** 「我承认这条国策在我最摆烂的一天也能做到」必须为 true */
  ackWorstDay: boolean;
  /** v1.1 诊断：负面稳态描述 */
  negativeStableState: string;
  /** v1.1 诊断：回溯链 */
  backtraceChain: string[];
  /** v1.1 诊断：有效干预节点 */
  effectiveInterventionNode: string;
}

export interface RsipAttachInput {
  policyId: string;
  /** 挂载父节点；为 null 表示给 treeId 指定的树建根 */
  parentNodeId: string | null;
  /** 建根时目标树；挂子节点时可省略（按父节点归属） */
  treeId?: string | null;
}

export interface RsipVerdictInput {
  nodeId: string;
  verdict: RsipVerdict;
}

export interface RsipReviewSubmitInput {
  verdicts: RsipVerdictInput[];
  /** 结算窗口外手动进入时前端标记 */
  late: boolean;
  notes?: string | null;
  /** v1.2「赢麻了」：用当天最大的喜报命名（可空） */
  dayTitle?: string | null;
  dayLevel?: RsipDayLevel | null;
}

/** v1.2 崩塌复盘：把崩塌当调试器，记录触发场景与教训 */
export interface RsipRollbackNoteInput {
  reasonScenario: string | null;
  lesson: string | null;
}

export interface RsipFreezeInput {
  scopeWholeTree: boolean;
  /** 整树冻结时必填：冻结哪棵树 */
  treeId?: string | null;
  scopeNodeIds: string[];
  reason: string;
  startDate: string;
  endDate: string;
}

export interface RsipFreezeReleaseInput {
  /** 解冻重判：仅 satisfied / violated */
  verdicts: { nodeId: string; verdict: 'satisfied' | 'violated' }[];
}

export interface RsipSettingsInput {
  reviewWindowStart: string;
  reviewWindowEnd: string;
}

export interface RsipTreeCreateInput {
  name: string;
  goal?: string | null;
  /** 从手牌中选作根的国策 */
  rootPolicyId: string;
  /** v1.1 树层级，默认 normal */
  tier?: RsipTreeTier;
}

export interface RsipTreeUpdateInput {
  name?: string;
  goal?: string | null;
}

export interface RsipGroupInput {
  name: string;
}

export interface RsipPolicyGroupAssignInput {
  /** null 表示移出分组 */
  groupId: string | null;
}

export interface RsipWinReportInput {
  title: string;
  content: string;
}

/* ---------- 结算结果 ---------- */

export interface RsipReviewResult {
  date: string;
  hadRollback: boolean;
  rolledBackPolicies: string[];
  retiredPolicies: string[];
  /** v1.2 本次「降回 +0」的国策（节点留树） */
  downgradedPolicies?: string[];
  /** 结算后是否开放新增入口 */
  canAttachToday: boolean;
  /** 本次结算触发的里程碑喜报 */
  newWinReports: RsipWinReport[];
}

export interface RsipFreezeReleaseResult {
  rolledBackPolicies: string[];
}

/* ---------- 仪表盘 ---------- */

export interface RsipDashboardTotals {
  activeTreeCount: number;
  archivedTreeCount: number;
  onTreePolicyCount: number;
  handPolicyCount: number;
  precedentCount: number;
  groupCount: number;
  /** 全部国策累计点亮天数之和 */
  totalCumulativeLitDays: number;
  maxCurrentStreak: number;
  rollbackCount: number;
  freezeCount: number;
  winReportCount: number;
  /** 连续「按时结算且无回滚」天数 */
  cleanReviewStreak: number;
}

export interface RsipDashboardDailyPoint {
  date: string;
  /** 当日判定为满足的节点数 */
  litCount: number;
  /** 当日判定为违反的节点数 */
  violatedCount: number;
  late: boolean;
}

export interface RsipDashboardTreeStat {
  treeId: string;
  name: string;
  goal: string | null;
  nodeCount: number;
  totalCumulativeLitDays: number;
  maxCurrentStreak: number;
}

export interface RsipDashboardGroupStat {
  groupId: string;
  name: string;
  policyCount: number;
  onTreeCount: number;
  totalCumulativeLitDays: number;
}

export interface RsipDashboardArchivedTree {
  id: string;
  name: string;
  archivedAt: string;
  nodeCount: number;
}

export interface RsipDashboard {
  totals: RsipDashboardTotals;
  /** 近 30 天每日结算情况（仅有结算记录的日期） */
  daily: RsipDashboardDailyPoint[];
  trees: RsipDashboardTreeStat[];
  groups: RsipDashboardGroupStat[];
  archivedTrees: RsipDashboardArchivedTree[];
  recentRollbacks: RsipRollbackEvent[];
  recentWinReports: RsipWinReport[];
  /** v1.1 首次使用日期（新手保护期判定），未引导为 null */
  firstUseDate?: string | null;
}
