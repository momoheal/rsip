# RSIP 自控力操作系统 · 全局研发规范

## 应用概览

基于知乎《如何提高自制力？》答案的 CTDP/RSIP 方法论构建的 Web 应用（详细设计见会话附件
`RSIP_PRD_v1.0.md` 与 `RSIP_TechSpec_v1.0.md`，以本文件记录的修正决策为准）。
核心机制：国策树（每棵树一个根节点）、每日结算（二元判定）、递归回滚（崩塌级联、内化进度不丢）、
水密隔舱（冻结）、每日最多新增 1 节点、主动型国策 ≤ 3。

## v0.5 设计决策（覆盖下方 MVP 早期决策，权威）

1. **多棵树**：不再限单根；每棵树一个根、一个名称 + 可选大目标；树可重命名、可归档。
   归档 = 树上全部活跃节点熄灭退回手牌（内化进度保留），树进入仪表盘归档列表。
   建树（新根）与挂载同门槛：需今日已结算、无回滚、有国策内化 >3 天，且占用每日 1 次
   新增名额（全局跨树）。每日结算、每日新增名额均为全局（跨树）；主动型 ≤3 也全局跨树统计。
2. **国策组**：跨树分类标签。国策可归入一个组（rsip_policies.group_id），组可增删改名；
   删除组时组内国策 groupId 置空。用于手牌/树/仪表盘按组筛选与统计，不影响任何判定逻辑。
3. **机制型模板开放**：模板库两条机制模板可点击：「存人失地」打开冻结弹窗，「赢麻了」
   打开喜报编写弹窗；不可作为国策加入手牌。
4. **喜报系统**：手动随时发布（标题+正文）；里程碑自动：结算提交后检测 ——
   连续点亮 7/21/100 天、累计点亮 30/100/365 天（按国策）、连续清洁结算（不迟到且无回滚）
   7/30 天，命中则在同一次事务写入喜报并随结算结果返回，前端弹庆祝展示。
   喜报风格：暖色庆祝（amber 系）可用，但仍不使用红色/灾难化表达。

## v1.2 设计决策（对照原文补齐，权威）

1. **CTDP 专注（F14）**：路由 `/focus`，引擎 `client/src/store/ctdpEngine.ts`，hook `useCtdp`。
   主链（神圣座位，#N）+ 预约链（预约时长减 30 秒缓冲内必须开始）+ 侦查任务（满 N 分钟即完成，
   可原地转主链，提前结束不影响主链）。疑似违规 / 预约超时一律「下必为例」二选一：
   判违规（该链清零）或判允许（记入该链判例，永久允许）；预约超时的裁决弹窗不可关闭。
   兵种 + 三三制（3 个 # = ##，9 个 # = ###）仅做展示。按 F15 本地优先只存 localStorage
   （key `rsip-ctdp-v1`），本地 / 平台模式通用；不参与国策结算。
2. **崩塌代价可视**：结算答「否 → 真违反」时显示将连带的子国策数与清零的连续天数之和
   （原文：根部失败代价大 → 被加倍保护）。
3. **崩塌复盘**：崩塌日志可补写触发场景 + 教训（调试方向快捷选项），接口 `PATCH api/rsip/rollbacks/:id`。
   同一国策崩塌 ≥2 次时，日志与手牌卡片提示「农村包围城市，先绕过去」。
   `sweptCount` 含触发节点自身，界面展示「连带 = sweptCount − 1」。
4. **赢麻了 · 每日命名**：结算末尾可选用当天最大的喜报命名并定级小赢 / 中赢 / 大赢
   （`RsipReviewSubmitInput.dayTitle/dayLevel`），总览 `namedDays` 返回最近 14 天，侧栏展示。
   平台后端暂未落库（`rsip_daily_reviews` 无对应列），`namedDays` 为可选字段。
