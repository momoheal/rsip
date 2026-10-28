import React from 'react';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import {
  ICON_OPTIONS,
} from '@client/src/components/rsip/policy-icons';
import { cn } from '@client/src/lib/utils';

interface PolicyIconPickerProps {
  /** 当前选中的图标 key，null 表示未选择 */
  value: string | null;
  onChange: (key: string) => void;
}

const PolicyIconPicker: React.FC<PolicyIconPickerProps> = ({
  value,
  onChange,
}) => (
  <div
    role="group"
    aria-label="选择国策图标"
    className="grid grid-cols-4 gap-2 sm:grid-cols-6"
  >
    {ICON_OPTIONS.map((option) => {
      const selected: boolean = value === option.key;
      return (
        <button
          key={option.key}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(option.key)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            selected ? 'ring-2 ring-amber-400' : 'hover:bg-muted/60',
          )}
        >
          <PolicyIcon iconKey={option.key} size={44} />
          <span
            className={cn(
              'text-xs',
              selected ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default PolicyIconPicker;
