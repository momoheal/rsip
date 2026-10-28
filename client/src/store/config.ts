/**
 * 数据源配置：
 * - 默认本地模式（USE_LOCAL=true）：前端用 localStorage 引擎独立运行，无需后端/登录。
 * - 平台模式：设置构建期环境变量 VITE_DATA_SOURCE=remote，走妙搭后端 API。
 */
export const USE_LOCAL: boolean =
  (import.meta.env.VITE_DATA_SOURCE ?? 'local') !== 'remote';
