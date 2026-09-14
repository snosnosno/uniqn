/**
 * StaffManagementTab — [근무] 사람 줄 취소 요청 승인·거절 (구인자 IA S1b)
 *
 * 🚨 이 스위트가 따로 필요한 이유
 *   카드 단위 테스트는 "띠가 그려진다"만 본다. 취소 요청은 화면 → StaffManagementTab →
 *   ConfirmedStaffList → ConfirmedStaffCard 를 **세 단계 타고 내려가고**, 중간 한 곳만 prop 을
 *   빠뜨려도 계산은 맞는데 화면엔 아무것도 안 뜬다(capacityGap 스위트와 같은 사고 유형).
 *
 * 고정하는 계약:
 *  1. 같은 지원서의 날짜 줄마다 띠가 뜨고, 직접 추가한 줄에는 뜨지 않는다.
 *  2. 🔴 승인은 지원서 단위다 — 확인창이 취소될 근무 일수를 밝힌 뒤에만 승인한다.
 *  3. 거절은 사유(3자 이상)를 받아 지원서 id 와 함께 넘긴다.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StaffManagementTab } from '../StaffManagementTab';

const mockUseThemeStore = jest.fn();

jest.mock('@/hooks/useConfirmedStaff', () => ({
  useConfirmedStaff: jest.fn(),
}));

jest.mock('@/hooks/applicant/useStaffCancellationReview', () => ({
  useStaffCancellationReview: jest.fn(),
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

jest.mock('@/utils/externalLink', () => ({
  openExternalUrl: jest.fn(),
}));

jest.mock('@/utils/date', () => ({
  ...jest.requireActual('@/utils/date'),
  getTodayString: () => '2026-04-01',
}));

// 실제 모달의 애니메이션·포털에 기대지 않는다. visible 은 **존중한다** — 무시하면 닫힌 모달도 열린 것처럼 보인다.
jest.mock('@/components/ui/Modal', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Modal: ({
      visible,
      children,
      footer,
    }: {
      visible?: boolean;
      children: React.ReactNode;
      footer?: React.ReactNode;
    }) =>
      visible ? (
        <>
          {children}
          {footer}
        </>
      ) : null,
    ConfirmModal: ({
      visible,
      title,
      message,
      confirmText,
      onConfirm,
      confirmTestID,
    }: {
      visible: boolean;
      title?: string;
      message: string;
      confirmText?: string;
      onConfirm: () => void;
      confirmTestID?: string;
    }) =>
      visible ? (
        <>
          <Text>{title}</Text>
          <Text>{message}</Text>
          <Pressable testID={confirmTestID} onPress={onConfirm}>
            <Text>{confirmText}</Text>
          </Pressable>
        </>
      ) : null,
  };
});

const { useConfirmedStaff } = jest.requireMock('@/hooks/useConfirmedStaff') as {
  useConfirmedStaff: jest.Mock;
};
const { useStaffCancellationReview } = jest.requireMock(
  '@/hooks/applicant/useStaffCancellationReview'
) as { useStaffCancellationReview: jest.Mock };
const { useUserProfile } = jest.requireMock('@/hooks/useUserProfile') as {
  useUserProfile: jest.Mock;
};

function staffRow(id: string, date: string, applicationId: string | null, staffName: string) {
  return {
    id,
    staffId: `staff-${id}`,
    staffName,
    role: 'dealer',
    date,
    status: 'scheduled',
    timeSlot: '19:00',
    isRead: true,
    workLog: { applicationId },
  };
}

function group(date: string, formattedDate: string, staff: ReturnType<typeof staffRow>[]) {
  return {
    date,
    formattedDate,
    staff,
    isToday: false,
    isPast: false,
    stats: { total: staff.length, scheduled: staff.length, checkedIn: 0, completed: 0, noShow: 0 },
  };
}

const approveAsync = jest.fn();
const rejectAsync = jest.fn();

beforeEach(() => {
  approveAsync.mockReset().mockResolvedValue(undefined);
  rejectAsync.mockReset().mockResolvedValue(undefined);
  mockUseThemeStore.mockReturnValue({ isDarkMode: false });
  useUserProfile.mockImplementation(({ fallbackName }: { fallbackName?: string }) => ({
    displayName: fallbackName,
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: null,
  }));
  useConfirmedStaff.mockReturnValue({
    grouped: [
      group('2026-04-02', '4월 2일 (목)', [
        staffRow('wl-1', '2026-04-02', 'app-1', '김딜러'),
        staffRow('wl-2', '2026-04-02', null, '박직접'),
      ]),
      group('2026-04-03', '4월 3일 (금)', [staffRow('wl-3', '2026-04-03', 'app-1', '김딜러')]),
    ],
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: jest.fn(),
    removeStaff: jest.fn(),
    changeStatus: jest.fn(),
    setNoShow: jest.fn(),
    cancelNoShow: jest.fn(),
    addStaff: jest.fn(),
    isAddingStaff: false,
  });
  useStaffCancellationReview.mockReturnValue({
    cancellationIndex: new Map([
      [
        'app-1',
        {
          applicationId: 'app-1',
          reason: '개인 사정',
          requestedAt: '2026-03-31T01:00:00.000Z',
          phone: '01012345678',
        },
      ],
    ]),
    reviewingApplicationId: null,
    approveAsync,
    rejectAsync,
  });
});

describe('StaffManagementTab — 취소 요청 줄', () => {
  it('같은 지원서의 날짜 줄마다 띠가 뜨고, 직접 추가한 줄에는 뜨지 않는다', () => {
    render(<StaffManagementTab jobPostingId="job-1" />);

    expect(screen.getAllByTestId('card-cancellation-request')).toHaveLength(2);
    expect(screen.queryByLabelText('박직접 취소 요청 승인')).toBeNull();
  });

  it('🔴 승인은 취소될 근무 일수를 밝힌 확인을 거친 뒤에만 실행된다', async () => {
    render(<StaffManagementTab jobPostingId="job-1" />);

    fireEvent.press(screen.getAllByLabelText('김딜러 취소 요청 승인')[0]);

    expect(approveAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText('김딜러님의 취소 요청을 승인할까요?\n이 지원의 근무 2일이 모두 취소됩니다.')
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('work-cancellation-approve-confirm'));
    });

    expect(approveAsync).toHaveBeenCalledTimes(1);
    expect(approveAsync).toHaveBeenCalledWith('app-1');
  });

  it('거절은 사유를 받아 지원서 id 와 함께 넘긴다', async () => {
    render(<StaffManagementTab jobPostingId="job-1" />);

    fireEvent.press(screen.getAllByLabelText('김딜러 취소 요청 거절')[0]);
    fireEvent.changeText(
      screen.getByPlaceholderText('최소 3자 이상 입력해주세요'),
      '대체 인원 없음'
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('거절하기'));
    });

    expect(rejectAsync).toHaveBeenCalledWith('app-1', '대체 인원 없음');
    expect(screen.queryByPlaceholderText('최소 3자 이상 입력해주세요')).toBeNull();
  });
});
