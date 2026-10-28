# RSIP 自控力操作系统 · 交接文档（Handoff）

> 应用 ID：`app_17gt3cjf1s4` ｜ 形态：全栈（NestJS + React）｜ 最后提交：`566b12d 收尾验收并更新规范`
> 本文写给下一位接手开发的人或 AI 会话；与 `AGENTS.md` 配合阅读，冲突时以代码实际行为为准。

## 1. 项目是什么

基于知乎《如何提高自制力？》答案中的 CTDP/RSIP 方法论构建的个人自控力管理 Web 应用。

核心机制：

- **国策树**：把个人规则（国策）组织成树形结构，每棵树一个根节点（v0.5 支持多棵树）。
- **每日结算**：每天在可配置时间窗口（默认 21:30–23:30）逐条二元判定「是否做到」。
- **递归回滚**：答「否」且确认真违反时，该节点与全部后代从树上摘下退回手牌；内化进度（cumulativeLitDays）不丢，currentStreak 归零。
- **永久合法化**：答「否」但选择合法化时，国策退役进判例库，不级联。
- **水密隔舱（冻结）**：整树或子树暂停结算，≤14 天，解冻日一次性重判。
- **喜报系统**：手动发布 + 结算后自动检测里程碑（连续点亮 7/21/100 天、累计 30/100/365 天、连续清洁结算 7/30 天）。
- **约束**：每日最多新增 1 个树节点（全局跨树）；主动型国策在树上同时 ≤3（全局）；根国策不允许主动型。

## 2. 技术栈与目录结构

```
├── client/                 # React 19 + TypeScript + Vite + Tailwind + shadcn/ui
│   └── src/
│       ├── app.tsx         # 路由：/ 主视图、/dashboard 仪表盘
│       ├── api/rsip/       # API 封装 + templates.ts（10 条内置模板静态数据）
│       ├── pages/RsipPage/ # 主页面（布局+弹窗编排）+ 21 个组件
│       ├── pages/DashboardPage/  # 仪表盘（统计卡 + 3 个 ECharts 图表 + 列表）
│       ├── components/rsip/      # PolicyTypeBadge / ProgressTrack / PolicyIcon(Picker) / policy-icons.ts
│       ├── assets/rsip-icons/    # 11 张国策分类插画（AI 生图，已在库）
│       └── hooks/useRsipOverview.ts
├── server/                 # NestJS 10 + Drizzle ORM + Postgres
│   └── modules/rsip/
│       ├── rsip.controller.ts    # 18 个端点，前缀 api/rsip，全部 @NeedLogin
│       ├── rsip.service.ts       # 树/国策/组/冻结/喜报/仪表盘
│       ├── rsip-review.service.ts# 每日结算（回滚级联、里程碑检测、进度更新）
│       ├── rsip.dto.ts / rsip.util.ts / rsip.module.ts
├── shared/api.interface.ts # 前后端接口契约（改接口先改这里）
└── server/database/schema.ts     # 自动生成，禁手改
```

## 3. 数据库（10 张表）

`rsip_policies`（国策，含 icon_key 图标分类、group_id 分组）、`rsip_trees`（树）、`rsip_tree_nodes`（挂载节点，含 extinguishedAt / retiredAt）、`rsip_daily_reviews`（结算记录 + verdicts JSONB，唯一索引 user+date）、`rsip_rollback_events`（崩塌日志）、`rsip_freeze_records`（冻结）、`rsip_progress`（按国策内化进度，唯一索引 user+policy）、`rsip_user_settings`（结算窗口等）、`rsip_policy_groups`（国策组）、`rsip_win_reports`（喜报，source=manual|milestone）。

要点：

- 全部按 `_created_by`（user_profile custom type）做行级隔离（RLS），无多人协作。
- 复杂唯一索引用 codegen 注释保留语义，见 schema.ts 内注释。
- `date` 列存 `YYYY-MM-DD` 字符串；`timestamptz` custom type TS 侧是 `Date`，出接口转 `.toISOString()`。

## 4. API 清单（前缀 /api/rsip，全部 @NeedLogin）

| 端点 | 方法 | 用途 |
|---|---|---|
| /overview | GET | 总览：树列表、手牌、冻结、结算状态、提示 |
| /onboarding | POST | 引导 3 步完成（大目标/候选/选根） |
| /policies | POST | 新建国策（入手牌） |
| /policies/:id | PATCH | 编辑国策 |
| /policies/:id/group | PATCH | 移动国策到分组 |
| /trees | POST | 新建树（占用每日新增名额） |
| /trees/:id | PATCH | 树重命名/改大目标 |
| /trees/:id/archive | POST | 归档树（活跃节点退回手牌） |
| /groups | POST | 新建国策组 |
| /groups/:id | PATCH / DELETE | 改组 / 删组（组内国策 groupId 置空） |
| /win-reports | POST | 手动发布喜报 |
| /dashboard | GET | 仪表盘统计（趋势/分布/树进度/归档/崩塌/喜报） |
| /tree/attach | POST | 挂载节点到树（每日限 1 次，门槛校验） |
| /review/submit | POST | 提交每日结算（含回滚级联、里程碑自动喜报） |
| /freeze | POST | 发起冻结（整树/子树，≤14 天） |
| /freeze/:id/release | POST | 解冻重判（满足恢复/不满足回滚；未重判顺延 1 天） |
| /settings | PATCH | 结算窗口设置 |

