/**
 * useShare unit tests
 *
 * shareJobById: 완전한 JobPosting 을 갖지 못한 화면(리스트 카드)에서 id 로 상세를
 * 조회한 뒤 shareJob 과 동일 본문으로 공유하는 경로를 검증한다.
 */

import React from 'react';
import { Share } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShare } from '../useShare';
import { jobPostingRepository } from '@/repositories';
import type { JobPosting } from '@/types';

// jest.setup.js 의 전역 react-query stub 을 실제 구현으로 복원 (useQueryClient/fetchQuery 필요)
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockGetJob = jest.fn<Promise<JobPosting | null>, [string]>();

jest.mock('@/hooks/useJobDetail', () => ({
  getJobDetailQueryOptions: (jobId: string, userId?: string) => ({
    queryKey: ['jobDetail', jobId, userId ?? 'public'],
    queryFn: () => mockGetJob(jobId),
  }),
}));

jest.mock('@/utils/jobShareMessage', () => ({
  buildJobShareText: jest.fn(() => 'SHARE_BODY'),
}));

jest.mock('@/services/observability', () => ({
  createJobDeepLink: jest.fn(() => 'https://uniqn.app/jobs/job-1'),
  trackEvent: jest.fn(),
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};

jest.mock('@/stores/toastStore', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { uid: string } }) => unknown) =>
    selector({ user: { uid: 'user-1' } }),
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useShare.shareJobById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('id 로 전체 공고를 조회한 뒤 실시간 확정수와 함께 공유 본문을 생성해 공유한다', async () => {
    const job = { id: 'job-1', title: '딜러 모집' } as JobPosting;
    mockGetJob.mockResolvedValue(job);
    // 실시간 확정수 맵(posting-prefixed) — buildJobShareText 에는 prefix 제거 submap 이 전달돼야 함
    jest
      .spyOn(jobPostingRepository, 'getPostingFilledCounts')
      .mockResolvedValue(new Map([['job-1__2026-06-06__19:00__dealer', 1]]));
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

    const { result } = renderHook(() => useShare(), { wrapper: makeWrapper() });

    let shareResult: Awaited<ReturnType<typeof result.current.shareJobById>> | undefined;
    await waitFor(async () => {
      shareResult = await result.current.shareJobById('job-1');
    });

    expect(mockGetJob).toHaveBeenCalledWith('job-1');
    expect(jobPostingRepository.getPostingFilledCounts).toHaveBeenCalledWith(['job-1']);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildJobShareText } = require('@/utils/jobShareMessage');
    expect(buildJobShareText).toHaveBeenCalledWith(
      job,
      'https://uniqn.app/jobs/job-1',
      new Map([['2026-06-06__19:00__dealer', 1]])
    );
    expect(shareSpy).toHaveBeenCalledWith(
      { title: '딜러 모집', message: 'SHARE_BODY' },
      { dialogTitle: '공고 공유하기' }
    );
    expect(shareResult).toEqual({ success: true, action: 'shared' });

    shareSpy.mockRestore();
  });

  it('공고를 찾지 못하면 실패를 반환하고 에러 토스트를 띄운다', async () => {
    mockGetJob.mockResolvedValue(null);
    const shareSpy = jest.spyOn(Share, 'share');

    const { result } = renderHook(() => useShare(), { wrapper: makeWrapper() });

    let shareResult: Awaited<ReturnType<typeof result.current.shareJobById>> | undefined;
    await waitFor(async () => {
      shareResult = await result.current.shareJobById('missing-job');
    });

    expect(shareSpy).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalled();
    expect(shareResult?.success).toBe(false);

    shareSpy.mockRestore();
  });
});
