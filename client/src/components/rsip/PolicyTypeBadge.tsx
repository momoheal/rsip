import React from 'react';
import { ShieldOff, Zap, Timer, Settings2 } from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import type { RsipPolicyType } from '@shared/api.interface';

const TYPE_META: Record<
  RsipPolicyType,
  { label: string; icon: React.ReactNode }
> = {
  passive: { label: '被动型', icon: <ShieldOff size={12} /> },
  semi_passive: { label: '半被动型', icon: <Zap size={12} /> },
  active: { label: '主动型', icon: <Timer size={12} /> },
  mechanism: { label: '机制型', icon: <Settings2 size={12} /> },
};

interface PolicyTypeBadgeProps {
  type: RsipPolicyType;
}

const PolicyTypeBadge: React.FC<PolicyTypeBadgeProps> = ({ type }) => {
  const meta = TYPE_META[type];
  return (
    <Badge
      variant="outline"
      className="gap-1 px-1.5 text-[11px] font-normal text-muted-foreground"
    >
      {meta.icon}
      {meta.label}
    </Badge>
  );
};

export default PolicyTypeBadge;
export { TYPE_META };
