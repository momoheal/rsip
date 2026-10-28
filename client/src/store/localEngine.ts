/**
 * RSIP 本地引擎（v1.1）
 * 在浏览器内完整实现后端业务逻辑，数据持久化到 localStorage。
 * 输入/输出类型与 shared/api.interface.ts 保持一致，
 * 使 api/rsip 层可在「本地引擎 / 平台后端」之间无缝切换。
 */
import type {
  RsipDashboard,
  RsipDiagnosis,
  RsipFreezeInput,
  RsipFreezeRecord,
  RsipFreezeReleaseInput,
  RsipFreezeReleaseResult,
  RsipGroupInput,
  RsipHandItem,
  RsipAttachInput,
  RsipOnboardingInput,
  RsipOverview,
  RsipPolicy,
  RsipPolicyGroup,
  RsipPolicyInput,
  RsipProgress,
  RsipReviewResult,
  RsipReviewSubmitInput,
  RsipSettingsInput,
  RsipTodayStatus,
  RsipTree,
  RsipTreeCreateInput,
  RsipTreeTier,
  RsipTreeUpdateInput,
  RsipTreeNode,
  RsipUserSettings,
  RsipVerdict,
  RsipWinReport,
  RsipWinReportInput,
} from '@shared/api.interface';

/* ---------------- 日期工具（业务时区 = 本地，按 Asia/Shanghai 使用） ---------------- */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- 内部扁平状态 ---------------- */

interface RawNode {
  nodeId: string;
  policyId: string;
  treeId: string;
  parentNodeId: string | null;
  attachedOn: string;
  active: boolean;
  extinguishedOn: string | null;
}

interface RawTree {
  id: string;
  name: string;
  goal: string | null;
  tier: RsipTreeTier;
  archived: boolean;
  archivedAt: string | null;
}

interface ReviewRecord {
  date: string;
  verdicts: { nodeId: string; policyId: string; verdict: RsipVerdict }[];
  late: boolean;
  notes: string | null;
}

interface LocalState {
  settings: RsipUserSettings;
  firstUseDate: string | null;
  cleanReviewStreak: number;
  policies: RsipPolicy[];
  trees: RawTree[];
  nodes: RawNode[];
  progress: Record<string, RsipProgress>;
  reviews: Record<string, ReviewRecord>;
  rollbacks: RsipOverview['rollbacks'];
  freezes: RsipFreezeRecord[];
  groups: RsipPolicyGroup[];
  winReports: RsipWinReport[];
  diagnoses: RsipDiagnosis[];
}

const STORAGE_KEY = 'rsip-local-state-v1';

function defaultSettings(): RsipUserSettings {
  return {
    reviewWindowStart: '21:30',
    reviewWindowEnd: '23:30',
    onboarded: false,
  };
}

function emptyState(): LocalState {
  return {
    settings: defaultSettings(),
    firstUseDate: null,
    cleanReviewStreak: 0,
    policies: [],
    trees: [],
    nodes: [],
    progress: {},
    reviews: {},
    rollbacks: [],
    freezes: [],
    groups: [],
    winReports: [],
    diagnoses: [],
  };
}

function loadState(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as LocalState;
    // 简单合并，保证新增字段存在
    return { ...emptyState(), ...parsed, settings: { ...defaultSettings(), ...parsed.settings } };
  } catch {
    return emptyState();
  }
}

