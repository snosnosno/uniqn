/**
 * VenueDayDetail — 로딩/에러/빈 상태/슬롯 렌더 4분기 검증(U4) + 출처 칩(구인자 IA S4)
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
import { usePostingTitles, useVenueDaySlots } from '@/hooks/workSchedule';
import type { VenueDaySlot } from '@/repositories/workSchedule';

jest.mock('@/hooks/workSchedule', () => ({
  useVenueDaySlots: jest.fn(),
  usePostingTitles: jest.fn(),
}));

// ConfirmedStaffCard 는 프로필 훅 등 무거운 의존 — 이름만 렌더하는 목으로 대체(카드 수 검증용).
// 빼기 콜백 전달 여부와 출처(문구·누를 수 있는지)도 함께 드러낸다.
jest.mock('@/components/employer/applicants/ConfirmedStaffCard', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    ConfirmedStaffCard: ({
      staff,
      onDelete,
      source,
    }: {
      staff: { staffName: string };
      onDelete?: unknown;
      source?: { label: string; onPress?: () => void };
    }) => (
      <View>
        <Text>{`${staff.staffName}${onDelete ? ' [빼기가능]' : ''}`}</Text>
        {source ? (
          <Pressable testID={`source-${staff.staffName}`} onPress={source.onPress}>
            <Text>{`${source.label}${source.onPress ? ' [이동가능]' : ''}`}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockUsePostingTitles = usePostingTitles as unknown as jest.Mock;

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
    checkInTs: null,
    checkOutTs: null,
    payrollStatus: null,
    date: '2026-07-05',
    ...overrides,
  };
}

function loaded(data: VenueDaySlot[]) {
  mockUseDaySlots.mockReturnValue({
    data,
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });
}

beforeEach(() => {
  mockUseDaySlots.mockReset();
  mockUsePostingTitles.mockReset();
  mockUsePostingTitles.mockReturnValue(new Map());
});

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
  loaded([]);

  const { getByText } = render(
    <VenueDayDetail venueId="v1" date="2026-07-05" onAddPress={onAddPress} />
  );

  expect(getByText('이 날 근무 인원이 없어요')).toBeTruthy();
  fireEvent.press(getByText('근무 추가하기'));
  expect(onAddPress).toHaveBeenCalledTimes(1);
});

it('슬롯 2건: 카드 2개(이름) 렌더', () => {
  loaded([
    makeSlot({ workLogId: 'wl-1', staffId: 'staff-1', staffName: '김딜러' }),
    makeSlot({ workLogId: 'wl-2', staffId: 'staff-2', staffName: '이플로어' }),
  ]);

  const { getByText } = render(<VenueDayDetail venueId="v1" date="2026-07-05" />);

  expect(getByText('김딜러')).toBeTruthy();
  expect(getByText('이플로어')).toBeTruthy();
});

it('체크인 이후에는 빼기 콜백을 카드에 전달하지 않는다', () => {
  loaded([makeSlot({ status: 'checked_in' })]);

  const { getByText } = render(
    <VenueDayDetail venueId="v1" date="2026-07-05" onSlotDelete={jest.fn()} />
  );

  expect(getByText('김딜러')).toBeTruthy();
});

it('출근 예정 배치에는 빼기 콜백을 전달한다', () => {
  loaded([makeSlot({ status: 'scheduled' })]);

  const { getByText } = render(
    <VenueDayDetail venueId="v1" date="2026-07-05" onSlotDelete={jest.fn()} />
  );

  expect(getByText('김딜러 [빼기가능]')).toBeTruthy();
});

describe('출처 칩 (구인자 IA S4)', () => {
  const SLOTS = [
    makeSlot({ workLogId: 'wl-1', staffName: '김딜러', jobPostingId: 'v1', isContainer: true }),
    makeSlot({
      workLogId: 'wl-2',
      staffName: '이플로어',
      jobPostingId: 'jp-1',
      isContainer: false,
    }),
    makeSlot({ workLogId: 'wl-3', staffName: '박서빙', jobPostingId: 'jp-2', isContainer: false }),
  ];

  it('공고 id 만 모아 제목을 조회한다 — 컨테이너 직속은 조회하지 않는다', () => {
    loaded(SLOTS);

    render(<VenueDayDetail venueId="v1" date="2026-07-05" />);

    expect(mockUsePostingTitles).toHaveBeenLastCalledWith(['jp-1', 'jp-2']);
  });

  it('직접 배치 · 제목 있는 공고 · 제목 모르는 공고를 구분해 보인다', () => {
    loaded(SLOTS);
    mockUsePostingTitles.mockReturnValue(new Map([['jp-1', '토요일 딜러 4명']]));

    const { getByText } = render(
      <VenueDayDetail venueId="v1" date="2026-07-05" onSourcePress={jest.fn()} />
    );

    expect(getByText('직접 배치')).toBeTruthy();
    expect(getByText('토요일 딜러 4명 공고에서 [이동가능]')).toBeTruthy();
    expect(getByText('공고에서 [이동가능]')).toBeTruthy();
  });

  it('공고 출처를 누르면 그 공고 id 로 콜백을 부르고, 직접 배치는 누를 수 없다', () => {
    loaded(SLOTS);
    mockUsePostingTitles.mockReturnValue(new Map([['jp-1', '토요일 딜러 4명']]));
    const onSourcePress = jest.fn();

    const { getByTestId, getByText } = render(
      <VenueDayDetail venueId="v1" date="2026-07-05" onSourcePress={onSourcePress} />
    );

    fireEvent.press(getByTestId('source-이플로어'));
    expect(onSourcePress).toHaveBeenCalledWith('jp-1');

    // 직접 배치는 이동 대상이 없다.
    expect(getByText('직접 배치')).toBeTruthy();
    fireEvent.press(getByTestId('source-김딜러'));
    expect(onSourcePress).toHaveBeenCalledTimes(1);
  });

  it('onSourcePress 가 없으면 공고 출처도 표시만 한다', () => {
    loaded(SLOTS);
    mockUsePostingTitles.mockReturnValue(new Map([['jp-1', '토요일 딜러 4명']]));

    const { getByText } = render(<VenueDayDetail venueId="v1" date="2026-07-05" />);

    expect(getByText('토요일 딜러 4명 공고에서')).toBeTruthy();
  });
});
