import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** 预设里的开发态检查器占位文件：client-toolkit 会引用它，生产构建需替换为空实现 */
const PRESET_STUBS = 'node_modules/@lark-apaas/coding-preset-vite-react/src';

/**
 * GitHub Pages 静态站点构建（仅本地模式）。
 * 与平台构建（vite.config.ts + @lark-apaas 预设）分开，不依赖妙搭平台插件。
 * 路由使用 HashRouter（VITE_ROUTER_MODE=hash），刷新与深链无需服务端回退。
 *
 * 构建：npx vite build --config vite.pages.config.ts
 * 产物位于 dist/pages/client/，工作流会把它整理到站点根目录。
 */
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/rsip/',
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_ROUTER_MODE': JSON.stringify('hash'),
  },
  resolve: {
    alias: [
      {
        find: '@/inspector.dev.css',
        replacement: path.resolve(PRESET_STUBS, 'empty.css'),
      },
      {
        find: '@lark-apaas/miaoda-inspector',
        replacement: path.resolve(PRESET_STUBS, 'inspector-stub.js'),
      },
    ],
    tsconfigPaths: true,
  },
  build: {
    outDir: 'dist/pages',
    emptyOutDir: true,
    rollupOptions: {
      input: 'client/index.html',
    },
  },
});
