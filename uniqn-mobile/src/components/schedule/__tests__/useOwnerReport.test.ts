import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOwnerReport } from '../useOwnerReport';
import type { CreateReportInput } from '@/types';

const mockGetUserProfile = jest.fn();
const mockCreateReport = jest.fn();
const mockAddToast = jest.fn();

jest.mock('@/services/auth', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}));
jest.mock('@/services/admin', () => ({
  createReport: (...args: unknown[]) => mockCreateReport(...args),
}));
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));
jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const input = {} as unknown as CreateReportInput;

describe('useOwnerReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('open: fallback 이름으로 즉시 표시하고 실이름으로 비동기 보강한다', async () => {
    mockGetUserProfile.mockResolvedValue({ name: '실제 구인자' });

    const { result } = renderHook(() => useOwnerReport());

    act(() => {
      result.current.open({
        ownerId: 'owner-1',
        ownerName: '기본 구인자',
        jobPostingId: 'jp-1',
        jobPostingTitle: '홀덤펍 딜러',
      });
    });

    // 즉시: fallback 이름 + visible + 공고 정보
    expect(result.current.visible).toBe(true);
    expect(result.current.target).toEqual({ id: 'owner-1', name: '기본 구인자' });
    expect(result.current.jobPostingId).toBe('jp-1');
    expect(result.current.jobPostingTitle).toBe('홀덤펍 딜러');

    // 비동기: 실이름으로 교체
    await waitFor(() => {
      expect(result.current.target).toEqual({ id: 'owner-1', name: '실제 구인자' });
    });
  });

  it('open: 프로필 조회 실패해도 fallback 이름을 유지한다', async () => {
    mockGetUserProfile.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useOwnerReport());

    act(() => {
      result.current.open({ ownerId: 'owner-2', ownerName: '기본 구인자', jobPostingId: 'jp-2' });
    });

    await waitFor(() => {
      expect(mockGetUserProfile).toHaveBeenCalledWith('owner-2');
    });
    expect(result.current.target).toEqual({ id: 'owner-2', name: '기본 구인자' });
    expect(result.current.visible).toBe(true);
  });

  it('submit: 성공 시 createReport 호출 + 성공 토스트 + 닫힘', async () => {
    mockCreateReport.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOwnerReport());

    await act(async () => {
      await result.current.submit(input);
    });

    expect(mockCreateReport).toHaveBeenCalledWith(input);
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: '신고가 접수되었습니다.',
    });
    expect(result.current.visible).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('submit: 실패 시 에러 토스트 + isLoading 복구', async () => {
    mockCreateReport.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useOwnerReport());

    await act(async () => {
      await result.current.submit(input);
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: '신고 접수에 실패했습니다. 다시 시도해주세요.',
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('close: visible=false + target=null', () => {
    const { result } = renderHook(() => useOwnerReport());

    act(() => {
      result.current.open({ ownerId: 'o', ownerName: 'n', jobPostingId: 'jp' });
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.target).toBeNull();
  });
});
