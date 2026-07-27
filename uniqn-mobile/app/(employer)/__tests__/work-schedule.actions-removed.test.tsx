/**
 * 근무표 화면 — 반복 전제 상단 액션 행 제거 회귀 가드
 *
 * "지난주 복사"·"출근 확인 요청"은 일정이 주 단위로 반복된다는 가정 위에 서 있던 벌크 수단이다.
 * 사장의 실제 패턴(매번 필요 인원이 다름)과 어긋나 제거했고, 이 테스트는 재유입을 막는다.
 * 대조군(월 네비게이션)을 함께 단언해 "화면이 안 그려져서 통과"하는 vacuous green 을 배제한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import WorkScheduleScreen from '../work-schedule';

// useQueryClient 실물은 QueryClientProvider 없으면 throw 하므로 이것만 대체한다.
// 나머지는 requireActual 유지 필수 — @/lib/queryClient 가 모듈 로드 시 QueryCache 를 생성한다
// (전체를 목으로 덮으면 "QueryCache is not a constructor" 로 스위트가 로드조차 안 된다).
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// 무거운 자식들은 전부 null — 이 테스트의 관심사는 화면 자신이 그리는 액션 행뿐이다.
jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/components/jobs/DateCalendar/CalendarGrid', () => ({ CalendarGrid: () => null }));
jest.mock('@/components/workSchedule', () => ({
  VenueSelector: () => null,
  VenueDayPanel: () => null,
  VenueCreateSheet: () => null,
  VenueSettingsSheet: () => null,
  GridBadgeLegend: () => null,
}));
jest.mock('@/components/ui', () => ({
  Loading: () => null,
  EmptyState: () => null,
  ErrorState: () => null,
}));
jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
  MapPinIcon: () => null,
  CopyIcon: () => null,
  BellIcon: () => null,
}));

// 플래그 ON — OFF 면 Redirect 로 화면이 통째로 사라져 단언이 vacuous 해진다.
jest.mock('@/hooks', () => ({
  useWorkScheduleEnabled: () => ({ enabled: true, isLoading: false }),
}));

jest.mock('@/hooks/workspace', () => ({
  useActiveWorkspace: () => ({
    workspaces: [{ id: 'ws-1', name: '팀' }],
    activeWorkspace: { id: 'ws-1', name: '팀' },
    setActiveWorkspaceId: jest.fn(),
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useEnsureDefaultWorkspace: () => ({ isCreating: false, retry: jest.fn() }),
}));

// 운영처 1개 + 요약 성공 → hasVenue=true 경로(ScrollView 본문)가 렌더된다.
jest.mock('@/hooks/workSchedule', () => ({
  useVenueContainers: () => ({
    data: [{ id: 'v1', name: '지점' }],
    isLoading: false,
    isSuccess: true,
  }),
  useGridSummary: () => ({
    data: {},
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useEnsureDefaultVenue: () => ({ isCreating: false }),
}));

describe('근무표 화면 — 반복 전제 액션 행 제거', () => {
  it('지난주 복사·출근 확인 요청 버튼과 "대상 주" 표기가 렌더되지 않는다', () => {
    const { queryByText, queryByLabelText } = render(<WorkScheduleScreen />);

    // 대조군 — 화면 본문이 실제로 렌더됐다는 증거(월 네비게이션은 그대로 남는다).
    expect(queryByLabelText('이전 달')).not.toBeNull();
    expect(queryByLabelText('다음 달')).not.toBeNull();

    // 핵심 단언 — 반복 전제 액션 3요소(버튼 2개 + 대상 주 라벨)가 사라져야 한다.
    expect(queryByText('지난주 복사')).toBeNull();
    expect(queryByText('출근 확인 요청')).toBeNull();
    expect(queryByLabelText('지난주 배치를 이번 주로 복사')).toBeNull();
    expect(queryByLabelText('이번 주 출근 확인 요청 보내기')).toBeNull();
    expect(queryByText(/대상 주/)).toBeNull();
  });
});
