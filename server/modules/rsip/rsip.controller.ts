import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { RsipService } from './rsip.service';
import { RsipReviewService } from './rsip-review.service';
import {
  RsipAttachDto,
  RsipFreezeDto,
  RsipFreezeReleaseDto,
  RsipGroupDto,
  RsipOnboardingDto,
  RsipPolicyDto,
  RsipPolicyGroupAssignDto,
  RsipReviewSubmitDto,
  RsipSettingsDto,
  RsipTreeCreateDto,
  RsipTreeUpdateDto,
  RsipWinReportDto,
} from './rsip.dto';
import { todayShanghai } from './rsip.util';

@NeedLogin()
@Controller('api/rsip')
export class RsipController {
  constructor(
    private readonly rsipService: RsipService,
    private readonly reviewService: RsipReviewService,
  ) {}

  @Get('overview')
  async getOverview() {
    return this.rsipService.getOverview();
  }

  @Post('onboarding')
  async completeOnboarding(@Body() dto: RsipOnboardingDto) {
    return this.rsipService.completeOnboarding(dto);
  }

  @Post('policies')
  async createPolicy(@Body() dto: RsipPolicyDto) {
    return this.rsipService.createPolicy(dto);
  }

  @Patch('policies/:id')
  async updatePolicy(@Param('id') id: string, @Body() dto: RsipPolicyDto) {
    return this.rsipService.updatePolicy(id, dto);
  }

  @Patch('policies/:id/group')
  async assignPolicyGroup(
    @Param('id') id: string,
    @Body() dto: RsipPolicyGroupAssignDto,
  ) {
    return this.rsipService.assignPolicyGroup(id, dto);
  }

  @Post('trees')
  async createTree(@Body() dto: RsipTreeCreateDto) {
    return this.rsipService.createTree(dto);
  }

  @Patch('trees/:id')
  async updateTree(@Param('id') id: string, @Body() dto: RsipTreeUpdateDto) {
    return this.rsipService.updateTree(id, dto);
  }

  @Post('trees/:id/archive')
  async archiveTree(@Param('id') id: string) {
    return this.rsipService.archiveTree(id);
  }

  @Post('groups')
  async createGroup(@Body() dto: RsipGroupDto) {
    return this.rsipService.createGroup(dto);
  }

  @Patch('groups/:id')
  async updateGroup(@Param('id') id: string, @Body() dto: RsipGroupDto) {
    return this.rsipService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string): Promise<void> {
    await this.rsipService.deleteGroup(id);
  }

  @Post('win-reports')
  async createWinReport(@Body() dto: RsipWinReportDto) {
    return this.rsipService.createWinReport(dto);
  }

  @Get('dashboard')
  async getDashboard() {
    return this.rsipService.getDashboard();
  }

  @Post('tree/attach')
  async attachNode(@Body() dto: RsipAttachDto) {
    return this.rsipService.attachNode(dto);
  }

  @Post('review/submit')
  async submitReview(@Body() dto: RsipReviewSubmitDto) {
    return this.reviewService.submitReview(dto, todayShanghai());
  }

  @Post('freeze')
  async createFreeze(@Body() dto: RsipFreezeDto) {
    return this.rsipService.createFreeze(dto);
  }

  @Post('freeze/:id/release')
  async releaseFreeze(
    @Param('id') id: string,
    @Body() dto: RsipFreezeReleaseDto,
  ) {
    return this.reviewService.releaseFreeze(id, dto, todayShanghai());
  }

  @Patch('settings')
  async updateSettings(@Body() dto: RsipSettingsDto) {
    return this.rsipService.updateSettings(dto);
  }
}
