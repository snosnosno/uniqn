/**
 * WorkLogEditSheet — 통합 편집 시트 조립 계약 테스트
 *
 * 이 스위트가 지키는 것 네 가지:
 *  1. 🔴 **dirty 축만 전송** — 스쳐 누른 칩이 `role_change_history` 를 오염시키지 않는다(§8-5).
 *  2. 🔴 **정산 완료 = 전체 읽기 전용**(D4) — 저장 버튼 자체가 없다.
 *  3. 🔴 **배지가 거짓말하지 않는다** — 노쇼 행에서 시간을 고쳐도 배지는 '노쇼'다.
 *  4. 🔴 **저장을 막아야 하는 입력은 막는다** — 출근==퇴근(구 `isValidTimeOrder` 계승).
 *
 * ⚠️ `toHaveTextContent(문자열)` 은 RNTL 13.3.3 에서 **완전일치**다. 따라서
 *    `.not.toHaveTextContent('...')` 는 언제나 통과하는 빈 가드다 — 부분 확인은 정규식으로 한다.
 *
 * ⚠️ 날짜는 **로컬 시각 생성자**로 만든다(jest.config 에 TZ 고정이 없다).
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { useUpdateSlot } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import type { JobPosting } from '@/types';

import { WorkLogEditSheet, type WorkLogEditInitial } from '../WorkLogEditSheet';

// SheetModal 은 RNModal + reanimated 라 무겁다 — children/footer/overlay 를 그대로 편다.
// overlay 를 빼면 피커가 렌더되지 않아 시각 입력 경로를 아예 못 본다(필수).
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

// 휠 피커는 reanimated 스크롤이라 그대로 못 쓴다. **열렸는지**와 **고른 값이 어떻게 조립되는지**
// 만 보면 되므로, 제목을 라벨에 담고 누르면 확정하는 스텁으로 바꾼다.
jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, title, onConfirm }: any) =>
      visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`피커 확정 ${title}`}
          onPress={() => onConfirm({ hour: 2, minute: 0 })}
        >
          <Text>{`피커 열림: ${title}`}</Text>
        </Pressable>
      ) : null,
  };
});

jest.mock('@/hooks/workSchedule', () => ({ useUpdateSlot: jest.fn() }));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockUseUpdateSlot = useUpdateSlot as unknown as jest.Mock;
const mockUseToastStore = useToastStore as unknown as jest.Mock;

const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();
let mutateSpy: jest.Mock;

const AT = (day: number, hour: number, minute = 0) => new Date(2026, 7, day, hour, minute);

const BASE_INITIAL: WorkLogEditInitial = {
  scheduledStart: '18:00',
  scheduledUnreadable: false,
  // 폐지된 범위 데이터 고지(예정 종료 소실) — 기본 픽스처는 범위가 아니라 단일값이다.
  hadLegacyEnd: false,
  checkIn: null,
  checkOut: null,
  role: 'dealer',
  customRole: null,
  color: null,
  memo: '',
  date: '2026-08-10',
  status: 'scheduled',
  payrollStatus: null,
  staffName: '김딜러',
};

beforeEach(() => {
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  mutateSpy = jest.fn();
  mockUseToastStore.mockImplementation((selector: (state: object) => unknown) =>
    selector({ success: toastSuccessSpy, error: toastErrorSpy, info: jest.fn() })
  );
  mockUseUpdateSlot.mockReturnValue({ mutate: mutateSpy, isPending: false });
});

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof WorkLogEditSheet>> = {},
  initialOverrides: Partial<WorkLogEditInitial> = {}
) {
  return render(
    <WorkLogEditSheet
      visible
      onClose={jest.fn()}
      workLogId="wl-1"
      editedBy="user-1"
      initial={{ ...BASE_INITIAL, ...initialOverrides }}
      {...overrides}
    />
  );
}

/** 퇴근 칸을 눌러 피커를 열고 02:00 을 확정한다. */
function pickCheckOutAt2() {
  fireEvent.press(screen.getByLabelText('실제 퇴근 선택'));
  fireEvent.press(screen.getByLabelText('피커 확정 실제 퇴근 시간'));
}

// ============================================================================
// 0. 레거시 unreadable 회귀 — 폐기될 EditSlotSheet 의 originalUnreadable 처리 계승
// ============================================================================

