import React, { useEffect, useState } from 'react';
import { ScrollText, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  ctdpEngine,
  type CtdpChain,
  type CtdpState,
} from '@client/src/store/ctdpEngine';

interface ProtocolPanelProps {
  state: CtdpState;
  run: (action: () => CtdpState) => boolean;
}

const PrecedentList: React.FC<{ title: string; chain: CtdpChain }> = ({
  title,
  chain,
}) => (
  <div>
    <p className="text-xs font-semibold text-foreground/85">{title}</p>
    {chain.precedents.length === 0 ? (
      <p className="mt-1 text-[11px] text-muted-foreground">
        还没有判例。规则的边界会在一次次裁决里慢慢收敛到刚好够用。
      </p>
    ) : (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chain.precedents.map((precedent) => (
          <span
            key={precedent.id}
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/80"
            title={`判于 ${precedent.createdAt.slice(0, 10)}`}
          >
            {precedent.text}
          </span>
        ))}
      </div>
    )}
  </div>
);

/** 协议设置（神圣座位、预约信号、时长）+ 两条链的判例 */
const ProtocolPanel: React.FC<ProtocolPanelProps> = ({ state, run }) => {
  const { settings } = state;
  const [seat, setSeat] = useState<string>(settings.seat);
  const [signal, setSignal] = useState<string>(settings.signal);
  const [focusMinutes, setFocusMinutes] = useState<string>(String(settings.focusMinutes));
  const [reserveMinutes, setReserveMinutes] = useState<string>(
    String(settings.reserveMinutes),
  );
  const [scoutMinutes, setScoutMinutes] = useState<string>(String(settings.scoutMinutes));

  useEffect(() => {
    setSeat(settings.seat);
    setSignal(settings.signal);
    setFocusMinutes(String(settings.focusMinutes));
    setReserveMinutes(String(settings.reserveMinutes));
    setScoutMinutes(String(settings.scoutMinutes));
    // 状态每秒重新读取一次，只在值真正变化时同步，避免冲掉正在输入的内容
  }, [
    settings.seat,
    settings.signal,
    settings.focusMinutes,
    settings.reserveMinutes,
    settings.scoutMinutes,
  ]);

  const busy: boolean = state.active !== null || state.reservation !== null;

  const save = (): void => {
    const ok = run(() =>
      ctdpEngine.updateSettings({
        seat,
        signal,
        focusMinutes: Number(focusMinutes) || settings.focusMinutes,
        reserveMinutes: Number(reserveMinutes) || settings.reserveMinutes,
        scoutMinutes: Number(scoutMinutes) || settings.scoutMinutes,
      }),
    );
    if (ok) toast.success('协议已更新');
  };

  return (
    <div className="space-y-4">
      <section className="rsip-panel p-4" aria-label="判例">
        <h2 className="flex items-center gap-2 font-serif text-sm font-bold text-foreground">
          <ScrollText size={15} className="text-gold-soft/80" />
          判例
        </h2>
        <div className="mt-3 space-y-3">
          <PrecedentList title="主链" chain={state.main} />
          <PrecedentList title="预约链" chain={state.aux} />
        </div>
      </section>

      <section className="rsip-panel p-4" aria-label="协议设置">
        <h2 className="flex items-center gap-2 font-serif text-sm font-bold text-foreground">
          <Settings2 size={15} className="text-gold-soft/80" />
          协议设置
        </h2>
        <div className="mt-3 space-y-2.5">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">
              神圣座位（看得见摸得着的标志最好）
            </span>
            <Input
              value={seat}
              maxLength={60}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeat(e.target.value)}
              className="h-8 text-xs"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">预约信号</span>
            <Input
              value={signal}
              maxLength={40}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignal(e.target.value)}
              className="h-8 text-xs"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">专注(分)</span>
              <Input
                type="number"
                min={5}
                max={180}
                value={focusMinutes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFocusMinutes(e.target.value)
                }
                className="h-8 text-xs tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">预约(分)</span>
              <Input
                type="number"
                min={1}
                max={60}
                value={reserveMinutes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setReserveMinutes(e.target.value)
                }
                className="h-8 text-xs tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">侦查(分)</span>
              <Input
                type="number"
                min={1}
                max={15}
                value={scoutMinutes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setScoutMinutes(e.target.value)
                }
                className="h-8 text-xs tabular-nums"
              />
            </label>
          </div>
          <Button size="sm" variant="outline" onClick={save} disabled={busy}>
            保存设置
          </Button>
          {busy && (
            <p className="text-[11px] text-muted-foreground">
              专注或预约进行中，结束后再改设置。
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProtocolPanel;