5. **可强化国策（强化等级 +N，F3 / PRD §12 决策 1）**：国策可选配强化规则
   （`RsipPolicy.upgradable / stepText / upgradeAfterStreak`，等级 `level`，本级起点 `levelStreakBase`）。
   每升一级把判定门槛平移一档；判定标准写基础门槛（+0），第 N 级 = 平移 N 档。本级连续点亮
   （`currentStreak − levelStreakBase`）达到门槛只提示「可升级」（树卡标记 + 节点详情），
   用户在节点详情里确认后 level+1，本级重新计数；不自动升级，且国策须在树上。
   结算时等级 > 0 的国策答「否」多一个处理方式「降回 +0」（`RsipVerdict = 'downgraded'`）：
   level 归零、节点留树、不级联、不记崩塌日志、不算回滚（不影响清洁结算与今日新增），
   currentStreak 照常归零、累计天数保留 —— 即原文「储备冗余，保护基础节点」。
   在 +N 上选「真违反」照常递归回滚，并把触发国策的等级归零（子国策保留各自等级）；
   编辑器关闭强化规则同样把等级归零。共享逻辑在 `components/rsip/upgrade.ts`，徽记
   `components/rsip/LevelBadge.tsx`（树卡、手牌卡、详情、结算列表）。仅本地模式：平台后端未落库，
   字段均为可选，`api/rsip.upgradePolicy` 在平台模式直接报错。
6. **已知差距**：平台后端仍缺 v1.1 字段（杠杆来源、相关性、树 tier、诊断）与 v1.2 强化等级，
   `tsc -p tsconfig.node.json` 有 5 个既有错误；实际运行以本地模式为准。

## 文档修正决策（覆盖 PRD/TechSpec 对应条目，权威）

1. **回滚语义**：节点违反后，自身与全部后代立即从树上摘下、退回手牌（树视图不存在灰显熄灭节点）；
   崩塌信息只记录在崩塌日志（RollbackEvent）中查看。Policy 与 TreeNode 分离，重挂时按 policyId
   继承内化进度（cumulativeLitDays 永不清零，currentStreak 归零）。
2. **单根（MVP 阶段）**：MVP 全程单根；v0.5 已升级为多棵树，见上方 v0.5 设计决策。
3. **国策组（F8）**：v0.5 已实现，形态 = 跨树分类标签，见上方 v0.5 设计决策。
4. **国策校验用结构化约束，不做自然语言启发式**：
   - 半被动型必填触发条件（trigger 非空）；
   - 判定标准（judge）必须以「是否/有没有/有没有做到」开头的二元问句；
   - 主动型国策在树上同时存在数量 ≤ 3，超过拒绝新增；
   - 根国策不允许选择主动型；
   - 名称非空且 ≤ 50 字。
5. **Web 通知**：不做 push；改为打开应用时的页内状态提示（结算窗口已开启 / 冻结到期待重判 /
   漏结算提醒），每天最多提示 2 类。

## MVP 边界与规则要点（实现以此为准）

- **F1 引导 3 步**：① 写大目标 → ② 拆解出 ≥3 个小国策候选（内置分类候选 + 模板推荐 + 自建）→
  ③ 只能选 1 条作根，且必须勾选「我承认这条国策在我最摆烂的一天也能做到」；根不允许主动型。
  非根候选自动进入手牌。
- **F2 主视图**：树形视图（仅点亮节点，根在上、分支向下）+ 手牌视图（未挂树国策）；
  手牌视图内含「判例库」（已永久合法化退役的国策）。节点点击弹出详情（判定标准、触发条件、
  类型、连续点亮、内化进度、崩塌日志入口）。
- **F4 每日结算**：结算窗口默认 21:30–23:30（用户可设置，存 user_settings）；窗口外可手动进入但记
  `late`；逐条二元回答；答「否」二次确认：真违反（→ 递归回滚）或 永久合法化（→ 退役进判例库，不级联）；
  未结算的国策状态保持点亮、currentStreak 冻结；连续漏结算 ≥ 2 天提示「是否该冻结了」。
