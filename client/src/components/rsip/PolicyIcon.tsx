import { cn } from '@/lib/utils';
import {
  getIconOption,
  getPolicyIconKey,
  getTemplateIconKey,
  type RsipIconKey,
} from './policy-icons';

export interface PolicyIconProps {
  iconKey?: RsipIconKey | string | null;
  policy?: {
    iconKey?: string | null;
    templateId?: string | null;
  };
  templateId?: string | null;
  /** 展示尺寸（正方形边长 px） */
  size?: number;
  className?: string;
}

/**
 * 国策分类图标：三选一传参（iconKey > policy > templateId），
 * 都缺省时显示「目标」默认图标。
 * 渲染为 lucide 图标 + 宝石质感圆角方块（色相取自分类），无外部图片依赖。
 */
export function PolicyIcon({
  iconKey,
  policy,
  templateId,
  size = 36,
  className,
}: PolicyIconProps) {
  let resolved: RsipIconKey;
  if (iconKey !== null && iconKey !== undefined) {
    resolved = getPolicyIconKey({ iconKey });
  } else if (policy !== undefined) {
    resolved = getPolicyIconKey(policy);
  } else {
    resolved = getTemplateIconKey(templateId ?? null);
  }
  const option = getIconOption(resolved);
  const { Icon, hue } = option;
  const iconSize = Math.round(size * 0.54);
  return (
    <span
      role="img"
      aria-label={option.label}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 80% 72%), hsl(${hue} 60% 46%) 55%, hsl(${hue} 55% 26%))`,
        boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.35), inset 0 0 0 1px hsl(${hue} 70% 80% / 0.25), 0 4px 10px -4px hsl(${hue} 70% 40% / 0.7)`,
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[28%] text-white',
        className,
      )}
    >
      <Icon
        size={iconSize}
        strokeWidth={2.2}
        style={{ filter: 'drop-shadow(0 1px 1px hsl(0 0% 0% / 0.45))' }}
      />
    </span>
  );
}
