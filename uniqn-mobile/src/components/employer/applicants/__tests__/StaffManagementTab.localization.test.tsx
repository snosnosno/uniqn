import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StaffManagementTab } from '../StaffManagementTab';

const mockUseThemeStore = jest.fn();

jest.mock('@/hooks/useConfirmedStaff', () => ({
  useConfirmedStaff: jest.fn(),
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: jest.fn(),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector?: (state: { isDarkMode: boolean }) => unknown) =>
    mockUseThemeStore(selector),
}));

jest.mock('../../settlement/WorkTimeEditor', () => ({
  WorkTimeEditor: () => null,
}));

jest.mock('@/utils/date', () => ({
  ...jest.requireActual('@/utils/date'),
  getTodayString: () => '2026-04-01',
}));

const { useConfirmedStaff } = jest.requireMock('@/hooks/useConfirmedStaff') as {
  useConfirmedStaff: jest.Mock;
};

const { useUserProfile } = jest.requireMock('@/hooks/useUserProfile') as {
  useUserProfile: jest.Mock;
};

const createHookState = (overrides: Record<string, unknown> = {}) => ({
  grouped: [
    {
      date: '2026-04-01',
      formattedDate: '4월 1일 (수)',
      staff: [
        {
          id: 'worklog-1',
          staffId: 'staff-1',
          staffName: 'sno(snosno)',
          role: 'staff',
          date: '2026-04-01',
          status: 'scheduled',
          timeSlot: '09:00',
          isRead: true,
        },
      ],
      isToday: false,
      isPast: false,
      stats: {
        total: 1,
        checkedIn: 0,
        completed: 0,
        noShow: 0,
      },
    },
  ],
  isLoading: false,
  isRefreshing: false,
  error: null,
  refresh: jest.fn(),
  updateWorkTime: jest.fn(),
  removeStaff: jest.fn(),
  changeStatus: jest.fn(),
  isUpdatingTime: false,
  ...overrides,
});

describe('StaffManagementTab localization', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseThemeStore.mockImplementation(
      (selector?: (state: { isDarkMode: boolean }) => unknown) => {
        const state = { isDarkMode: false };
        return typeof selector === 'function' ? selector(state) : state;
      }
    );

    useUserProfile.mockReturnValue({
      displayName: 'sno(snosno)',
      profilePhotoURL: undefined,
      userProfile: null,
      isLoading: false,
    });
  });

  it('renders staff management labels in Korean', () => {
    useConfirmedStaff.mockReturnValue(createHookState());

    render(
      <StaffManagementTab
        jobPostingId="job-1"
        onShowRoleChange={jest.fn()}
        onShowReport={jest.fn()}
      />
    );

    expect(screen.getByText('새로고침')).toBeTruthy();
    // QR 진입점은 헤더 QR 버튼 하나로 통일 — 정산 화면의 중복 진입점은 없어야 한다.
    expect(screen.queryByText('이벤트 QR 열기')).toBeNull();
    expect(screen.getByText('전체 (1)')).toBeTruthy();
    expect(screen.getByText('출근 예정 (1)')).toBeTruthy();
    expect(screen.getByText('근무 중')).toBeTruthy();
    expect(screen.getByText('퇴근 완료')).toBeTruthy();
    expect(screen.getByText('4월 1일 (수)')).toBeTruthy();
    expect(screen.getByText('sno(snosno)')).toBeTruthy();
    expect(screen.getByText('출근 예정')).toBeTruthy();
    expect(screen.getByText('시작')).toBeTruthy();
    expect(screen.getByText('종료')).toBeTruthy();
    expect(screen.getByText('시간 수정')).toBeTruthy();
    expect(screen.getByText('역할 변경')).toBeTruthy();
    expect(screen.getByText('신고')).toBeTruthy();
  });

  it('renders loading copy in Korean', () => {
    useConfirmedStaff.mockReturnValue(
      createHookState({
        grouped: [],
        isLoading: true,
      })
    );

    render(<StaffManagementTab jobPostingId="job-1" />);

    expect(screen.getByText('확정된 스태프를 불러오는 중입니다...')).toBeTruthy();
  });

  it('renders error copy in Korean', () => {
    useConfirmedStaff.mockReturnValue(
      createHookState({
        grouped: [],
        error: new Error('네트워크 오류'),
      })
    );

    render(<StaffManagementTab jobPostingId="job-1" />);

    expect(screen.getByText('확정된 스태프를 불러오지 못했습니다')).toBeTruthy();
    // 디자인 루프 Z: ErrorState가 일반 Error의 원시 메시지('네트워크 오류')를
    // 노출하지 않고 사용자 친화 문구로 sanitize(extractUserMessage) — 회귀 가드
    expect(screen.getByText('알 수 없는 오류가 발생했습니다')).toBeTruthy();
    expect(screen.queryByText('네트워크 오류')).toBeNull();
  });
});
