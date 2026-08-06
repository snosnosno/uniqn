/**
 * WorkTimeFields — 예정·실적 분리 계약 테스트
 *
 * 🔴 이 스위트의 존재 이유는 회귀 방지다. 폐지될 WorkTimeEditor 는 실제 출근 기록이 없으면
 *    예정 시각을 출근 칸에 프리필했고, 그래서 퇴근만 고쳐도 예정 값이 check_in_ts 로 저장돼
 *    근태 상태가 '출근'으로 뒤집혔다(사용자 신고). 첫 테스트가 그 프리필의 부활을 막는다.
 *
 * ⚠️ 날짜는 **로컬 시각 생성자**(new Date(y, m, d, h, min))로 만든다. ISO+09:00 리터럴은
 *    러너 타임존에 따라 getHours() 가 달라져 표시 단언이 흔들린다(jest.config 에 TZ 고정 없음).
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
    render(<WorkTimeFields value={makeValue()} baseDate={BASE_DATE} onChange={jest.fn()} />);

    // 예정은 보이고
    expect(screen.getByText('18:00')).toBeTruthy();
    // 출근 칸은 비어 있다 — '18:00' 이 출근 자리에 복제되면 안 된다
    expect(screen.getByTestId('check-in-value')).toHaveTextContent('—');
  });

  it('[예정대로 기록] 을 누르면 출근이 예정 시각으로 채워진다', () => {
    const onChange = jest.fn();
    render(<WorkTimeFields value={makeValue()} baseDate={BASE_DATE} onChange={onChange} />);

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
        onChange={jest.fn()}
      />
    );

    // 정확 일치로 본다 — '출근 예정' 도 '출근' 을 부분 포함하므로 부분일치 단언은 빈 통과다.
    expect(screen.getByTestId('status-badge')).toHaveTextContent(/^출근$/);
  });

  it('[예정대로 기록] 은 원본 value 를 변형하지 않는다(불변성)', () => {
    const value = makeValue();
    const onChange = jest.fn();
    render(<WorkTimeFields value={value} baseDate={BASE_DATE} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('예정대로 출근 기록'));

    expect(value.checkIn).toBeNull();
    expect(onChange.mock.calls[0][0]).not.toBe(value);
  });

  it('실제 출근이 있으면 그 시각을 출근 칸에 보여준다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 42) })}
        baseDate={BASE_DATE}
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

describe('WorkTimeFields — readOnly', () => {
  it('readOnly 면 [예정대로 기록]·[지우기] 를 렌더하지 않는다', () => {
    render(
      <WorkTimeFields
        value={makeValue({ checkIn: new Date(2026, 7, 10, 18, 0) })}
        baseDate={BASE_DATE}
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