- **F5 每日新增**：入口条件 = 今日已完成结算 && 今日无回滚 && 已有 ≥1 条国策 cumulativeLitDays > 3；
  从手牌选或新建；挂在任意已点亮节点下；提示级联风险；当日限 1 次。
- **F6 回滚**：中性文案（禁止红色/灾难化 UI）；回滚后展示医学免责提示
  「严重情绪/注意力问题请就医，本应用不替代治疗」。
- **F9 冻结**：手动发起，范围 = 整树或指定子树，期限 ≤ 14 天，事由必填；冻结期不进结算列表；
  解冻日一次性重判（满足→恢复，不满足→回滚）；解冻日未重判自动顺延 1 天（不静默判负）。
- **F10 模板库**：10 条内置模板（PRD 表格原样），按类型分组，一键加入手牌；
  2 条机制型模板展示但标注「v0.5 开放」，不可加入。
- **根节点崩塌**：整树退回手牌，页面引导「从手牌里挑最不可能失败的一条重新做根」。
- 首次启动（引导页）展示医学免责声明。

## 数据边界结论

个人工具但需跨设备持久化 → 服务端存储（Postgres，按登录用户 user_profile 隔离，全部接口
@NeedLogin）。单用户单树数据量小（≤ 数百节点）。无多人协作、无匿名访问、无外部服务依赖，
不使用 AI 插件（MVP 内置候选与模板均为静态数据）。

## 技术架构

- 后端：单模块 `server/modules/rsip/`（controller + service 拆分），路径前缀 `api/rsip`。
- 前端：单页应用。路由：`/` 主视图（含引导浮层、结算浮层、编辑器/冻结弹窗）。
  页面文件只做布局编排；弹窗/树/表单区块均为独立组件；数据获取用自定义 hook（`client/src/hooks/`）。
  - 主页面 `client/src/pages/RsipPage/RsipPage.tsx`（布局 + 弹窗编排）
  - 组件 `client/src/pages/RsipPage/components/`：OnboardingWizard / MedicalDisclaimer /
    TreeView / HandView / NodeDetailDialog / RollbackLogDialog / DailyReviewDialog /
    AttachFlowDialog / FreezeReleaseDialog / PolicyEditorDialog / TemplateLibraryDialog /
    FreezeDialog / SettingsDialog / StatusBanner /
    TreeSwitcher / TreeCreateDialog / GroupManagerDialog / WinReportListDialog /
    WinReportCelebrateDialog
  - 仪表盘页 `client/src/pages/DashboardPage/`（路由 /dashboard）
  - 共享 `client/src/components/rsip/`：PolicyTypeBadge / ProgressTrack / PolicyIcon / LevelBadge；
    `client/src/api/rsip/`（API 封装 + templates.ts 模板静态数据）；
    `client/src/hooks/useRsipOverview.ts`（总览数据 hook）
- 国策图标系统：`rsip_policies.icon_key`（可空）存分类 key，
  前端 `client/src/components/rsip/policy-icons.ts`（11 张分类插画 + 模板映射，
  图片在 `client/src/assets/rsip-icons/`）与 `PolicyIcon.tsx`（展示）/
  `PolicyIconPicker.tsx`（选择器，编辑器与挂载内联新建用）。所有出现国策/
  模板的位置展示分类插画，默认 target 图。
- 表（见 server/database/schema.ts，DDL 由 lark-apps-db 通道执行后 codegen）：
  rsip_policies / rsip_tree_nodes / rsip_daily_reviews / rsip_rollback_events /
  rsip_freeze_records / rsip_progress / rsip_user_settings /
  rsip_trees / rsip_policy_groups / rsip_win_reports。
  rsip_tree_nodes.tree_id 必填指向 rsip_trees；rsip_policies.group_id 可空指向
  rsip_policy_groups；rsip_freeze_records.tree_id 整树冻结时指向目标树。
