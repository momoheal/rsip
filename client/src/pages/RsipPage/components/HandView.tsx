import React, { useMemo, useState } from 'react';
import { Layers, Pencil, ScrollText, Sprout, Tags } from 'lucide-react';
import type {
  RsipHandItem,
  RsipPolicy,
  RsipPolicyGroup,
} from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import PolicyCard from '@client/src/components/rsip/PolicyCard';
import { cn } from '@client/src/lib/utils';

const FILTER_ALL = 'all';
const FILTER_UNGROUPED = 'ungrouped';

interface GroupFilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}

const GroupFilterChip: React.FC<GroupFilterChipProps> = ({
  label,
  count,
  active,
  onSelect,
}) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={`筛选分组 ${label}`}
    onClick={onSelect}
    className={cn(
      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all',
      active
        ? 'border-gold/60 bg-gold/15 text-gold-soft shadow-[0_0_12px_-4px_var(--gold)]'
        : 'border-border bg-card/60 text-foreground/70 hover:border-foreground/25 hover:text-foreground',
    )}
  >
    {label}
    <span
      className={cn(
        'tabular-nums',
        active ? 'text-gold-soft/70' : 'text-muted-foreground/75',
      )}
    >
      {count}
    </span>
  </button>
);

interface EmptySlotProps {
  title: string;
  hint: string;
}

/** 空牌位：虚线卡槽 */
const EmptySlot: React.FC<EmptySlotProps> = ({ title, hint }) => (
  <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-foreground/15 bg-card/30 p-8 text-center">
    <div className="mb-3 flex h-16 w-12 items-center justify-center rounded-md border border-foreground/15 bg-muted/50">
      <Layers size={20} className="text-muted-foreground/60" />
    </div>
    <p className="font-serif text-sm font-semibold text-foreground/85">
      {title}
    </p>
    <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
      {hint}
    </p>
  </div>
);

interface HandViewProps {
  hand: RsipHandItem[];
  precedents: RsipPolicy[];
  onEditPolicy: (policy: RsipPolicy) => void;
  onAttach?: (policy: RsipPolicy) => void;
  /** 国策组列表，用于按组筛选 */
  groups?: RsipPolicyGroup[];
  /** 打开国策组管理 */
  onManageGroups?: () => void;
  /** 每条国策累计崩塌次数（≥2 次在卡上标注，提示先绕过去） */
  collapseCountByPolicy?: Map<string, number>;
}

const HandView: React.FC<HandViewProps> = (props) => {
  const {
    hand,
    precedents,
    onEditPolicy,
    onAttach,
    groups,
    onManageGroups,
    collapseCountByPolicy,
  } = props;
  const [filter, setFilter] = useState<string>(FILTER_ALL);

  const groupList: RsipPolicyGroup[] = useMemo<RsipPolicyGroup[]>(
    () => groups ?? [],
    [groups],
  );

  const groupNameById = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    groupList.forEach((group: RsipPolicyGroup) => map.set(group.id, group.name));
    return map;
  }, [groupList]);

  const activeFilter: string =
    filter === FILTER_ALL ||
    filter === FILTER_UNGROUPED ||
    groupNameById.has(filter)
      ? filter
      : FILTER_ALL;

  const ungroupedCount: number = hand.filter(
    (item: RsipHandItem) => item.policy.groupId === null,
  ).length;

  const visibleHand: RsipHandItem[] = hand.filter((item: RsipHandItem) => {
    if (activeFilter === FILTER_ALL) return true;
    if (activeFilter === FILTER_UNGROUPED) return item.policy.groupId === null;
    return item.policy.groupId === activeFilter;
  });

  const showFilterRow: boolean = groups !== undefined;

  const groupNameOf = (policy: RsipPolicy): string | null =>
    policy.groupId ? (groupNameById.get(policy.groupId) ?? null) : null;

  /** 卡片标记：曾上树 / 反复崩塌 */
  const tagOf = (item: RsipHandItem): string | null => {
    const collapses: number = collapseCountByPolicy?.get(item.policy.id) ?? 0;
    const parts: string[] = [];
    if (item.everLit) parts.push('曾上树');
    if (collapses >= 2) parts.push(`崩塌 ${collapses} 次`);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  return (
    <div className="@container flex flex-col gap-6">
      <section aria-label="手牌" className="flex flex-col gap-4">
        {showFilterRow && (
          <div className="flex flex-wrap items-center gap-1.5">
            <GroupFilterChip
              label="全部"
              count={hand.length}
              active={activeFilter === FILTER_ALL}
              onSelect={() => setFilter(FILTER_ALL)}
            />
            <GroupFilterChip
              label="未分组"
              count={ungroupedCount}
              active={activeFilter === FILTER_UNGROUPED}
              onSelect={() => setFilter(FILTER_UNGROUPED)}
            />
            {groupList.map((group: RsipPolicyGroup) => (
              <GroupFilterChip
                key={group.id}
                label={group.name}
                count={
                  hand.filter(
                    (item: RsipHandItem) => item.policy.groupId === group.id,
                  ).length
                }
                active={activeFilter === group.id}
                onSelect={() => setFilter(group.id)}
              />
            ))}
            {onManageGroups && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label="管理分组"
                onClick={onManageGroups}
              >
                <Tags size={15} />
                管理分组
              </Button>
            )}
          </div>
        )}

        {hand.length === 0 ? (
          <EmptySlot
            title="手牌为空"
            hint="未挂树的国策会出现在这里，等待挂到树上。"
          />
        ) : visibleHand.length === 0 ? (
          <EmptySlot
            title="该分组下暂无国策"
            hint="换一个分组，或在国策编辑里调整归属。"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 @[420px]:grid-cols-2 @[680px]:grid-cols-3">
            {visibleHand.map((item: RsipHandItem, index: number) => (
              <PolicyCard
                key={item.policy.id}
                policy={item.policy}
                progress={item.progress}
                groupName={groupNameOf(item.policy)}
                tag={tagOf(item)}
                dealDelay={Math.min(index, 8) * 60}
                actions={
                  <>
                    {onAttach && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`挂到树上 ${item.policy.name}`}
                        title="挂树"
                        onClick={() => onAttach(item.policy)}
                      >
                        <Sprout />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 bg-background/40"
                      aria-label={`编辑国策 ${item.policy.name}`}
                      onClick={() => onEditPolicy(item.policy)}
                    >
                      <Pencil />
                      编辑
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="判例库" className="rsip-panel p-4">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-gold-soft/80" />
          <h2 className="font-serif text-sm font-bold text-foreground">
            判例库
          </h2>
          <span className="rounded-full bg-muted px-2 text-[11px] tabular-nums text-muted-foreground">
            {precedents.length}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          已永久合法化退役的国策，不再参与每日结算，留作判例。
        </p>

        {precedents.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground/75">暂无判例</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 @[420px]:grid-cols-2 @[680px]:grid-cols-3">
            {precedents.map((policy: RsipPolicy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                progress={null}
                retired
                tag="已退役"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HandView;
