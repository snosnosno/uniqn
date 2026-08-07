/**
 * VenueDayPanel — 근무표 진입점이 통합 편집 시트에 무엇을 넘기는가 (Task 8)
 *
 * 이 스위트는 시트 내부 로직이 아니라 **배선**을 고정한다. 시트는 진짜를 렌더하고
 * (SheetModal/피커만 가볍게 대체), 슬롯 → `initial` 매핑이 실제 화면에 드러나는지를 본다.
 * 목으로 시트를 지우면 배선 오류가 전부 통과하므로 그렇게 하지 않는다.
 *
 * 고정하는 계약 넷:
 *  1. 🔴 `isContainer` 게이트 제거 — 공고 스팬 슬롯에서도 실적을 편집할 수 있다(설계 결함 ②).
 *     실적 값은 슬롯이 직접 들고 온다(Task 2 읽기 RPC) — `useConfirmedStaff` 해소가 아니다.
 *  2. 🔴 `status` 실값 전달 — 노쇼 행 배지가 "저장하면 출근이 됩니다"라고 거짓말하지 않는다.
 *     `null` 로 얼버무리면 배지가 시각에서 파생돼 '출근 예정'이 뜬다(= 이 단언이 red).
 *  3. 🔴 `scheduledUnreadable` 실값 전달 — 레거시 자유 텍스트('저녁 6시')는 "읽을 수 없음"으로
 *     들어가야 미정 선택이 **실제 변경**이 된다. `false` 로 대충 채우면 안내가 사라진다(= red).
 *  4. 빼기는 시트 푸터가 아니라 **카드 액션**이다(설계 §3-4).
 *
 * ⚠️ `toHaveTextContent(문자열)` 은 RNTL 13.3.3 에서 완전일치다 — 부분 확인은 정규식으로.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { useSetVenueSoftTarget, useVenueDaySlots, useUpdateSlot } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';

import { VenueDayPanel } from '../VenueDayPanel';

// SheetModal 은 RNModal + reanimated 라 무겁다 — children/footer/overlay 를 그대로 편다.
jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer, overlay }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

// 휠 피커는 reanimated 스크롤이라 그대로 못 쓴다 — 열림 여부만 드러내는 스텁.
jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, title }: any) =>
      visible ? <Text>{`피커 열림: ${title}`}</Text> : null,
  };
});

jest.mock('@/hooks/workSchedule', () => ({
  useSetVenueSoftTarget: jest.fn(),
  useVenueDaySlots: jest.fn(),
  useUpdateSlot: jest.fn(),
  useDeleteSlot: jest.fn(),
  // 3-C 일괄 변경 시트가 쓰는 훅 — 이 파일의 관심 밖이지만 명시 목이라 빠뜨리면 렌더가 죽는다.
  useUpdatePostingSlotTime: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));
jest.mock('@/stores/authStore', () => ({ useUser: jest.fn(() => ({ uid: 'u1' })) }));
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
jest.mock('../AddSlotSheet', () => ({ AddSlotSheet: () => null }));
jest.mock('../SlotTimeChangeSheet', () => ({ SlotTimeChangeSheet: () => null }));

// 상세 목: 슬롯 행 탭(=편집 시트 열기)과 빼기(카드 액션)를 버튼으로 대체.
jest.mock('../VenueDayDetail', () => {
  const { Text, Pressable, View } = require('react-native');
  return {
    VenueDayDetail: ({
      onSlotPress,
      onSlotDelete,
    }: {
      onSlotPress?: (s: unknown) => void;
      onSlotDelete?: (s: unknown) => void;
    }) => (
      <View>
        <Pressable
          onPress={() => onSlotPress?.((globalThis as Record<string, unknown>).__TEST_SLOT__)}
        >
          <Text>슬롯 열기</Text>
        </Pressable>
        {onSlotDelete ? (
          <Pressable
            onPress={() => onSlotDelete((globalThis as Record<string, unknown>).__TEST_SLOT__)}
          >
            <Text>카드 빼기</Text>
          </Pressable>
        ) : (
          <Text>카드 빼기 없음</Text>
        )}
      </View>
    ),
  };
});

const mockUseSoftTarget = useSetVenueSoftTarget as unknown as jest.Mock;
const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockUseUpdateSlot = useUpdateSlot as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;

const toastErrorSpy = jest.fn();

/**
 * 공고 스팬 슬롯(= 컨테이너 직속이 아님) + 실적 기록 있음.
 * 옛 구현은 `isContainer: false` 에서 실적 입구를 통째로 지웠다.
 */
const SPAN_SLOT = {
  workLogId: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  staffNickname: null,
  staffPhotoUrl: null,
  role: 'dealer',
  customRole: null,
  timeSlot: '19:00',
  status: 'checked_in',
  jobPostingId: 'posting-1',
  isContainer: false,
  color: null,
  notes: null,
  // 로컬 시각으로 만든다 — jest.config 에 TZ 고정이 없다.
  checkInTs: new Date(2026, 6, 5, 19, 4).toISOString(),
  checkOutTs: null,
  payrollStatus: null,
  date: '2026-07-05',
};

function setSlot(overrides: Record<string, unknown> = {}) {
  const slot = { ...SPAN_SLOT, ...overrides };
  (globalThis as Record<string, unknown>).__TEST_SLOT__ = slot;
  mockUseDaySlots.mockReturnValue({ data: [slot] });
}

