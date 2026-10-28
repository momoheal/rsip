import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  CircleAlert,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Textarea } from '@client/src/components/ui/textarea';
import PolicyTypeBadge from '@client/src/components/rsip/PolicyTypeBadge';
import { PolicyIcon } from '@client/src/components/rsip/PolicyIcon';
import { RSIP_TEMPLATES, suggestTemplateIds } from '@client/src/api/rsip/templates';
import type { RsipTemplate } from '@client/src/api/rsip/templates';
import { extractErrorMessage, submitOnboarding } from '@client/src/api/rsip';
import type {
  RsipLeverageSource,
  RsipOnboardingInput,
  RsipPolicyInput,
  RsipUserPolicyType,
} from '@shared/api.interface';
import { cn } from '@/lib/utils';
import MedicalDisclaimer from './MedicalDisclaimer';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

interface CandidateDraft {
  key: string;
  name: string;
  type: RsipUserPolicyType;
  trigger: string;
  judge: string;
  templateId: string | null;
  leverage: RsipLeverageSource;
}

interface CandidateErrors {
  name?: string;
  trigger?: string;
  judge?: string;
  leverage?: string;
}

const STEPS: { id: string; label: string; title: string; hint: string }[] = [
  {
    id: 'state',
    label: '描述负面稳态',
    title: '你最近困在哪个反复出现的状态里？',
    hint: '先说清它通常从什么动作开始、怎么结束。',
  },
  {
    id: 'backtrace',
    label: '回溯定位',
    title: '沿时间轴回溯，找到「你还能选」的最早节点',
    hint: '在不可逃逸区内部硬扛没用，要找到边界上的有效干预节点。',
  },
  {
    id: 'candidates',
    label: '设计国策',
    title: '在这个节点设计小国策候选',
    hint: '每条都要能在一天内回答「是 / 否」，并说明它借的是什么能量。',
  },
  {
    id: 'root',
    label: '选根国策',
    title: '只能选 1 条做根',
    hint: '根国策决定整棵树的起点，选最不容易失败的一条。',
  },
];

const TYPE_OPTIONS: { value: RsipUserPolicyType; label: string }[] = [
  { value: 'passive', label: '被动型' },
  { value: 'semi_passive', label: '半被动型' },
  { value: 'active', label: '主动型' },
];

const LEVERAGE_OPTIONS: { value: RsipLeverageSource; label: string }[] = [
  { value: 'causal_chain', label: '因果链' },
  { value: 'behavior_inertia', label: '行为惯性' },
  { value: 'environment', label: '环境' },
  { value: 'physical_posture', label: '物理姿势' },
  { value: 'physiological', label: '生理本能' },
  { value: 'math_structure', label: '数学结构' },
];

const JUDGE_PREFIXES: string[] = ['是否', '有没有'];

function isUserPolicyType(
  value: RsipTemplate['type'],
): value is RsipUserPolicyType {
  return value === 'passive' || value === 'semi_passive' || value === 'active';
}

