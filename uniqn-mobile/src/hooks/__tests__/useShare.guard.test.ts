/**
 * useShare 공유 게이트(canShareJob) 테스트
 *
 * runJobShare 진입부의 단일 게이트가 죽은 링크(승인 대기 대회·마감/취소 공고) 공유를
 * 7개 진입점 전체에서 차단하는지 검증한다.
 *
 * 핵심 계약: 공유 불가 상태면 (a) success=false 를 반환하고
 * (b) 네이티브 공유 시트(Share.share)를 절대 열지 않는다 — 반환값만 확인하는 약한 검증이
 * 아니라, 시트가 닫힌 채로 유지되는 실제 동작을 함께 단언한다.
 */

import React from 'react';
import { Share } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShare } from '../useShare';
import { jobPostingRepository } from '@/repositories';
import type { JobPosting } from '@/types';

// jest.setup.js 의 전역 react-query stub 을 실제 구현으로 복원 (useQueryClient/Provider 필요)
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/hooks/useJobDetail', () => ({
  getJobDetailQueryOptions: (jobId: string, userId?: string) => ({
    queryKey: ['jobDetail', jobId, userId ?? 'public'],
    queryFn: () => Promise.resolve(null),
  }),
}));

jest.mock('@/utils/jobShareMessage', () => ({
  buildJobShareText: jest.fn(() => 'SHARE_BODY'),
}));

jest.mock('@/services/observability', () => ({
  createJobDeepLink: jest.fn(() => 'https://uniqn.app/jobs/jp1'),
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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    // .ts 파일이라 JSX 대신 createElement 로 Provider 를 감싼다.
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// 승인 대기 대회 — status 는 active 여도 tournamentConfig.approvalStatus='pending' → 죽은 링크.
const pendingTournament = {
  id: 'jp1',
  title: '대회 딜러',
  status: 'active',
  postingType: 'tournament',
  tournamentConfig: { approvalStatus: 'pending' },
} as unknown as JobPosting;

// 마감(closed) 일반 공고 — 브라우징 불가 상태.
const closedRegular = {
  id: 'jp2',
  title: '마감 공고',
  status: 'closed',
  postingType: 'regular',
} as unknown as JobPosting;

describe('useShare 공유 게이트 (canShareJob)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('승인 대기 대회는 공유 시트를 열지 않고 success=false 를 반환한다', async () => {
    // 가드가 없다면 아래 두 경로가 실행돼 최종적으로 success=true 가 됨 → 가드 존재를 증명한다.
    const countSpy = jest
      .spyOn(jobPostingRepository, 'getPostingFilledCounts')
      .mockResolvedValue(new Map());
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

    const { result } = renderHook(() => useShare(), { wrapper: makeWrapper() });

    let shareResult: Awaited<ReturnType<typeof result.current.shareJob>> | undefined;
    await waitFor(async () => {
      shareResult = await result.current.shareJob(pendingTournament);
    });

    // (a) 반환값 계약: 공유 실패
    expect(shareResult?.success).toBe(false);
    // (b) 실제 동작: 네이티브 공유 시트가 열리지 않음 (죽은 링크 유출 차단)
    expect(shareSpy).not.toHaveBeenCalled();
    // 게이트 이전 단계(확정 인원 조회)에도 도달하지 않음
    expect(countSpy).not.toHaveBeenCalled();
    // 사용자 안내 토스트 노출
    expect(mockToast.error).toHaveBeenCalled();

    shareSpy.mockRestore();
    countSpy.mockRestore();
  });

  it('마감된 공고도 공유 시트를 열지 않고 success=false 를 반환한다', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

    const { result } = renderHook(() => useShare(), { wrapper: makeWrapper() });

    let shareResult: Awaited<ReturnType<typeof result.current.shareJob>> | undefined;
    await waitFor(async () => {
      shareResult = await result.current.shareJob(closedRegular);
    });

    expect(shareResult?.success).toBe(false);
    expect(shareSpy).not.toHaveBeenCalled();

    shareSpy.mockRestore();
  });
});
