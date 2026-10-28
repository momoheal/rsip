import React, { useState } from 'react';
import { Armchair, BellRing, Binoculars, Flag, Sparkles } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { cn } from '@client/src/lib/utils';
import {
  ctdpEngine,
  sessionEndsAt,
  UNIT_KINDS,
  type CtdpState,
  type CtdpUnitKind,
} from '@client/src/store/ctdpEngine';
import CountdownRing from './CountdownRing';

interface FocusConsoleProps {
  state: CtdpState;
  now: number;
  run: (action: () => CtdpState) => boolean;
}

const UNIT_LABEL: Record<CtdpUnitKind, string> = Object.fromEntries(
  UNIT_KINDS.map((unit) => [unit.key, unit.label]),
) as Record<CtdpUnitKind, string>;

/** 专注控制台：空闲 → 预约倒计时 → 专注中 三种状态 */
const FocusConsole: React.FC<FocusConsoleProps> = ({ state, now, run }) => {
  const [unit, setUnit] = useState<CtdpUnitKind>('assault');
  const [goal, setGoal] = useState<string>('');
  const { settings, active, reservation } = state;

  const start = (kind: 'main' | 'scout'): void => {
    run(() => ctdpEngine.start(kind, unit, goal));
  };

  const unitPicker = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">这个单元的兵种</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="兵种">
          {UNIT_KINDS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={unit === item.key}
              title={item.hint}
              onClick={() => setUnit(item.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                unit === item.key
                  ? 'border-gold/60 bg-gold/15 text-gold-soft'
                  : 'border-border text-foreground/70 hover:border-foreground/30',
              )}
            >
              {item.label}
              <span className="ml-1 hidden text-[10px] text-muted-foreground sm:inline">
                {item.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Input
        value={goal}
        maxLength={60}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setGoal(event.target.value)
        }
        placeholder="这一小时要做什么（可选），例如：读完论文第 3 节"
        aria-label="本次专注目标"
      />
    </div>
  );

  // 专注中
  if (active) {
    const endsAt: number = sessionEndsAt(active);
    const remaining: number = endsAt - now;
    const totalMs: number = active.durationMin * 60_000;
    const isScout: boolean = active.kind === 'scout';
    return (
      <section className="rsip-panel rsip-panel-gilt p-5" aria-label="专注中">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-[11px] tracking-[0.25em] text-gold-soft/80">
            {isScout ? '侦查任务' : `主链 #${state.main.count + 1} 进行中`}
          </p>
          <CountdownRing
            remainingMs={remaining}
            totalMs={totalMs}
            label={isScout ? '侦查剩余' : '专注剩余'}
          />
          <div className="space-y-1">
            <p className="font-serif text-base font-bold text-foreground">
              {active.goal || (isScout ? '先专注几分钟看看' : '以最好的状态专注')}
            </p>
            <p className="text-xs text-muted-foreground">
              {UNIT_LABEL[active.unit]}单元
              {active.fromReservation ? ' · 由预约触发' : ''}
            </p>
          </div>
          {isScout ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => run(() => ctdpEngine.promoteScout())}>
                <Sparkles size={14} />
                进入状态了，转为主链 {settings.focusMinutes} 分钟
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(() => ctdpEngine.endScout())}
              >
                结束侦查
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => ctdpEngine.raiseSuspect('main'))}
            >
              <Flag size={14} />
              出现疑似违规 / 想中途离开
            </Button>
          )}
          <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground">
            {isScout
              ? `侦查满 ${settings.scoutMinutes} 分钟就算完成；坚持不下去随时结束，不影响主链。`
              : '到点自动记下这个节点。关掉页面也会继续计时。'}
          </p>
        </div>
      </section>
    );
  }

  // 预约倒计时
  if (reservation) {
    const remaining: number = reservation.deadline - now;
    const totalMs: number = reservation.deadline - reservation.createdAt;
    return (
      <section className="rsip-panel p-5" aria-label="预约倒计时">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-[11px] tracking-[0.25em] text-frost/90">
            预约链 #{state.aux.count + 1} · 已发出「{settings.signal}」
          </p>
          <CountdownRing
            remainingMs={remaining}
            totalMs={totalMs}
            label="内必须坐上去"
            tone="frost"
          />
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            倒计时结束前执行「{settings.seat}」，开始主链专注。
            已预留 30 秒缓冲，不用卡着最后一秒。
          </p>
        </div>
        <div className="mt-5">{unitPicker}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="rsip-endturn flex min-h-10 items-center gap-2 px-6 text-sm"
            data-ready="true"
            onClick={() => start('main')}
          >
            <Armchair size={16} />
            坐上神圣座位
          </button>
          <Button variant="outline" onClick={() => start('scout')}>
            <Binoculars size={15} />
            先侦查 {settings.scoutMinutes} 分钟
          </Button>
        </div>
        <div className="mt-3 text-center">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => run(() => ctdpEngine.raiseSuspect('aux'))}
          >
            想撤销这次预约
          </Button>
        </div>
      </section>
    );
  }

  // 空闲
  return (
    <section className="rsip-panel p-5" aria-label="开始专注">
      <div className="space-y-1">
        <h2 className="font-serif text-base font-bold text-foreground">
          现在不想开始？那就先预约
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          「15 分钟后开始」的门槛远低于「立刻开始」。发出预约信号后，倒计时结束前坐上神圣座位即可。
        </p>
      </div>
      <div className="mt-4">{unitPicker}</div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className="rsip-endturn flex min-h-11 items-center justify-center gap-2 px-4 text-sm"
          onClick={() => run(() => ctdpEngine.reserve())}
        >
          <BellRing size={16} />
          预约 · {settings.reserveMinutes} 分钟后
        </button>
        <Button
          variant="outline"
          className="min-h-11 bg-card/60"
          onClick={() => start('main')}
        >
          <Armchair size={15} />
          立刻坐上去
        </Button>
        <Button
          variant="outline"
          className="min-h-11 bg-card/60"
          onClick={() => start('scout')}
        >
          <Binoculars size={15} />
          侦查 {settings.scoutMinutes} 分钟
        </Button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        神圣座位：「{settings.seat}」。一旦坐上去，就以最好的状态专注满 {settings.focusMinutes} 分钟。
      </p>
    </section>
  );
};

export default FocusConsole;
