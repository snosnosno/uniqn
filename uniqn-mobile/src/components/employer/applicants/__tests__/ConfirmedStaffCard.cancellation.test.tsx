/**
 * ConfirmedStaffCard — 취소 요청 줄 (구인자 IA S1b)
 *
 * 고정하는 계약:
 *  1. 검토 대기 취소 요청이 있는 줄에만 `취소 요청` 띠가 뜬다. 없으면 자리도 없다.
 *  2. 띠에는 사유가 보이고, 스크린리더 라벨에도 사유가 들어간다(accessible 컨테이너의 자식 Text 는 낭독되지 않는다).
 *  3. [거절] [승인] 은 줄의 staff 와 요청을 그대로 넘긴다.
 *  4. [전화] 는 번호가 있을 때만 그린다.
 *  5. 처리 중이면 이 줄의 버튼만 잠근다.
 *
 * ⚠️ `accessibilityState` 는 react-native-web 에서 무효라 잠금 판정에 쓰지 않는다 — onPress 미호출로 본다.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { PendingCancellation } from '@/domains/application/pendingCancellationIndex';
import type { ConfirmedStaff } from '@/types';

import { ConfirmedStaffCard } from '../ConfirmedStaffCard';

const mockOpenExternalUrl = jest.fn();

jest.mock('@/utils/externalLink', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    displayName: '김딜러',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: null,
  }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

const STAFF = {
  id: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  role: 'dealer',
  date: '2026-09-20',
  status: 'scheduled',
  timeSlot: '19:00',
  workLog: { applicationId: 'app-1' },
} as unknown as ConfirmedStaff;

const CANCELLATION: PendingCancellation = {
  applicationId: 'app-1',
  reason: '개인 사정으로 참석이 어렵습니다',
  requestedAt: '2026-09-14T01:00:00.000Z',
  phone: '01012345678',
};

function renderCard(props: Partial<React.ComponentProps<typeof ConfirmedStaffCard>> = {}) {
  return render(<ConfirmedStaffCard staff={STAFF} showActions {...props} />);
}

describe('ConfirmedStaffCard — 취소 요청 줄', () => {
  beforeEach(() => {
    mockOpenExternalUrl.mockReset();
  });

  it('취소 요청이 없으면 띠를 렌더하지 않는다', () => {
    renderCard({ onApproveCancellation: jest.fn(), onRejectCancellation: jest.fn() });

    expect(screen.queryByTestId('card-cancellation-request')).toBeNull();
  });

  it('취소 요청이 있으면 `취소 요청` 과 사유를 보여주고, 라벨에도 사유를 싣는다', () => {
    renderCard({
      cancellation: CANCELLATION,
      onApproveCancellation: jest.fn(),
      onRejectCancellation: jest.fn(),
    });

    expect(screen.getByTestId('card-cancellation-request')).toBeTruthy();
    expect(screen.getByText('취소 요청')).toBeTruthy();
    expect(screen.getByText('개인 사정으로 참석이 어렵습니다')).toBeTruthy();
    expect(screen.getByLabelText('취소 요청. 사유: 개인 사정으로 참석이 어렵습니다')).toBeTruthy();
  });

  it('[승인] 과 [거절] 은 줄과 요청을 그대로 넘긴다', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    renderCard({
      cancellation: CANCELLATION,
      onApproveCancellation: onApprove,
      onRejectCancellation: onReject,
    });

    fireEvent.press(screen.getByLabelText('김딜러 취소 요청 승인'));
    fireEvent.press(screen.getByLabelText('김딜러 취소 요청 거절'));

    expect(onApprove).toHaveBeenCalledWith(STAFF, CANCELLATION);
    expect(onReject).toHaveBeenCalledWith(STAFF, CANCELLATION);
  });

  it('[전화] 는 tel: 링크를 외부 링크 유틸로 연다', () => {
    renderCard({
      cancellation: CANCELLATION,
      onApproveCancellation: jest.fn(),
      onRejectCancellation: jest.fn(),
    });

    fireEvent.press(screen.getByLabelText('김딜러에게 전화'));

    expect(mockOpenExternalUrl).toHaveBeenCalledWith(
      'tel:01012345678',
      expect.objectContaining({ fallbackTitle: '전화 앱을 열 수 없어요' })
    );
  });

  it('번호가 없으면 [전화] 를 그리지 않는다', () => {
    renderCard({
      cancellation: { ...CANCELLATION, phone: undefined },
      onApproveCancellation: jest.fn(),
      onRejectCancellation: jest.fn(),
    });

    expect(screen.queryByLabelText('김딜러에게 전화')).toBeNull();
    expect(screen.getByLabelText('김딜러 취소 요청 승인')).toBeTruthy();
  });

  it('처리 중이면 이 줄의 승인·거절이 눌리지 않는다', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    renderCard({
      cancellation: CANCELLATION,
      onApproveCancellation: onApprove,
      onRejectCancellation: onReject,
      isCancellationProcessing: true,
    });

    fireEvent.press(screen.getByLabelText('김딜러 취소 요청 승인'));
    fireEvent.press(screen.getByLabelText('김딜러 취소 요청 거절'));

    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });
});
