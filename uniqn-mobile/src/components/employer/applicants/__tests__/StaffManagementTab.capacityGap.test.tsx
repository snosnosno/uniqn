import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StaffManagementTab } from '../StaffManagementTab';
import type { PostingCapacityGap } from '@/domains/job-posting/capacityGap';

/**
 * S3-1 근무일 D-day 정원 미달 경고가 **배정 줄(날짜 섹션 헤더)에 실제로 뜨는지** 고정한다.
 *
 * 🚨 이 스위트가 따로 필요한 이유
 *   판정 순수함수는 capacityGap.test.ts 가 덮지만, 그건 "계산이 맞다"만 보인다.
 *   `capacityGapByDate` 가 화면(settlements) → StaffManagementTab → ConfirmedStaffList →
 *   SectionHeader 까지 **네 단계를 타고 내려가는데**, 중간 어디서든 prop 을 안 넘기면
 *   계산은 맞는데 화면엔 아무것도 안 뜬다 — 그리고 그건 어떤 테스트도 에러로 잡아주지 않는다.
 *   실제로 이 프로젝트에서 "구현은 됐는데 렌더 경로가 끊긴" 사고가 반복됐다.
 */

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

jest.mock('@/components/workLogEdit', () => ({
  WorkLogEditSheet: () => null,
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

const WORK_DATE = '2026-04-02';

const createHookState = (overrides: Record<string, unknown> = {}) => ({
  grouped: [
    {
      date: WORK_DATE,
      formattedDate: '4월 2일 (목)',
      staff: [
        {
          id: 'worklog-1',
          staffId: 'staff-1',
          staffName: 'sno(snosno)',
          role: 'staff',
          date: WORK_DATE,
          status: 'scheduled',
          timeSlot: '09:00',
          isRead: true,
        },
      ],
      isToday: false,
      isPast: false,
      stats: { total: 1, checkedIn: 0, completed: 0, noShow: 0 },
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

const GAP: PostingCapacityGap = {
  date: WORK_DATE,
  required: 3,
  filled: 1,
  missing: 2,
  dOffset: 1,
};

describe('StaffManagementTab — D-day 정원 미달 경고 (S3-1)', () => {
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

    useConfirmedStaff.mockReturnValue(createHookState());
  });

  it('해당 날짜에 미달이 있으면 배정 줄에 경고 문구가 뜬다', () => {
    render(
      <StaffManagementTab jobPostingId="job-1" capacityGapByDate={new Map([[WORK_DATE, GAP]])} />
    );

    expect(screen.getByText('D-1 · 2자리 비었어요')).toBeTruthy();
  });

  it('경고에 필요·확정 인원을 푼 접근성 라벨을 단다', () => {
    // 색 틴트만으로는 "경고"라는 사실이 스크린리더에 전달되지 않는다.
    // `accessibilityState` 는 react-native-web 에서 무효라 상태를 라벨 본문에 실어야 한다.
    render(
      <StaffManagementTab jobPostingId="job-1" capacityGapByDate={new Map([[WORK_DATE, GAP]])} />
    );

    expect(
      screen.getByLabelText(
        // '확정'은 applications 축 용어다(S2-2). 좌석은 '자리'로 말해야 스크린리더 경로에서만
        // 축 규약이 깨지는 일이 없다.
        '정원 미달 경고. 4월 2일 (목) 근무, D-1 · 2자리 비었어요. 자리 1/3 채움.'
      )
    ).toBeTruthy();
  });

  it('미달이 없으면 경고 줄을 렌더하지 않는다 (기존 동작 보존)', () => {
    render(<StaffManagementTab jobPostingId="job-1" />);

    expect(screen.queryByText(/자리 비었어요/)).toBeNull();
    // 날짜 헤더 자체는 그대로 떠야 한다 — 경고 유무와 무관하다.
    expect(screen.getByText('4월 2일 (목)')).toBeTruthy();
  });

  it('다른 날짜의 미달은 이 날짜 줄에 새지 않는다', () => {
    // 날짜별 판정이 무너지면 여기서 엉뚱한 날의 경고가 뜬다.
    render(
      <StaffManagementTab
        jobPostingId="job-1"
        capacityGapByDate={new Map([['2026-04-09', { ...GAP, date: '2026-04-09' }]])}
      />
    );

    expect(screen.queryByText(/자리 비었어요/)).toBeNull();
  });
});