## 5. 关键业务规则（实现要点）

- **回滚语义**：违反节点 + 全部后代立即摘树退回手牌（树上无灰显节点）；崩塌只记录在 RollbackEvent。Policy 与 TreeNode 分离，重挂按 policyId 继承累计点亮天数。
- **每日新增门槛**：今日已结算 && 今日无回滚 && 已有 ≥1 条国策 cumulativeLitDays > 3；全局跨树每日 1 次。
- **结算窗口**：窗口外可提交但记 `late`；未结算国策保持点亮、streak 冻结；连续漏结算 ≥2 天提示「是否该冻结了」。
- **国策校验**（结构化，非 NLP）：半被动必填触发条件；判定标准必须以「是否/有没有/有没有做到」开头；名称非空 ≤50 字。
- **里程碑检测**在 review/submit 同一事务内完成，命中即写喜报并随结算结果返回，前端弹庆祝展示。
- **解冻**：解冻日重判一次；不满足→回滚；未重判自动顺延 1 天（不静默判负）。
- **根节点崩塌**：整树退回手牌，页面引导重新选根。

## 6. 设计规范（视觉与文案）

- 基调冷静中性：slate 灰阶打底，点亮用 amber-400 暖色点缀；**严禁红色 / 警告图标 / 灾难化措辞**（回滚是特性不是失败）。
- 文案中性、具体、不喊口号（禁止「加油」「你可以的」）；回滚后展示医学免责提示。
- 排版：标题 text-xl semibold、正文 text-sm、数字 tabular-nums；间距 px-6 py-6 / 卡片 p-4 / gap-4；桌面双栏、移动单列（sm: 断点）。
- 图标：lucide-react（树=TreePine、组=Tags、喜报=PartyPopper、仪表盘=BarChart3）；国策另有 11 张分类插画（policy-icons.ts 维护 key→图映射）。
- 仪表盘图表用 ReactECharts，色板中性灰 + amber；统计卡 data-ai-section-type="card-stat"。

## 7. 开发工作流（在妙搭沙箱内）

1. 改代码 → 平台自动热重载 → `commit_task` 提交（内建代码检查）。
2. **DDL 流程**：改表结构必须走 lark-apps-db skill 的 `+db-execute` 通道执行 SQL → 触发 codegen 重新生成 `schema.ts` → **重读 schema.ts** 再写业务代码。
3. 契约先行：新增/改接口先改 `shared/api.interface.ts`，DTO 的字符串联合按 inline literal + `@IsIn` 写。
4. 发布上线：`lark-cli apps +release-create --apply-reason <理由>` → `+release-get` 轮询终态。
5. 验证入口注意：本地 `/dev/health` 判活；接口测试工具只打 `/api`、`/openapi`；`__runtime__` 路径在 Agent 侧不可达（用户侧正常）。

## 8. 验证状态

**已验证（接口自测 + E2E 闭环）**：引导流程、总览/手牌/树渲染、挂载（含名额与门槛拒绝）、每日结算（满足/迟到/违反回滚级联/合法化退役）、冻结发起与解冻重判、设置修改、多树切换/新建、国策组增删改、喜报手动发布、仪表盘统计与图表、图标系统展示。

**未实测 / 已知边界**：

- 里程碑自动喜报（7/21/100 天等阈值）逻辑已实现并有单次结算事务测试，但未用真实天数数据触发过端到端庆祝弹窗。
- 树重命名、归档的 E2E 用例已入库，归档后仪表盘归档列表依赖真实归档数据。
- 数据库内为开发者本人的真实使用数据（个人工具），导出 zip **不含任何数据库数据**（仅源码）。
- 本 zip 由 `+export` 生成：无 git 历史、无环境变量、无凭证；继续开发请回到妙搭工作区。

## 9. 后续建议

- 若要接入提醒：平台无 push，可考虑自动化任务（cron）+ 飞书消息插件。
- 若要多设备同步体验优化：结算窗口提示逻辑目前仅在打开应用时展示（StatusBanner，每天最多 2 类提示）。
- 性能余量充足（单用户 ≤ 数百节点），暂无索引优化需求。