describe('WorkLogEditSheet — 읽을 수 없는 레거시 예정값', () => {
  /** `time_slot` 에 `'저녁 6시'` 같은 자유 텍스트가 남은 행. 진입점이 파싱에 실패해 넘기는 모양. */
  const LEGACY = { scheduledStart: null, scheduledUnreadable: true } as const;

  it('🔴 미정을 켜면 timeUndecided 가 실린다 — 안 그러면 값이 영영 안 지워진다', () => {
    renderSheet({}, LEGACY);

    fireEvent.press(screen.getByLabelText('출근 예정 미정'));
    fireEvent.press(screen.getByLabelText('저장'));

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy.mock.calls[0][0].input.timeUndecided).toBe(true);
  });

  it('🔴 정상 미정 행은 여전히 빈 패치다 — "미정이면 무조건 보낸다"가 되면 안 된다', () => {
    // 반대 결함 방지. 원래부터 time_slot 이 NULL 인 행은 이미 해소된 상태라 보낼 것이 없다.
    renderSheet({}, { scheduledStart: null });

    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('해소 전에는 안내를 띄우고 다른 축만 고쳐도 저장을 막는다', () => {
    renderSheet({}, LEGACY);

    expect(screen.getByTestId('scheduled-unreadable-notice')).toBeTruthy();

    // 퇴근을 고쳐 dirty 를 만들어도 예정이 미해소면 저장이 열리지 않는다.
    pickCheckOutAt2();
    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('시각을 고르면 해소돼 안내가 사라지고 저장이 열린다', () => {
    renderSheet({}, LEGACY);

    fireEvent.press(screen.getByLabelText('출근 예정 선택'));
    fireEvent.press(screen.getByLabelText('피커 확정 출근 예정 시간'));

    expect(screen.queryByTestId('scheduled-unreadable-notice')).toBeNull();
    expect(screen.getByLabelText('저장')).not.toBeDisabled();
  });

  it('정상 미정 행에는 안내를 띄우지 않는다', () => {
    renderSheet({}, { scheduledStart: null });

    expect(screen.queryByTestId('scheduled-unreadable-notice')).toBeNull();
  });
});

// ============================================================================
// 1. dirty 축만 전송
// ============================================================================

describe('WorkLogEditSheet — 안 건드린 축은 보내지 않는다 (§8-5)', () => {
  it('아무것도 안 바꾸면 저장이 비활성이다', () => {
    renderSheet();

    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('🔴 퇴근만 고치고 저장하면 역할·색·메모·예정 키가 실리지 않는다', () => {
    renderSheet();

    pickCheckOutAt2();
    fireEvent.press(screen.getByLabelText('저장'));

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    const { workLogId, input } = mutateSpy.mock.calls[0][0];

    expect(workLogId).toBe('wl-1');
    expect('checkOut' in input).toBe(true);
    expect('checkIn' in input).toBe(false);
    expect('staffRole' in input).toBe(false);
    expect('color' in input).toBe(false);
    expect('memo' in input).toBe(false);
    expect('startTime' in input).toBe(false);
    expect(input.editedBy).toBe('user-1');
  });

  it('🔴 미정을 켰다 끄면 예정 시각이 되돌아온다 — 화면은 저장될 값을 말한다', () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText('출근 예정 미정')); // 켬 → scheduledStart 가 지워진다
    fireEvent.press(screen.getByLabelText('출근 예정 미정')); // 끔 → 되돌아와야 한다

    expect(screen.getByTestId('scheduled-start-value')).toHaveTextContent('18:00');
  });

  it('미정 왕복은 변경이 아니다 — 되돌린 뒤에도 패치는 비어 있다', () => {
    // 복원이 "값을 새로 고른 것"으로 오해되면 안 된다. 서버엔 18:00 이 그대로 있다.
    renderSheet();

    fireEvent.press(screen.getByLabelText('출근 예정 미정'));
    fireEvent.press(screen.getByLabelText('출근 예정 미정'));

    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('🔴 이미 선택된 역할 칩을 다시 눌러도 저장이 열리지 않는다 (스쳐 누름 방어)', () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-dealer'));

    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('역할을 실제로 바꾸면 staffRole 만 실린다', () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-floor'));
    fireEvent.press(screen.getByLabelText('저장'));

    const { input } = mutateSpy.mock.calls[0][0];
    expect(input.staffRole).toBe('floor');
    expect('checkIn' in input).toBe(false);
    expect('checkOut' in input).toBe(false);
  });
});

// ============================================================================
// 2. 정산 완료 = 전체 읽기 전용 (D4)
// ============================================================================

describe('WorkLogEditSheet — 정산 완료 건 (D4)', () => {
  it('🔴 사유를 보여주고 저장 버튼을 아예 렌더하지 않는다', () => {
    renderSheet({}, { payrollStatus: 'completed' });

    // 문구는 `settledLockMessage` 단일 소스를 쓴다 — 같은 상황에 5번째 문구를 만들지 않는다.
    expect(screen.getByTestId('settled-notice')).toHaveTextContent(/정산이 완료된 근무는/);
    expect(screen.queryByLabelText('저장')).toBeNull();
    expect(screen.getByLabelText('닫기')).toBeTruthy();
  });

  it('🔴 실적 입력 진입 자체가 막힌다 — 눌러도 피커가 열리지 않는다', () => {
    renderSheet({}, { payrollStatus: 'completed' });

    fireEvent.press(screen.getByLabelText('실제 퇴근 선택'));

    expect(screen.queryByText(/피커 열림/)).toBeNull();
  });

  it('값 확인은 가능하다 — 진입 자체를 막지 않는다', () => {
    renderSheet({}, { payrollStatus: 'completed', checkIn: AT(10, 18), checkOut: AT(11, 2) });

    expect(screen.getByTestId('check-in-value')).toHaveTextContent('18:00');
    expect(screen.getByTestId('work-duration-value')).toHaveTextContent('8시간');
  });
});

// ============================================================================
// 3. 배지 정직성 — currentStatus 배선
// ============================================================================

describe('WorkLogEditSheet — 상태 배지는 서버가 저장할 값을 말한다', () => {
  it('🔴 노쇼 행은 출퇴근이 다 있어도 배지가 노쇼다 (서버가 상태를 바꾸지 않는다)', () => {
    renderSheet({}, { status: 'no_show', checkIn: AT(10, 18), checkOut: AT(11, 2) });

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/노쇼/);
  });

  it('🔴 열자마자는 저장 전 상태를 말한다 — 표류 행이어도 파생하지 않는다', () => {
    // 🔴 이 픽스처는 서버 pgTAP 이 스스로 인정한 표류 행이다
    //    (`work_log_slot_attendance_rpc.test.sql` 의 `wl_drift` = status='scheduled' + check_in_ts).
    //    예전 구현은 폼 값만 보고 무조건 파생해 여기서 '출근' 을 보여줬는데, 사용자가 메모만
    //    고쳐 저장하면 패치에 실적 키가 없어 서버는 scheduled 를 유지한다 — **배지가 거짓말**이다.
    //    실패 방향이 이번 작업의 원래 신고("손대지 않은 근태가 출근으로 뒤집힘")와 같다.
    renderSheet({}, { status: 'scheduled', checkIn: AT(10, 18) });

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근 예정$/);
  });

  it('실적을 건드리면 그때 파생한다 — 게이트지 침묵이 아니다', () => {
    renderSheet({}, { status: 'scheduled', checkIn: AT(10, 18) });

    pickCheckOutAt2();

    // 🔑 앵커를 붙인다. `/퇴근/` 이면 다른 값이 와도 통과할 수 있다.
    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^퇴근$/);
  });

  it('실적이 없던 행에 출근을 넣으면 배지가 출근으로 바뀐다', () => {
    renderSheet();

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근 예정$/);

    fireEvent.press(screen.getByLabelText('실제 출근 선택'));
    fireEvent.press(screen.getByLabelText('피커 확정 실제 출근 시간'));

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근$/);
  });
});

