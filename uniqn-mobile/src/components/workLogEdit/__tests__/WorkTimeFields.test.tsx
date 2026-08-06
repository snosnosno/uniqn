/**
 * WorkTimeFields — 예정·실적 분리 계약 테스트
 *
 * 🔴 이 스위트의 존재 이유는 회귀 방지다. 폐지될 WorkTimeEditor 는 실제 출근 기록이 없으면
 *    예정 시각을 출근 칸에 프리필했고, 그래서 퇴근만 고쳐도 예정 값이 check_in_ts 로 저장돼
 *    근태 상태가 '출근'으로 뒤집혔다(사용자 신고). 첫 테스트가 그 프리필의 부활을 막는다.
 *
 * ⚠️ 날짜는 **로컬 시각 생성자**(new Date(y, m, d, h, min))로 만든다. ISO+09:00 리터럴은
 *    러너 타임존에 따라 getHours() 가 달라져 표시 단언이 흔들린다(jest.config 에 TZ 고정 없음).
 *
 * ⚠️ `currentStatus` 는 **필수 prop(undefined 허용)** 이다. 모르는 경우를 테스트할 때도
 *    `currentStatus={undefined}` 를 명시한다 — 호출부가 "이 값을 아는가"를 건너뛰지 못하게 하는
 *    타입 계약이라, 테스트가 그 계약을 우회하면 계약을 세운 이유가 없어진다.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

import { WorkTimeFields, applyPickedTime, type WorkTimeFieldsValue } from '../WorkTimeFields';

const BASE_DATE = new Date(2026, 7, 10); // 2026-08-10 00:00 로컬

/** 기본값 — 각 테스트가 필요한 축만 덮어쓴다. */
function makeValue(overrides: Partial<WorkTimeFieldsValue> = {}): WorkTimeFieldsValue {
  return {
    scheduledStart: '18:00',
    scheduledUndecided: false,
    checkIn: null,
    checkOut: null,
    ...overrides,
  };
}

describe('WorkTimeFields — 예정과 실적의 분리', () => {
  it('🔴 실제 출근이 없으면 출근 칸을 예정 시각으로 채우지 않는다', () => {
    render(
      <WorkTimeFields
        value={makeValue()}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    // 예정은 보이고
    expect(screen.getByText('18:00')).toBeTruthy();
    // 출근 칸은 비어 있다 — '18:00' 이 출근 자리에 복제되면 안 된다
    expect(screen.getByTestId('check-in-value')).toHaveTextContent('—');
  });

  it('[예정대로 기록] 을 누르면 출근이 예정 시각으로 채워진다', () => {
    const onChange = jest.fn();
    render(
      <WorkTimeFields
        value={makeValue()}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={onChange}
      />
    );

    fireEvent.press(screen.getByLabelText('예정대로 출근 기록'));

    const next = onChange.mock.calls[0][0];
    expect(next.checkIn).not.toBeNull();
    expect(next.checkIn.getHours()).toBe(18);
    expect(next.checkIn.getMinutes()).toBe(0);
  });

  it('예정이 미정이면 [예정대로 기록] 버튼을 렌더하지 않는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ scheduledStart: null, scheduledUndecided: true })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('예정대로 출근 기록')).toBeNull();
  });

  it('출근이 있으면 상태 배지가 "출근"으로 미리 바뀐다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 5) })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    // 정확 일치로 본다 — '출근 예정' 도 '출근' 을 부분 포함하므로 부분일치 단언은 빈 통과다.
    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근$/);
  });

  it('[예정대로 기록] 은 원본 value 를 변형하지 않는다(불변성)', () => {
    const value = makeValue();
    const onChange = jest.fn();
    render(
      <WorkTimeFields
        value={value}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={onChange}
      />
    );

    fireEvent.press(screen.getByLabelText('예정대로 출근 기록'));

    expect(value.checkIn).toBeNull();
    expect(onChange.mock.calls[0][0]).not.toBe(value);
  });

  it('실제 출근이 있으면 그 시각을 출근 칸에 보여준다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 42) })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('check-in-value')).toHaveTextContent('18:42');
  });

  it('출근을 지우면 null 로 비운다 — 예정으로 되돌리지 않는다', () => {
    const onChange = jest.fn();
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 5) })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={onChange}
      />
    );

    fireEvent.press(screen.getByLabelText('실제 출근 지우기'));

    expect(onChange.mock.calls[0][0].checkIn).toBeNull();
  });
});

