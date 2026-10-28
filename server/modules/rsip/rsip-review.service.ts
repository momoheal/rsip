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
import { eq, inArray, isNull } from 'drizzle-orm';
import type {
  RsipFreezeReleaseResult,
  RsipReviewResult,
  RsipVerdict,
  RsipWinReport,
} from '@shared/api.interface';
import type { RsipReviewSubmitDto, RsipFreezeReleaseDto } from './rsip.dto';
import {
  rsipDailyReviews,
  rsipFreezeRecords,
  rsipPolicies,
  rsipProgress,
  rsipRollbackEvents,
  rsipTreeNodes,
  rsipWinReports,
} from '@server/database/schema';
import { computeCleanReviewStreak, toWinReport } from './rsip.service';

type NodeRow = typeof rsipTreeNodes.$inferSelect;

type WinReportInsert = typeof rsipWinReports.$inferInsert;
type WinReportRow = typeof rsipWinReports.$inferSelect;

const STREAK_MILESTONES: number[] = [7, 21, 100];
const CUMULATIVE_MILESTONES: number[] = [30, 100, 365];
const CLEAN_MILESTONES: number[] = [7, 30];

interface SatisfiedMilestone {
  policyId: string;
  policyName: string;
  newStreak: number;
  newCumulative: number;
}

interface VerdictRow {
  nodeId: string;
  policyId: string;
  verdict: RsipVerdict;
}

