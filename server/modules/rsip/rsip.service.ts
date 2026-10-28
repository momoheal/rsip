import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import type {
  RsipDashboard,
  RsipDashboardArchivedTree,
  RsipDashboardDailyPoint,
  RsipDashboardGroupStat,
  RsipDashboardTotals,
  RsipDashboardTreeStat,
  RsipFreezeRecord,
  RsipHandItem,
  RsipMilestoneType,
  RsipOverview,
  RsipPolicy,
  RsipPolicyGroup,
  RsipProgress,
  RsipRollbackEvent,
  RsipTree,
  RsipTreeNode,
  RsipUserSettings,
  RsipWinReport,
} from '@shared/api.interface';
import {
  rsipDailyReviews,
  rsipFreezeRecords,
  rsipPolicies,
  rsipPolicyGroups,
  rsipProgress,
  rsipRollbackEvents,
  rsipTreeNodes,
  rsipTrees,
  rsipUserSettings,
  rsipWinReports,
} from '@server/database/schema';
import type {
  RsipAttachDto,
  RsipFreezeDto,
  RsipGroupDto,
  RsipOnboardingDto,
  RsipPolicyDto,
  RsipPolicyGroupAssignDto,
  RsipRollbackNoteDto,
  RsipSettingsDto,
  RsipTreeCreateDto,
  RsipTreeUpdateDto,
  RsipWinReportDto,
} from './rsip.dto';
import {
  addDays,
  dateToShanghaiString,
  daysBetween,
  isWindowOpen,
  shanghaiNow,
  todayShanghai,
  validatePolicyDraft,
} from './rsip.util';

type PolicyRow = typeof rsipPolicies.$inferSelect;
type NodeRow = typeof rsipTreeNodes.$inferSelect;
type ProgressRow = typeof rsipProgress.$inferSelect;
type FreezeRow = typeof rsipFreezeRecords.$inferSelect;
type RollbackRow = typeof rsipRollbackEvents.$inferSelect;
type SettingsRow = typeof rsipUserSettings.$inferSelect;
type TreeRow = typeof rsipTrees.$inferSelect;
type GroupRow = typeof rsipPolicyGroups.$inferSelect;
type WinReportRow = typeof rsipWinReports.$inferSelect;

interface VerdictItem {
  nodeId: string;
  policyId: string;
  verdict: string;
}

const MAX_TREE_DEPTH = 50;
const WIN_REPORT_LIST_LIMIT = 20;