describe('WorkTimeFields — 상태 배지가 서버 파생과 같은 값을 말한다', () => {
  // 서버 update_work_log_slot(20260806140000) §4 파생과 1:1 대조:
  //   출근O+퇴근O→checked_out / 출근O→checked_in / 출근X→scheduled
  //   단 no_show·cancelled 는 불가침, completed 는 강등 금지.
  it('출근·퇴근이 모두 있으면 "퇴근"', () => {
    render(
      <WorkTimeFields
        value={makeValue({
          checkIn: new Date(2026, 7, 10, 18, 0),
          checkOut: new Date(2026, 7, 10, 23, 0),
        })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^퇴근$/);
  });

  it('출근이 없으면 퇴근만 있어도 "출근 예정"으로 강등한다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkOut: new Date(2026, 7, 10, 23, 0) })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근 예정$/);
  });

  it('🔴 no_show 는 출퇴근이 다 있어도 배지가 "노쇼"로 남는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({
          checkIn: new Date(2026, 7, 10, 18, 0),
          checkOut: new Date(2026, 7, 10, 23, 0),
        })}
        baseDate={BASE_DATE}
        currentStatus="no_show"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^노쇼$/);
  });

  it('🔴 cancelled 도 배지가 "취소"로 남는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 0) })}
        baseDate={BASE_DATE}
        currentStatus="cancelled"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^취소$/);
  });

  it('completed 는 "퇴근"으로 강등하지 않는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({
          checkIn: new Date(2026, 7, 10, 18, 0),
          checkOut: new Date(2026, 7, 10, 23, 0),
        })}
        baseDate={BASE_DATE}
        currentStatus="completed"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^정산 완료$/);
  });

  it('completed 라도 출근을 비우면 "출근 예정"으로 내려간다', () => {
    // 서버는 completed 강등 금지를 '양쪽 NOT NULL' 가지에만 건다. 출근이 비면 scheduled 다.
    render(
      <WorkTimeFields
        value={makeValue()}
        baseDate={BASE_DATE}
        currentStatus="completed"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근 예정$/);
  });
});

describe('WorkTimeFields — 익일 표기', () => {
  // 앵커는 baseDate 가 아니라 **출근**이다(WorkTimeDisplay.isEndNextDay 와 같은 축).
  it('퇴근이 출근보다 다음 달력일이면 (익일) 을 붙인다', () => {
    render(
      <WorkTimeFields
        value={makeValue({
          checkIn: new Date(2026, 7, 10, 22, 0),
          checkOut: new Date(2026, 7, 11, 2, 0),
        })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('check-out-value')).toHaveTextContent('02:00 (익일)');
  });

  it('🔴 출근 자체가 자정을 넘긴 행에는 (익일) 을 붙이지 않는다', () => {
    // 익일 00:30 출근 ~ 08:00 퇴근. baseDate 를 앵커로 쓰면 퇴근에만 꼬리표가 붙어
    // 같은 하룻밤이 이틀처럼 읽힌다 — 표시 정본은 이 경우 익일 표기가 없다.
    render(
      <WorkTimeFields
        value={makeValue({
          checkIn: new Date(2026, 7, 11, 0, 30),
          checkOut: new Date(2026, 7, 11, 8, 0),
        })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('check-out-value')).toHaveTextContent('08:00');
    expect(screen.getByTestId('check-out-value')).not.toHaveTextContent('익일');
  });

  it('같은 날 퇴근에는 꼬리표가 없다', () => {
    render(
      <WorkTimeFields
        value={makeValue({
          checkIn: new Date(2026, 7, 10, 18, 0),
          checkOut: new Date(2026, 7, 10, 23, 0),
        })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('check-out-value')).not.toHaveTextContent('익일');
  });

  it('출근이 없으면 baseDate 를 앵커로 삼는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkOut: new Date(2026, 7, 11, 2, 0) })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('check-out-value')).toHaveTextContent('02:00 (익일)');
  });
});

describe('WorkTimeFields — readOnly', () => {
  it('readOnly 면 [예정대로 기록]·[지우기] 를 렌더하지 않는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 0) })}
        baseDate={BASE_DATE}
        currentStatus={undefined}
        onChange={jest.fn()}
        readOnly
      />
    );

    expect(screen.queryByLabelText('예정대로 출근 기록')).toBeNull();
    expect(screen.queryByLabelText('실제 출근 지우기')).toBeNull();
  });
});