// ============================================================================
// 4. 구 편집기에서 물려받은 파생 4종
// ============================================================================

describe('WorkLogEditSheet — 총 근무 시간 · 경고 · 차단 (구 WorkTimeEditor 계승)', () => {
  it('총 근무 시간을 보여준다', () => {
    renderSheet({}, { checkIn: AT(10, 18), checkOut: AT(11, 2) });

    expect(screen.getByTestId('work-duration-value')).toHaveTextContent('8시간');
  });

  it('🔴 출근 == 퇴근이면 배너를 띄우고 저장을 막는다', () => {
    // 출근 02:00 인 행에서 퇴근도 02:00 을 고르면 두 값이 같아진다.
    renderSheet({}, { checkIn: AT(10, 2) });

    pickCheckOutAt2();

    expect(screen.getByText('출근과 퇴근 시간이 같아요. 다시 확인해주세요.')).toBeTruthy();
    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('12시간을 넘기면 경고하되 저장은 막지 않는다', () => {
    renderSheet({}, { checkIn: AT(10, 9), checkOut: AT(10, 22) });

    expect(screen.getByText(/근무 시간이 13시간이에요/)).toBeTruthy();
    // 초기값 그대로라 패치가 비어 저장이 닫혀 있다 — 경고 자체가 차단이 아님을 본다.
    expect(screen.queryByText(/출근과 퇴근 시간이 같아요/)).toBeNull();
  });

  it('🔴 퇴근이 출근보다 이르면 배너로 이유를 말한다', () => {
    // 판정(`deriveAttendanceInsight`)만으로는 저장이 막히는 이유가 화면에 없다. 배너 JSX 를
    // 지워도 저장은 여전히 막히므로, 단위 테스트만으로는 "왜 안 눌리지" 상태를 못 잡는다.
    renderSheet({}, { checkIn: AT(10, 23), checkOut: AT(10, 22) });

    expect(
      screen.getByText('퇴근이 출근보다 이릅니다. 출근 시간을 다시 확인해주세요.')
    ).toBeTruthy();
  });

  it('퇴근이 출근보다 이르면 다른 축을 고쳐도 저장이 막힌다', () => {
    renderSheet({}, { checkIn: AT(10, 23), checkOut: AT(10, 22) });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-floor'));

    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('익일 퇴근이면 안내한다', () => {
    renderSheet({}, { checkIn: AT(10, 18), checkOut: AT(11, 2) });

    expect(screen.getByText('익일 퇴근으로 계산돼요.')).toBeTruthy();
  });

  it('🔴 출근 기록이 없어도 익일 퇴근 왕복이 하루를 앞당기지 않는다', () => {
    // QR 퇴근만 찍힌 행(출근 NULL · 퇴근 익일 02:00). 피커는 화면에 보이던 02:00 에서 열리고,
    // 사용자는 **같은 값을 확정만** 한다 — 그런데 조립이 하루를 앞당기면 화면의 '(익일)' 이
    // 사라지고 손대지 않은 축이 dirty 가 된다. 출근이 없어 근태 판정도 EMPTY 라 배너도 안 뜬다.
    renderSheet({}, { checkIn: null, checkOut: AT(11, 2) });

    expect(screen.getByTestId('check-out-value')).toHaveTextContent('02:00 (익일)');

    pickCheckOutAt2();

    expect(screen.getByTestId('check-out-value')).toHaveTextContent('02:00 (익일)');
    // 값이 그대로면 보낼 것도 없다 — 하루가 앞당겨지면 여기서 저장이 열린다.
    expect(screen.getByLabelText('저장')).toBeDisabled();
  });
});

// ============================================================================
// 5. 접힘 기본값(D6) · 역할 마감 표기 배선
// ============================================================================

function createPosting(): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '마감 표기 테스트',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2026-08-10',
    workDates: ['2026-08-10'],
    totalPositions: 1,
    filledPositions: 1,
    location: { name: 'Seoul', district: 'Gangnam', detailedAddress: '101' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-08-10',
      allDates: ['2026-08-10'],
      requirements: [
        {
          date: '2026-08-10',
          timeSlots: [
            { id: 'slot-1', startTime: '18:00', roles: [{ id: 'r1', role: 'floor', count: 1 }] },
          ],
        },
      ],
    },
    roleCatalog: [],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 20000 } },
    questions: { items: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as JobPosting;
}

describe('WorkLogEditSheet — 섹션 접힘과 역할 칩 배선', () => {
  it('역할 섹션은 기본 접힘이고 요약이 지금 값을 말한다 (D6 · §3-1)', () => {
    renderSheet({}, { color: 'slot-teal' });

    expect(screen.getByText('딜러 · 청록')).toBeTruthy();
    // 접힘은 스타일 숨김이 아니라 미렌더다 — 칩이 존재하지 않아야 한다.
    expect(screen.queryByTestId('role-chip-dealer')).toBeNull();
  });

  it('기타 역할은 저장된 커스텀 이름을 요약에 보여준다', () => {
    renderSheet({}, { role: 'other', customRole: '바리스타' });

    expect(screen.getByText('기타 · 바리스타')).toBeTruthy();
  });

  it('🔴 jobPosting 과 filledByRole 을 칩까지 내려보낸다 — 마감이 표기된다', () => {
    renderSheet({ jobPosting: createPosting(), filledByRole: { floor: 1 } });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));

    expect(screen.getByText('(마감)')).toBeTruthy();
    // D7 — 표기만 하고 선택은 열려 있다.
    fireEvent.press(screen.getByTestId('role-chip-floor'));
    expect(screen.getByLabelText('저장')).not.toBeDisabled();
  });

  it('공고가 없으면 마감 표기를 생략한다 (근무표 경로 — 설계 §3-2-b)', () => {
    renderSheet({ filledByRole: { floor: 1 } });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));

    expect(screen.queryByText('(마감)')).toBeNull();
  });
});

