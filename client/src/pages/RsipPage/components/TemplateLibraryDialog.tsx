import React, { useState } from 'react';
import { toast } from 'sonner';
import { Library } from 'lucide-react';
import type { RsipPolicyInput, RsipPolicyType } from '@shared/api.interface';
import {
  RSIP_TEMPLATES,
  type RsipTemplate,
} from '@client/src/api/rsip/templates';
import { createPolicy, extractErrorMessage } from '@client/src/api/rsip';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';

interface TemplateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  /** 机制型模板「存人失地」点击时打开冻结弹窗 */
  onOpenFreeze?: () => void;
  /** 机制型模板「赢麻了」点击时打开喜报编写 */
  onOpenWinReport?: () => void;
}

const GROUPS: { type: RsipPolicyType; label: string; hint: string }[] = [
  {
    type: 'passive',
    label: '被动型',
    hint: '靠环境与物理阻断，无需临场决策',
  },
  {
    type: 'semi_passive',
    label: '半被动型',
    hint: '挂在固定触发点上，触发后自动执行',
  },
  {
    type: 'active',
    label: '主动型',
    hint: '需要定时投入；树上同时存在不超过 3 条',
  },
  {
    type: 'mechanism',
    label: '机制型',
    hint: '平台机制入口，直接打开对应功能',
  },
];

const TemplateLibraryDialog: React.FC<TemplateLibraryDialogProps> = ({
  open,
  onClose,
  onAdded,
  onOpenFreeze,
  onOpenWinReport,
}) => {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleAdd = async (template: RsipTemplate): Promise<void> => {
    if (template.mechanism || template.type === 'mechanism') return;
    setPendingId(template.id);
    try {
      const input: RsipPolicyInput = {
        name: template.name,
        type: template.type,
        trigger: template.trigger,
        judge: template.judge,
        templateId: template.id,
      };
      await createPolicy(input);
      toast.success('已加入手牌');
      onAdded();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  const handleMechanism = (template: RsipTemplate): void => {
    if (template.id === 'freeze-entry') {
      if (!onOpenFreeze) return;
      onClose();
      onOpenFreeze();
    } else if (template.id === 'win-report') {
      if (!onOpenWinReport) return;
      onClose();
      onOpenWinReport();
    }
  };

  const mechanismAction = (template: RsipTemplate): {
    label: string;
    handler: () => void;
    disabled: boolean;
  } => {
    if (template.id === 'freeze-entry') {
      return {
        label: '打开冻结',
        handler: () => handleMechanism(template),
        disabled: !onOpenFreeze,
      };
    }
    return {
      label: '写喜报',
      handler: () => handleMechanism(template),
      disabled: !onOpenWinReport,
    };
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library size={16} className="text-muted-foreground/75" />
            模板库
          </DialogTitle>
          <DialogDescription>
            内置模板按类型分组，加入后进入手牌，可再挂到树上。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {GROUPS.map((group: { type: RsipPolicyType; label: string; hint: string }) => {
            const templates: RsipTemplate[] = RSIP_TEMPLATES.filter(
              (template: RsipTemplate) => template.type === group.type,
            );
            if (templates.length === 0) return null;
            return (
              <section key={group.type}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {group.label}
                  </h3>
                  <span className="text-xs text-muted-foreground">{group.hint}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {templates.map((template: RsipTemplate) => (
                    <div
                      key={template.id}
                      className="flex flex-col rounded-xl border border-border bg-card/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_10px_28px_-14px_var(--gold)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <PolicyIcon templateId={template.id} size={36} />
                          <p className="text-sm font-medium text-foreground">
                            {template.name}
                          </p>
                        </div>
                        <PolicyTypeBadge type={template.type} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {template.description}
                      </p>
                      {template.judge ? (
                        <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                          判定：{template.judge}
                        </p>
                      ) : null}
                      {template.trigger ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          触发：{template.trigger}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {template.mechanism ? (
                          <Badge
                            variant="outline"
                            className="px-1.5 text-[11px] font-normal text-muted-foreground"
                          >
                            机制入口
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/75">
                            加入后进入手牌
                          </span>
                        )}
                        {template.mechanism ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={mechanismAction(template).disabled}
                            onClick={mechanismAction(template).handler}
                          >
                            {mechanismAction(template).label}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pendingId === template.id}
                            onClick={() => {
                              void handleAdd(template);
                            }}
                          >
                            {pendingId === template.id ? '加入中…' : '加入手牌'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateLibraryDialog;
