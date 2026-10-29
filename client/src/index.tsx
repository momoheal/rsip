import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { AppContainer } from '@lark-apaas/client-toolkit/components/AppContainer';
import { ErrorRender } from '@lark-apaas/client-toolkit/components/ErrorRender';

import RoutesComponent from './app.tsx';
import './index.css';
import { Toaster } from '@client/src/components/ui/sonner';

function resolveBasePath(): string {
  if (typeof window !== 'undefined') {
    const pn = window.location.pathname;
    // 本地 dev 特征：vite root 为项目根，物理入口 index.html 位于 client/ 下，
    // 访问路径形如 /client/；此判断优先于平台注入的 __BASENAME__。
    if (pn.indexOf('/client') === 0) {
      return '/client';
    }
    // 平台部署时由 server 注入
    if (window.__BASENAME__) {
      return window.__BASENAME__;
    }
  }
  return '/';
}

const CLIENT_BASE_PATH = resolveBasePath();

// GitHub Pages 等静态托管没有 SPA 回退，改用 hash 路由；平台构建保持 BrowserRouter
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;

const MainApp = () => {
  return (
    <Router basename={CLIENT_BASE_PATH}>
      <AppContainer defaultTheme="light">
        <ErrorBoundary
          fallbackRender={parameter => (
            <ErrorRender
              error={parameter.error as Error}
              resetErrorBoundary={parameter.resetErrorBoundary}
            />
          )}
        >
          <RoutesComponent />
          {createPortal(<Toaster />, document.body)}
        </ErrorBoundary>
      </AppContainer>
    </Router>
  );
};

createRoot(document.getElementById('root')!).render(<MainApp />);