@Injectable()
export class RsipReviewService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async submitReview(
    dto: RsipReviewSubmitDto,
    today: string,
  ): Promise<RsipReviewResult> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: rsipDailyReviews.id })
        .from(rsipDailyReviews)
        .where(eq(rsipDailyReviews.reviewDate, today));
      if (existing.length > 0) {
        throw new ConflictException('今日已完成结算，不能重复提交');
      }

      const nodes: NodeRow[] = await tx
        .select()
        .from(rsipTreeNodes)
        .where(isNull(rsipTreeNodes.extinguishedAt));
      const freezes = await tx
        .select()
        .from(rsipFreezeRecords)
        .where(eq(rsipFreezeRecords.released, false));
      const frozenIds = new Set<string>();
      for (const f of freezes) {
        if (f.startDate > today || today > f.endDate) continue;
        const ids: string[] = f.scopeWholeTree
          ? f.treeId === null
            ? nodes.map((n: NodeRow) => n.id)
            : nodes
                .filter((n: NodeRow) => n.treeId === f.treeId)
                .map((n: NodeRow) => n.id)
          : (f.scopeNodeIds as string[]);
        for (const id of ids) frozenIds.add(id);
      }
      const due = nodes.filter(
        (n: NodeRow) => n.retiredAt === null && !frozenIds.has(n.id),
      );

      const policyRows = await tx
        .select({ id: rsipPolicies.id, name: rsipPolicies.name })
        .from(rsipPolicies);
      const policyNameById = new Map<string, string>(
        policyRows.map((p: { id: string; name: string }) => [p.id, p.name]),
      );

      const verdictMap = new Map<string, RsipVerdict>();
      for (const v of dto.verdicts) {
        if (verdictMap.has(v.nodeId)) {
          throw new BadRequestException('存在重复的国策判定');
        }
        verdictMap.set(v.nodeId, v.verdict);
      }
      if (verdictMap.size !== due.length) {
        throw new BadRequestException('结算必须且只能覆盖全部应结算国策');
      }
      for (const n of due) {
        if (!verdictMap.has(n.id)) {
          throw new BadRequestException('结算必须覆盖全部应结算国策');
        }
      }

      const nodeById = new Map<string, NodeRow>(
        nodes.map((n: NodeRow) => [n.id, n]),
      );
      const childrenMap = new Map<string, NodeRow[]>();
      for (const n of nodes) {
        if (n.parentNodeId === null) continue;
        const list = childrenMap.get(n.parentNodeId) ?? [];
        list.push(n);
        childrenMap.set(n.parentNodeId, list);
      }

      const now = new Date();
      let hadRollback = false;
      const rolledBackPolicyIds: string[] = [];
      const retiredPolicyIds: string[] = [];
      const satisfiedMilestones: SatisfiedMilestone[] = [];

      for (const n of due) {
        if (verdictMap.get(n.id) !== 'legalized') continue;
        await tx
          .update(rsipTreeNodes)
          .set({ retiredAt: now, updatedAt: now })
          .where(eq(rsipTreeNodes.id, n.id));
        await tx
          .update(rsipPolicies)
          .set({
            retiredAt: now,
            retireReason: '永久合法化（下必为例）',
            updatedAt: now,
          })
          .where(eq(rsipPolicies.id, n.policyId));
        retiredPolicyIds.push(n.policyId);
      }

      for (const n of due) {
        if (verdictMap.get(n.id) !== 'satisfied') continue;
        const progressRows = await tx
          .select()
          .from(rsipProgress)
          .where(eq(rsipProgress.policyId, n.policyId));
        let newStreak: number;
        let newCumulative: number;
        if (progressRows.length === 0) {
          newStreak = 1;
          newCumulative = 1;
          await tx.insert(rsipProgress).values({
            policyId: n.policyId,
            cumulativeLitDays: newCumulative,
            currentStreak: newStreak,
            lastLitDate: today,
          });
        } else {
          const p = progressRows[0];
          newStreak = p.currentStreak + 1;
          newCumulative = p.cumulativeLitDays + 1;
          await tx
            .update(rsipProgress)
            .set({
              cumulativeLitDays: newCumulative,
              currentStreak: newStreak,
              lastLitDate: today,
              updatedAt: now,
            })
            .where(eq(rsipProgress.id, p.id));
        }
        satisfiedMilestones.push({
          policyId: n.policyId,
          policyName: policyNameById.get(n.policyId) ?? '未知国策',
          newStreak,
          newCumulative,
        });
      }

      for (const n of due) {
        if (verdictMap.get(n.id) !== 'violated') continue;
        const swept: NodeRow[] = [];
        const stack: NodeRow[] = [n];
        while (stack.length > 0) {
          const cur = stack.pop() as NodeRow;
          swept.push(cur);
          const kids = childrenMap.get(cur.id) ?? [];
          for (const k of kids) stack.push(k);
        }
        const sweptIds = swept.map((s: NodeRow) => s.id);
        await tx
          .update(rsipTreeNodes)
          .set({ extinguishedAt: now, updatedAt: now })
          .where(inArray(rsipTreeNodes.id, sweptIds));
        const sweptPolicyIds = Array.from(
          new Set(swept.map((s: NodeRow) => s.policyId)),
        );
        await tx
          .update(rsipProgress)
          .set({ currentStreak: 0, updatedAt: now })
          .where(inArray(rsipProgress.policyId, sweptPolicyIds));
        await tx.insert(rsipRollbackEvents).values({
          triggerNodeId: n.id,
          triggerPolicyId: n.policyId,
          sweptPolicyIds,
          sweptCount: sweptIds.length,
          occurredOn: today,
        });
        hadRollback = true;
        rolledBackPolicyIds.push(...sweptPolicyIds);
      }

      const verdictRows: VerdictRow[] = dto.verdicts.map(
        (v: { nodeId: string; verdict: RsipVerdict }) => ({
          nodeId: v.nodeId,
          policyId: nodeById.get(v.nodeId)?.policyId ?? '',
          verdict: v.verdict,
        }),
      );
      await tx.insert(rsipDailyReviews).values({
        reviewDate: today,
        late: dto.late,
        hadRollback,
        verdicts: verdictRows,
        notes: dto.notes ?? null,
      });

      const progressAll = await tx.select().from(rsipProgress);
      const canAttachToday =
        !hadRollback && progressAll.some((p) => p.cumulativeLitDays > 3);

      const winReportValues: WinReportInsert[] = [];
      for (const m of satisfiedMilestones) {
        if (STREAK_MILESTONES.includes(m.newStreak)) {
          winReportValues.push({
            title: `连续点亮 ${m.newStreak} 天`,
            content: `「${m.policyName}」已连续点亮 ${m.newStreak} 天，累计内化 ${m.newCumulative} 天。`,
            source: 'milestone',
            milestoneType: `streak_${m.newStreak}`,
            relatedPolicyId: m.policyId,
          });
        }
        if (CUMULATIVE_MILESTONES.includes(m.newCumulative)) {
          winReportValues.push({
            title: `累计点亮 ${m.newCumulative} 天`,
            content: `「${m.policyName}」累计点亮达到 ${m.newCumulative} 天。`,
            source: 'milestone',
            milestoneType: `cumulative_${m.newCumulative}`,
            relatedPolicyId: m.policyId,
          });
        }
      }

      const reviewRecords = await tx
        .select({
          reviewDate: rsipDailyReviews.reviewDate,
          late: rsipDailyReviews.late,
          hadRollback: rsipDailyReviews.hadRollback,
        })
        .from(rsipDailyReviews);
      const cleanStreak = computeCleanReviewStreak(reviewRecords, today);
      if (CLEAN_MILESTONES.includes(cleanStreak)) {
        winReportValues.push({
          title: `连续清洁结算 ${cleanStreak} 天`,
          content: `连续 ${cleanStreak} 天按时完成结算且没有崩塌。`,
          source: 'milestone',
          milestoneType: `clean_${cleanStreak}`,
          relatedPolicyId: null,
        });
      }

      let newWinReports: RsipWinReport[] = [];
      if (winReportValues.length > 0) {
        const insertedWinReports = await tx
          .insert(rsipWinReports)
          .values(winReportValues)
          .returning();
        newWinReports = insertedWinReports.map((r: WinReportRow) =>
          toWinReport(r, policyNameById),
        );
      }

      return {
        date: today,
        hadRollback,
        rolledBackPolicies: Array.from(new Set(rolledBackPolicyIds)),
        retiredPolicies: retiredPolicyIds,
        canAttachToday,
        newWinReports,
      };
    });
  }

  async releaseFreeze(
    freezeId: string,
    dto: RsipFreezeReleaseDto,
    today: string,
  ): Promise<RsipFreezeReleaseResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(rsipFreezeRecords)
        .where(eq(rsipFreezeRecords.id, freezeId));
      if (rows.length === 0) {
        throw new NotFoundException('冻结记录不存在');
      }
      const freeze = rows[0];
      if (freeze.released) {
        throw new ConflictException('该冻结已解冻');
      }
      if (today < freeze.endDate) {
        throw new BadRequestException('冻结尚未到期，不能提前解冻重判');
      }

      const nodes: NodeRow[] = await tx
        .select()
        .from(rsipTreeNodes)
        .where(isNull(rsipTreeNodes.extinguishedAt));
      const scopeIds: string[] = freeze.scopeWholeTree
        ? freeze.treeId === null
          ? nodes.map((n: NodeRow) => n.id)
          : nodes
              .filter((n: NodeRow) => n.treeId === freeze.treeId)
              .map((n: NodeRow) => n.id)
        : (freeze.scopeNodeIds as string[]);
      const scopeSet = new Set<string>(scopeIds);
      const scopeNodes = nodes.filter(
        (n: NodeRow) => scopeSet.has(n.id) && n.retiredAt === null,
      );

      const verdictMap = new Map<string, 'satisfied' | 'violated'>();
      for (const v of dto.verdicts) {
        if (verdictMap.has(v.nodeId)) {
          throw new BadRequestException('存在重复的国策判定');
        }
        verdictMap.set(v.nodeId, v.verdict);
      }
      if (verdictMap.size !== scopeNodes.length) {
        throw new BadRequestException('解冻重判必须且只能覆盖全部冻结中的国策');
      }
      for (const n of scopeNodes) {
        if (!verdictMap.has(n.id)) {
          throw new BadRequestException('解冻重判必须覆盖全部冻结中的国策');
        }
      }

      const childrenMap = new Map<string, NodeRow[]>();
      for (const n of nodes) {
        if (n.parentNodeId === null) continue;
        const list = childrenMap.get(n.parentNodeId) ?? [];
        list.push(n);
        childrenMap.set(n.parentNodeId, list);
      }

      const now = new Date();
      const rolledBackPolicyIds: string[] = [];
      for (const n of scopeNodes) {
        if (verdictMap.get(n.id) !== 'violated') continue;
        const swept: NodeRow[] = [];
        const stack: NodeRow[] = [n];
        while (stack.length > 0) {
          const cur = stack.pop() as NodeRow;
          swept.push(cur);
          const kids = childrenMap.get(cur.id) ?? [];
          for (const k of kids) stack.push(k);
        }
        const sweptIds = swept.map((s: NodeRow) => s.id);
        await tx
          .update(rsipTreeNodes)
          .set({ extinguishedAt: now, updatedAt: now })
          .where(inArray(rsipTreeNodes.id, sweptIds));
        const sweptPolicyIds = Array.from(
          new Set(swept.map((s: NodeRow) => s.policyId)),
        );
        await tx
          .update(rsipProgress)
          .set({ currentStreak: 0, updatedAt: now })
          .where(inArray(rsipProgress.policyId, sweptPolicyIds));
        await tx.insert(rsipRollbackEvents).values({
          triggerNodeId: n.id,
          triggerPolicyId: n.policyId,
          sweptPolicyIds,
          sweptCount: sweptIds.length,
          occurredOn: today,
        });
        rolledBackPolicyIds.push(...sweptPolicyIds);
      }

      await tx
        .update(rsipFreezeRecords)
        .set({ released: true, releasedOn: today, updatedAt: now })
        .where(eq(rsipFreezeRecords.id, freezeId));

      return {
        rolledBackPolicies: Array.from(new Set(rolledBackPolicyIds)),
      };
    });
  }
}