beforeEach(() => {
  toastErrorSpy.mockReset();
  mockUseSoftTarget.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockUseUpdateSlot.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: jest.fn(), error: toastErrorSpy, info: jest.fn() })
  );
  setSlot();
});

function renderPanel() {
  return render(<VenueDayPanel venueId="v1" date="2026-07-05" dateLabel="7월 5일 (일)" />);
}

describe('VenueDayPanel — 통합 편집 시트 배선', () => {
  it('🔴 공고 스팬 슬롯에서도 실적을 편집할 수 있다(isContainer 게이트 제거)', () => {
    renderPanel();
    fireEvent.press(screen.getByText('슬롯 열기'));

    // 옛 구현: isContainer=false → attendance 미주입 → 실적 섹션 자체가 없었다.
    expect(screen.getByText('실제 출근')).toBeTruthy();
    expect(screen.getByText('실제 퇴근')).toBeTruthy();
    // 값의 출처가 슬롯(checkInTs)임을 못 박는다 — useConfirmedStaff 해소가 아니다.
    expect(screen.getByTestId('check-in-value')).toHaveTextContent('19:04');
  });

  it('🔴 노쇼 행의 배지는 노쇼다(status 실값 전달)', () => {
    setSlot({ status: 'no_show' });
    renderPanel();
    fireEvent.press(screen.getByText('슬롯 열기'));

    // status 를 null 로 얼버무리면 배지가 시각에서 파생돼 '출근 예정' 이 뜬다.
    expect(screen.getByTestId('status-badge')).toHaveTextContent('노쇼');
  });

  it('🔴 읽을 수 없는 레거시 예정값은 다시 고르라고 안내한다(scheduledUnreadable 실값 전달)', () => {
    setSlot({ timeSlot: '저녁 6시' });
    renderPanel();
    fireEvent.press(screen.getByText('슬롯 열기'));

    expect(screen.getByTestId('scheduled-unreadable-notice')).toBeTruthy();
  });

  it('🔴 정산 완료 건은 읽기 전용으로 연다(payrollStatus 실값 전달)', () => {
    setSlot({ payrollStatus: 'completed' });
    renderPanel();
    fireEvent.press(screen.getByText('슬롯 열기'));

    // payrollStatus 를 null 로 넘기면 잠금 안내도, 읽기 전용 푸터도 나오지 않는다.
    // ⚠️ '저장' 문구로 판정하면 안 된다 — 패널 자체의 '필요 인원 저장' 버튼이 걸린다.
    //    읽기 전용 푸터의 [닫기] 는 이 모드에서만 존재하는 판별자다.
    expect(screen.getByTestId('settled-notice')).toBeTruthy();
    expect(screen.getByLabelText('닫기')).toBeTruthy();
  });

  it('🔴 폐지된 범위 데이터는 예정 종료가 사라진다고 고지한다(hadLegacyEnd 실값 전달)', () => {
    // 시트는 시작(18:00)만 보여준다. 고지가 없으면 예정을 다시 고르는 순간 02:00 이
    // 말없이 소멸한다 — 폐기된 EditSlotSheet 가 정확히 이 상황을 알렸다.
    setSlot({ timeSlot: '18:00 - 02:00' });
    renderPanel();
    fireEvent.press(screen.getByText('슬롯 열기'));

    expect(screen.getByTestId('legacy-end-notice')).toBeTruthy();
    // 차단이 아니라 고지다 — 저장 게이트를 건드리면 안 된다(구 시트도 막지 않았다).
    expect(screen.queryByTestId('scheduled-unreadable-notice')).toBeNull();
  });

  it('빼기는 시트 푸터가 아니라 카드 액션이다(설계 §3-4)', () => {
    renderPanel();

    // 카드 쪽 입구가 산다.
    expect(screen.getByText('카드 빼기')).toBeTruthy();

    fireEvent.press(screen.getByText('슬롯 열기'));
    // 시트 푸터는 [취소][저장] 둘뿐 — '빼기' 라벨이 시트 안에 있으면 안 된다.
    expect(screen.queryByLabelText('근무 빼기')).toBeNull();
  });

  it('🔴 기록이 있는 행을 뺄 때는 무엇이 사라지는지 말한다', () => {
    // 근무표는 근태 상태로 빼기를 막지 않는다(막을 곳이 여기뿐이라 — 게이트 자체는
    // ConfirmedStaffCard.actions.test 가 고정한다). 막지 않는 대신 위험을 문구로 드러낸다.
    setSlot({ status: 'checked_in' });
    renderPanel();

    fireEvent.press(screen.getByText('카드 빼기'));

    expect(screen.getByText(/기록된 출퇴근 시각도 함께 사라져요/)).toBeTruthy();
  });

  it('기록이 없는 행에는 그 경고를 붙이지 않는다(대조군)', () => {
    setSlot({ status: 'scheduled', checkInTs: null, checkOutTs: null });
    renderPanel();

    fireEvent.press(screen.getByText('카드 빼기'));

    expect(screen.getByText(/근무에서 뺄까요/)).toBeTruthy();
    expect(screen.queryByText(/기록된 출퇴근 시각도 함께 사라져요/)).toBeNull();
  });
});