describe('applyPickedTime — 시각 조립', () => {
  it('출근을 고르면 기준 날짜에 그 시각을 얹는다', () => {
    const next = applyPickedTime(makeValue(), 'checkIn', '18:30', BASE_DATE);

    expect(next.checkIn?.getFullYear()).toBe(2026);
    expect(next.checkIn?.getMonth()).toBe(7);
    expect(next.checkIn?.getDate()).toBe(10);
    expect(next.checkIn?.getHours()).toBe(18);
    expect(next.checkIn?.getMinutes()).toBe(30);
  });

  it('🔴 퇴근이 출근보다 이르면 익일로 올린다(자정 넘김)', () => {
    const value = makeValue({ checkIn: new Date(2026, 7, 10, 22, 0) });

    const next = applyPickedTime(value, 'checkOut', '02:00', BASE_DATE);

    expect(next.checkOut?.getDate()).toBe(11);
    expect(next.checkOut?.getHours()).toBe(2);
    // 퇴근 - 출근 = 4시간. 음수 근무시간이 저장되지 않는다.
    expect(next.checkOut!.getTime() - value.checkIn!.getTime()).toBe(4 * 60 * 60 * 1000);
  });

  it('🔴 퇴근이 출근과 같으면 익일로 올리지 않는다 — 조용한 24시간 근무 금지', () => {
    // 등호를 익일에 포함시키면 22:00 출근 행에서 22:00 퇴근을 고른 순간 값이 +24h 로 조립돼
    // '퇴근' 배지와 함께 24시간 근무가 저장 가능해진다. 레포 정본은 반대다 —
    // deriveOvernightPreview:49-58 은 isEqual 을 "검증 오류 대상, 24시간 근무 해석 안 함"으로
    // 두고, WorkTimeEditor:240-243 은 이 입력의 저장을 차단했다.
    // 같은 날로 남겨야 시트의 "시작==종료" 검증이 두 값을 비교해 잡아낼 수 있다.
    const value = makeValue({ checkIn: new Date(2026, 7, 10, 22, 0) });

    const next = applyPickedTime(value, 'checkOut', '22:00', BASE_DATE);

    expect(next.checkOut?.getDate()).toBe(10);
    expect(next.checkOut?.getTime()).toBe(value.checkIn!.getTime());
  });

  it('24+ 표기는 그 자체로 익일이다', () => {
    const next = applyPickedTime(makeValue(), 'checkOut', '26:00', BASE_DATE);

    expect(next.checkOut?.getDate()).toBe(11);
    expect(next.checkOut?.getHours()).toBe(2);
  });

  it('출근이 없으면 퇴근은 익일 보정 없이 기준 날짜에 얹는다', () => {
    const next = applyPickedTime(makeValue(), 'checkOut', '02:00', BASE_DATE);

    expect(next.checkOut?.getDate()).toBe(10);
  });

  it('예정 시각을 고르면 미정이 풀린다', () => {
    const next = applyPickedTime(
      makeValue({ scheduledStart: null, scheduledUndecided: true }),
      'scheduled',
      '18:00',
      BASE_DATE
    );

    expect(next.scheduledStart).toBe('18:00');
    expect(next.scheduledUndecided).toBe(false);
  });

  it('읽을 수 없는 값이면 원본을 그대로 돌려준다', () => {
    const value = makeValue();

    expect(applyPickedTime(value, 'checkIn', '저녁 6시', BASE_DATE)).toEqual(value);
  });

  it('인자로 받은 value 와 baseDate 를 변형하지 않는다(불변성)', () => {
    const value = makeValue();
    const baseDate = new Date(2026, 7, 10);

    applyPickedTime(value, 'checkIn', '18:30', baseDate);

    expect(value.checkIn).toBeNull();
    expect(baseDate.getHours()).toBe(0);
  });
});
