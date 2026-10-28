import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  RsipFreezeInput,
  RsipFreezeReleaseInput,
  RsipGroupInput,
  RsipOnboardingInput,
  RsipPolicyGroupAssignInput,
  RsipPolicyInput,
  RsipReviewSubmitInput,
  RsipSettingsInput,
  RsipTreeCreateInput,
  RsipTreeUpdateInput,
  RsipVerdict,
  RsipWinReportInput,
} from '@shared/api.interface';

export class RsipPolicyDto implements RsipPolicyInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsString()
  @IsIn(['passive', 'semi_passive', 'active'])
  type!: 'passive' | 'semi_passive' | 'active';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  trigger?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  judge!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  templateId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  iconKey?: string | null;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;
}

export class RsipOnboardingDto implements RsipOnboardingInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  bigGoal!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RsipPolicyDto)
  candidates!: RsipPolicyDto[];

  @IsInt()
  rootIndex!: number;

  @IsBoolean()
  ackWorstDay!: boolean;
}

export class RsipAttachDto {
  @IsUUID()
  policyId!: string;

  @IsOptional()
  @IsUUID()
  parentNodeId!: string | null;

  @IsOptional()
  @IsUUID()
  treeId?: string | null;
}

export class RsipVerdictItemDto {
  @IsUUID()
  nodeId!: string;

  @IsString()
  @IsIn(['satisfied', 'violated', 'legalized'])
  verdict!: RsipVerdict;
}

export class RsipReviewSubmitDto implements RsipReviewSubmitInput {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RsipVerdictItemDto)
  verdicts!: RsipVerdictItemDto[];

  @IsBoolean()
  late!: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class RsipFreezeDto implements RsipFreezeInput {
  @IsBoolean()
  scopeWholeTree!: boolean;

  @IsOptional()
  @IsUUID()
  treeId?: string | null;

  @IsArray()
  @IsUUID('4', { each: true })
  scopeNodeIds!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;
}

export class RsipFreezeReleaseVerdictDto {
  @IsUUID()
  nodeId!: string;

  @IsString()
  @IsIn(['satisfied', 'violated'])
  verdict!: 'satisfied' | 'violated';
}

export class RsipFreezeReleaseDto implements RsipFreezeReleaseInput {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RsipFreezeReleaseVerdictDto)
  verdicts!: RsipFreezeReleaseVerdictDto[];
}

export class RsipSettingsDto implements RsipSettingsInput {
  @IsString()
  reviewWindowStart!: string;

  @IsString()
  reviewWindowEnd!: string;
}

/** 建树：一棵树一个根，根国策从手牌中选 */
export class RsipTreeCreateDto implements RsipTreeCreateInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  goal?: string | null;

  @IsUUID()
  rootPolicyId!: string;
}

/** 树重命名 / 修改大目标（goal 显式 null 表示清空） */
export class RsipTreeUpdateDto implements RsipTreeUpdateInput {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  goal?: string | null;
}

/** 国策组：跨树分类标签，不影响任何判定逻辑 */
export class RsipGroupDto implements RsipGroupInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}

/** 给国策指定/移出国策组（groupId 为 null 表示移出分组） */
export class RsipPolicyGroupAssignDto implements RsipPolicyGroupAssignInput {
  @IsOptional()
  @IsUUID()
  groupId!: string | null;
}

/** 手动发布喜报 */
export class RsipWinReportDto implements RsipWinReportInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