function validateCandidate(candidate: CandidateDraft): CandidateErrors {
  const errors: CandidateErrors = {};
  const name: string = candidate.name.trim();
  if (!name) {
    errors.name = '请填写国策名称';
  } else if (name.length > 50) {
    errors.name = '名称不超过 50 字';
  }

  if (candidate.type === 'semi_passive' && !candidate.trigger.trim()) {
    errors.trigger = '半被动型必须填写触发条件';
  }

  const judge: string = candidate.judge.trim();
  if (!judge) {
    errors.judge = '请填写判定标准';
  } else if (!JUDGE_PREFIXES.some((prefix: string) => judge.startsWith(prefix))) {
    errors.judge = '判定标准需以「是否」或「有没有」开头';
  }

  if (!candidate.leverage) errors.leverage = '请选择杠杆来源';

  return errors;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  open,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [negativeState, setNegativeState] = useState<string>('');
  const [backtraceChain, setBacktraceChain] = useState<string[]>([]);
  const [backtraceInput, setBacktraceInput] = useState<string>('');
  const [effectiveNode, setEffectiveNode] = useState<string>('');
  const [candidates, setCandidates] = useState<CandidateDraft[]>([]);
  const [rootIndex, setRootIndex] = useState<number>(-1);
  const [ack, setAck] = useState<boolean>(false);
  const [showErrors, setShowErrors] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<RsipUserPolicyType>('passive');
  const [newTrigger, setNewTrigger] = useState<string>('');
  const [newJudge, setNewJudge] = useState<string>('');
  const [newLeverage, setNewLeverage] = useState<RsipLeverageSource>('causal_chain');

  const keySeed = useRef<number>(0);

  const currentStep = STEPS[step - 1];

  // 回溯链按"从稳态起点到更早节点"的顺序展示；最新输入的更早节点排在最后
  const chainForDisplay = useMemo(() => backtraceChain, [backtraceChain]);

  const suggestedTemplates = useMemo<RsipTemplate[]>(() => {
    const ids: string[] = suggestTemplateIds(negativeState);
    const list: RsipTemplate[] = [];
    for (const id of ids) {
      const found = RSIP_TEMPLATES.find((item: RsipTemplate) => item.id === id);
      if (found && isUserPolicyType(found.type)) list.push(found);
    }
    return list;
  }, [negativeState]);

  const errorsByKey = useMemo<Record<string, CandidateErrors>>(() => {
    const map: Record<string, CandidateErrors> = {};
    for (const candidate of candidates) {
      map[candidate.key] = validateCandidate(candidate);
    }
    return map;
  }, [candidates]);

  const hasCandidateError: boolean = candidates.some(
    (candidate: CandidateDraft) =>
      Object.keys(errorsByKey[candidate.key] ?? {}).length > 0,
  );

  const nextKey = (): string => {
    keySeed.current += 1;
    return `candidate-${keySeed.current}`;
  };

  const patchCandidate = (
    key: string,
    patch: Partial<CandidateDraft>,
  ): void => {
    setCandidates((prev: CandidateDraft[]) =>
      prev.map((item: CandidateDraft) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleAddBacktrace = (): void => {
    const value = backtraceInput.trim();
    if (!value) return;
    setBacktraceChain((prev) => [...prev, value]);
    setBacktraceInput('');
    // 默认把最新（最早）节点作为有效干预节点
    setEffectiveNode(value);
  };

  const handleRemoveBacktrace = (index: number): void => {
    const removed = backtraceChain[index];
    setBacktraceChain((prev) => prev.filter((_, i) => i !== index));
    if (effectiveNode === removed) {
      const next = backtraceChain[index - 1] ?? '';
      setEffectiveNode(next);
    }
  };

  const handleAddFromTemplate = (template: RsipTemplate): void => {
    if (!isUserPolicyType(template.type)) return;
    // 模板默认杠杆：按模板 id 推断
    const leverageByTemplate: Record<string, RsipLeverageSource> = {
      'sleep-consistent': 'behavior_inertia',
      'before-bed-phone': 'environment',
      'wake-no-phone': 'behavior_inertia',
      'daily-walk': 'causal_chain',
      'water-morning': 'physiological',
      'clothes-basket': 'causal_chain',
      'desk-clean': 'causal_chain',
      'no-sugar-drink': 'physical_posture',
    };
    const added: CandidateDraft = {
      key: nextKey(),
      name: template.name,
      type: template.type,
      trigger: template.trigger ?? '',
      judge: template.judge,
      templateId: template.id,
      leverage: leverageByTemplate[template.id] ?? 'causal_chain',
    };
    setCandidates((prev: CandidateDraft[]) => [...prev, added]);
  };

  const handleAddManual = (): void => {
    if (!newName.trim()) return;
    setCandidates((prev: CandidateDraft[]) => [
      ...prev,
      {
        key: nextKey(),
        name: newName.trim(),
        type: newType,
        trigger: newTrigger,
        judge: newJudge,
        templateId: null,
        leverage: newLeverage,
      },
    ]);
    setNewName('');
    setNewTrigger('');
    setNewJudge('');
    setNewType('passive');
    setNewLeverage('causal_chain');
  };

  const handleRemoveCandidate = (key: string): void => {
    const removedIndex: number = candidates.findIndex(
      (item: CandidateDraft) => item.key === key,
    );
    setCandidates((prev: CandidateDraft[]) =>
      prev.filter((item: CandidateDraft) => item.key !== key),
    );
    if (removedIndex < 0) return;
    setRootIndex((prev: number) => {
      if (prev === removedIndex) return -1;
      if (prev > removedIndex) return prev - 1;
      return prev;
    });
  };

  const handleNext = (): void => {
    if (step === 1) {
      if (!negativeState.trim()) {
        setShowErrors(true);
        return;
      }
      setShowErrors(false);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (backtraceChain.length < 1 || !effectiveNode) {
        setShowErrors(true);
        return;
      }
      setShowErrors(false);
      setStep(3);
      return;
    }
    if (step === 3) {
      setShowErrors(true);
      if (candidates.length < 3 || hasCandidateError) return;
      const picked = candidates[rootIndex];
      if (!picked || picked.type === 'active') setRootIndex(-1);
      setShowErrors(false);
      setStep(4);
    }
  };

  const handleBack = (): void => {
    setShowErrors(false);
    setStep((prev: number) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (): Promise<void> => {
    if (submitting || !ack || rootIndex < 0) return;
    const root = candidates[rootIndex];
    if (!root || root.type === 'active') return;

    setSubmitting(true);
    const payload: RsipOnboardingInput = {
      bigGoal: negativeState.trim().slice(0, 100),
      candidates: candidates.map((candidate: CandidateDraft): RsipPolicyInput => ({
        name: candidate.name.trim(),
        type: candidate.type,
        trigger:
          candidate.type === 'semi_passive'
            ? candidate.trigger.trim()
            : null,
        judge: candidate.judge.trim(),
        templateId: candidate.templateId,
        leverage: candidate.leverage,
        // 相关性：候选是否针对有效干预节点（同节点即相关）
        relevant: true,
      })),
      rootIndex,
      ackWorstDay: true,
      negativeStableState: negativeState.trim(),
      backtraceChain,
      effectiveInterventionNode: effectiveNode,
    };

    try {
      await submitOnboarding(payload);
      toast.success('诊断完成，第一条根国策已挂上');
      onComplete();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const rootCandidate = rootIndex >= 0 ? candidates[rootIndex] : undefined;
  const canSubmit: boolean = Boolean(
    rootCandidate && rootCandidate.type !== 'active' && ack && !submitting,
  );

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[90vh] w-full max-w-2xl gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="gap-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-base font-semibold text-foreground">
            {currentStep.title}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {currentStep.hint}
          </DialogDescription>

          <ol
            className="mt-2 flex flex-wrap items-center gap-2"
            aria-label="引导步骤"
          >
            {STEPS.map((item, index: number) => {
              const isCurrent: boolean = index + 1 === step;
              const isDone: boolean = index + 1 < step;
              return (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
                      isCurrent
                        ? 'bg-foreground text-background'
                        : isDone
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-foreground/10 text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      isCurrent
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <ChevronRight
                      size={13}
                      aria-hidden="true"
                      className="text-muted-foreground/45"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
          {/* Step 1：世界观 + 负面稳态 */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/85">
                  <Waypoints size={14} className="text-amber-500" />
                  为什么靠意志力硬撑没用？
                </p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/70">
                  人对未来价值是「双曲贴现」的，远期奖励/惩罚几乎没有分量；而生活是一层层
                  「不可逃逸区」——在负面稳态内部，选项概率是 99:1，自由意志统计上无效。
                  我们要做的，是找到稳态边界上那个你还能干预的节点。
                </p>
              </div>

              <div>
                <Label
                  htmlFor="rsip-negative-state"
                  className="text-sm text-foreground/85"
                >
                  描述这个负面稳态：从什么动作开始、怎么结束？
                </Label>
                <Textarea
                  id="rsip-negative-state"
                  value={negativeState}
                  maxLength={300}
                  onChange={(event) => setNegativeState(event.target.value)}
                  placeholder="例如：晚饭后一躺到沙发上，就开始刷手机，越刷越停不下来，等反应过来已经凌晨两点，第二天又起不来"
                  className="mt-1.5 min-h-24 text-sm"
                />
                {showErrors && !negativeState.trim() && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-foreground/70">
                    <CircleAlert
                      size={12}
                      aria-hidden="true"
                      className="text-muted-foreground/75"
                    />
                    请先描述这个状态
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <ShieldAlert
                  size={14}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-muted-foreground/75"
                />
                <p className="text-xs leading-relaxed text-foreground/70">
                  本应用是行为管理工具，不构成医疗建议；若存在严重情绪或注意力问题，请及时就医
                </p>
              </div>
            </div>
          )}

          {/* Step 2：回溯定位 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-medium text-foreground/85">
                  一步步向前回溯
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  问自己：「要避免『现在这个动作』，是不是要先避免更早的某个动作？」
                  把更早的节点逐个加进来。
                </p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={backtraceInput}
                    maxLength={60}
                    onChange={(event) => setBacktraceInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddBacktrace();
                      }
                    }}
                    placeholder={
                      chainForDisplay.length === 0
                        ? '例如：要避免「躺沙发刷手机」，先要避免「拿着手机上沙发」'
                        : '例如：要避免「拿着手机上沙发」，先要避免「进家门后无所事事」'
                    }
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!backtraceInput.trim()}
                    onClick={handleAddBacktrace}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground/85">
                  回溯链（从稳态起点 → 更早节点）
                </p>
                <ol className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px]">起点</span>
                    {negativeState.trim().slice(0, 40)}
                    {negativeState.trim().length > 40 ? '…' : ''}
                  </li>
                  {chainForDisplay.map((node, index) => {
                    const isEffective = effectiveNode === node;
                    return (
                      <li
                        key={`${node}-${index}`}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                          isEffective
                            ? 'border-amber-400 bg-amber-400/10 text-foreground'
                            : 'border-border bg-card text-foreground/85',
                        )}
                      >
                        <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px]">
                          {index + 1}
                        </span>
                        <span className="flex-1">{node}</span>
                        {isEffective && (
                          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                            有效干预节点
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`删除回溯节点 ${node}`}
                          onClick={() => handleRemoveBacktrace(index)}
                          className="text-muted-foreground/75 hover:text-foreground/70"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {chainForDisplay.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-medium text-foreground/85">
                    哪个是「你还能选」的最早节点？
                  </p>
                  <RadioGroup
                    value={effectiveNode}
                    onValueChange={(value) => setEffectiveNode(value)}
                    className="mt-2 gap-1.5"
                  >
                    {chainForDisplay.map((node, index) => (
                      <div key={`pick-${node}-${index}`} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={node}
                          id={`eff-${index}`}
                          aria-label={`选择「${node}」为有效干预节点`}
                        />
                        <Label htmlFor={`eff-${index}`} className="text-xs text-foreground/85">
                          {node}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {showErrors && (chainForDisplay.length === 0 || !effectiveNode) && (
                <p className="flex items-center gap-1 text-xs text-foreground/70">
                  <CircleAlert size={12} className="text-muted-foreground/75" />
                  请至少回溯一个节点，并选择有效干预节点
                </p>
              )}
            </div>
          )}

          {/* Step 3：设计国策候选 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                国策要挂在有效干预节点「{effectiveNode}」上。优先设计被动/半被动型，
                主动型要少做。
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles size={13} className="text-amber-500" />
                  推荐模板，可一键加入后再修改
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTemplates.map((template: RsipTemplate) => {
                    const added = candidates.some(
                      (item) => item.templateId === template.id,
                    );
                    return (
                      <Button
                        key={template.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={added}
                        onClick={() => handleAddFromTemplate(template)}
                        className="h-auto items-start gap-1.5 whitespace-normal py-1.5 text-left text-xs leading-relaxed"
                      >
                        <Plus size={12} />
                        <span>{template.name}{added ? '（已加入）' : ''}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-medium text-foreground/85">自建候选</p>
                <div className="mt-2 space-y-2">
                  <div>
                    <Label htmlFor="new-name" className="text-xs text-muted-foreground">
                      名称
                    </Label>
                    <Input
                      id="new-name"
                      value={newName}
                      maxLength={50}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="例如：进门后 15 分钟内把换洗衣物放进浴室"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="new-type" className="text-xs text-muted-foreground">
                        类型
                      </Label>
                      <Select value={newType} onValueChange={(v) => setNewType(v as RsipUserPolicyType)}>
                        <SelectTrigger id="new-type" className="mt-1 w-full text-sm">
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="new-leverage" className="text-xs text-muted-foreground">
                        杠杆来源
                      </Label>
                      <Select value={newLeverage} onValueChange={(v) => setNewLeverage(v as RsipLeverageSource)}>
                        <SelectTrigger id="new-leverage" className="mt-1 w-full text-sm">
                          <SelectValue placeholder="选择杠杆" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVERAGE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {newType === 'semi_passive' && (
                    <div>
                      <Label htmlFor="new-trigger" className="text-xs text-muted-foreground">
                        触发条件（必填）
                      </Label>
                      <Input
                        id="new-trigger"
                        value={newTrigger}
                        onChange={(e) => setNewTrigger(e.target.value)}
                        placeholder="例如：进家门"
                        className="mt-1 text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="new-judge" className="text-xs text-muted-foreground">
                      判定标准（以「是否」或「有没有」开头）
                    </Label>
                    <Input
                      id="new-judge"
                      value={newJudge}
                      onChange={(e) => setNewJudge(e.target.value)}
                      placeholder="例如：是否进家门后 15 分钟内把换洗衣物放进了浴室？"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!newName.trim()}
                    onClick={handleAddManual}
                  >
                    <Plus size={13} />
                    加入候选
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground/85">候选列表</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {candidates.length} 条 · 至少 3 条
                  </p>
                </div>
                {candidates.length === 0 && (
                  <div className="rounded-lg border border-dashed border-foreground/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    还没有候选，从推荐模板或自建加入。
                  </div>
                )}
                <div className="space-y-2">
                  {candidates.map((candidate, index) => {
                    const errors = errorsByKey[candidate.key] ?? {};
                    return (
                      <div
                        key={candidate.key}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-start gap-2">
                          <PolicyIcon
                            templateId={candidate.templateId}
                            size={32}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground">
                                {candidate.name || '未命名候选'}
                              </span>
                              <PolicyTypeBadge type={candidate.type} />
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {LEVERAGE_OPTIONS.find((o) => o.value === candidate.leverage)?.label}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{candidate.judge}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`删除候选 ${candidate.name || index + 1}`}
                            onClick={() => handleRemoveCandidate(candidate.key)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                        {showErrors && Object.keys(errors).length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {Object.values(errors).map((msg) => (
                              <p key={msg} className="flex items-center gap-1 text-xs text-foreground/70">
                                <CircleAlert size={12} className="text-muted-foreground/75" />
                                {msg}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 4：选根 + 确认 */}
          {step === 4 && (
            <div className="space-y-4">
              <RadioGroup
                value={rootIndex >= 0 ? String(rootIndex) : ''}
                onValueChange={(v) => setRootIndex(Number(v))}
                className="gap-2"
                aria-label="选择根国策"
              >
                {candidates.map((candidate, index) => {
                  const disabled = candidate.type === 'active';
                  return (
                    <div
                      key={candidate.key}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg border bg-card p-3',
                        rootIndex === index ? 'border-amber-400' : 'border-border',
                        disabled && 'bg-muted/50',
                      )}
                    >
                      <RadioGroupItem
                        value={String(index)}
                        id={`root-${candidate.key}`}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <PolicyIcon templateId={candidate.templateId} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label
                            htmlFor={`root-${candidate.key}`}
                            className={cn(
                              'text-sm font-medium',
                              disabled ? 'text-muted-foreground/75' : 'text-foreground',
                            )}
                          >
                            {candidate.name || '未命名候选'}
                          </label>
                          <PolicyTypeBadge type={candidate.type} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{candidate.judge}</p>
                        {disabled && (
                          <p className="mt-1 text-xs text-foreground/70">根国策不能是主动型</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
                <Checkbox
                  id="ack-worst"
                  checked={ack}
                  onCheckedChange={(v) => setAck(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="ack-worst" className="text-sm leading-relaxed text-foreground/85">
                  我承认这条国策在我最摆烂的一天也能做到
                </Label>
              </div>

              {!rootCandidate && (
                <p className="text-xs text-muted-foreground">先在上面选一条候选，才能作为根国策。</p>
              )}

              <MedicalDisclaimer />
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 1 || submitting}
            onClick={handleBack}
          >
            上一步
          </Button>
          <div className="flex items-center justify-end gap-2">
            {step < 4 ? (
              <Button type="button" size="sm" onClick={handleNext}>
                下一步
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitting ? '提交中…' : '挂上第一条根国策'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWizard;
