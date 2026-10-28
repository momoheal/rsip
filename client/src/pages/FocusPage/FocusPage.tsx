import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { useCtdp } from '@client/src/hooks/useCtdp';
import { formationOf, sessionEndsAt } from '@client/src/store/ctdpEngine';
import ChainBoard from './components/ChainBoard';
import FocusConsole from './components/FocusConsole';
import { formatClock } from './components/CountdownRing';
import FocusLog from './components/FocusLog';
import ProtocolPanel from './components/ProtocolPanel';
import RulingDialog from './components/RulingDialog';

const PRINCIPLES: { title: string; text: string }[] = [
  {
    title: '神圣座位',
    text: '坐上去就必须以最好的状态专注；每次成功记 #N，一次失败整条链清零。链越长，放弃的代价越大，反而越不用和自己拉锯。',
  },
  {
    title: '下必为例',
    text: '疑似违规只能二选一：判违规清零，或判允许并永久允许。没有「这次特殊，下不为例」。',
  },
  {
    title: '线性时延',
    text: '「15 分钟后开始」比「立刻开始」容易得多。先发预约信号，再让预约链把你推上座位。',
  },
];

/**
 * CTDP 专注页（第一代方法）：管一小时尺度的专注。
 * 长期稳态仍由 RSIP 国策树负责，这里只是它下面的一个子工具。
 */
const FocusPage: React.FC = () => {
  const { state, now, completedNo, clearCompleted, run } = useCtdp();

  // 标签页标题显示倒计时，切走也能看到剩余时间
  useEffect(() => {
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);

  useEffect(() => {
    if (state.active) {
      const remaining = sessionEndsAt(state.active) - now;
      document.title = `${formatClock(remaining)} · 专注中`;
    } else if (state.reservation) {
      document.title = `${formatClock(state.reservation.deadline - now)} · 预约中`;
    } else {
      document.title = 'CTDP 专注';
    }
  }, [state.active, state.reservation, now]);

  const formation = completedNo !== null ? formationOf(completedNo) : null;

  return (
    <div className="rsip-table min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" aria-label="返回国策树" asChild>
            <Link to="/">
              <ArrowLeft size={16} />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-black tracking-wide text-foreground">
              CTDP 专注
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              链式时延协议 · 管好这一小时；长期稳态交给国策树
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <ChainBoard state={state} />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-5">
            <FocusConsole state={state} now={now} run={run} />
            <FocusLog log={state.log} />
          </div>
          <aside className="space-y-4">
            <section className="rsip-panel p-4" aria-label="三个原理">
              <h2 className="rsip-ornament font-serif text-xs font-bold tracking-[0.2em] text-gold-soft/90">
                三个原理
              </h2>
              <ul className="mt-3 space-y-3">
                {PRINCIPLES.map((item) => (
                  <li key={item.title}>
                    <p className="text-xs font-semibold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <ProtocolPanel state={state} run={run} />
          </aside>
        </div>
      </main>

      <RulingDialog state={state} run={run} />

      <Dialog
        open={completedNo !== null}
        onOpenChange={(next: boolean) => {
          if (!next) clearCompleted();
        }}
      >
        <DialogContent className="max-w-sm overflow-hidden">
          <DialogHeader className="relative items-center text-center sm:text-center">
            <div className="rsip-rays" aria-hidden="true" />
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold/15 text-gold shadow-[0_0_30px_-4px_var(--gold)]">
              <Sparkles size={22} />
            </span>
            <DialogTitle className="mt-2 font-display text-3xl text-gold-soft">
              #{completedNo}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              主链新增一个节点，这是一份实打实的工作量证明。
              {formation && completedNo !== null && completedNo % 3 === 0
                ? ` 凑满一个任务组：##${formation.groups}。`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={clearCompleted}>
              收下
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FocusPage;
