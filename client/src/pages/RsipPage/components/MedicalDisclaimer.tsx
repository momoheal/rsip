import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MedicalDisclaimerProps {
  className?: string;
}

const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({ className }) => {
  return (
    <div
      role="note"
      aria-label="医学免责声明"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5',
        className,
      )}
    >
      <ShieldAlert
        size={14}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-muted-foreground/75"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        本应用是行为管理工具，不替代专业治疗；若感到持续痛苦或无法控制的冲动，请寻求专业医疗帮助
      </p>
    </div>
  );
};

export default MedicalDisclaimer;