// ============================================================================
// 7. 커스텀 역할명 배정 (기능 소실 복구 — 서버 20260807120000/130000 의 클라 짝)
// ============================================================================

/** `other` 이름이 정의된 공고 — 폐기된 `deriveAvailableRoles` 가 펼치던 그 자리다. */
function createCustomPosting(): JobPosting {
  const posting = createPosting();
  return {
    ...posting,
    schedule: {
      ...posting.schedule,
      requirements: [
        {
          date: '2026-08-10',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '18:00',
              roles: [
                { id: 'r1', role: 'floor', count: 1 },
                { id: 'r2', role: 'other', customRole: '바리스타', count: 2 },
              ],
            },
          ],
        },
      ],
    },
  } as JobPosting;
}

describe('WorkLogEditSheet — 커스텀 역할명 배정', () => {
  it('🔴 공고의 커스텀 역할로 배정하면 staffRole 과 customRole 이 한 쌍으로 실린다', () => {
    // 서버 판정표 ①. 둘 중 하나만 가면 INVALID_INPUT 이라 쌍이 유일한 합법 경로다.
    renderSheet({ jobPosting: createCustomPosting() });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-custom-바리스타'));
    fireEvent.press(screen.getByLabelText('저장'));

    const { input } = mutateSpy.mock.calls[0][0];
    expect(input.staffRole).toBe('other');
    expect(input.customRole).toBe('바리스타');
    // 손대지 않은 축은 여전히 키가 없다.
    expect('checkIn' in input).toBe(false);
    expect('memo' in input).toBe(false);
  });

  it('🔴 이름만 바꾸면 staffRole 없이 customRole 만 실린다 (판정표 ④)', () => {
    const posting = createCustomPosting();
    renderSheet(
      { jobPosting: posting },
      // 이미 다른 이름의 기타로 저장된 행 — 공고에 없는 이름이라 자기 칩이 함께 떠야 한다.
      { role: 'other', customRole: '플로어장' }
    );

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-custom-바리스타'));
    fireEvent.press(screen.getByLabelText('저장'));

    const { input } = mutateSpy.mock.calls[0][0];
    expect(input.customRole).toBe('바리스타');
    expect('staffRole' in input).toBe(false);
  });

  it('🔴 표준 역할로 옮기면 customRole 키를 만들지 않는다 (판정표 ③ 회피)', () => {
    renderSheet({ jobPosting: createCustomPosting() }, { role: 'other', customRole: '바리스타' });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-floor'));
    fireEvent.press(screen.getByLabelText('저장'));

    const { input } = mutateSpy.mock.calls[0][0];
    expect(input.staffRole).toBe('floor');
    expect('customRole' in input).toBe(false);
  });

  it('"기타" 칩은 이름을 지운다 — 이름 삭제는 역할 삭제가 아니다 (판정표 ⑥)', () => {
    renderSheet({ jobPosting: createCustomPosting() }, { role: 'other', customRole: '바리스타' });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByLabelText('역할 기타'));
    fireEvent.press(screen.getByLabelText('저장'));

    const { input } = mutateSpy.mock.calls[0][0];
    expect('customRole' in input).toBe(true);
    expect(input.customRole).toBeNull();
    expect('staffRole' in input).toBe(false);
  });

  it('🔴 지운 이름을 되돌릴 칩이 화면에 남는다 — 공고에 없는 이름이어도', () => {
    // 근무표 경로(공고 없음)가 이 경우다. 칩이 없으면 한 번 스친 순간 되돌릴 방법이 없다.
    renderSheet({}, { role: 'other', customRole: '바리스타' });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByLabelText('역할 기타'));
    expect(screen.getByText('이름 없는 기타 역할로 저장돼요.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('role-chip-custom-바리스타'));

    // 되돌아왔으니 보낼 것이 없다.
    expect(screen.getByLabelText('저장')).toBeDisabled();
  });

  it('🔴 표류 행에서 딜러 칩이 선택돼 있다 — 화면이 스스로와 어긋나지 않는다', () => {
    // `role='dealer'` + `custom_role='바리스타'`(정합 CHECK 없음). 선택 판정이 원시 비교면
    // 표준 칩도 이름 칩도 안 켜지는데, 접힘 요약은 `딜러` 라고 말한다.
    renderSheet({}, { role: 'dealer', customRole: '바리스타' });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));

    expect(screen.getByTestId('role-chip-dealer-selected')).toBeTruthy();
    expect(screen.queryByTestId('role-chip-custom-바리스타-selected')).toBeNull();
  });

  it('🔴 표류 행에서 "기타" 를 고르면 안내 문구대로 이름이 지워진다', () => {
    // 안내("이름 없는 기타 역할로 저장돼요.")와 실제 저장이 어긋나면 안 된다. 서버는 안 보낸
    // 축에 원시 custom_role 을 쓰므로, 클라가 customRole:null 을 명시해야 문구가 사실이 된다.
    renderSheet({}, { role: 'floor', customRole: '바리스타' });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByLabelText('역할 기타'));

    expect(screen.getByText('이름 없는 기타 역할로 저장돼요.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('저장'));

    const { input } = mutateSpy.mock.calls[0][0];
    expect(input.staffRole).toBe('other');
    expect('customRole' in input).toBe(true);
    expect(input.customRole).toBeNull();
  });

  it('요약이 고른 이름을 말한다 (접힌 줄은 숨김이 아니라 읽기다)', () => {
    // 🔑 요약은 `initial` 이 아니라 **폼의 현재 값**을 읽어야 한다. `initial` 을 읽으면
    //    이름을 바꾼 뒤 접었을 때 접힌 줄만 옛 이름을 말한다.
    //    (요약 줄은 접혔을 때만 렌더된다 — `CollapsibleSection:58-65`.)
    renderSheet({ jobPosting: createCustomPosting() });

    fireEvent.press(screen.getByLabelText('역할 펼치기'));
    fireEvent.press(screen.getByTestId('role-chip-custom-바리스타'));
    fireEvent.press(screen.getByLabelText('역할 접기'));

    expect(screen.getByText('기타 · 바리스타')).toBeTruthy();
  });
});

// ============================================================================
// 6. 저장 결과 처리
// ============================================================================

describe('WorkLogEditSheet — 저장 결과', () => {
  it('성공하면 토스트 + onSaved + onClose 를 부른다', () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();
    mutateSpy.mockImplementation((_vars, options) => options.onSuccess());

    renderSheet({ onSaved, onClose });
    pickCheckOutAt2();
    fireEvent.press(screen.getByLabelText('저장'));

    expect(toastSuccessSpy).toHaveBeenCalledWith('근무 정보를 수정했어요.');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('실패하면 에러 토스트를 띄우고 시트를 닫지 않는다', () => {
    const onClose = jest.fn();
    mutateSpy.mockImplementation((_vars, options) => options.onError(new Error('boom')));

    renderSheet({ onClose });
    pickCheckOutAt2();
    fireEvent.press(screen.getByLabelText('저장'));

    expect(toastErrorSpy).toHaveBeenCalledWith('수정에 실패했어요. 잠시 후 다시 시도해주세요.');
    expect(onClose).not.toHaveBeenCalled();
  });
});
