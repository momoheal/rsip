# RSIP 自控力操作系统

一个个人自控力管理的 Web 应用。把个人规则拆成「国策」，组织成「国策树」，每天结算一次，
用递归回滚保护基础节点。方法来自知乎 edmond《如何提高自制力？》一文中的 CTDP / RSIP 思路，
本项目是对它的个人化实现，不是原文的官方版本。

> 本应用不替代医学诊断与治疗。严重的情绪或注意力问题请就医。

## 核心概念

| 概念 | 说明 |
| --- | --- |
| 国策 | 一条可执行的规则，含判定标准（一个「是否……？」二元问句）、类型（被动 / 半被动 / 主动）与杠杆来源 |
| 国策树 | 每棵树一个根节点，子节点是挂在已点亮节点下的国策；可多棵树并存 |
| 每日结算 | 每天在结算窗口（默认 21:30–23:30）逐条回答「是 / 否」 |
| 递归回滚 | 答「否」且判为真违反时，该节点与全部子孙退回手牌；内化进度（累计天数）保留，连续天数归零 |
| 永久合法化 | 答「否」但判为不该约束，国策退役进判例库，不级联 |
| 强化等级（+N） | 国策可设一条强化规则：每升一级把时间门槛平移一档，达到门槛后手动确认升级；失手时可「降回 +0」，节点留在树上 |
| 冻结 | 整树或子树暂停结算，最长 14 天，解冻日一次性重判 |
| 喜报 | 手动记录，或在连续点亮、累计点亮、连续清洁结算达到里程碑时自动生成 |
| CTDP 专注 | 以计时的方式做专注任务：主链、预约链与侦查任务，疑似违规时由用户裁决 |

## 功能概览

- **引导**：写下大目标，拆出至少三个候选国策，选一条作根。根国策不能是主动型。
- **国策树视图**：卡牌式展示，点亮、冻结、待重判、可升级等状态一目了然。
- **手牌视图**：未挂树的国策，含判例库。支持按国策组筛选。
- **每日结算**：逐条判定，「否」时选择真违反、降回 +0 或永久合法化；可选给当天命名（小赢 / 中赢 / 大赢）。
- **崩塌日志与复盘**：回滚事件可补写触发场景与教训。同一国策崩塌两次及以上会给出提示。
- **仪表盘**（`/dashboard`）：统计、近 30 天结算趋势、树进度、归档与崩塌记录。
- **CTDP 专注**（`/focus`）：本地保存，不参与国策结算。

## 数据与运行模式

应用有两种数据源，由构建期环境变量 `VITE_DATA_SOURCE` 决定：

- **本地模式（默认）**：所有数据保存在浏览器 `localStorage`（键 `rsip-local-state-v1`，CTDP 为 `rsip-ctdp-v1`）。无需登录、无需后端，清除浏览器数据即会丢失。
- **平台模式**（`VITE_DATA_SOURCE=remote`）：通过 NestJS 后端 `api/rsip` 读写，需要登录。当前后端落后于本地引擎：

  - 缺少 v1.1 字段（杠杆来源、相关性、树层级、诊断）与 v1.2 字段（强化等级、每日命名）；
  - 强化升级在平台模式下会报错；
  - `tsc -p tsconfig.node.json` 有 5 个已知错误。

  因此实际使用与验证请以本地模式为准。

## 技术栈

- 前端：React 19、TypeScript、Vite、Tailwind CSS、shadcn/ui（Radix）、React Router、react-hook-form + zod、sonner、lucide-react
- 后端（平台模式）：NestJS 10、Drizzle ORM、PostgreSQL
- 共享契约：`shared/api.interface.ts`，前后端与本地引擎共用同一套类型

## 目录结构

```
client/src/
├── api/rsip/          # 接口封装；按 USE_LOCAL 切换本地引擎或后端
├── store/
│   ├── localEngine.ts # 本地引擎：全部业务规则（结算、回滚、里程碑、强化等）
│   ├── ctdpEngine.ts  # CTDP 专注引擎
│   └── config.ts      # 数据源开关
├── pages/
│   ├── RsipPage/      # 主视图与各弹窗
│   ├── DashboardPage/ # 仪表盘
│   └── FocusPage/     # CTDP 专注
└── components/rsip/   # 国策卡、徽记、稀有度、国策图标等共享组件
server/modules/rsip/   # 平台模式后端（controller / service / review）
shared/api.interface.ts
AGENTS.md              # 研发规范与设计决策（权威）
HANDOFF.md             # 交接文档
```

## 快速开始

环境要求：Node.js ≥ 22，npm ≥ 10。

```bash
npm install
npm run dev:client
```

启动后在终端输出的地址打开页面（默认端口由 Vite 决定，例如 `http://localhost:5173`）。
本地模式下无需启动后端。

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev:client` | 启动前端开发服务器（本地模式） |
| `npm run type:check:client` | 前端类型检查 |
| `npm run eslint` | ESLint 检查 |
| `npm run stylelint` | 样式检查 |
| `npm run build:client` | 构建前端 |

## 在线体验

部署在 GitHub Pages：<https://momoheal.github.io/rsip/>

- 仅本地模式可用，数据只存在你的浏览器里，换设备或清除数据不会同步。
- 路由使用 hash（`#/dashboard`、`#/focus`），刷新页面不会 404。

静态站点由 `.github/workflows/pages.yml` 在 `main` 推送时自动构建部署，构建配置见 `vite.pages.config.ts`（与平台构建的 `vite.config.ts` 分开）。本地验证：

```bash
npx vite build --config vite.pages.config.ts
```

## 设计原则

- **崩塌是特性**：回滚使用中性配色与平和文案，不使用红色或警告式表达。
- **判定只有「是 / 否」**：国策必须能二元回答，判定标准以「是否」或「有没有」开头。
- **不自动升级、不静默判负**：强化升级需要手动确认；冻结到期未重判则顺延，不直接算作失败。
- **本地优先**：核心流程不依赖网络与账号。

更完整的设计决策见 [AGENTS.md](AGENTS.md)，交接细节见 [HANDOFF.md](HANDOFF.md)。

## 参考

- 知乎 edmond，《如何提高自制力？》（CTDP / RSIP 方法论来源）
- 产品与技术文档：`RSIP_PRD_v1.1.md`、`RSIP_TechSpec_v1.1.md`（位于仓库上级目录，未随本仓库发布）

## 许可

本项目以 [MIT License](LICENSE) 发布。
