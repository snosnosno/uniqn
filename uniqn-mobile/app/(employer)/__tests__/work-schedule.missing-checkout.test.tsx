/**
 * 근무표 화면 — "퇴근 미기록 N건" 안전망 배너
 *
 * 자동 퇴근을 만들지 않기로 했으므로, 퇴근이 안 찍힌 근무는 정산 게이트에 영영 도달하지
 * 못한 채 조용히 남는다. 이 배너가 구인자에게 그 사실을 알리는 **유일한 경로**라 사라지면
 * 아무 에러 없이 안전망만 없어진다 — 그래서 렌더 자체를 회귀 가드로 고정한다.
 *
 * 대조군(월 네비게이션)을 함께 단언해 "화면이 안 그려져서 통과"하는 vacuous green 을 배제한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { ConfirmedStaffGroup } from '@/types/confirmedStaff';
import WorkScheduleScreen from '../work-schedule';

let mockGroups: ConfirmedStaffGroup[] = [];

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/hooks/useConfirmedStaff', () => ({
  useConfirmedStaff: () => ({ grouped: mockGroups }),
}));

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
}));

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

function group(overrides: Partial<ConfirmedStaffGroup> = {}): ConfirmedStaffGroup {
  return {
    date: '2026-07-20',
    formattedDate: '7월 20일',
    staff: [],
    isToday: false,
    isPast: true,
    stats: { total: 2, checkedIn: 0, completed: 2, noShow: 0 },
    ...overrides,
  };
}

describe('근무표 화면 — 퇴근 미기록 배너', () => {
  afterEach(() => {
    mockGroups = [];
  });

  it('지난 날짜에 퇴근 미기록이 있으면 건수와 함께 배너를 그린다', () => {
    mockGroups = [
      group({ date: '2026-07-20', stats: { total: 2, checkedIn: 2, completed: 0, noShow: 0 } }),
      group({ date: '2026-07-22', stats: { total: 1, checkedIn: 1, completed: 0, noShow: 0 } }),
    ];

    const { queryByText, queryByLabelText, queryByTestId } = render(<WorkScheduleScreen />);

    // 대조군 — 화면 본문이 실제로 렌더됐다는 증거
    expect(queryByLabelText('이전 달')).not.toBeNull();

    expect(queryByTestId('missing-checkout-banner')).not.toBeNull();
    expect(queryByText('퇴근 미기록 3건')).not.toBeNull();
  });

  it('미기록이 없으면 배너를 그리지 않는다', () => {
    mockGroups = [group()];

    const { queryByLabelText, queryByTestId } = render(<WorkScheduleScreen />);

    expect(queryByLabelText('이전 달')).not.toBeNull();
    expect(queryByTestId('missing-checkout-banner')).toBeNull();
  });

  // 🔴 오늘 근무 중인 사람은 미기록이 아니다. 세면 배너가 영업시간 내내 켜져 안전망이 죽는다.
  it('오늘 근무 중인 인원만 있으면 배너를 그리지 않는다', () => {
    mockGroups = [
      group({
        date: '2026-07-31',
        isToday: true,
        isPast: false,
        stats: { total: 4, checkedIn: 4, completed: 0, noShow: 0 },
      }),
    ];

    const { queryByLabelText, queryByTestId } = render(<WorkScheduleScreen />);

    expect(queryByLabelText('이전 달')).not.toBeNull();
    expect(queryByTestId('missing-checkout-banner')).toBeNull();
  });
});
