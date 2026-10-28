import React from 'react';
import { Bell, Info, Snowflake } from 'lucide-react';
import type { RsipOverview } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';

interface StatusBannerProps {
  overview: RsipOverview;
  onOpenReview: () => void;
  onOpenRelease: () => void;
  onOpenFreeze?: () => void;
  onOpenAttach?: () => void;
}

interface BannerAction {
  label: string;
  onClick: () => void;
}

interface BannerItem {
  key: string;
  icon: React.ReactNode;
  text: string;
  action?: BannerAction;
}

const MAX_ITEMS = 2;

const StatusBanner: React.FC<StatusBannerProps> = ({
  overview,
  onOpenReview,
  onOpenRelease,
  onOpenFreeze,
  onOpenAttach,
}) => {
  const today = overview.today;
  const items: BannerItem[] = [];

  if (today.hasPendingRelease) {
    items.push({
      key: 'pending-release',
      icon: <Info size={14} className="text-gold-soft" />,
      text: '有国策待解冻重判',
      action: { label: '去重判', onClick: onOpenRelease },
    });
  }

  if (items.length < MAX_ITEMS && today.windowOpen && !today.reviewCompleted) {
    items.push({
      key: 'window-open',
      icon: <Bell size={14} className="text-gold-soft" />,
      text: `结算窗口已开启，今日应结算 ${today.dueCount} 条`,
      action: { label: '开始结算', onClick: onOpenReview },
    });
  }

  if (items.length < MAX_ITEMS && today.reviewCompleted && today.canAttachToday) {
    items.push({
      key: 'can-attach',
      icon: <Info size={14} className="text-gold-soft" />,
      text: '今天可以挂一条新国策',
      action: { label: '去挂载', onClick: onOpenAttach ?? onOpenReview },
    });
  }

  if (items.length < MAX_ITEMS && today.missedReviewDays >= 1) {
    items.push({
      key: 'missed-review',
      icon: <Snowflake size={14} className="text-gold-soft" />,
      text: `已连续 ${today.missedReviewDays} 天未结算；连续漏 2 天以上时，冻结比硬扛更有效`,
      action:
        today.missedReviewDays >= 2 && onOpenFreeze
          ? { label: '考虑冻结', onClick: onOpenFreeze }
          : undefined,
    });
  }

  if (items.length < MAX_ITEMS && overview.needsRootRebuild) {
    items.push({
      key: 'rebuild-root',
      icon: <Info size={14} className="text-gold-soft" />,
      text: '根国策已熄灭，等一次清洁结算后从手牌重新挂根',
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="rsip-panel rsip-panel-gilt overflow-hidden">
      {items.map((item: BannerItem, index: number) => (
        <div
          key={item.key}
          className={`relative flex flex-wrap items-center justify-between gap-2 py-3 pr-3 pl-4 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-gold before:to-gold-deep ${
            index > 0 ? 'border-t border-border' : ''
          }`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/10">
              {item.icon}
            </span>
            <p className="text-sm leading-relaxed text-foreground/85">
              {item.text}
            </p>
          </div>
          {item.action ? (
            <Button
              type="button"
              size="sm"
              onClick={item.action.onClick}
            >
              {item.action.label}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default StatusBanner;
