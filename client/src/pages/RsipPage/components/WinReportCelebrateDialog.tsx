import React from 'react';
import { PartyPopper, Sparkles } from 'lucide-react';
import type { RsipWinReport } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { ScrollArea } from '@client/src/components/ui/scroll-area';

interface WinReportCelebrateDialogProps {
  open: boolean;
  /** 本次结算触发的里程碑喜报 */
  reports: RsipWinReport[];
  onClose: () => void;
}

/** 里程碑喜报：像开卡包一样逐张翻开 */
const WinReportCelebrateDialog: React.FC<WinReportCelebrateDialogProps> = ({
  open,
  reports,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader className="relative items-center text-center sm:text-center">
          <div className="rsip-rays" aria-hidden="true" />
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold/15 text-gold shadow-[0_0_30px_-4px_var(--gold)]">
            <PartyPopper size={22} />
          </span>
          <DialogTitle className="mt-2 text-xl text-gold-soft">
            里程碑达成
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            这是结算后自动记录的喜报，点亮的事实留在这里。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <ul className="flex flex-col gap-3 py-1">
            {reports.map((report: RsipWinReport, index: number) => (
              <li
                key={report.id}
                data-rarity="legendary"
                className="rsip-card rsip-reveal p-4"
                style={
                  { '--delay': `${150 + index * 220}ms` } as React.CSSProperties
                }
              >
                <div className="rsip-card-foil" aria-hidden="true" />
                <div className="relative z-[4] flex items-start gap-3">
                  <span className="rsip-gem" data-tone="streak" aria-hidden="true">
                    <Sparkles size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-base font-bold leading-relaxed text-foreground">
                      {report.title}
                    </p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-foreground/70">
                      {report.content}
                    </p>
                    {report.relatedPolicyName && (
                      <p className="mt-2 inline-flex rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] text-gold-soft">
                        相关国策 · {report.relatedPolicyName}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button size="sm" aria-label="关闭喜报庆祝" onClick={onClose}>
            收下
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WinReportCelebrateDialog;
