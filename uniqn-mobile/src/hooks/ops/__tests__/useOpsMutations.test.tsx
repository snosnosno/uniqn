/**
 * useOpsMutations — 1e 신규 스태프 변이 5종 테스트.
 * (useSetTournamentPosting / useImportOpsStaff / useAddOpsStaff / useRemoveOpsStaff / useAssignTableStaff)
 * 기존 mutation(useSetVenueSoftTarget/useCreateVenueContainer) 문형 복제 — 레포(여기선 Service) 위임 +
 * onSuccess invalidate 키 단언. 그 외 기존 20여종 mutation 은 이 태스크 범위 밖(회귀 없음, 파일 불변 유지).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import {
  useSetTournamentPosting,
  useImportOpsStaff,
  useAddOpsStaff,
  useRemoveOpsStaff,
  useAssignTableStaff,
} from '../useOpsMutations';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockSetTournamentPosting = jest.fn();
const mockImportFromPosting = jest.fn();
const mockAddStaff = jest.fn();
const mockRemoveStaff = jest.fn();
const mockAssignTableStaff = jest.fn();

jest.mock('@/services/ops', () => ({
  opsTournamentService: {},
  opsParticipantService: {},
  opsTableService: {},
  opsSeatService: {},
  opsStaffService: {
    setTournamentPosting: (...args: unknown[]) => mockSetTournamentPosting(...args),
    importFromPosting: (...args: unknown[]) => mockImportFromPosting(...args),
    addStaff: (...args: unknown[]) => mockAddStaff(...args),
    removeStaff: (...args: unknown[]) => mockRemoveStaff(...args),
    assignTableStaff: (...args: unknown[]) => mockAssignTableStaff(...args),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      success: (...a: unknown[]) => mockToastSuccess(...a),
      error: (...a: unknown[]) => mockToastError(...a),
    }),
  },
}));

const TID = 't1';

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useSetTournamentPosting', () => {
  beforeEach(() => {
    mockSetTournamentPosting.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    (useAuthStore as unknown as jest.Mock).mockReturnValue('actor-1');
  });

  it('jobPostingId 를 Service 로 위임(actor=authStore)', async () => {
    mockSetTournamentPosting.mockResolvedValueOnce(undefined);
    const client = createClient();
    const { result } = renderHook(() => useSetTournamentPosting(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('posting-1');
    });

    expect(mockSetTournamentPosting).toHaveBeenCalledWith(TID, 'actor-1', 'posting-1');
  });

  it('성공 시 ops.staff + ops.tournamentDetail/tournaments 를 invalidate', async () => {
    mockSetTournamentPosting.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSetTournamentPosting(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('posting-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.staff(TID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.tournamentDetail(TID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.tournaments() });
  });

  it('로그인 안됨(actorId 없음) → Service 미호출 + 에러', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue(undefined);
    const client = createClient();
    const { result } = renderHook(() => useSetTournamentPosting(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('posting-1').catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSetTournamentPosting).not.toHaveBeenCalled();
  });
});

describe('useImportOpsStaff', () => {
  beforeEach(() => {
    mockImportFromPosting.mockReset();
    mockToastSuccess.mockReset();
    (useAuthStore as unknown as jest.Mock).mockReturnValue('actor-1');
  });

  it('date 를 Service 로 위임 + {imported,skipped} 를 호출측에 전달', async () => {
    mockImportFromPosting.mockResolvedValueOnce({ imported: 3, skipped: 1 });
    const client = createClient();
    const { result } = renderHook(() => useImportOpsStaff(TID), {
      wrapper: createWrapper(client),
    });

    let resolved: { imported: number; skipped: number } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync(null);
    });

    expect(mockImportFromPosting).toHaveBeenCalledWith(TID, 'actor-1', null);
    expect(resolved).toEqual({ imported: 3, skipped: 1 });
  });

  it('성공 시 ops.staff 를 invalidate', async () => {
    mockImportFromPosting.mockResolvedValueOnce({ imported: 2, skipped: 0 });
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useImportOpsStaff(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(null);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.staff(TID) });
  });

  // Task 8(STAFF 탭) 스펙 §4.2 고정 문구 — "N명 추가 · M명 건너뜀"(항상 두 항목 모두 표시).
  it('성공 시 "N명 추가 · M명 건너뜀" 토스트를 표시한다', async () => {
    mockImportFromPosting.mockResolvedValueOnce({ imported: 3, skipped: 1 });
    const client = createClient();
    const { result } = renderHook(() => useImportOpsStaff(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(null);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToastSuccess).toHaveBeenCalledWith('3명 추가 · 1명 건너뜀');
  });
});

describe('useAddOpsStaff', () => {
  beforeEach(() => {
    mockAddStaff.mockReset();
    mockToastSuccess.mockReset();
    (useAuthStore as unknown as jest.Mock).mockReturnValue('actor-1');
  });

  it('staffId/role/customRole 을 Service 로 위임', async () => {
    mockAddStaff.mockResolvedValueOnce(undefined);
    const client = createClient();
    const { result } = renderHook(() => useAddOpsStaff(TID), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ staffId: 's1', role: 'dealer', customRole: null });
    });

    expect(mockAddStaff).toHaveBeenCalledWith(TID, 'actor-1', 's1', 'dealer', null);
  });

  it('성공 시 ops.staff 를 invalidate', async () => {
    mockAddStaff.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useAddOpsStaff(TID), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ staffId: 's1', role: 'dealer' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.staff(TID) });
  });
});

describe('useRemoveOpsStaff', () => {
  beforeEach(() => {
    mockRemoveStaff.mockReset();
    mockToastSuccess.mockReset();
    (useAuthStore as unknown as jest.Mock).mockReturnValue('actor-1');
  });

  it('opsStaffId 를 Service 로 위임', async () => {
    mockRemoveStaff.mockResolvedValueOnce(undefined);
    const client = createClient();
    const { result } = renderHook(() => useRemoveOpsStaff(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('os1');
    });

    expect(mockRemoveStaff).toHaveBeenCalledWith(TID, 'actor-1', 'os1');
  });

  it('성공 시 ops.staff + ops.tables 를 invalidate(cascade-clear 반영)', async () => {
    mockRemoveStaff.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRemoveOpsStaff(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('os1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.staff(TID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.tables(TID) });
  });
});

describe('useAssignTableStaff', () => {
  beforeEach(() => {
    mockAssignTableStaff.mockReset();
    mockToastSuccess.mockReset();
    (useAuthStore as unknown as jest.Mock).mockReturnValue('actor-1');
  });

  it('tableId/staffId 를 Service 로 위임(staffId=null 해제 포함)', async () => {
    mockAssignTableStaff.mockResolvedValueOnce(undefined);
    const client = createClient();
    const { result } = renderHook(() => useAssignTableStaff(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ tableId: 'tb1', staffId: null });
    });

    expect(mockAssignTableStaff).toHaveBeenCalledWith(TID, 'actor-1', 'tb1', null);
  });

  it('성공 시 ops.tables + ops.staff 를 invalidate', async () => {
    mockAssignTableStaff.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useAssignTableStaff(TID), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ tableId: 'tb1', staffId: 's1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.tables(TID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ops.staff(TID) });
  });
});
