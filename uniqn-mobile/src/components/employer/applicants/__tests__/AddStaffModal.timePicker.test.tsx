/**
 * AddStaffModal — 자유 텍스트 시간 입력 폐지 회귀 가드 (2-A)
 *
 * 원래 결함: 시간대가 '예: 18:00~02:00' 플레이스홀더의 **자유 입력**이라, 검증 없이 임의 문자열
 * (범위·오타·한글)이 그대로 `work_logs.time_slot` 으로 들어갔다. 같은 컬럼을 QR 대상 선택·정산·
 * 표시가 전부 파싱하는데도 형제 경로(addSlotPayload)만 'HH:mm' 을 강제하고 여기만 뚫려 있었다.
 *
 * 고정하는 계약:
 *  1. 자유 텍스트 입력이 존재하지 않는다(부활 금지).
 *  2. 시간을 고르지도 '미정'을 체크하지도 않으면 추가할 수 없다(저장 게이트 · 결정 4).
 *  3. '미정'이면 timeSlot 을 아예 싣지 않는다(시간 미기록 — 지원/확정 모델과 동일).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { AddStaffModal } from '../AddStaffModal';
import { useStaffNicknameSearch } from '@/hooks/useStaffNicknameSearch';
import { useToastStore } from '@/stores/toastStore';

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

jest.mock('@/components/ui/TimeWheelPicker', () => ({
  TimeWheelPicker: () => null,
}));

// 날짜 선택은 이 테스트의 대상이 아니다 — 탭 한 번으로 고정 날짜를 넣는 버튼으로 대체.
jest.mock('@/components/ui/CalendarPicker', () => {
  const { Text, Pressable } = require('react-native');
  return {
    CalendarPicker: ({ onChange }: { onChange: (d: Date) => void }) => (
      <Pressable onPress={() => onChange(new Date('2026-08-01T00:00:00'))}>
        <Text>날짜 고르기</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/hooks/useStaffNicknameSearch', () => ({ useStaffNicknameSearch: jest.fn() }));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockUseNicknameSearch = useStaffNicknameSearch as unknown as jest.Mock;
const mockUseToastStore = useToastStore as unknown as jest.Mock;

const onSubmitMock = jest.fn();
const addToastMock = jest.fn();

beforeEach(() => {
  onSubmitMock.mockReset().mockResolvedValue(undefined);
  addToastMock.mockReset();
  mockUseNicknameSearch.mockReturnValue({
    reset: jest.fn(),
    search: jest.fn(),
    isSearching: false,
    searched: true,
    results: [{ uid: 'staff-9', name: '홍길동', nickname: null, region: null, photoURL: null }],
    error: null,
  });
  mockUseToastStore.mockImplementation((selector?: (s: object) => unknown) => {
    const state = { addToast: addToastMock };
    return selector ? selector(state) : state;
  });
});

function renderModal() {
  return render(
    <AddStaffModal visible onClose={jest.fn()} jobPostingId="jp-1" onSubmit={onSubmitMock} />
  );
}

/** 가입자 선택 → 날짜 선택 → 역할 선택까지 진행(시간 축은 호출측이 결정). */
function fillUpToRole(api: ReturnType<typeof renderModal>) {
  fireEvent.press(api.getByText('홍길동'));
  fireEvent.press(api.getByLabelText('근무 날짜 선택'));
  fireEvent.press(api.getByText('날짜 고르기'));
  fireEvent.press(api.getByText('🃏 딜러'));
}

describe('AddStaffModal — 시간 입력', () => {
  it('자유 텍스트 시간 입력이 존재하지 않는다(부활 금지)', () => {
    const api = renderModal();
    fillUpToRole(api);

    expect(api.queryByPlaceholderText('예: 18:00~02:00')).toBeNull();
    expect(api.queryByText('시간대 (선택)')).toBeNull();
    // 대신 피커 트리거가 있다.
    expect(api.getByText('출근 예정')).toBeTruthy();
    expect(api.getByText('시간 선택')).toBeTruthy();
  });

  it('시간을 고르지도 미정을 체크하지도 않으면 추가할 수 없다(저장 게이트)', () => {
    const api = renderModal();
    fillUpToRole(api);

    fireEvent.press(api.getByText('추가'));

    expect(onSubmitMock).not.toHaveBeenCalled();
  });

  it("'미정' 체크 후 추가하면 timeSlot 을 싣지 않는다(시간 미기록)", () => {
    const api = renderModal();
    fillUpToRole(api);

    fireEvent.press(api.getByText('미정'));
    fireEvent.press(api.getByText('추가'));

    expect(onSubmitMock).toHaveBeenCalledTimes(1);
    const input = onSubmitMock.mock.calls[0][0] as {
      jobPostingId: string;
      staffId: string;
      assignments: Record<string, unknown>[];
    };
    expect(input.jobPostingId).toBe('jp-1');
    expect(input.staffId).toBe('staff-9');
    expect(input.assignments).toHaveLength(1);
    // write 경계 빌더가 날짜를 YYYY-MM-DD 로 정규화한다(E5).
    expect(input.assignments[0].date).toBe('2026-08-01');
    expect(input.assignments[0].role).toBe('dealer');
    expect(input.assignments[0]).not.toHaveProperty('timeSlot');
  });
});