function saveState(state: LocalState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- 组装 overview ---------------- */

function isFrozenOn(state: LocalState, node: RawNode, date: string): RsipFreezeRecord | null {
  for (const f of state.freezes) {
    if (f.released) continue;
    if (date < f.startDate || date > f.endDate) continue;
    if (f.scopeWholeTree && f.treeId === node.treeId) return f;
    if (f.scopeNodeIds.includes(node.nodeId)) return f;
  }
  return null;
}

function buildTreeNode(
  state: LocalState,
  node: RawNode,
  date: string,
): RsipTreeNode {
  const policy = state.policies.find((p) => p.id === node.policyId)!;
  const frozen = isFrozenOn(state, node, date);
  const children = state.nodes
    .filter((n) => n.active && n.parentNodeId === node.nodeId)
    .sort((a, b) => a.attachedOn.localeCompare(b.attachedOn))
    .map((n) => buildTreeNode(state, n, date));
  return {
    nodeId: node.nodeId,
    policyId: node.policyId,
    treeId: node.treeId,
    parentNodeId: node.parentNodeId,
    attachedOn: node.attachedOn,
    policy,
    progress: state.progress[node.policyId] ?? null,
    frozenBy: frozen ? { freezeId: frozen.id, endDate: frozen.endDate } : null,
    pendingRelease: state.freezes.some(
      (f) =>
        !f.released &&
        f.needsRelease &&
        (f.scopeNodeIds.includes(node.nodeId) ||
          (f.scopeWholeTree && f.treeId === node.treeId)),
    ),
    children,
  };
}

function buildTree(state: LocalState, raw: RawTree, date: string): RsipTree {
  const rootNode = state.nodes.find(
    (n) => n.treeId === raw.id && n.parentNodeId === null && n.active,
  );
  const activeCount = state.nodes.filter((n) => n.treeId === raw.id && n.active).length;
  return {
    id: raw.id,
    name: raw.name,
    goal: raw.goal,
    tier: raw.tier,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
    nodeCount: activeCount,
    root: rootNode ? buildTreeNode(state, rootNode, date) : null,
  };
}

function buildHand(state: LocalState): RsipHandItem[] {
  // 手牌：未退役、且当前没有任何 active 节点的国策
  return state.policies
    .filter((p) => !p.isRetired)
    .filter((p) => !state.nodes.some((n) => n.policyId === p.id && n.active))
    .map((p) => {
      const everLit = state.nodes.some((n) => n.policyId === p.id);
      return {
        policy: p,
        progress: state.progress[p.id] ?? null,
        everLit,
      };
    });
}

function buildToday(state: LocalState, date: string): RsipTodayStatus {
  const review = state.reviews[date];
  const reviewCompleted = !!review;
  const reviewLate = review?.late ?? false;
  const windowOpen =
    nowMinutes() >= hmToMinutes(state.settings.reviewWindowStart) &&
    nowMinutes() <= hmToMinutes(state.settings.reviewWindowEnd);

  const activeNodes = state.nodes.filter((n) => n.active);
  const dueCount = activeNodes.filter((n) => !isFrozenOn(state, n, date)).length;

  const attachUsedToday = activeNodes.some((n) => n.attachedOn === date);
  const hadRollbackToday = state.rollbacks.some((r) => r.occurredOn === date);

  const anyProgressOver3 = Object.values(state.progress).some(
    (p) => p.cumulativeLitDays > 3,
  );
  const canAttachToday =
    reviewCompleted && !reviewLate && !hadRollbackToday && !attachUsedToday && anyProgressOver3;

  // 连续漏结算天数
  let missedReviewDays = 0;
  if (!reviewCompleted) {
    // 只有当前时间已过结算窗口结束，今天才可能计为漏结算；
    // 窗口前 / 窗口内（含新用户首日）不计，避免一打开就提示漏结算。
    const windowEnd = hmToMinutes(state.settings.reviewWindowEnd);
    const cursor = new Date();
    if (nowMinutes() <= windowEnd) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (let i = 0; i < 30; i++) {
      const d = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate(),
      ).padStart(2, '0')}`;
      // 不早于首次使用日期
      if (state.firstUseDate && d < state.firstUseDate) {
        break;
      }
      if (state.reviews[d]) {
        break;
      }
      // 当天有应结算节点：在 d 已挂载、仍点亮、未冻结
      const hasDue = state.nodes.some(
        (n) =>
          n.attachedOn <= d &&
          (n.extinguishedOn === null || d < n.extinguishedOn) &&
          !isFrozenOn(state, n, d),
      );
      if (hasDue) {
        missedReviewDays += 1;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const hasPendingRelease = state.freezes.some((f) => !f.released && f.needsRelease);

  return {
    date,
    windowOpen,
    reviewCompleted,
    reviewLate,
    hadRollbackToday,
    dueCount,
    attachUsedToday,
    canAttachToday,
    missedReviewDays,
    hasPendingRelease,
  };
}

function buildOverview(state: LocalState): RsipOverview {
  const date = todayStr();
  const trees = state.trees
    .filter((t) => !t.archived)
    .map((t) => buildTree(state, t, date));
  const precedents = state.policies.filter((p) => p.isRetired);
  const needsRootRebuild =
    state.settings.onboarded && trees.every((t) => t.root === null);
  return {
    settings: state.settings,
    today: buildToday(state, date),
    trees,
    needsRootRebuild,
    hand: buildHand(state),
    precedents,
    groups: state.groups.map((g) => ({
      ...g,
      policyCount: state.policies.filter((p) => p.groupId === g.id && !p.isRetired).length,
    })),
    winReports: [...state.winReports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
    freezes: state.freezes.map((f) => decorateFreeze(state, f, date)),
    rollbacks: [...state.rollbacks].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    diagnoses: state.diagnoses,
    firstUseDate: state.firstUseDate,
  };
}

function decorateFreeze(state: LocalState, f: RsipFreezeRecord, date: string): RsipFreezeRecord {
  return { ...f, needsRelease: !f.released && f.endDate <= date };
}

/* ---------------- 国策构造 ---------------- */

function buildPolicy(input: RsipPolicyInput, existing?: RsipPolicy): RsipPolicy {
  const base: RsipPolicy =
    existing ?? {
      id: uid('pol'),
      name: '',
      type: 'passive',
      trigger: null,
      judge: '',
      templateId: null,
      iconKey: null,
      groupId: null,
      leverage: null,
      relevant: null,
      isRetired: false,
      retireReason: null,
      createdAt: new Date().toISOString(),
    };
  return {
    ...base,
    name: input.name,
    type: input.type,
    trigger: input.type === 'semi_passive' ? input.trigger ?? null : null,
    judge: input.judge,
    templateId: input.templateId ?? existing?.templateId ?? null,
    iconKey: input.iconKey ?? existing?.iconKey ?? null,
    groupId: input.groupId ?? existing?.groupId ?? null,
    leverage: input.leverage ?? existing?.leverage ?? null,
    relevant: input.relevant ?? existing?.relevant ?? null,
  };
}

function activeIgnitedCount(state: LocalState): number {
  return state.nodes.filter((n) => {
    if (!n.active) return false;
    const p = state.policies.find((x) => x.id === n.policyId);
    return p?.type === 'active';
  }).length;
}

/* ---------------- 递归回滚 ---------------- */

function collectSubtree(state: LocalState, rootNodeId: string): RawNode[] {
  const result: RawNode[] = [];
  const walk = (id: string) => {
    const node = state.nodes.find((n) => n.nodeId === id);
    if (!node) return;
    result.push(node);
    state.nodes
      .filter((n) => n.active && n.parentNodeId === id)
      .forEach((c) => walk(c.nodeId));
  };
  walk(rootNodeId);
  return result;
}

function rollbackFrom(
  state: LocalState,
  triggerNodeId: string,
  date: string,
): { swept: RawNode[]; triggerPolicy: RsipPolicy } {
  const swept = collectSubtree(state, triggerNodeId);
  for (const n of swept) {
    n.active = false;
    n.extinguishedOn = date;
    const prog = state.progress[n.policyId];
    if (prog) prog.currentStreak = 0;
  }
  const triggerNode = state.nodes.find((n) => n.nodeId === triggerNodeId)!;
  const triggerPolicy = state.policies.find((p) => p.id === triggerNode.policyId)!;
  state.rollbacks.push({
    id: uid('rb'),
    occurredOn: date,
    triggerPolicyId: triggerPolicy.id,
    triggerPolicyName: triggerPolicy.name,
    sweptCount: swept.length,
    reasonScenario: null,
    lesson: null,
  });
  return { swept, triggerPolicy };
}

/* ---------------- 精锐继承（v1.1） ---------------- */

function treeScore(state: LocalState, treeId: string): number {
  const treeNodes = state.nodes.filter((n) => n.treeId === treeId);
  const root = treeNodes.find((n) => n.parentNodeId === null);
  let rootAge = 0;
  let rootCum = 0;
  if (root) {
    const today = todayStr();
    // 根存活天数：active 则按今天-挂载，否则按熄灭-挂载
    const end = root.active ? today : root.extinguishedOn ?? root.attachedOn;
    rootAge = Math.max(
      0,
      Math.round((Date.parse(end) - Date.parse(root.attachedOn)) / 86400000),
    );
    rootCum = state.progress[root.policyId]?.cumulativeLitDays ?? 0;
  }
  return rootAge * 0.6 + rootCum * 0.4;
}

function handleSuccession(state: LocalState, collapsedEliteTreeId: string): void {
  const candidates = state.trees.filter(
    (t) => !t.archived && t.tier === 'normal' && t.id !== collapsedEliteTreeId,
  );
  if (candidates.length === 0) return;
  candidates.sort((a, b) => treeScore(state, b.id) - treeScore(state, a.id));
  const successor = candidates[0];
  successor.tier = 'elite';
}

/* ---------------- 里程碑检测 ---------------- */

const STREAK_MILESTONES: [number, RsipWinReport['milestoneType']][] = [
  [7, 'streak_7'],
  [21, 'streak_21'],
  [100, 'streak_100'],
];
const CUM_MILESTONES: [number, RsipWinReport['milestoneType']][] = [
  [30, 'cumulative_30'],
  [100, 'cumulative_100'],
  [365, 'cumulative_365'],
];

function makeMilestoneWin(
  policy: RsipPolicy,
  type: NonNullable<RsipWinReport['milestoneType']>,
  title: string,
): RsipWinReport {
  return {
    id: uid('win'),
    title,
    content: title,
    source: 'milestone',
    milestoneType: type,
    relatedPolicyId: policy.id,
    relatedPolicyName: policy.name,
    createdAt: new Date().toISOString(),
  };
}

/* ---------------- 引擎操作 ---------------- */

export const localEngine = {
  getOverview(): RsipOverview {
    const state = loadState();
    return buildOverview(state);
  },

  onboarding(input: RsipOnboardingInput): RsipOverview {
    const state = loadState();
    if (state.settings.onboarded) return buildOverview(state);
    const date = todayStr();

    // 创建候选国策
    const created: RsipPolicy[] = input.candidates.map((c) => buildPolicy(c));
    state.policies.push(...created);
    const rootPolicy = created[input.rootIndex];

    // 创建第一棵树
    const tree: RawTree = {
      id: uid('tree'),
      name: '第一棵国策树',
      goal: input.bigGoal,
      tier: 'normal',
      archived: false,
      archivedAt: null,
    };
    state.trees.push(tree);

    // 挂根
    const rootNode: RawNode = {
      nodeId: uid('node'),
      policyId: rootPolicy.id,
      treeId: tree.id,
      parentNodeId: null,
      attachedOn: date,
      active: true,
      extinguishedOn: null,
    };
    state.nodes.push(rootNode);
    state.progress[rootPolicy.id] = {
      policyId: rootPolicy.id,
      cumulativeLitDays: 0,
      currentStreak: 0,
      lastLitDate: null,
    };

    // 诊断记录
    state.diagnoses.push({
      id: uid('diag'),
      treeId: tree.id,
      negativeStableState: input.negativeStableState,
      backtraceChain: input.backtraceChain,
      effectiveInterventionNode: input.effectiveInterventionNode,
      createdAt: new Date().toISOString(),
    });

    state.settings.onboarded = true;
    state.firstUseDate = date;
    saveState(state);
    return buildOverview(state);
  },

  createPolicy(input: RsipPolicyInput): RsipPolicy {
    const state = loadState();
    const policy = buildPolicy(input);
    state.policies.push(policy);
    saveState(state);
    return policy;
  },

  updatePolicy(id: string, input: RsipPolicyInput): RsipPolicy {
    const state = loadState();
    const existing = state.policies.find((p) => p.id === id);
    if (!existing) throw new Error('国策不存在');
    const updated = buildPolicy(input, existing);
    Object.assign(existing, updated);
    saveState(state);
    return existing;
  },

  attachNode(input: RsipAttachInput): RsipOverview {
    const state = loadState();
    const date = todayStr();
    const today = buildToday(state, date);

    if (today.attachUsedToday) throw new Error('今天已经挂载过国策，每天最多新增 1 条');
    if (!today.reviewCompleted) throw new Error('请先完成今日结算');
    if (today.hadRollbackToday) throw new Error('今天发生过回滚，明天再新增');
    if (!Object.values(state.progress).some((p) => p.cumulativeLitDays > 3)) {
      throw new Error('需要先有国策累计点亮超过 3 天，才能新增');
    }

    const policy = state.policies.find((p) => p.id === input.policyId);
    if (!policy) throw new Error('国策不存在');
    if (policy.isRetired) throw new Error('该国策已退役，不能挂载');

    let treeId: string;
    let parentNodeId: string | null = input.parentNodeId;

    if (input.parentNodeId === null) {
      // 建根
      const tree = state.trees.find((t) => t.id === input.treeId && !t.archived);
      if (!tree) throw new Error('目标树不存在');
      if (state.nodes.some((n) => n.treeId === tree.id && n.parentNodeId === null && n.active)) {
        throw new Error('这棵树已经有根了');
      }
      if (policy.type === 'active') throw new Error('根国策不允许是主动型');
      treeId = tree.id;
      parentNodeId = null;
    } else {
      const parent = state.nodes.find((n) => n.nodeId === input.parentNodeId && n.active);
      if (!parent) throw new Error('父节点不存在或已熄灭');
      treeId = parent.treeId;
    }

    if (policy.type === 'active') {
      if (activeIgnitedCount(state) >= 3) throw new Error('主动型国策最多同时存在 3 条');
    }

    const node: RawNode = {
      nodeId: uid('node'),
      policyId: policy.id,
      treeId,
      parentNodeId,
      attachedOn: date,
      active: true,
      extinguishedOn: null,
    };
    state.nodes.push(node);
    if (!state.progress[policy.id]) {
      state.progress[policy.id] = {
        policyId: policy.id,
        cumulativeLitDays: 0,
        currentStreak: 0,
        lastLitDate: null,
      };
    }
    saveState(state);
    return buildOverview(state);
  },

  submitReview(input: RsipReviewSubmitInput): RsipReviewResult {
    const state = loadState();
    const date = todayStr();
    if (state.reviews[date]) throw new Error('今日已结算');

    const newWins: RsipWinReport[] = [];
    const rolledBackPolicies: string[] = [];
    const retiredPolicies: string[] = [];
    let hadRollback = false;

    // 先处理 legalized（退役，不级联）
    for (const v of input.verdicts) {
      if (v.verdict !== 'legalized') continue;
      const node = state.nodes.find((n) => n.nodeId === v.nodeId && n.active);
      if (!node) continue;
      const policy = state.policies.find((p) => p.id === node.policyId)!;
      policy.isRetired = true;
      policy.retireReason = '下必为例：永久合法化';
      node.active = false;
      node.extinguishedOn = date;
      retiredPolicies.push(policy.id);
    }

    // 处理 violated（递归回滚）
    for (const v of input.verdicts) {
      if (v.verdict !== 'violated') continue;
      const node = state.nodes.find((n) => n.nodeId === v.nodeId && n.active);
      if (!node) continue;
      const tree = state.trees.find((t) => t.id === node.treeId)!;
      const { swept, triggerPolicy } = rollbackFrom(state, node.nodeId, date);
      hadRollback = true;
      rolledBackPolicies.push(...swept.map((n) => n.policyId));
      // 精锐树根崩塌 → 触发继承
      if (tree.tier === 'elite' && node.parentNodeId === null) {
        handleSuccession(state, tree.id);
      }
      void triggerPolicy;
    }

    // 处理 satisfied（更新进度 + 里程碑）
    for (const v of input.verdicts) {
      if (v.verdict !== 'satisfied') continue;
      const node = state.nodes.find((n) => n.nodeId === v.nodeId && n.active);
      if (!node) continue;
      const policy = state.policies.find((p) => p.id === node.policyId)!;
      const prog =
        state.progress[policy.id] ??
        { policyId: policy.id, cumulativeLitDays: 0, currentStreak: 0, lastLitDate: null };
      const oldStreak = prog.currentStreak;
      const oldCum = prog.cumulativeLitDays;
      prog.cumulativeLitDays += 1;
      prog.currentStreak += 1;
      prog.lastLitDate = date;
      state.progress[policy.id] = prog;

      for (const [threshold, type] of STREAK_MILESTONES) {
        if (oldStreak < threshold && prog.currentStreak >= threshold) {
          newWins.push(makeMilestoneWin(policy, type, `连续点亮 ${threshold} 天`));
        }
      }
      for (const [threshold, type] of CUM_MILESTONES) {
        if (oldCum < threshold && prog.cumulativeLitDays >= threshold) {
          newWins.push(makeMilestoneWin(policy, type, `累计点亮 ${threshold} 天`));
        }
      }
    }

    // 清洁结算 streak
    if (!input.late && !hadRollback) {
      const oldClean = state.cleanReviewStreak;
      state.cleanReviewStreak += 1;
      if (oldClean < 7 && state.cleanReviewStreak >= 7) {
        newWins.push({
          id: uid('win'),
          title: '连续 7 天清洁结算',
          content: '连续 7 天按时结算且无回滚',
          source: 'milestone',
          milestoneType: 'clean_7',
          relatedPolicyId: null,
          relatedPolicyName: null,
          createdAt: new Date().toISOString(),
        });
      }
      if (oldClean < 30 && state.cleanReviewStreak >= 30) {
        newWins.push({
          id: uid('win'),
          title: '连续 30 天清洁结算',
          content: '连续 30 天按时结算且无回滚',
          source: 'milestone',
          milestoneType: 'clean_30',
          relatedPolicyId: null,
          relatedPolicyName: null,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      state.cleanReviewStreak = 0;
    }

    state.winReports.push(...newWins);

    state.reviews[date] = {
      date,
      verdicts: input.verdicts.map((v) => ({
        nodeId: v.nodeId,
        policyId: state.nodes.find((n) => n.nodeId === v.nodeId)?.policyId ?? '',
        verdict: v.verdict,
      })),
      late: input.late,
      notes: input.notes ?? null,
    };

    saveState(state);
    const after = buildToday(state, date);
    return {
      date,
      hadRollback,
      rolledBackPolicies: [...new Set(rolledBackPolicies)],
      retiredPolicies: [...new Set(retiredPolicies)],
      canAttachToday: after.canAttachToday,
      newWinReports: newWins,
    };
  },

  createFreeze(input: RsipFreezeInput): RsipFreezeRecord {
    const state = loadState();
    if (input.scopeWholeTree && !input.treeId) throw new Error('整树冻结需指定树');
    if (input.endDate < input.startDate) throw new Error('结束日期不能早于开始日期');
    const days = Math.round(
      (Date.parse(input.endDate) - Date.parse(input.startDate)) / 86400000,
    );
    if (days > 14) throw new Error('冻结期限最长 14 天');

    let scopeNodeIds = input.scopeNodeIds;
    if (input.scopeWholeTree) {
      scopeNodeIds = state.nodes
        .filter((n) => n.active && n.treeId === input.treeId)
        .map((n) => n.nodeId);
    }
    const record: RsipFreezeRecord = {
      id: uid('frz'),
      scopeWholeTree: input.scopeWholeTree,
      treeId: input.scopeWholeTree ? input.treeId ?? null : null,
      scopeNodeIds,
      reason: input.reason,
      startDate: input.startDate,
      endDate: input.endDate,
      released: false,
      releasedOn: null,
      needsRelease: false,
    };
    state.freezes.push(record);
    saveState(state);
    return record;
  },

  releaseFreeze(id: string, input: RsipFreezeReleaseInput): RsipFreezeReleaseResult {
    const state = loadState();
    const date = todayStr();
    const freeze = state.freezes.find((f) => f.id === id);
    if (!freeze) throw new Error('冻结记录不存在');
    const rolledBackPolicies: string[] = [];

    for (const v of input.verdicts) {
      const node = state.nodes.find((n) => n.nodeId === v.nodeId && n.active);
      if (!node) continue;
      if (v.verdict === 'violated') {
        const { swept } = rollbackFrom(state, node.nodeId, date);
        rolledBackPolicies.push(...swept.map((n) => n.policyId));
      }
    }
    freeze.released = true;
    freeze.releasedOn = date;
    saveState(state);
    return { rolledBackPolicies: [...new Set(rolledBackPolicies)] };
  },

  updateSettings(input: RsipSettingsInput): RsipUserSettings {
    const state = loadState();
    state.settings.reviewWindowStart = input.reviewWindowStart;
    state.settings.reviewWindowEnd = input.reviewWindowEnd;
    saveState(state);
    return state.settings;
  },

  createTree(input: RsipTreeCreateInput): RsipOverview {
    const state = loadState();
    const date = todayStr();
    const today = buildToday(state, date);
    if (today.attachUsedToday) throw new Error('今天已经挂载过国策，每天最多新增 1 条');
    if (!today.reviewCompleted) throw new Error('请先完成今日结算');

    const rootPolicy = state.policies.find((p) => p.id === input.rootPolicyId && !p.isRetired);
    if (!rootPolicy) throw new Error('根国策不存在');
    if (rootPolicy.type === 'active') throw new Error('根国策不允许是主动型');

    if (input.tier === 'elite') {
      if (state.trees.some((t) => !t.archived && t.tier === 'elite')) {
        throw new Error('已经存在精锐树，同一时刻只能有一棵');
      }
    }

    const tree: RawTree = {
      id: uid('tree'),
      name: input.name,
      goal: input.goal ?? null,
      tier: input.tier ?? 'normal',
      archived: false,
      archivedAt: null,
    };
    state.trees.push(tree);
    state.nodes.push({
      nodeId: uid('node'),
      policyId: rootPolicy.id,
      treeId: tree.id,
      parentNodeId: null,
      attachedOn: date,
      active: true,
      extinguishedOn: null,
    });
    if (!state.progress[rootPolicy.id]) {
      state.progress[rootPolicy.id] = {
        policyId: rootPolicy.id,
        cumulativeLitDays: 0,
        currentStreak: 0,
        lastLitDate: null,
      };
    }
    saveState(state);
    return buildOverview(state);
  },

  updateTree(id: string, input: RsipTreeUpdateInput): RsipOverview {
    const state = loadState();
    const tree = state.trees.find((t) => t.id === id);
    if (!tree) throw new Error('树不存在');
    if (input.name !== undefined) tree.name = input.name;
    if (input.goal !== undefined) tree.goal = input.goal;
    saveState(state);
    return buildOverview(state);
  },

  archiveTree(id: string): RsipOverview {
    const state = loadState();
    const tree = state.trees.find((t) => t.id === id);
    if (!tree) throw new Error('树不存在');
    const date = todayStr();
    tree.archived = true;
    tree.archivedAt = date;
    // 树上节点退回手牌
    state.nodes
      .filter((n) => n.treeId === id && n.active)
      .forEach((n) => {
        n.active = false;
        n.extinguishedOn = date;
      });
    // 若归档的是精锐树，触发继承
    if (tree.tier === 'elite') handleSuccession(state, id);
    saveState(state);
    return buildOverview(state);
  },

  createGroup(input: RsipGroupInput): RsipPolicyGroup {
    const state = loadState();
    const group: RsipPolicyGroup = { id: uid('grp'), name: input.name, policyCount: 0 };
    state.groups.push(group);
    saveState(state);
    return group;
  },

  updateGroup(id: string, input: RsipGroupInput): RsipPolicyGroup {
    const state = loadState();
    const group = state.groups.find((g) => g.id === id);
    if (!group) throw new Error('组不存在');
    group.name = input.name;
    saveState(state);
    return group;
  },

  deleteGroup(id: string): void {
    const state = loadState();
    state.groups = state.groups.filter((g) => g.id !== id);
    state.policies.forEach((p) => {
      if (p.groupId === id) p.groupId = null;
    });
    saveState(state);
  },

  assignPolicyGroup(policyId: string, groupId: string | null): RsipPolicy {
    const state = loadState();
    const policy = state.policies.find((p) => p.id === policyId);
    if (!policy) throw new Error('国策不存在');
    policy.groupId = groupId;
    saveState(state);
    return policy;
  },

  createWinReport(input: RsipWinReportInput): RsipWinReport {
    const state = loadState();
    const report: RsipWinReport = {
      id: uid('win'),
      title: input.title,
      content: input.content,
      source: 'manual',
      milestoneType: null,
      relatedPolicyId: null,
      relatedPolicyName: null,
      createdAt: new Date().toISOString(),
    };
    state.winReports.push(report);
    saveState(state);
    return report;
  },

  getDashboard(): RsipDashboard {
    const state = loadState();
    const date = todayStr();

    const activeTrees = state.trees.filter((t) => !t.archived);
    const archivedTrees = state.trees.filter((t) => t.archived);

    const onTreePolicies = new Set(
      state.nodes.filter((n) => n.active).map((n) => n.policyId),
    );
    const handPolicies = state.policies
      .filter((p) => !p.isRetired)
      .filter((p) => !onTreePolicies.has(p.id));

    const totalCumulative = Object.values(state.progress).reduce(
      (s, p) => s + p.cumulativeLitDays,
      0,
    );
    const maxStreak = Object.values(state.progress).reduce(
      (m, p) => Math.max(m, p.currentStreak),
      0,
    );

    // 近 30 天 daily
    const daily = Object.values(state.reviews)
      .filter((r) => r.date >= addDays(date, -29))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        litCount: r.verdicts.filter((v) => v.verdict === 'satisfied').length,
        violatedCount: r.verdicts.filter((v) => v.verdict === 'violated').length,
        late: r.late,
      }));

    const trees = activeTrees.map((t) => {
      const treePolicies = new Set(
        state.nodes.filter((n) => n.treeId === t.id).map((n) => n.policyId),
      );
      const cum = [...treePolicies].reduce(
        (s, pid) => s + (state.progress[pid]?.cumulativeLitDays ?? 0),
        0,
      );
      const streak = [...treePolicies].reduce(
        (m, pid) => Math.max(m, state.progress[pid]?.currentStreak ?? 0),
        0,
      );
      return {
        treeId: t.id,
        name: t.name,
        goal: t.goal,
        nodeCount: state.nodes.filter((n) => n.treeId === t.id && n.active).length,
        totalCumulativeLitDays: cum,
        maxCurrentStreak: streak,
      };
    });

    const groups = state.groups.map((g) => {
      const members = state.policies.filter((p) => p.groupId === g.id && !p.isRetired);
      return {
        groupId: g.id,
        name: g.name,
        policyCount: members.length,
        onTreeCount: members.filter((p) => onTreePolicies.has(p.id)).length,
        totalCumulativeLitDays: members.reduce(
          (s, p) => s + (state.progress[p.id]?.cumulativeLitDays ?? 0),
          0,
        ),
      };
    });

    return {
      totals: {
        activeTreeCount: activeTrees.length,
        archivedTreeCount: archivedTrees.length,
        onTreePolicyCount: onTreePolicies.size,
        handPolicyCount: handPolicies.length,
        precedentCount: state.policies.filter((p) => p.isRetired).length,
        groupCount: state.groups.length,
        totalCumulativeLitDays: totalCumulative,
        maxCurrentStreak: maxStreak,
        rollbackCount: state.rollbacks.length,
        freezeCount: state.freezes.length,
        winReportCount: state.winReports.length,
        cleanReviewStreak: state.cleanReviewStreak,
      },
      daily,
      trees,
      groups,
      archivedTrees: archivedTrees.map((t) => ({
        id: t.id,
        name: t.name,
        archivedAt: t.archivedAt ?? date,
        nodeCount: state.nodes.filter((n) => n.treeId === t.id).length,
      })),
      recentRollbacks: [...state.rollbacks]
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
        .slice(0, 10),
      recentWinReports: [...state.winReports]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
      firstUseDate: state.firstUseDate,
    };
  },

  /** 重置本地数据（调试用） */
  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};

function addDays(date: string, delta: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
