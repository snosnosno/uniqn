/**
 * VenueSettlementsScreen 렌더 스모크 — 로딩/빈 상태/폴백 배지 조건부.
 * (expo 웹 그라운딩은 메인 세션이 별도 수행. 여기서는 상태별 분기 렌더만 관찰한다.)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import VenueSettlementsScreen from '../venue-settlements';
import type { SettlementWorkLog } from '@/services/work/settlement/types';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/weeklyGrid', () => ({
  useVenueSettlement: jest.fn(),
  useSetVenueRoleSalary: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
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

jest.mock('@/components/employer/settlement/SettlementCard', () => ({
  SettlementCard: 'SettlementCard',
}));

jest.mock('@/components/weeklyGrid/RoleSalaryField', () => ({
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
  return jest.requireMock('@/hooks/weeklyGrid') as Mocks;
}
function getParams(): jest.Mock {
  return (jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock })
    .useLocalSearchParams;
}

const FALLBACK_BADGE = /기본 단가\(시급 15,000원\)로 계산됐어요/;

beforeEach(() => {
  const { useVenueSettlement, useSetVenueRoleSalary } = getMocks();
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
    expect(getByText('지점 정산')).toBeTruthy();
    expect(queryByText('이 달 정산할 근무가 없어요')).toBeNull();
    expect(queryByText(FALLBACK_BADGE)).toBeNull();
  });

  it('데이터가 없으면 빈 상태 안내를 렌더한다', () => {
    getMocks().useVenueSettlement.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<VenueSettlementsScreen />);
    expect(getByText('이 달 정산할 근무가 없어요')).toBeTruthy();
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
});
