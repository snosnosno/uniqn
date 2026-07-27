/**
 * VenueDayDetail — 로딩/에러/빈 상태/슬롯 렌더 4분기 검증(U4)
 *
 * useVenueDaySlots 결과에 따라 (1) 로딩 인디케이터, (2) 에러 + 재시도, (3) 빈 상태 CTA,
 * (4) 슬롯 카드 목록 중 하나를 그리는지 검증한다. ConfirmedStaffCard 는 무거운 의존(프로필 훅)이라
 * 이름 Text 만 렌더하는 목으로 대체 → buildVenueDayGroup 투영 결과(그룹 staff 수)만큼 카드가 나오는지 확인.
 *
 * 주의: ErrorState 는 compact 모드라 title 프롭('배치를 불러오지 못했어요')을 렌더하지 않고
 * 에러 메시지 + 재시도만 노출한다. 따라서 에러 분기는 재시도 라벨/refetch 로 식별한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { VenueDayDetail } from '../VenueDayDetail';
import { useVenueDaySlots } from '@/hooks/workSchedule';
import type { VenueDaySlot } from '@/repositories/workSchedule';

jest.mock('@/hooks/workSchedule', () => ({ useVenueDaySlots: jest.fn() }));

// ConfirmedStaffCard 는 프로필 훅 등 무거운 의존 — 이름만 렌더하는 목으로 대체(카드 수 검증용).
jest.mock('@/components/employer/applicants/ConfirmedStaffCard', () => {
  const { Text } = require('react-native');
  return {
    ConfirmedStaffCard: ({ staff }: { staff: { staffName: string } }) => (
      <Text>{staff.staffName}</Text>
    ),
  };
});

const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;

function makeSlot(overrides: Partial<VenueDaySlot> = {}): VenueDaySlot {
  return {
    workLogId: 'wl-1',
    staffId: 'staff-1',
    staffName: '김딜러',
    staffNickname: null,
    staffPhotoUrl: null,
    role: 'dealer',
    customRole: null,
    timeSlot: '18:00~02:00',
    status: 'scheduled',
    jobPostingId: 'jp-1',
    isContainer: true,
    color: null,
    notes: null,
    ...overrides,
  };
}

beforeEach(() => mockUseDaySlots.mockReset());

it('로딩 중(초기 fetch, isRefetching=false): 로딩 인디케이터 렌더', () => {
  mockUseDaySlots.mockReturnValue({
    data: undefined,
    isLoading: true,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });

  const { UNSAFE_getByType } = render(<VenueDayDetail venueId="v1" date="2026-07-05" />);

  expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
});

it('에러: 재시도 노출 + 탭 시 refetch 호출', () => {
  const refetch = jest.fn();
  mockUseDaySlots.mockReturnValue({
    data: undefined,
    isLoading: false,
    isRefetching: false,
    error: new Error('네트워크 오류'),
    refetch,
  });

  const { getByLabelText } = render(<VenueDayDetail venueId="v1" date="2026-07-05" />);

  fireEvent.press(getByLabelText('다시 시도'));

  expect(refetch).toHaveBeenCalledTimes(1);
});

it('빈 배열: 빈 상태 안내 + onAddPress 제공 시 "근무 추가하기" 탭 → 콜백 호출', () => {
  const onAddPress = jest.fn();
  mockUseDaySlots.mockReturnValue({
    data: [],
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });

  const { getByText } = render(
    <VenueDayDetail venueId="v1" date="2026-07-05" onAddPress={onAddPress} />
  );

  expect(getByText('이 날 근무 인원이 없어요')).toBeTruthy();
  fireEvent.press(getByText('근무 추가하기'));
  expect(onAddPress).toHaveBeenCalledTimes(1);
});

it('슬롯 2건: 카드 2개(이름) 렌더', () => {
  mockUseDaySlots.mockReturnValue({
    data: [
      makeSlot({ workLogId: 'wl-1', staffId: 'staff-1', staffName: '김딜러' }),
      makeSlot({ workLogId: 'wl-2', staffId: 'staff-2', staffName: '이플로어' }),
    ],
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });

  const { getByText } = render(<VenueDayDetail venueId="v1" date="2026-07-05" />);

  expect(getByText('김딜러')).toBeTruthy();
  expect(getByText('이플로어')).toBeTruthy();
});
