/**
 * ApplicantsScreen — 확정 해제 되돌리기 회귀 테스트 (S2-7).
 *
 * 확정/해제는 사장이 지원자 목록을 훑으며 반복하는 조작이다. 매번 네이티브 Alert
 * (`confirmAction`)가 앞을 막으면 흐름이 끊긴다 — "확인하고 실행" 대신 "실행하고 되돌리기"로 바꿨다.
 *
 * 고정하는 계약 셋.
 *  1. 해제는 즉시 실행되고 되돌리기 어포던스가 달린 토스트를 남긴다.
 *  2. 되돌리기는 **해제 전에 캡처한 배정**으로 재확정을 호출한다 — 해제 후에는 서버가
 *     배정을 비울 수 있어서, 그때 읽으면 빈 배정으로 재확정하게 된다.
 *  3. 같은 지원자를 연타해도 뮤테이션은 한 번만 나간다. action 토스트는 dedupe 면제라
 *     (`toastStore.ts` 주석) 가드가 없으면 되돌리기 어포던스가 쌓인다.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ApplicantsScreen from '../applicants';

const mockAddToast = jest.fn();
const mockCancelConfirmation = jest.fn();
const mockConfirmWithHistory = jest.fn();

const mockApplicant = {
  id: 'application-1',
  status: 'confirmed',
  assignments: [{ date: '2026-08-20', role: 'dealer', timeSlot: '18:00-24:00' }],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'posting-1' }),
}));

jest.mock('../_layout', () => ({
  useJobDetailContext: () => ({
    job: { id: 'posting-1', title: '금요일 딜러 모집', schedule: { kind: 'dated' } },
    isFixed: false,
    handleShowQR: jest.fn(),
  }),
  HeaderQRAction: () => null,
  JobTitleSuffix: () => null,
}));

// onCancelConfirmation 을 실제로 발화하는 목 — null 목이면 이 파일의 계약이 통째로 사라진다.
jest.mock('@/components/employer', () => {
  const { Text: RNText, Pressable: RNPressable } = jest.requireActual('react-native');
  return {
    ApplicantList: ({
      applicants,
      onCancelConfirmation,
    }: {
      applicants: { id: string }[];
      onCancelConfirmation: (applicant: unknown) => void;
    }) => (
      <RNPressable testID="cancel-confirmation" onPress={() => onCancelConfirmation(applicants[0])}>
        <RNText>확정 해제</RNText>
      </RNPressable>
    ),
    ApplicantConfirmModal: () => null,
    ApplicantProfileModal: () => null,
    // 필터 파싱 계약은 ApplicantList 쪽 테스트가 검증한다 — 여기서 빠뜨리면
    // 화면이 마운트조차 못 한다("toApplicantFilter is not a function").
    toApplicantFilter: jest.requireActual('@/components/employer/applicants/ApplicantList')
      .toApplicantFilter,
  };
});

jest.mock('@/components', () => ({
  Loading: () => null,
  ErrorState: () => null,
}));

jest.mock('@/components/jobs', () => ({
  SeatFillSummary: () => null,
}));

jest.mock('@/components/headers', () => ({
  StackHeader: () => null,
}));

jest.mock('@/domains/job-posting', () => ({
  buildPostingFacts: (p: unknown) => p,
  projectPostingSurface: () => ({ filledPositions: 1, totalPositions: 5 }),
}));

jest.mock('@/hooks/applicant', () => ({
  useApplicantManagement: () => ({
    applicants: [mockApplicant],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    confirmWithHistoryAsync: mockConfirmWithHistory,
    rejectApplicationAsync: jest.fn(),
    cancelConfirmationAsync: mockCancelConfirmation,
    bulkConfirm: jest.fn(),
    isBulkConfirming: false,
    markAsRead: jest.fn(),
  }),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJobById: jest.fn() }),
}));

jest.mock('@/hooks/useSubmitGate', () => ({
  useSubmitGate: () => ({ submit: jest.fn(), isSubmitting: false }),
}));

jest.mock('@/hooks/useManualRefresh', () => ({
  useManualRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: unknown }) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

describe('ApplicantsScreen — 확정 해제 되돌리기', () => {
  beforeEach(() => {
    mockAddToast.mockReset();
    mockCancelConfirmation.mockReset().mockResolvedValue(undefined);
    mockConfirmWithHistory.mockReset().mockResolvedValue(undefined);
  });

  it('해제는 확인 다이얼로그 없이 실행되고 되돌리기 토스트를 남긴다', async () => {
    const { getByTestId } = render(<ApplicantsScreen />);

    fireEvent.press(getByTestId('cancel-confirmation'));

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    expect(mockCancelConfirmation).toHaveBeenCalledWith({ applicationId: 'application-1' });

    const toast = mockAddToast.mock.calls[0][0];
    expect(toast.message).toContain('확정을 해제했어요');
    expect(toast.action.label).toBe('되돌리기');
  });

  it('되돌리기는 해제 전에 캡처한 배정으로 재확정한다', async () => {
    const { getByTestId } = render(<ApplicantsScreen />);

    fireEvent.press(getByTestId('cancel-confirmation'));
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    mockAddToast.mock.calls[0][0].action.onPress();

    expect(mockConfirmWithHistory).toHaveBeenCalledWith({
      applicationId: 'application-1',
      selectedAssignments: mockApplicant.assignments,
    });
  });

  it('같은 지원자를 연타해도 해제는 한 번만 나간다', async () => {
    // 첫 호출을 보류시켜 in-flight 상태를 만든다 — 가드가 없으면 두 번째가 그대로 통과한다.
    let release: (() => void) | undefined;
    mockCancelConfirmation.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );

    const { getByTestId } = render(<ApplicantsScreen />);

    fireEvent.press(getByTestId('cancel-confirmation'));
    fireEvent.press(getByTestId('cancel-confirmation'));

    expect(mockCancelConfirmation).toHaveBeenCalledTimes(1);

    release?.();
    await waitFor(() => expect(mockAddToast).toHaveBeenCalledTimes(1));
  });
});