function toPolicy(row: PolicyRow): RsipPolicy {
  return {
    id: row.id,
    name: row.name,
    type: row.type as RsipPolicy['type'],
    trigger: row.triggerText,
    judge: row.judge,
    templateId: row.templateId,
    iconKey: row.iconKey,
    groupId: row.groupId,
    isRetired: row.retiredAt !== null,
    retireReason: row.retireReason,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProgress(row: ProgressRow): RsipProgress {
  return {
    policyId: row.policyId,
    cumulativeLitDays: row.cumulativeLitDays,
    currentStreak: row.currentStreak,
    lastLitDate: row.lastLitDate,
  };
}

function toFreeze(row: FreezeRow, today: string): RsipFreezeRecord {
  const needsRelease = !row.released && row.endDate === today;
  return {
    id: row.id,
    scopeWholeTree: row.scopeWholeTree,
    treeId: row.treeId,
    scopeNodeIds: row.scopeNodeIds as string[],
    reason: row.reason,
    startDate: row.startDate,
    endDate: row.endDate,
    released: row.released,
    releasedOn: row.releasedOn,
    needsRelease,
  };
}

export function toWinReport(
  row: WinReportRow,
  policyNameById: Map<string, string>,
): RsipWinReport {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source === 'milestone' ? 'milestone' : 'manual',
    milestoneType: row.milestoneType as RsipMilestoneType | null,
    relatedPolicyId: row.relatedPolicyId,
    relatedPolicyName:
      row.relatedPolicyId !== null
        ? (policyNameById.get(row.relatedPolicyId) ?? null)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRollbackEvent(
  row: RollbackRow,
  policyById: Map<string, PolicyRow>,
): RsipRollbackEvent {
  return {
    id: row.id,
    occurredOn: row.occurredOn,
    triggerPolicyId: row.triggerPolicyId,
    triggerPolicyName: policyById.get(row.triggerPolicyId)?.name ?? '未知国策',
    sweptCount: row.sweptCount,
    reasonScenario: row.reasonScenario,
    lesson: row.lesson,
  };
}

export interface CleanReviewRecord {
  reviewDate: string;
  late: boolean;
  hadRollback: boolean;
}

/** 连续「按时结算且无回滚」天数；今日未结算时从昨天起算 */
export function computeCleanReviewStreak(
  records: CleanReviewRecord[],
  today: string,
): number {
  const byDate = new Map<string, CleanReviewRecord>();
  for (const r of records) byDate.set(r.reviewDate, r);
  let cursor = byDate.has(today) ? today : addDays(today, -1);
  let streak = 0;
  for (let i = 0; i < 3660; i += 1) {
    const record = byDate.get(cursor);
    if (record === undefined) break;
    if (record.late || record.hadRollback) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

@Injectable()
export class RsipService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getOverview(): Promise<RsipOverview> {
    const today = todayShanghai();
    const { time } = shanghaiNow();
    const settingsRow = await this.getOrCreateSettingsRow();

    await this.db
      .update(rsipFreezeRecords)
      .set({ endDate: today, updatedAt: new Date() })
      .where(
        and(
          eq(rsipFreezeRecords.released, false),
          lt(rsipFreezeRecords.endDate, today),
        ),
      );

    const nodes: NodeRow[] = await this.db
      .select()
      .from(rsipTreeNodes)
      .where(isNull(rsipTreeNodes.extinguishedAt));
    const allNodePolicyIds = await this.db
      .select({ policyId: rsipTreeNodes.policyId })
      .from(rsipTreeNodes);
    const policies: PolicyRow[] = await this.db.select().from(rsipPolicies);
    const progressRows: ProgressRow[] = await this.db
      .select()
      .from(rsipProgress);
    const treeRows: TreeRow[] = await this.db.select().from(rsipTrees);
    const groupRows: GroupRow[] = await this.db
      .select()
      .from(rsipPolicyGroups);
    const winReportRows: WinReportRow[] = await this.db
      .select()
      .from(rsipWinReports)
      .orderBy(desc(rsipWinReports.createdAt))
      .limit(WIN_REPORT_LIST_LIMIT);
    const freezes: FreezeRow[] = await this.db
      .select()
      .from(rsipFreezeRecords);
    const rollbacks: RollbackRow[] = await this.db
      .select()
      .from(rsipRollbackEvents)
      .orderBy(rsipRollbackEvents.occurredOn)
      .limit(200);
    const reviews = await this.db
      .select({
        reviewDate: rsipDailyReviews.reviewDate,
        late: rsipDailyReviews.late,
        hadRollback: rsipDailyReviews.hadRollback,
      })
      .from(rsipDailyReviews);

    const policyById = new Map<string, PolicyRow>(
      policies.map((p: PolicyRow) => [p.id, p]),
    );
    const policyNameById = new Map<string, string>(
      policies.map((p: PolicyRow) => [p.id, p.name]),
    );
    const progressByPolicy = new Map<string, ProgressRow>(
      progressRows.map((p: ProgressRow) => [p.policyId, p]),
    );

    const freezeScopeNodeIds = (freeze: FreezeRow): string[] => {
      if (!freeze.scopeWholeTree) return freeze.scopeNodeIds as string[];
      if (freeze.treeId === null) return nodes.map((n: NodeRow) => n.id);
      return nodes
        .filter((n: NodeRow) => n.treeId === freeze.treeId)
        .map((n: NodeRow) => n.id);
    };

    const unreleasedFreezes = freezes.filter((f: FreezeRow) => !f.released);
    const activeFreezeByNode = new Map<string, FreezeRow>();
    const releaseFreezeByNode = new Map<string, FreezeRow>();
    for (const f of unreleasedFreezes) {
      if (f.startDate > today || today > f.endDate) continue;
      for (const id of freezeScopeNodeIds(f)) {
        if (!activeFreezeByNode.has(id)) activeFreezeByNode.set(id, f);
      }
    }
    for (const f of unreleasedFreezes) {
      if (f.endDate !== today) continue;
      for (const id of freezeScopeNodeIds(f)) releaseFreezeByNode.set(id, f);
    }
    const frozenNodeIds = new Set<string>(activeFreezeByNode.keys());

    const childrenMap = new Map<string, NodeRow[]>();
    for (const n of nodes) {
      if (n.parentNodeId === null) continue;
      const list = childrenMap.get(n.parentNodeId) ?? [];
      list.push(n);
      childrenMap.set(n.parentNodeId, list);
    }

    const buildTreeNode = (row: NodeRow, depth: number): RsipTreeNode => {
      const policy = policyById.get(row.policyId);
      const progress = progressByPolicy.get(row.policyId);
      const releaseFreeze = releaseFreezeByNode.get(row.id) ?? null;
      const activeFreeze = activeFreezeByNode.get(row.id) ?? null;
      return {
        nodeId: row.id,
        policyId: row.policyId,
        treeId: row.treeId,
        parentNodeId: row.parentNodeId,
        attachedOn: row.attachedOn,
        policy:
          policy !== undefined
            ? toPolicy(policy)
            : {
                id: row.policyId,
                name: '未知国策',
                type: 'passive',
                trigger: null,
                judge: '',
                templateId: null,
                groupId: null,
                isRetired: false,
                retireReason: null,
                createdAt: '',
              },
        progress: progress !== undefined ? toProgress(progress) : null,
        frozenBy:
          releaseFreeze === null && activeFreeze !== null
            ? { freezeId: activeFreeze.id, endDate: activeFreeze.endDate }
            : null,
        pendingRelease: releaseFreeze !== null,
        children:
          depth < MAX_TREE_DEPTH
            ? (childrenMap.get(row.id) ?? []).map((c: NodeRow) =>
                buildTreeNode(c, depth + 1),
              )
            : [],
      };
    };

    const activeNodesByTree = new Map<string, NodeRow[]>();
    for (const n of nodes) {
      const list = activeNodesByTree.get(n.treeId) ?? [];
      list.push(n);
      activeNodesByTree.set(n.treeId, list);
    }
    const activeTreeRows = treeRows.filter(
      (t: TreeRow) => t.archivedAt === null,
    );
    const trees: RsipTree[] = activeTreeRows.map((t: TreeRow) => {
      const treeNodes = activeNodesByTree.get(t.id) ?? [];
      const rootRow = treeNodes.find((n: NodeRow) => n.parentNodeId === null);
      return {
        id: t.id,
        name: t.name,
        goal: t.goal,
        archived: false,
        archivedAt: null,
        nodeCount: treeNodes.length,
        root: rootRow !== undefined ? buildTreeNode(rootRow, 0) : null,
      };
    });

    const activePolicyIds = new Set(nodes.map((n: NodeRow) => n.policyId));
    const everLitPolicyIds = new Set(
      allNodePolicyIds.map((r: { policyId: string }) => r.policyId),
    );
    const hand: RsipHandItem[] = [];
    const precedents: RsipPolicy[] = [];
    for (const p of policies) {
      const policy = toPolicy(p);
      if (p.retiredAt !== null) {
        precedents.push(policy);
        continue;
      }
      if (activePolicyIds.has(p.id)) continue;
      const progress = progressByPolicy.get(p.id);
      hand.push({
        policy,
        progress: progress !== undefined ? toProgress(progress) : null,
        everLit: everLitPolicyIds.has(p.id),
      });
    }

    const dueCount = nodes.filter(
      (n: NodeRow) =>
        n.retiredAt === null &&
        !frozenNodeIds.has(n.id) &&
        policyById.get(n.policyId)?.retiredAt === null,
    ).length;

    const reviewToday = reviews.find(
      (r: { reviewDate: string }) => r.reviewDate === today,
    );
    const attachUsedToday =
      (
        await this.db
          .select({ id: rsipTreeNodes.id })
          .from(rsipTreeNodes)
          .where(eq(rsipTreeNodes.attachedOn, today))
      ).length > 0;
    const rollbackToday =
      rollbacks.some((r: RollbackRow) => r.occurredOn === today) ||
      (reviewToday?.hadRollback ?? false);
    const progressOverThree = progressRows.some(
      (p: ProgressRow) => p.cumulativeLitDays > 3,
    );

    let missedReviewDays = 0;
    if (reviewToday === undefined && settingsRow.onboarded) {
      const sortedDates = reviews
        .map((r: { reviewDate: string }) => r.reviewDate)
        .sort((a: string, b: string) => (a < b ? 1 : -1));
      const lastReviewDate = sortedDates[0];
      const startFrom =
        lastReviewDate !== undefined
          ? addDays(lastReviewDate, 1)
          : settingsRow.onboardedAt !== null
            ? dateToShanghaiString(settingsRow.onboardedAt)
            : today;
      missedReviewDays = Math.min(
        Math.max(daysBetween(startFrom, today), 0),
        30,
      );
    }

    const rollbackEvents: RsipRollbackEvent[] = rollbacks
      .slice()
      .reverse()
      .slice(0, 20)
      .map((r: RollbackRow) => toRollbackEvent(r, policyById));

    const groupPolicyCount = new Map<string, number>();
    for (const p of policies) {
      if (p.groupId === null) continue;
      const count = groupPolicyCount.get(p.groupId) ?? 0;
      groupPolicyCount.set(p.groupId, count + 1);
    }
    const groups: RsipPolicyGroup[] = groupRows.map((g: GroupRow) => ({
      id: g.id,
      name: g.name,
      policyCount: groupPolicyCount.get(g.id) ?? 0,
    }));

    const winReports: RsipWinReport[] = winReportRows.map((r: WinReportRow) =>
      toWinReport(r, policyNameById),
    );

    const settings: RsipUserSettings = {
      reviewWindowStart: settingsRow.reviewWindowStart,
      reviewWindowEnd: settingsRow.reviewWindowEnd,
      onboarded: settingsRow.onboarded,
    };

    return {
      settings,
      today: {
        date: today,
        windowOpen: isWindowOpen(
          time,
          settingsRow.reviewWindowStart,
          settingsRow.reviewWindowEnd,
        ),
        reviewCompleted: reviewToday !== undefined,
        reviewLate: reviewToday?.late ?? false,
        hadRollbackToday: rollbackToday,
        dueCount,
        attachUsedToday,
        canAttachToday:
          reviewToday !== undefined &&
          !rollbackToday &&
          !attachUsedToday &&
          progressOverThree,
        missedReviewDays,
        hasPendingRelease: releaseFreezeByNode.size > 0,
      },
      trees,
      needsRootRebuild:
        settingsRow.onboarded &&
        trees.every((t: RsipTree) => t.root === null),
      hand,
      precedents,
      groups,
      winReports,
      freezes: freezes
        .slice()
        .reverse()
        .map((f: FreezeRow) => toFreeze(f, today)),
      rollbacks: rollbackEvents,
    };
  }

  private async getOrCreateSettingsRow(): Promise<SettingsRow> {
    const rows = await this.db.select().from(rsipUserSettings);
    if (rows.length > 0) return rows[0];
    await this.db.insert(rsipUserSettings).values({});
    const created = await this.db.select().from(rsipUserSettings);
    if (created.length > 0) return created[0];
    throw new ConflictException('用户设置初始化失败，请重试');
  }

  /** 每日新增 / 建树的统一门槛（全局跨树），返回今日日期 */
  private async assertAttachAllowed(
    tx: PostgresJsDatabase,
  ): Promise<string> {
    const settingsRows = await tx.select().from(rsipUserSettings);
    const settingsRow = settingsRows[0];
    if (settingsRow === undefined || !settingsRow.onboarded) {
      throw new BadRequestException('请先完成新手引导');
    }
    const today = todayShanghai();

    const attachedToday = await tx
      .select({ id: rsipTreeNodes.id })
      .from(rsipTreeNodes)
      .where(eq(rsipTreeNodes.attachedOn, today));
    if (attachedToday.length > 0) {
      throw new ConflictException('今天已经挂过国策了，明天再来');
    }
    const rollbackToday = await tx
      .select({ id: rsipRollbackEvents.id })
      .from(rsipRollbackEvents)
      .where(eq(rsipRollbackEvents.occurredOn, today));
    if (rollbackToday.length > 0) {
      throw new ConflictException('今天发生了回滚，今天不新增国策');
    }
    const reviewToday = await tx
      .select({ id: rsipDailyReviews.id })
      .from(rsipDailyReviews)
      .where(eq(rsipDailyReviews.reviewDate, today));
    if (reviewToday.length === 0) {
      throw new ConflictException('请先完成今日结算，再挂新的国策');
    }
    const progressRows = await tx
      .select({ cumulativeLitDays: rsipProgress.cumulativeLitDays })
      .from(rsipProgress);
    if (!progressRows.some((p) => p.cumulativeLitDays > 3)) {
      throw new ConflictException(
        '还没有国策内化超过 3 天，先让现有国策稳定下来',
      );
    }
    return today;
  }

  async completeOnboarding(dto: RsipOnboardingDto): Promise<RsipOverview> {
    await this.db.transaction(async (tx) => {
      const rows = await tx.select().from(rsipUserSettings);
      const settingsRow = rows[0];
      if (settingsRow !== undefined && settingsRow.onboarded) {
        throw new ConflictException('已完成新手引导，不能重复执行');
      }
      if (dto.candidates.length < 3) {
        throw new BadRequestException('至少需要 3 个候选国策');
      }
      if (
        dto.rootIndex < 0 ||
        dto.rootIndex >= dto.candidates.length ||
        !Number.isInteger(dto.rootIndex)
      ) {
        throw new BadRequestException('根国策选择无效');
      }
      if (!dto.ackWorstDay) {
        throw new BadRequestException(
          '必须勾选「我承认这条国策在我最摆烂的一天也能做到」',
        );
      }
      for (const c of dto.candidates) {
        const error = validatePolicyDraft(c);
        if (error !== '') throw new BadRequestException(error);
      }
      const root = dto.candidates[dto.rootIndex];
      if (root !== undefined && root.type === 'active') {
        throw new BadRequestException('根国策不能是主动型，请选被动或半被动型');
      }

      const today = todayShanghai();
      const now = new Date();
      const insertedTrees = await tx
        .insert(rsipTrees)
        .values({ name: '我的国策树', goal: null })
        .returning({ id: rsipTrees.id });
      const treeId = insertedTrees[0]?.id;
      if (treeId === undefined) {
        throw new ConflictException('建树失败，请重试');
      }
      const rootPolicyId = await this.insertPolicyRow(tx, root, now);
      for (const c of dto.candidates) {
        if (c === root) continue;
        await this.insertPolicyRow(tx, c, now);
      }
      await tx.insert(rsipTreeNodes).values({
        policyId: rootPolicyId,
        parentNodeId: null,
        attachedOn: today,
        treeId,
      });
      if (settingsRow === undefined) {
        await tx.insert(rsipUserSettings).values({
          onboarded: true,
          onboardedAt: now,
        });
      } else {
        await tx
          .update(rsipUserSettings)
          .set({ onboarded: true, onboardedAt: now, updatedAt: now })
          .where(eq(rsipUserSettings.id, settingsRow.id));
      }
    });
    return this.getOverview();
  }

  private async insertPolicyRow(
    tx: PostgresJsDatabase,
    dto: RsipPolicyDto,
    now: Date,
  ): Promise<string> {
    const inserted = await tx
      .insert(rsipPolicies)
      .values({
        name: dto.name.trim(),
        type: dto.type,
        triggerText:
          dto.type === 'semi_passive' ? (dto.trigger ?? '').trim() : null,
        judge: dto.judge.trim(),
        templateId: dto.templateId ?? null,
        iconKey: dto.iconKey ?? null,
        groupId: dto.groupId ?? null,
      })
      .returning({ id: rsipPolicies.id });
    const policyId = inserted[0]?.id;
    if (policyId === undefined) {
      throw new ConflictException('国策创建失败，请重试');
    }
    await tx.insert(rsipProgress).values({ policyId });
    return policyId;
  }

  private async assertGroupExists(groupId: string): Promise<void> {
    const rows = await this.db
      .select({ id: rsipPolicyGroups.id })
      .from(rsipPolicyGroups)
      .where(eq(rsipPolicyGroups.id, groupId));
    if (rows.length === 0) throw new NotFoundException('国策组不存在');
  }

  async createPolicy(dto: RsipPolicyDto): Promise<RsipPolicy> {
    const error = validatePolicyDraft(dto);
    if (error !== '') throw new BadRequestException(error);
    if (typeof dto.groupId === 'string') {
      await this.assertGroupExists(dto.groupId);
    }
    const inserted = await this.db
      .insert(rsipPolicies)
      .values({
        name: dto.name.trim(),
        type: dto.type,
        triggerText:
          dto.type === 'semi_passive' ? (dto.trigger ?? '').trim() : null,
        judge: dto.judge.trim(),
        templateId: dto.templateId ?? null,
        iconKey: dto.iconKey ?? null,
        groupId: dto.groupId ?? null,
      })
      .returning();
    const row = inserted[0];
    if (row === undefined) {
      throw new ConflictException('国策创建失败，请重试');
    }
    await this.db.insert(rsipProgress).values({ policyId: row.id });
    return toPolicy(row);
  }

  async updatePolicy(id: string, dto: RsipPolicyDto): Promise<RsipPolicy> {
    const rows = await this.db
      .select()
      .from(rsipPolicies)
      .where(eq(rsipPolicies.id, id));
    if (rows.length === 0) throw new NotFoundException('国策不存在');
    const policy = rows[0];
    if (policy.retiredAt !== null) {
      throw new BadRequestException('已退役的国策不能编辑');
    }
    const nodeRows = await this.db
      .select({ policyId: rsipTreeNodes.policyId })
      .from(rsipTreeNodes)
      .where(isNull(rsipTreeNodes.extinguishedAt));
    if (nodeRows.some((n: { policyId: string }) => n.policyId === id)) {
      throw new BadRequestException('挂在树上的国策不能编辑，请先处理挂载关系');
    }

    const error = validatePolicyDraft(dto);
    if (error !== '') throw new BadRequestException(error);
    if (typeof dto.groupId === 'string') {
      await this.assertGroupExists(dto.groupId);
    }
    const updated = await this.db
      .update(rsipPolicies)
      .set({
        name: dto.name.trim(),
        type: dto.type,
        triggerText:
          dto.type === 'semi_passive' ? (dto.trigger ?? '').trim() : null,
        judge: dto.judge.trim(),
        templateId: dto.templateId ?? null,
        iconKey: dto.iconKey ?? null,
        groupId: dto.groupId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(rsipPolicies.id, id))
      .returning();
    const row = updated[0];
    if (row === undefined) throw new ConflictException('国策更新失败');
    return toPolicy(row);
  }

  async attachNode(dto: RsipAttachDto): Promise<RsipOverview> {
    await this.db.transaction(async (tx) => {
      const today = await this.assertAttachAllowed(tx);

      const policyRows = await tx
        .select()
        .from(rsipPolicies)
        .where(eq(rsipPolicies.id, dto.policyId));
      if (policyRows.length === 0) throw new NotFoundException('国策不存在');
      const policy = policyRows[0];
      if (policy.retiredAt !== null) {
        throw new BadRequestException('已退役的国策不能挂树');
      }

      const nodes: NodeRow[] = await tx
        .select()
        .from(rsipTreeNodes)
        .where(isNull(rsipTreeNodes.extinguishedAt));
      if (nodes.some((n: NodeRow) => n.policyId === dto.policyId)) {
        throw new BadRequestException('该国策已经在树上');
      }

      let treeId: string;
      if (dto.parentNodeId === null) {
        const requestedTreeId =
          typeof dto.treeId === 'string' ? dto.treeId : null;
        if (requestedTreeId === null) {
          throw new BadRequestException('建根需要指定目标树');
        }
        const treeRows = await tx
          .select()
          .from(rsipTrees)
          .where(eq(rsipTrees.id, requestedTreeId));
        if (treeRows.length === 0) throw new NotFoundException('树不存在');
        if (treeRows[0].archivedAt !== null) {
          throw new BadRequestException('已归档的树不能新增节点');
        }
        if (
          nodes.some(
            (n: NodeRow) =>
              n.treeId === requestedTreeId && n.parentNodeId === null,
          )
        ) {
          throw new BadRequestException(
            '该树已有根节点，请挂到已点亮的节点下',
          );
        }
        treeId = requestedTreeId;
      } else {
        const parent = nodes.find((n: NodeRow) => n.id === dto.parentNodeId);
        if (parent === undefined) {
          throw new BadRequestException('父节点不存在或已熄灭');
        }
        if (parent.retiredAt !== null) {
          throw new BadRequestException('父节点已退役，不能挂载');
        }
        treeId = parent.treeId;
      }

      if (policy.type === 'active') {
        const activePolicyIds = new Set(
          nodes.map((n: NodeRow) => n.policyId),
        );
        const allPolicies = await tx
          .select({ id: rsipPolicies.id, type: rsipPolicies.type })
          .from(rsipPolicies);
        const activeTypedCount = allPolicies.filter(
          (p: { id: string; type: string }) =>
            p.type === 'active' && activePolicyIds.has(p.id),
        ).length;
        if (activeTypedCount >= 3) {
          throw new BadRequestException(
            '主动型国策最多同时存在 3 条，请先选择被动或半被动型',
          );
        }
      }

      await tx.insert(rsipTreeNodes).values({
        policyId: dto.policyId,
        parentNodeId: dto.parentNodeId,
        attachedOn: today,
        treeId,
      });
    });
    return this.getOverview();
  }

  async createTree(dto: RsipTreeCreateDto): Promise<RsipOverview> {
    const name = dto.name.trim();
    if (name.length === 0) throw new BadRequestException('树名称不能为空');
    if (name.length > 100) throw new BadRequestException('树名称不能超过 100 字');
    const goal =
      dto.goal === undefined || dto.goal === null ? null : dto.goal.trim();
    if (goal !== null && goal.length > 200) {
      throw new BadRequestException('大目标不能超过 200 字');
    }

    await this.db.transaction(async (tx) => {
      const today = await this.assertAttachAllowed(tx);

      const policyRows = await tx
        .select()
        .from(rsipPolicies)
        .where(eq(rsipPolicies.id, dto.rootPolicyId));
      if (policyRows.length === 0) throw new NotFoundException('国策不存在');
      const policy = policyRows[0];
      if (policy.retiredAt !== null) {
        throw new BadRequestException('已退役的国策不能作为根国策');
      }
      if (policy.type === 'active') {
        throw new BadRequestException('根国策不能是主动型，请选被动或半被动型');
      }
      const nodes: { policyId: string }[] = await tx
        .select({ policyId: rsipTreeNodes.policyId })
        .from(rsipTreeNodes)
        .where(isNull(rsipTreeNodes.extinguishedAt));
      if (
        nodes.some((n: { policyId: string }) => n.policyId === dto.rootPolicyId)
      ) {
        throw new BadRequestException('该国策已经在树上');
      }

      const insertedTrees = await tx
        .insert(rsipTrees)
        .values({ name, goal: goal !== null && goal.length > 0 ? goal : null })
        .returning({ id: rsipTrees.id });
      const treeId = insertedTrees[0]?.id;
      if (treeId === undefined) {
        throw new ConflictException('建树失败，请重试');
      }
      await tx.insert(rsipTreeNodes).values({
        policyId: dto.rootPolicyId,
        parentNodeId: null,
        attachedOn: today,
        treeId,
      });
    });
    return this.getOverview();
  }

  async updateTree(id: string, dto: RsipTreeUpdateDto): Promise<RsipOverview> {
    const rows = await this.db
      .select()
      .from(rsipTrees)
      .where(eq(rsipTrees.id, id));
    if (rows.length === 0) throw new NotFoundException('树不存在');
    if (rows[0].archivedAt !== null) {
      throw new BadRequestException('已归档的树不能编辑');
    }

    const patch: Partial<typeof rsipTrees.$inferInsert> = {};
    if (typeof dto.name === 'string') {
      const name = dto.name.trim();
      if (name.length === 0) throw new BadRequestException('树名称不能为空');
      if (name.length > 100) {
        throw new BadRequestException('树名称不能超过 100 字');
      }
      patch.name = name;
    }
    if (dto.goal !== undefined) {
      if (dto.goal === null) {
        patch.goal = null;
      } else {
        const goal = dto.goal.trim();
        if (goal.length > 200) {
          throw new BadRequestException('大目标不能超过 200 字');
        }
        patch.goal = goal.length === 0 ? null : goal;
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }
    patch.updatedAt = new Date();
    const updated = await this.db
      .update(rsipTrees)
      .set(patch)
      .where(eq(rsipTrees.id, id))
      .returning({ id: rsipTrees.id });
    if (updated.length === 0) throw new NotFoundException('树不存在');
    return this.getOverview();
  }

  async archiveTree(id: string): Promise<RsipOverview> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(rsipTrees)
        .where(eq(rsipTrees.id, id));
      if (rows.length === 0) throw new NotFoundException('树不存在');
      if (rows[0].archivedAt !== null) {
        throw new BadRequestException('该树已归档');
      }

      const treeNodes: NodeRow[] = await tx
        .select()
        .from(rsipTreeNodes)
        .where(
          and(eq(rsipTreeNodes.treeId, id), isNull(rsipTreeNodes.extinguishedAt)),
        );
      const treeNodeIdSet = new Set<string>(
        treeNodes.map((n: NodeRow) => n.id),
      );
      const unreleasedFreezes = await tx
        .select()
        .from(rsipFreezeRecords)
        .where(eq(rsipFreezeRecords.released, false));
      const hasOverlap = unreleasedFreezes.some((f: FreezeRow) => {
        if (f.scopeWholeTree) return f.treeId === null || f.treeId === id;
        return (f.scopeNodeIds as string[]).some((nodeId: string) =>
          treeNodeIdSet.has(nodeId),
        );
      });
      if (hasOverlap) {
        throw new BadRequestException(
          '该树存在未解冻的冻结，请先完成解冻重判',
        );
      }

      const now = new Date();
      await tx
        .update(rsipTreeNodes)
        .set({ extinguishedAt: now, updatedAt: now })
        .where(
          and(eq(rsipTreeNodes.treeId, id), isNull(rsipTreeNodes.extinguishedAt)),
        );
      const policyIds = Array.from(
        new Set(treeNodes.map((n: NodeRow) => n.policyId)),
      );
      if (policyIds.length > 0) {
        await tx
          .update(rsipProgress)
          .set({ currentStreak: 0, updatedAt: now })
          .where(inArray(rsipProgress.policyId, policyIds));
      }
      const archived = await tx
        .update(rsipTrees)
        .set({ archivedAt: now, updatedAt: now })
        .where(eq(rsipTrees.id, id))
        .returning({ id: rsipTrees.id });
      if (archived.length === 0) throw new NotFoundException('树不存在');
    });
    return this.getOverview();
  }

  async createGroup(dto: RsipGroupDto): Promise<RsipPolicyGroup> {
    const name = dto.name.trim();
    if (name.length === 0) {
      throw new BadRequestException('国策组名称不能为空');
    }
    const existing = await this.db
      .select({ id: rsipPolicyGroups.id })
      .from(rsipPolicyGroups)
      .where(eq(rsipPolicyGroups.name, name));
    if (existing.length > 0) {
      throw new ConflictException('已存在同名国策组');
    }
    const inserted = await this.db
      .insert(rsipPolicyGroups)
      .values({ name })
      .returning();
    const row = inserted[0];
    if (row === undefined) throw new ConflictException('国策组创建失败');
    return { id: row.id, name: row.name, policyCount: 0 };
  }

  async updateGroup(id: string, dto: RsipGroupDto): Promise<RsipPolicyGroup> {
    const rows = await this.db
      .select()
      .from(rsipPolicyGroups)
      .where(eq(rsipPolicyGroups.id, id));
    if (rows.length === 0) throw new NotFoundException('国策组不存在');
    const name = dto.name.trim();
    if (name.length === 0) {
      throw new BadRequestException('国策组名称不能为空');
    }
    const sameName = await this.db
      .select({ id: rsipPolicyGroups.id })
      .from(rsipPolicyGroups)
      .where(eq(rsipPolicyGroups.name, name));
    if (sameName.some((g: { id: string }) => g.id !== id)) {
      throw new ConflictException('已存在同名国策组');
    }
    const updated = await this.db
      .update(rsipPolicyGroups)
      .set({ name, updatedAt: new Date() })
      .where(eq(rsipPolicyGroups.id, id))
      .returning({ id: rsipPolicyGroups.id, name: rsipPolicyGroups.name });
    const row = updated[0];
    if (row === undefined) throw new NotFoundException('国策组不存在');
    const policyRows = await this.db
      .select({ id: rsipPolicies.id })
      .from(rsipPolicies)
      .where(eq(rsipPolicies.groupId, id));
    return { id: row.id, name: row.name, policyCount: policyRows.length };
  }

  async deleteGroup(id: string): Promise<void> {
    const rows = await this.db
      .select({ id: rsipPolicyGroups.id })
      .from(rsipPolicyGroups)
      .where(eq(rsipPolicyGroups.id, id));
    if (rows.length === 0) throw new NotFoundException('国策组不存在');
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(rsipPolicies)
        .set({ groupId: null, updatedAt: now })
        .where(eq(rsipPolicies.groupId, id));
      const deleted = await tx
        .delete(rsipPolicyGroups)
        .where(eq(rsipPolicyGroups.id, id))
        .returning({ id: rsipPolicyGroups.id });
      if (deleted.length === 0) throw new NotFoundException('国策组不存在');
    });
  }

  async assignPolicyGroup(
    policyId: string,
    dto: RsipPolicyGroupAssignDto,
  ): Promise<RsipPolicy> {
    const rows = await this.db
      .select({ id: rsipPolicies.id })
      .from(rsipPolicies)
      .where(eq(rsipPolicies.id, policyId));
    if (rows.length === 0) throw new NotFoundException('国策不存在');
    const groupId = dto.groupId ?? null;
    if (groupId !== null) {
      await this.assertGroupExists(groupId);
    }
    const updated = await this.db
      .update(rsipPolicies)
      .set({ groupId, updatedAt: new Date() })
      .where(eq(rsipPolicies.id, policyId))
      .returning();
    const row = updated[0];
    if (row === undefined) throw new NotFoundException('国策不存在');
    return toPolicy(row);
  }

  /** v1.2 崩塌复盘：补写触发场景与教训（不改变任何判定） */
  async updateRollbackNote(
    id: string,
    dto: RsipRollbackNoteDto,
  ): Promise<RsipRollbackEvent> {
    const reasonScenario: string | null = dto.reasonScenario?.trim()
      ? dto.reasonScenario.trim()
      : null;
    const lesson: string | null = dto.lesson?.trim() ? dto.lesson.trim() : null;
    const updated: RollbackRow[] = await this.db
      .update(rsipRollbackEvents)
      .set({ reasonScenario, lesson, updatedAt: new Date() })
      .where(eq(rsipRollbackEvents.id, id))
      .returning();
    const row: RollbackRow | undefined = updated[0];
    if (row === undefined) throw new NotFoundException('崩塌记录不存在');
    const policyRows: PolicyRow[] = await this.db
      .select()
      .from(rsipPolicies)
      .where(eq(rsipPolicies.id, row.triggerPolicyId));
    const policyById = new Map<string, PolicyRow>(
      policyRows.map((p: PolicyRow) => [p.id, p]),
    );
    return toRollbackEvent(row, policyById);
  }

  async createWinReport(dto: RsipWinReportDto): Promise<RsipWinReport> {
    const title = dto.title.trim();
    if (title.length === 0) {
      throw new BadRequestException('喜报标题不能为空');
    }
    const content = dto.content.trim();
    if (content.length === 0) {
      throw new BadRequestException('喜报正文不能为空');
    }
    const inserted = await this.db
      .insert(rsipWinReports)
      .values({
        title,
        content,
        source: 'manual',
        milestoneType: null,
        relatedPolicyId: null,
      })
      .returning();
    const row = inserted[0];
    if (row === undefined) throw new ConflictException('喜报发布失败');
    return toWinReport(row, new Map<string, string>());
  }

  async createFreeze(dto: RsipFreezeDto): Promise<RsipFreezeRecord> {
    const today = todayShanghai();
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('冻结开始日期不能晚于结束日期');
    }
    if (daysBetween(dto.startDate, dto.endDate) > 13) {
      throw new BadRequestException('冻结期限最长 14 天（含首尾）');
    }
    if (dto.endDate < today) {
      throw new BadRequestException('冻结结束日期不能早于今天');
    }

    const unreleased = await this.db
      .select({ id: rsipFreezeRecords.id })
      .from(rsipFreezeRecords)
      .where(eq(rsipFreezeRecords.released, false));
    if (unreleased.length > 0) {
      throw new ConflictException('已存在未解冻的冻结记录');
    }

    let treeId: string | null = null;
    if (dto.scopeWholeTree) {
      treeId = typeof dto.treeId === 'string' ? dto.treeId : null;
      if (treeId === null) {
        throw new BadRequestException('整树冻结必须选择目标树');
      }
      const treeRows = await this.db
        .select()
        .from(rsipTrees)
        .where(eq(rsipTrees.id, treeId));
      if (treeRows.length === 0) throw new NotFoundException('树不存在');
      if (treeRows[0].archivedAt !== null) {
        throw new BadRequestException('已归档的树不能冻结');
      }
    }

    const nodes: NodeRow[] = await this.db
      .select()
      .from(rsipTreeNodes)
      .where(isNull(rsipTreeNodes.extinguishedAt));
    if (!dto.scopeWholeTree) {
      if (dto.scopeNodeIds.length === 0) {
        throw new BadRequestException('请选择冻结范围');
      }
      const nodeIds = new Set(nodes.map((n: NodeRow) => n.id));
      for (const id of dto.scopeNodeIds) {
        if (!nodeIds.has(id)) {
          throw new BadRequestException('冻结范围包含无效或已熄灭的节点');
        }
      }
    }

    const inserted = await this.db
      .insert(rsipFreezeRecords)
      .values({
        scopeWholeTree: dto.scopeWholeTree,
        treeId,
        scopeNodeIds: dto.scopeNodeIds,
        reason: dto.reason.trim(),
        startDate: dto.startDate,
        endDate: dto.endDate,
      })
      .returning();
    const row = inserted[0];
    if (row === undefined) throw new ConflictException('冻结创建失败');
    return toFreeze(row, today);
  }

  async getDashboard(): Promise<RsipDashboard> {
    const today = todayShanghai();

    const trees: TreeRow[] = await this.db.select().from(rsipTrees);
    const groups: GroupRow[] = await this.db.select().from(rsipPolicyGroups);
    const policies: PolicyRow[] = await this.db.select().from(rsipPolicies);
    const activeNodes: NodeRow[] = await this.db
      .select()
      .from(rsipTreeNodes)
      .where(isNull(rsipTreeNodes.extinguishedAt));
    const allNodeRows = await this.db
      .select({ treeId: rsipTreeNodes.treeId })
      .from(rsipTreeNodes);
    const progressRows: ProgressRow[] = await this.db
      .select()
      .from(rsipProgress);
    const reviewRows = await this.db
      .select({
        reviewDate: rsipDailyReviews.reviewDate,
        late: rsipDailyReviews.late,
        hadRollback: rsipDailyReviews.hadRollback,
        verdicts: rsipDailyReviews.verdicts,
      })
      .from(rsipDailyReviews);
    const rollbackRows: RollbackRow[] = await this.db
      .select()
      .from(rsipRollbackEvents);
    const freezeRows = await this.db
      .select({ id: rsipFreezeRecords.id })
      .from(rsipFreezeRecords);
    const winReportRows: WinReportRow[] = await this.db
      .select()
      .from(rsipWinReports);
    const recentRollbackRows: RollbackRow[] = await this.db
      .select()
      .from(rsipRollbackEvents)
      .orderBy(desc(rsipRollbackEvents.occurredOn))
      .limit(WIN_REPORT_LIST_LIMIT);
    const recentWinReportRows: WinReportRow[] = await this.db
      .select()
      .from(rsipWinReports)
      .orderBy(desc(rsipWinReports.createdAt))
      .limit(WIN_REPORT_LIST_LIMIT);

    const policyById = new Map<string, PolicyRow>(
      policies.map((p: PolicyRow) => [p.id, p]),
    );
    const policyNameById = new Map<string, string>(
      policies.map((p: PolicyRow) => [p.id, p.name]),
    );
    const progressByPolicy = new Map<string, ProgressRow>(
      progressRows.map((p: ProgressRow) => [p.policyId, p]),
    );

    const activeTreeRows = trees.filter(
      (t: TreeRow) => t.archivedAt === null,
    );
    const onTreePolicyIds = new Set<string>(
      activeNodes.map((n: NodeRow) => n.policyId),
    );
    const handPolicies = policies.filter(
      (p: PolicyRow) => p.retiredAt === null && !onTreePolicyIds.has(p.id),
    );
    const precedents = policies.filter((p: PolicyRow) => p.retiredAt !== null);

    const activeNodesByTree = new Map<string, NodeRow[]>();
    for (const n of activeNodes) {
      const list = activeNodesByTree.get(n.treeId) ?? [];
      list.push(n);
      activeNodesByTree.set(n.treeId, list);
    }
    const nodeCountByTree = new Map<string, number>();
    for (const r of allNodeRows) {
      nodeCountByTree.set(r.treeId, (nodeCountByTree.get(r.treeId) ?? 0) + 1);
    }

    const treeStats: RsipDashboardTreeStat[] = activeTreeRows.map(
      (t: TreeRow): RsipDashboardTreeStat => {
        const treeNodes = activeNodesByTree.get(t.id) ?? [];
        const policyIds = Array.from(
          new Set(treeNodes.map((n: NodeRow) => n.policyId)),
        );
        let cumulative = 0;
        let maxStreak = 0;
        for (const pid of policyIds) {
          const progress = progressByPolicy.get(pid);
          if (progress === undefined) continue;
          cumulative += progress.cumulativeLitDays;
          maxStreak = Math.max(maxStreak, progress.currentStreak);
        }
        return {
          treeId: t.id,
          name: t.name,
          goal: t.goal,
          nodeCount: treeNodes.length,
          totalCumulativeLitDays: cumulative,
          maxCurrentStreak: maxStreak,
        };
      },
    );

    const groupStats: RsipDashboardGroupStat[] = groups.map(
      (g: GroupRow): RsipDashboardGroupStat => {
        const groupPolicies = policies.filter(
          (p: PolicyRow) => p.groupId === g.id,
        );
        let cumulative = 0;
        for (const p of groupPolicies) {
          cumulative += progressByPolicy.get(p.id)?.cumulativeLitDays ?? 0;
        }
        return {
          groupId: g.id,
          name: g.name,
          policyCount: groupPolicies.length,
          onTreeCount: groupPolicies.filter((p: PolicyRow) =>
            onTreePolicyIds.has(p.id),
          ).length,
          totalCumulativeLitDays: cumulative,
        };
      },
    );

    const archivedTrees: RsipDashboardArchivedTree[] = [];
    for (const t of trees) {
      if (t.archivedAt === null) continue;
      archivedTrees.push({
        id: t.id,
        name: t.name,
        archivedAt: t.archivedAt.toISOString(),
        nodeCount: nodeCountByTree.get(t.id) ?? 0,
      });
    }

    const dailyStart = addDays(today, -29);
    const daily: RsipDashboardDailyPoint[] = reviewRows
      .filter((r) => r.reviewDate >= dailyStart && r.reviewDate <= today)
      .map((r): RsipDashboardDailyPoint => {
        const verdicts = (r.verdicts as VerdictItem[]) ?? [];
        return {
          date: r.reviewDate,
          litCount: verdicts.filter((v: VerdictItem) => v.verdict === 'satisfied')
            .length,
          violatedCount: verdicts.filter(
            (v: VerdictItem) => v.verdict === 'violated',
          ).length,
          late: r.late,
        };
      })
      .sort((a: RsipDashboardDailyPoint, b: RsipDashboardDailyPoint) =>
        a.date < b.date ? -1 : 1,
      );

    let totalCumulativeLitDays = 0;
    let maxCurrentStreak = 0;
    for (const p of progressRows) {
      totalCumulativeLitDays += p.cumulativeLitDays;
      maxCurrentStreak = Math.max(maxCurrentStreak, p.currentStreak);
    }

    const totals: RsipDashboardTotals = {
      activeTreeCount: activeTreeRows.length,
      archivedTreeCount: trees.length - activeTreeRows.length,
      onTreePolicyCount: onTreePolicyIds.size,
      handPolicyCount: handPolicies.length,
      precedentCount: precedents.length,
      groupCount: groups.length,
      totalCumulativeLitDays,
      maxCurrentStreak,
      rollbackCount: rollbackRows.length,
      freezeCount: freezeRows.length,
      winReportCount: winReportRows.length,
      cleanReviewStreak: computeCleanReviewStreak(reviewRows, today),
    };

    return {
      totals,
      daily,
      trees: treeStats,
      groups: groupStats,
      archivedTrees,
      recentRollbacks: recentRollbackRows.map((r: RollbackRow) =>
        toRollbackEvent(r, policyById),
      ),
      recentWinReports: recentWinReportRows.map((r: WinReportRow) =>
        toWinReport(r, policyNameById),
      ),
    };
  }

  async updateSettings(dto: RsipSettingsDto): Promise<RsipUserSettings> {
    const settingsRow = await this.getOrCreateSettingsRow();
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRe.test(dto.reviewWindowStart) || !timeRe.test(dto.reviewWindowEnd)) {
      throw new BadRequestException('结算窗口时间格式必须为 HH:mm');
    }
    await this.db
      .update(rsipUserSettings)
      .set({
        reviewWindowStart: dto.reviewWindowStart,
        reviewWindowEnd: dto.reviewWindowEnd,
        updatedAt: new Date(),
      })
      .where(eq(rsipUserSettings.id, settingsRow.id));
    return {
      reviewWindowStart: dto.reviewWindowStart,
      reviewWindowEnd: dto.reviewWindowEnd,
      onboarded: settingsRow.onboarded,
    };
  }
}
