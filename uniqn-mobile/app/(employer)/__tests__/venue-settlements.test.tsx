/**
 * VenueSettlementsScreen(지점 근무 금액) 렌더 스모크 — 로딩/빈 상태/폴백 배지/합계.
 * (expo 웹 그라운딩은 메인 세션이 별도 수행. 여기서는 상태별 분기 렌더만 관찰한다.)
 *
 * 구인자 IA S2 — 지급 완료·일괄 정산·지급 완료 취소를 걷어낸 **읽기 전용** 화면이다.
 * 공고 없이 근무표에 직접 배치한 사람의 금액을 볼 곳은 여기뿐이라 화면은 남겼다.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import VenueSettlementsScreen from '../venue-settlements';
import type { SettlementWorkLog } from '@/services/work/settlement/types';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/workSchedule', () => ({
  useVenueSettlement: jest.fn(),
  useSetVenueRoleSalary: jest.fn(),
}));

// 저장/refetch 흐름의 토스트 호출을 단언하기 위해 모듈 스코프 목으로 캡처한다.
const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

// SettlementDetailModal 이 실제로 렌더되면 프로필 훅이 react-query 를 탄다 — Provider 가 없는
// 이 스모크에서는 표시 이름만 고정해 둔다.
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: ({ fallbackName }: { fallbackName?: string }) => ({
    displayName: fallbackName ?? '스태프',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: undefined,
  }),
}));

jest.mock('@/components/headers', () => {
  const RN = jest.requireActual('react-native') as typeof import('react-native');
  return {
    StackHeader: ({ title }: { title: string }) => (
      <RN.View>
        <RN.Text>{title}</RN.Text>
      </RN.View>
    ),
  };
});

// 카드 자체는 별도 테스트 대상이지만, 상세 모달을 여는 유일한 경로가 카드 탭이라
// onPress 를 실제로 발화시킬 수 있는 최소 목으로 둔다(문자열 목이면 press 를 못 건다).
jest.mock('@/components/employer/settlement/SettlementCard', () => {
  const RN = jest.requireActual('react-native') as typeof import('react-native');
  return {
    SettlementCard: ({ workLog, onPress }: { workLog: { id?: string }; onPress?: () => void }) => (
      <RN.Pressable
        accessibilityRole="button"
        accessibilityLabel={`카드-${workLog.id}`}
        onPress={onPress}
      >
        <RN.Text>{`카드-${workLog.id}`}</RN.Text>
      </RN.Pressable>
    ),
  };
});

jest.mock('@/components/workSchedule/RoleSalaryField', () => ({
  RoleSalaryField: 'RoleSalaryField',
  defaultVenueSalaryDraft: () => ({ type: 'hourly', amount: 15000 }),
}));

// ============================================================================
// 헬퍼
// ============================================================================

function makeWorkLog(overrides: Partial<SettlementWorkLog> = {}): SettlementWorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    jobPostingId: 'jp-1',
    date: '2026-07-10',
    status: 'confirmed',
    role: 'dealer',
    salaryInfo: { type: 'hourly', amount: 15000 },
    salarySource: 'roleTable',
    ...overrides,
  } as SettlementWorkLog;
}

type Mocks = { useVenueSettlement: jest.Mock; useSetVenueRoleSalary: jest.Mock };
function getMocks(): Mocks {
  return jest.requireMock('@/hooks/workSchedule') as Mocks;
}
function getParams(): jest.Mock {
  return (jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock })
    .useLocalSearchParams;
}

const FALLBACK_BADGE = /기본 단가\(시급 15,000원\)로 계산됐어요/;

beforeEach(() => {
  const { useVenueSettlement, useSetVenueRoleSalary } = getMocks();
  mockAddToast.mockClear();
  useSetVenueRoleSalary.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  getParams().mockReturnValue({ venueId: 'v1', month: '2026-07' });
  useVenueSettlement.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
});

describe('VenueSettlementsScreen 렌더 스모크', () => {
  it('로딩 중에는 빈 상태·배지를 그리지 않고 헤더만 렌더한다', () => {
    getMocks().useVenueSettlement.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: jest.fn(),
    });
    const { getByText, queryByText } = render(<VenueSettlementsScreen />);
    expect(getByText('지점 근무 금액')).toBeTruthy();
    expect(queryByText('이 달 근무 기록이 없어요')).toBeNull();
    expect(queryByText(FALLBACK_BADGE)).toBeNull();
  });

  it('데이터가 없으면 빈 상태 안내를 렌더한다', () => {
    const { getByText } = render(<VenueSettlementsScreen />);
    expect(getByText('이 달 근무 기록이 없어요')).toBeTruthy();
  });

  it('컨테이너 직속(jobPostingId===venueId) 폴백 건에만 배지 + 건수 요약을 렌더한다', () => {
    // 컨테이너 직속 행(jobPostingId==='v1')만 지점 단가표로 해소되므로 배지 대상(HIGH-1 ②).
    getMocks().useVenueSettlement.mockReturnValue({
      data: [
        makeWorkLog({ id: 'wl-fb', jobPostingId: 'v1', salarySource: 'fallback' }),
        makeWorkLog({ id: 'wl-ok', jobPostingId: 'v1', salarySource: 'roleTable' }),
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText, getAllByText } = render(<VenueSettlementsScreen />);
    // 폴백 1건만 배지 노출
    expect(getAllByText(FALLBACK_BADGE)).toHaveLength(1);
    expect(getByText('기본 단가로 계산된 근무 1건 — 배지를 탭해 단가를 설정하세요.')).toBeTruthy();
  });

  it('공고 스팬(jobPostingId≠venueId) 폴백 행에는 배지·요약을 렌더하지 않는다', () => {
    // 공고 스팬 행의 fallback 은 공고 defaultSalary 해소라 지점 단가표와 무관 — 배지를 탭해
    // 지점 단가를 저장해도 재계산되지 않으므로 거짓 배지가 된다. 스코프 게이트로 차단(HIGH-1 ①).
    getMocks().useVenueSettlement.mockReturnValue({
      data: [makeWorkLog({ id: 'wl-span', jobPostingId: 'jp-span', salarySource: 'fallback' })],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { queryByText } = render(<VenueSettlementsScreen />);
    expect(queryByText(FALLBACK_BADGE)).toBeNull();
    expect(queryByText(/배지를 탭해 단가를 설정하세요/)).toBeNull();
  });

  it('컨테이너 직속·공고 스팬 폴백이 섞이면 컨테이너 직속만 배지·요약에 집계한다', () => {
    // 요약 건수(fallbackCount)도 컨테이너 직속만 세야 한다 — 스팬 행은 제외(HIGH-1).
    getMocks().useVenueSettlement.mockReturnValue({
      data: [
        makeWorkLog({ id: 'wl-fb', jobPostingId: 'v1', salarySource: 'fallback' }),
        makeWorkLog({ id: 'wl-span', jobPostingId: 'jp-span', salarySource: 'fallback' }),
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText, getAllByText } = render(<VenueSettlementsScreen />);
    expect(getAllByText(FALLBACK_BADGE)).toHaveLength(1);
    expect(getByText('기본 단가로 계산된 근무 1건 — 배지를 탭해 단가를 설정하세요.')).toBeTruthy();
  });

  it('폴백이 없으면 배지·요약을 렌더하지 않는다', () => {
    getMocks().useVenueSettlement.mockReturnValue({
      data: [makeWorkLog({ id: 'wl-ok', jobPostingId: 'v1', salarySource: 'roleTable' })],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { queryByText } = render(<VenueSettlementsScreen />);
    expect(queryByText(FALLBACK_BADGE)).toBeNull();
    expect(queryByText(/배지를 탭해 단가를 설정하세요/)).toBeNull();
  });

  it('월 라벨은 leading zero 없이 표시한다 ("07" → "7월")', () => {
    // 'YYYY-MM' 의 월 부분 선행 0 을 제거해 자연스러운 한글 라벨로 보인다.
    const { getByText } = render(<VenueSettlementsScreen />);
    expect(getByText('2026년 7월')).toBeTruthy();
  });

  it('단가 저장 성공 후 refetch 가 실패해도 실패 토스트를 띄우지 않는다', async () => {
    // refetch 실패는 저장 자체의 실패가 아니므로 성공 토스트만 떠야 한다(모순 토스트 방지).
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const refetch = jest.fn().mockRejectedValue(new Error('network'));
    getMocks().useSetVenueRoleSalary.mockReturnValue({ mutateAsync, isPending: false });
    getMocks().useVenueSettlement.mockReturnValue({
      data: [makeWorkLog({ id: 'wl-fb', jobPostingId: 'v1', salarySource: 'fallback' })],
      isLoading: false,
      refetch,
    });
    const { getByText, getByLabelText } = render(<VenueSettlementsScreen />);
    // 배지 탭 → 단가 설정 시트 오픈
    fireEvent.press(getByLabelText(/기본 단가 적용 — 탭해서 단가 설정/));
    // 저장 버튼 탭 → mutateAsync 성공 → refetch 실패
    await act(async () => {
      fireEvent.press(getByText('단가 저장하고 다시 계산'));
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: '단가를 저장했어요. 금액을 다시 계산합니다.',
    });
    expect(mockAddToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

// ============================================================================
// 구인자 IA S2 — 읽기 전용
// ============================================================================

describe('VenueSettlementsScreen — 지급 워크플로우 없음', () => {
  function checkedOut(id: string, amount: number): SettlementWorkLog {
    return makeWorkLog({
      id,
      jobPostingId: 'v1',
      checkInTime: '2026-07-10T10:00:00.000Z',
      checkOutTime: '2026-07-10T14:00:00.000Z',
      calculatedAmount: amount,
    } as Partial<SettlementWorkLog>);
  }

  it('지급 예정 합계는 퇴근이 기록된 근무만 더한다', () => {
    getMocks().useVenueSettlement.mockReturnValue({
      data: [
        checkedOut('wl-a', 60000),
        checkedOut('wl-b', 40000),
        // 🚨 과거에 지급 완료로 처리된 근무 — "지급 예정" 에 더하면 사장이 한 번 더 보낸다.
        makeWorkLog({
          id: 'wl-paid',
          jobPostingId: 'v1',
          checkInTime: '2026-07-09T10:00:00.000Z',
          checkOutTime: '2026-07-09T14:00:00.000Z',
          calculatedAmount: 70000,
          payrollStatus: 'completed',
          payrollAmount: 50000,
        } as Partial<SettlementWorkLog>),
        // 퇴근 전 — 금액을 만들지 않는다.
        makeWorkLog({
          id: 'wl-open',
          jobPostingId: 'v1',
          checkInTime: '2026-07-11T10:00:00.000Z',
          calculatedAmount: 99999,
        } as Partial<SettlementWorkLog>),
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<VenueSettlementsScreen />);

    expect(getByTestId('venue-payable-total').props.children).toBe('₩100,000');
    // 확정 금액(50,000 — 재계산값 70,000 이 아니다)은 따로 밝힌다.
    expect(getByTestId('venue-settled-note').props.children).toContain('₩50,000');
  });

  it('일괄 정산 · 지급 완료 · 지급 완료 취소 진입점이 없다', () => {
    getMocks().useVenueSettlement.mockReturnValue({
      data: [
        checkedOut('wl-a', 60000),
        makeWorkLog({
          id: 'wl-done',
          jobPostingId: 'v1',
          payrollStatus: 'completed',
          payrollAmount: 80000,
          checkInTime: '2026-07-10T10:00:00.000Z',
          checkOutTime: '2026-07-10T14:00:00.000Z',
        } as Partial<SettlementWorkLog>),
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { queryByText, getByLabelText, queryByLabelText } = render(<VenueSettlementsScreen />);

    expect(queryByText(/전체 정산|일괄 정산/)).toBeNull();
    // 과거 지급 완료 행의 상세에서도 취소 진입점이 없다.
    fireEvent.press(getByLabelText('카드-wl-done'));
    expect(queryByLabelText('지급 완료 취소')).toBeNull();
    expect(queryByText('지급 완료로 표시')).toBeNull();
  });
});
