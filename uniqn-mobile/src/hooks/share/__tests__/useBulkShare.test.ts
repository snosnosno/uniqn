/**
 * useBulkShare 계약 테스트
 *
 * 핵심 계약 3가지:
 * (a) 선택한 공고가 전부 공유 불가면 **공유 시트를 열지 않는다** — 반환값만이 아니라
 *     Share.share 미호출을 함께 단언한다(단일 공유 가드 테스트와 같은 강도).
 * (b) 일부만 공유 불가면 확인을 거쳐 나머지만 내보낸다. 확인을 취소하면 시트가 열리지 않는다.
 * (c) 조회는 배치 2회 고정 — 공고 수에 비례해 왕복이 늘어나지 않는다.
 */

import { Share } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useBulkShare } from '../useBulkShare';
import { jobPostingRepository } from '@/repositories';
import { buildBulkJobShareText } from '@/utils/bulkJobShareMessage';
import { confirmActionAsync } from '@/utils/confirmAction';
import type { JobPosting } from '@/types';

jest.mock('@/services/observability', () => ({
  createDeepLink: () => 'https://uniqn.app/jobs',
  trackEvent: jest.fn(),
}));

jest.mock('@/utils/bulkJobShareMessage', () => ({
  ...jest.requireActual('@/utils/bulkJobShareMessage'),
  buildBulkJobShareText: jest.fn(() => 'BULK_SHARE_BODY'),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmActionAsync: jest.fn(),
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

const mockConfirm = confirmActionAsync as jest.MockedFunction<typeof confirmActionAsync>;
const mockBuildText = buildBulkJobShareText as jest.MockedFunction<typeof buildBulkJobShareText>;

const posting = (id: string, overrides: Partial<JobPosting> = {}): JobPosting =>
  ({
    id,
    title: `공고 ${id}`,
    status: 'active',
    postingType: 'regular',
    ...overrides,
  }) as unknown as JobPosting;

const closed = (id: string) => posting(id, { status: 'closed' });
const pendingTournament = (id: string) =>
  posting(id, {
    postingType: 'tournament',
    tournamentConfig: { approvalStatus: 'pending' },
  } as Partial<JobPosting>);

describe('useBulkShare', () => {
  let shareSpy: jest.SpyInstance;
  let batchSpy: jest.SpyInstance;
  let countSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    batchSpy = jest.spyOn(jobPostingRepository, 'getByIdBatch').mockResolvedValue([]);
    countSpy = jest
      .spyOn(jobPostingRepository, 'getPostingFilledCounts')
      .mockResolvedValue(new Map());
  });

  afterEach(() => {
    shareSpy.mockRestore();
    batchSpy.mockRestore();
    countSpy.mockRestore();
  });

  async function share(ids: string[]) {
    const { result } = renderHook(() => useBulkShare());
    let out: Awaited<ReturnType<typeof result.current.shareJobs>> | undefined;
    await waitFor(async () => {
      out = await result.current.shareJobs(ids, 'employer');
    });
    return out!;
  }

  it('공유 가능한 공고만 있으면 시트를 한 번 열고 전건을 담는다', async () => {
    batchSpy.mockResolvedValue([posting('a'), posting('b'), posting('c')]);

    const out = await share(['a', 'b', 'c']);

    expect(out.success).toBe(true);
    expect(out.sharedCount).toBe(3);
    expect(out.skippedCount).toBe(0);
    // 공고가 3건이어도 시트는 1회, 조회는 배치 2회 (getByIdBatch + getPostingFilledCounts)
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(countSpy).toHaveBeenCalledTimes(1);
    expect(countSpy).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('본문 링크는 개별 공고가 아니라 구인구직 탭 하나를 넘긴다', async () => {
    batchSpy.mockResolvedValue([posting('a'), posting('b')]);

    await share(['a', 'b']);

    // 두 번째 인자가 목록 URL — 개별 공고 URL 생성 함수가 아니다
    expect(mockBuildText).toHaveBeenCalledWith(
      expect.any(Array),
      'https://uniqn.app/jobs',
      expect.any(Function)
    );
    // 공유 시트에도 url 을 따로 넘기지 않는다 (iOS 이중 렌더 방지)
    expect(shareSpy.mock.calls[0][0]).not.toHaveProperty('url');
  });

  it('전건이 공유 불가면 공유 시트를 열지 않는다', async () => {
    batchSpy.mockResolvedValue([closed('a'), pendingTournament('b')]);

    const out = await share(['a', 'b']);

    expect(out.success).toBe(false);
    expect(shareSpy).not.toHaveBeenCalled();
    // 게이트 이전 단계인 확정 인원 조회에도 도달하지 않는다
    expect(countSpy).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('일부만 공유 불가면 확인 후 나머지만 공유한다', async () => {
    batchSpy.mockResolvedValue([posting('a'), closed('b'), posting('c')]);
    mockConfirm.mockResolvedValue(true);

    const out = await share(['a', 'b', 'c']);

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(out.success).toBe(true);
    expect(out.sharedCount).toBe(2);
    expect(out.skippedCount).toBe(1);
    expect(countSpy).toHaveBeenCalledWith(['a', 'c']);
  });

  it('부분 공유 확인을 취소하면 시트를 열지 않는다', async () => {
    batchSpy.mockResolvedValue([posting('a'), closed('b')]);
    mockConfirm.mockResolvedValue(false);

    const out = await share(['a', 'b']);

    expect(out.success).toBe(false);
    expect(out.action).toBe('dismissed');
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('선택 상한(10건)을 넘으면 조회 없이 차단한다', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);

    const out = await share(ids);

    expect(out.success).toBe(false);
    expect(batchSpy).not.toHaveBeenCalled();
    expect(shareSpy).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('빈 선택은 조회 없이 차단한다', async () => {
    const out = await share([]);

    expect(out.success).toBe(false);
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('확정 인원 조회가 실패해도 공유는 계속된다 (0/N degrade)', async () => {
    batchSpy.mockResolvedValue([posting('a')]);
    countSpy.mockRejectedValue(new Error('network'));

    const out = await share(['a']);

    expect(out.success).toBe(true);
    expect(shareSpy).toHaveBeenCalledTimes(1);
  });

  it('공고 조회가 실패하면 시트를 열지 않고 안내한다', async () => {
    batchSpy.mockRejectedValue(new Error('network'));

    const out = await share(['a']);

    expect(out.success).toBe(false);
    expect(shareSpy).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalled();
  });
});
