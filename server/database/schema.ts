/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const rsipWinReports = pgTable("rsip_win_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 100 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 20 }).notNull().default('manual'),
  milestoneType: varchar("milestone_type", { length: 50 }),
  relatedPolicyId: uuid("related_policy_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const rsipPolicyGroups = pgTable("rsip_policy_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const rsipTrees = pgTable("rsip_trees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  goal: varchar("goal", { length: 200 }),
  archivedAt: customTimestamptz("archived_at", { precision: 6 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const rsipUserSettings = pgTable("rsip_user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewWindowStart: varchar("review_window_start", { length: 5 }).notNull().default('21:30'),
  reviewWindowEnd: varchar("review_window_end", { length: 5 }).notNull().default('23:30'),
  onboarded: boolean("onboarded").notNull().default(false),
  onboardedAt: customTimestamptz("onboarded_at", { precision: 6 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX uq_rsip_settings_user ON rsip_user_settings USING btree (((_created_by).user_id)),
]);

export const rsipProgress = pgTable("rsip_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id").notNull(),
  cumulativeLitDays: integer("cumulative_lit_days").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  lastLitDate: date("last_lit_date"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX uq_rsip_progress_user_policy ON rsip_progress USING btree (policy_id, ((_created_by).user_id)),
  foreignKey({
    columns: [table.policyId],
    foreignColumns: [rsipPolicies.id],
    name: "rsip_progress_policy_id_fkey",
  }),
]);

export const rsipFreezeRecords = pgTable("rsip_freeze_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeWholeTree: boolean("scope_whole_tree").notNull().default(false),
  /**
   * @type string[]
   */
  scopeNodeIds: jsonb("scope_node_ids").notNull().default('[]'),
  reason: varchar("reason", { length: 200 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  released: boolean("released").notNull().default(false),
  releasedOn: date("released_on"),
  treeId: uuid("tree_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const rsipRollbackEvents = pgTable("rsip_rollback_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  triggerNodeId: uuid("trigger_node_id").notNull(),
  triggerPolicyId: uuid("trigger_policy_id").notNull(),
  /**
   * @type string[]
   */
  sweptPolicyIds: jsonb("swept_policy_ids").notNull().default('[]'),
  sweptCount: integer("swept_count").notNull().default(0),
  occurredOn: date("occurred_on").notNull(),
  reasonScenario: text("reason_scenario"),
  lesson: text("lesson"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const rsipDailyReviews = pgTable("rsip_daily_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewDate: date("review_date").notNull(),
  completedAt: customTimestamptz("completed_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  late: boolean("late").notNull().default(false),
  hadRollback: boolean("had_rollback").notNull().default(false),
  /**
   * @type { nodeId: string, policyId: string, verdict: "satisfied" | "violated" | "legalized" }[]
   */
  verdicts: jsonb("verdicts").notNull().default('[]'),
  notes: text("notes"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX uq_rsip_reviews_user_date ON rsip_daily_reviews USING btree (review_date, ((_created_by).user_id)),
]);

export const rsipTreeNodes = pgTable("rsip_tree_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id").notNull(),
  parentNodeId: uuid("parent_node_id"),
  attachedOn: date("attached_on").notNull(),
  extinguishedAt: customTimestamptz("extinguished_at", { precision: 6 }),
  retiredAt: customTimestamptz("retired_at", { precision: 6 }),
  treeId: uuid("tree_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_rsip_tree_nodes_policy").on(table.policyId),
  index("idx_rsip_tree_nodes_parent").on(table.parentNodeId),
  index("idx_rsip_tree_nodes_tree").on(table.treeId),
  foreignKey({
    columns: [table.policyId],
    foreignColumns: [rsipPolicies.id],
    name: "rsip_tree_nodes_policy_id_fkey",
  }),
  foreignKey({
    columns: [table.parentNodeId],
    foreignColumns: [rsipTreeNodes.id],
    name: "rsip_tree_nodes_parent_node_id_fkey",
  }),
  foreignKey({
    columns: [table.treeId],
    foreignColumns: [rsipTrees.id],
    name: "rsip_tree_nodes_tree_id_fkey",
  }),
]);

export const rsipPolicies = pgTable("rsip_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  triggerText: varchar("trigger_text", { length: 200 }),
  judge: varchar("judge", { length: 200 }).notNull(),
  templateId: varchar("template_id", { length: 50 }),
  retiredAt: customTimestamptz("retired_at", { precision: 6 }),
  retireReason: varchar("retire_reason", { length: 200 }),
  groupId: uuid("group_id"),
  iconKey: varchar("icon_key", { length: 30 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  foreignKey({
    columns: [table.groupId],
    foreignColumns: [rsipPolicyGroups.id],
    name: "rsip_policies_group_id_fkey",
  }),
]);

// table aliases
export const rsipDailyReviewsTable = rsipDailyReviews;
export const rsipFreezeRecordsTable = rsipFreezeRecords;
export const rsipPoliciesTable = rsipPolicies;
export const rsipPolicyGroupsTable = rsipPolicyGroups;
export const rsipProgressTable = rsipProgress;
export const rsipRollbackEventsTable = rsipRollbackEvents;
export const rsipTreeNodesTable = rsipTreeNodes;
export const rsipTreesTable = rsipTrees;
export const rsipUserSettingsTable = rsipUserSettings;
export const rsipWinReportsTable = rsipWinReports;
