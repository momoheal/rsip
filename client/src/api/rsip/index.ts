import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  RsipDashboard,
  RsipFreezeInput,
  RsipFreezeRecord,
  RsipFreezeReleaseInput,
  RsipFreezeReleaseResult,
  RsipGroupInput,
  RsipAttachInput,
  RsipOnboardingInput,
  RsipOverview,
  RsipPolicy,
  RsipPolicyGroup,
  RsipPolicyGroupAssignInput,
  RsipPolicyInput,
  RsipReviewResult,
  RsipReviewSubmitInput,
  RsipSettingsInput,
  RsipTreeCreateInput,
  RsipTreeUpdateInput,
  RsipUserSettings,
  RsipWinReport,
  RsipWinReportInput,
} from '@shared/api.interface';
import { USE_LOCAL } from '@client/src/store/config';
import { localEngine } from '@client/src/store/localEngine';

export function extractErrorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: { error?: { message?: string } } };
  };
  return err?.response?.data?.error?.message ?? '请求失败，请稍后重试';
}

export async function fetchOverview(): Promise<RsipOverview> {
  if (USE_LOCAL) return localEngine.getOverview();
  const res = await axiosForBackend.get<RsipOverview>('/api/rsip/overview');
  return res.data;
}

export async function submitOnboarding(
  input: RsipOnboardingInput,
): Promise<RsipOverview> {
  if (USE_LOCAL) return localEngine.onboarding(input);
  const res = await axiosForBackend.post<RsipOverview>(
    '/api/rsip/onboarding',
    input,
  );
  return res.data;
}

export async function createPolicy(input: RsipPolicyInput): Promise<RsipPolicy> {
  if (USE_LOCAL) return localEngine.createPolicy(input);
  const res = await axiosForBackend.post<RsipPolicy>(
    '/api/rsip/policies',
    input,
  );
  return res.data;
}

export async function updatePolicy(
  id: string,
  input: RsipPolicyInput,
): Promise<RsipPolicy> {
  if (USE_LOCAL) return localEngine.updatePolicy(id, input);
  const res = await axiosForBackend.patch<RsipPolicy>(
    `/api/rsip/policies/${id}`,
    input,
  );
  return res.data;
}

export async function attachNode(input: RsipAttachInput): Promise<RsipOverview> {
  if (USE_LOCAL) return localEngine.attachNode(input);
  const res = await axiosForBackend.post<RsipOverview>(
    '/api/rsip/tree/attach',
    input,
  );
  return res.data;
}

export async function submitReview(
  input: RsipReviewSubmitInput,
): Promise<RsipReviewResult> {
  if (USE_LOCAL) return localEngine.submitReview(input);
  const res = await axiosForBackend.post<RsipReviewResult>(
    '/api/rsip/review/submit',
    input,
  );
  return res.data;
}

export async function createFreeze(
  input: RsipFreezeInput,
): Promise<RsipFreezeRecord> {
  if (USE_LOCAL) return localEngine.createFreeze(input);
  const res = await axiosForBackend.post<RsipFreezeRecord>(
    '/api/rsip/freeze',
    input,
  );
  return res.data;
}

export async function releaseFreeze(
  id: string,
  input: RsipFreezeReleaseInput,
): Promise<RsipFreezeReleaseResult> {
  if (USE_LOCAL) return localEngine.releaseFreeze(id, input);
  const res = await axiosForBackend.post<RsipFreezeReleaseResult>(
    `/api/rsip/freeze/${id}/release`,
    input,
  );
  return res.data;
}

export async function updateSettings(
  input: RsipSettingsInput,
): Promise<RsipUserSettings> {
  if (USE_LOCAL) return localEngine.updateSettings(input);
  const res = await axiosForBackend.patch<RsipUserSettings>(
    '/api/rsip/settings',
    input,
  );
  return res.data;
}

export async function fetchDashboard(): Promise<RsipDashboard> {
  if (USE_LOCAL) return localEngine.getDashboard();
  const res = await axiosForBackend.get<RsipDashboard>('/api/rsip/dashboard');
  return res.data;
}

export async function createTree(input: RsipTreeCreateInput): Promise<RsipOverview> {
  if (USE_LOCAL) return localEngine.createTree(input);
  const res = await axiosForBackend.post<RsipOverview>(
    '/api/rsip/trees',
    input,
  );
  return res.data;
}

export async function updateTree(
  id: string,
  input: RsipTreeUpdateInput,
): Promise<RsipOverview> {
  if (USE_LOCAL) return localEngine.updateTree(id, input);
  const res = await axiosForBackend.patch<RsipOverview>(
    `/api/rsip/trees/${id}`,
    input,
  );
  return res.data;
}

export async function archiveTree(id: string): Promise<RsipOverview> {
  if (USE_LOCAL) return localEngine.archiveTree(id);
  const res = await axiosForBackend.post<RsipOverview>(
    `/api/rsip/trees/${id}/archive`,
  );
  return res.data;
}

export async function createGroup(input: RsipGroupInput): Promise<RsipPolicyGroup> {
  if (USE_LOCAL) return localEngine.createGroup(input);
  const res = await axiosForBackend.post<RsipPolicyGroup>(
    '/api/rsip/groups',
    input,
  );
  return res.data;
}

export async function updateGroup(
  id: string,
  input: RsipGroupInput,
): Promise<RsipPolicyGroup> {
  if (USE_LOCAL) return localEngine.updateGroup(id, input);
  const res = await axiosForBackend.patch<RsipPolicyGroup>(
    `/api/rsip/groups/${id}`,
    input,
  );
  return res.data;
}

export async function deleteGroup(id: string): Promise<void> {
  if (USE_LOCAL) {
    localEngine.deleteGroup(id);
    return;
  }
  await axiosForBackend.delete(`/api/rsip/groups/${id}`);
}

export async function assignPolicyGroup(
  policyId: string,
  input: RsipPolicyGroupAssignInput,
): Promise<RsipPolicy> {
  if (USE_LOCAL) return localEngine.assignPolicyGroup(policyId, input.groupId);
  const res = await axiosForBackend.patch<RsipPolicy>(
    `/api/rsip/policies/${policyId}/group`,
    input,
  );
  return res.data;
}

export async function createWinReport(
  input: RsipWinReportInput,
): Promise<RsipWinReport> {
  if (USE_LOCAL) return localEngine.createWinReport(input);
  const res = await axiosForBackend.post<RsipWinReport>(
    '/api/rsip/win-reports',
    input,
  );
  return res.data;
}

export async function safeApiCall<T>(
  action: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const data = await action();
    return { ok: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : extractErrorMessage(error);
    logger.error('RSIP 接口调用失败', message);
    return { ok: false, message };
  }
}
