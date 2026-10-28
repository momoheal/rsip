import React, { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import {
  ctdpEngine,
  type CtdpChain,
  type CtdpState,
} from '@client/src/store/ctdpEngine';

interface RulingDialogProps {
  state: CtdpState;
  run: (action: () => CtdpState) => boolean;
}

const MAIN_SUGGESTIONS: string[] = ['上厕所', '接电话', '回一条消息', '拿快递', '起身倒水'];
const AUX_SUGGESTIONS: string[] = ['人在室外', '正在洗澡', '临时有急事'];

/**
 * 下必为例：疑似违规只有两个选项 ——
 * 判违规（链清零）或判允许（从此永久允许，记入判例）。
 * 不提供「这次特殊，下不为例」。
 */
const RulingDialog: React.FC<RulingDialogProps> = ({ state, run }) => {
  const pending = state.pendingRuling;
  const [behavior, setBehavior] = useState<string>('');
  // 状态每秒重新读取，pending 每次都是新对象；只在裁决事件本身变化时清空输入
  const pendingKey: string | null = pending ? `${pending.chain}:${pending.reason}` : null;

  useEffect(() => {
    setBehavior('');
  }, [pendingKey]);

  if (!pending) return null;

  const isMain: boolean = pending.chain === 'main';
  const chain: CtdpChain = isMain ? state.main : state.aux;
  const chainName: string = isMain ? '主链' : '预约链';
  const suggestions: string[] = isMain ? MAIN_SUGGESTIONS : AUX_SUGGESTIONS;
  const trimmed: string = behavior.trim();
  const isKnownPrecedent: boolean = chain.precedents.some(
    (precedent) => precedent.text === trimmed,
  );

  const description: string = isMain
    ? '专注中出现了与「最好的状态」不符的情况。'
    : pending.reason === 'overdue'
      ? `预约已超时：${state.settings.reserveMinutes} 分钟内没有坐上神圣座位。`
      : '你想撤销这次预约。';

  return (
    <Dialog
      open
      onOpenChange={(next: boolean) => {
        // 超时裁决必须做出选择；疑似违规可以撤回
        if (!next && pending.reason === 'suspect') {
          run(() => ctdpEngine.dismissSuspect());
        }
      }}
    >
      <DialogContent
        className="max-w-md"
        showCloseButton={pending.reason === 'suspect'}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Scale size={18} className="text-gold-soft" />
            下必为例 · {chainName}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {description}
            只有两个选项，而且这次怎么判，以后同样的情况就必须怎么判。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="ruling-behavior" className="text-xs text-muted-foreground">
            具体是什么情况
          </label>
          <Input
            id="ruling-behavior"
            value={behavior}
            maxLength={60}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setBehavior(event.target.value)
            }
            placeholder={isMain ? '例如：中途回了一条工作消息' : '例如：预约后人还在室外'}
          />
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((text: string) => (
              <button
                key={text}
                type="button"
                onClick={() => setBehavior(text)}
                className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-foreground/75 transition-colors hover:border-gold/50 hover:text-gold-soft"
              >
                {text}
              </button>
            ))}
          </div>
          {isKnownPrecedent && (
            <p className="text-[11px] leading-relaxed text-gold-soft/90">
              这已经是本链的判例，按先例判允许即可。
            </p>
          )}
        </div>

        {chain.precedents.length > 0 && (
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <p className="text-[11px] text-muted-foreground">本链已有判例（永久允许）</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {chain.precedents.map((precedent) => (
                <span
                  key={precedent.id}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/80"
                >
                  {precedent.text}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start whitespace-normal py-2.5 text-left"
            disabled={!trimmed}
            onClick={() => run(() => ctdpEngine.rule('precedent', trimmed))}
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">
                判允许{trimmed ? `：「${trimmed}」` : ''}
              </span>
              <span className="block text-[11px] font-normal text-muted-foreground">
                从此{chainName}永久允许这种情况，{isMain ? '本次专注继续' : '这次预约不计入链长'}
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start whitespace-normal py-2.5 text-left"
            onClick={() => run(() => ctdpEngine.rule('reset', trimmed))}
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">
                判违规：{chainName}清零
              </span>
              <span className="block text-[11px] font-normal text-muted-foreground">
                #{chain.count} 的纪录归零，下次从 #1 重新开始
                {isMain ? '，本次专注结束' : ''}
              </span>
            </span>
          </Button>
        </div>

        {pending.reason === 'suspect' && (
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run(() => ctdpEngine.dismissSuspect())}
            >
              只是误点，返回
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RulingDialog;