- 接口（全部 @NeedLogin，前缀 api/rsip）：
  overview / onboarding / policies (POST, PATCH) / policies/:id/group (PATCH) /
  tree/attach / review/submit / freeze / freeze/:id/release / settings /
  trees (POST) / trees/:id (PATCH) / trees/:id/archive (POST) /
  groups (POST) / groups/:id (PATCH, DELETE) / win-reports (POST) / dashboard (GET)。
- 接口契约：shared/api.interface.ts（后端实现前先写契约）。
- 前端请求一律 axiosForBackend；错误提示读 error.response.data.error.message。

## 设计基线（视觉规范，子 agent 必须遵循）

- 基调（v1.2「夜间牌桌」，覆盖早期浅色基调）：借鉴卡牌游戏的视觉语言 —— 深墨蓝牌桌 +
  象牙色文字，国策即卡牌；「崩塌是特性」— 回滚相关 UI 一律中性色 + 平和文案，
  禁用红色/警告图标/灾难化措辞；点亮 = 琥珀金（记忆点）。
- 色彩：一律用语义 token（bg-background / bg-card / bg-muted / text-foreground /
  text-muted-foreground / border-border），**不要再写 neutral-* / bg-white 硬编码色**；
  牌桌专用色 gold / gold-soft / gold-deep / frost（见 tailwind-theme.css）；不使用红色系表达状态。
- 牌桌视觉层：`client/src/rsip-game.css`（@layer components，工具类可覆盖）。
  卡牌 `.rsip-card` + `data-rarity`；稀有度由累计点亮天数决定（`components/rsip/rarity.ts`：
  0 未点亮 / 1 普通 / 7 精良 / 21 稀有 / 100 史诗 / 365 传说），只做视觉分级、不参与判定；
  竖版国策卡 `components/rsip/PolicyCard.tsx`，数值宝石 `StatGem.tsx`，倾斜高光 `hooks/useCardTilt.ts`；
  冻结 = `.rsip-frost`，待重判 = `.rsip-pending`，点亮 = `.rsip-lit`，结算按钮 = `.rsip-endturn`。
  所有动效在 prefers-reduced-motion 下关闭。卡牌标题用 font-serif，宝石数字用 font-display。
- 排版：中文界面；页面标题 text-xl font-semibold；正文 text-sm；辅助信息 text-xs text-muted-foreground；
  行高 leading-relaxed；数字用 tabular-nums。
- 间距：页面内容区 px-6 py-6（移动端 px-4）；卡片内边距 p-4；并列卡片/区块间距 gap-4；
  父容器已给 padding 时子容器不再叠加。
- 布局：桌面双栏（主内容 + 右侧状态栏），移动端单列堆叠；全部响应式（sm: 断点切换）。
- 组件：shadcn/ui 为主；面板用 .rsip-panel；树节点为牌桌卡牌，用 CSS 树连线（.rsip-tree-child）连接，
  父子都点亮时连线变金色；内化进度条为细条（h-1.5 rounded-full），显示到下一稀有度的进度。
- 文案：所有提示语中性、具体、不喊口号（P5：禁止「加油」「你可以的」类文案）。
- 图标：lucide-react，类型映射：被动型=ShieldOff/禁止类、半被动=Zap/触发类、主动型=Timer、
  机制型=Settings2；树=TreePine、组=Tags、喜报=PartyPopper、仪表盘=BarChart3、归档=Archive。
- 仪表盘：统计卡片用 data-ai-section-type="card-stat"；图表用 ReactECharts（开发前必须
  加载 /charts-skill），色板为深色牌桌 + 琥珀金点缀（chartTheme.ts），不使用红色；数字 tabular-nums；
  页面结构与主页面一致（max-w-5xl、header 带返回主视图入口）。
