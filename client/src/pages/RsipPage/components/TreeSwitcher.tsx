import React from 'react';
import {
  Archive,
  Crown,
  MoreHorizontal,
  Pencil,
  Plus,
  TreePine,
} from 'lucide-react';
import type { RsipTree } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { cn } from '@client/src/lib/utils';

interface TreeSwitcherProps {
  trees: RsipTree[];
  selectedTreeId: string | null;
  onSelect: (treeId: string) => void;
  onCreateTree: () => void;
  onEditTree: (tree: RsipTree) => void;
  onArchiveTree: (tree: RsipTree) => void;
}

/** 多棵树切换：像牌组标签一样排列，选中的一组带金色描边 */
const TreeSwitcher: React.FC<TreeSwitcherProps> = ({
  trees,
  selectedTreeId,
  onSelect,
  onCreateTree,
  onEditTree,
  onArchiveTree,
}) => {
  const selectedTree: RsipTree | undefined = trees.find(
    (tree: RsipTree) => tree.id === selectedTreeId,
  );

  return (
    <div className="flex flex-col gap-2" aria-label="国策树切换">
      <div className="flex flex-wrap items-center gap-2">
        {trees.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {trees.map((tree: RsipTree) => {
              const selected: boolean = tree.id === selectedTreeId;
              return (
                <div
                  key={tree.id}
                  className={cn(
                    'flex shrink-0 items-center rounded-lg border transition-all',
                    selected
                      ? 'border-gold/60 bg-gradient-to-b from-gold/20 to-gold/5 shadow-[0_0_16px_-6px_var(--gold)]'
                      : 'border-border bg-card/60 hover:border-foreground/25',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(tree.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-center gap-2 rounded-l-lg py-1.5 pr-1 pl-3 text-sm transition-colors',
                      selected
                        ? 'text-gold-soft'
                        : 'text-foreground/70 hover:text-foreground',
                    )}
                  >
                    {tree.tier === 'elite' ? (
                      <Crown size={14} className="shrink-0" />
                    ) : (
                      <TreePine size={14} className="shrink-0" />
                    )}
                    <span className="max-w-40 truncate font-serif font-semibold">
                      {tree.name}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 font-display text-[11px] tabular-nums',
                        selected
                          ? 'bg-gold/20 text-gold-soft'
                          : 'bg-muted text-muted-foreground',
                      )}
                      title={`${tree.nodeCount} 张国策在场`}
                    >
                      {tree.nodeCount}
                    </span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`设置树 ${tree.name}`}
                        className={cn(
                          'min-h-0 px-1.5 py-0',
                          selected
                            ? 'text-gold-soft/70 hover:text-gold-soft'
                            : 'text-muted-foreground/75',
                        )}
                      >
                        <MoreHorizontal size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        aria-label={`编辑树 ${tree.name}`}
                        onSelect={() => onEditTree(tree)}
                      >
                        <Pencil size={14} />
                        重命名 / 改目标
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        aria-label={`归档树 ${tree.name}`}
                        onSelect={() => onArchiveTree(tree)}
                      >
                        <Archive size={14} />
                        归档这棵树
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        <Button
          variant={trees.length > 0 ? 'outline' : 'default'}
          size="sm"
          aria-label="新建国策树"
          onClick={onCreateTree}
          className={cn(
            trees.length > 0 ? 'ml-auto shrink-0 bg-card/60' : 'w-full',
          )}
        >
          <Plus size={15} />
          建树
        </Button>
      </div>

      {selectedTree?.goal && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <span className="text-gold-soft/80">大目标</span>
          <span className="truncate text-foreground/80">
            {selectedTree.goal}
          </span>
        </p>
      )}
    </div>
  );
};

export default TreeSwitcher;
