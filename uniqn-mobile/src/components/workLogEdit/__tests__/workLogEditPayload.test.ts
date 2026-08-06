/**
 * resolveWorkLogEditPayload — "안 건드린 축은 키 자체가 없다" 계약 테스트
 *
 * 🔴 이 스위트는 편의 기능이 아니라 **안전장치**를 지킨다. 한 시트가 되면 "퇴근만 고치려다
 *    역할 칩을 스쳐 역할까지 저장"이 가능해지고, 역할은 `role_change_history` 가 남는 축이라
 *    오탐 저장이 이력을 오염시킨다(설계 §8-5).
 *
 * ⚠️ 단언은 `toEqual` 로 값만 보지 않고 **`'key' in patch`** 로 키 존재를 본다. 서버 계약이
 *    `p_patch ? 'checkIn'` 이라 `{checkIn: undefined}` 와 키 부재는 JSON 직렬화 뒤에야 같아진다 —
 *    값만 보면 "키는 있는데 값이 undefined" 인 구현이 통과해 버린다.
 *
 * ⚠️ 날짜는 **로컬 시각 생성자**로 만든다(jest.config 에 TZ 고정이 없다).
 */
import { resolveWorkLogEditPayload, type WorkLogEditAxes } from '../workLogEditPayload';

/** 시각이 정해져 있고 실적은 아직 없는, 가장 흔한 출발 상태. */
const INITIAL: WorkLogEditAxes = {
  scheduledStart: '18:00',
  scheduledUndecided: false,
  checkIn: null,
  checkOut: null,
  role: 'dealer',
  color: null,
  memo: '',
};

const CHECK_OUT = new Date(2026, 7, 10, 2, 0); // 2026-08-10 02:00 로컬
const CHECK_IN = new Date(2026, 7, 10, 18, 0);

describe('resolveWorkLogEditPayload — 안 건드린 축은 보내지 않는다', () => {
  it('아무것도 안 바꾸면 빈 패치다', () => {
    expect(resolveWorkLogEditPayload(INITIAL, { ...INITIAL })).toEqual({});
  });

  it('🔴 퇴근만 바꾸면 역할·색·메모·예정 키가 없다', () => {
    const out = resolveWorkLogEditPayload(INITIAL, { ...INITIAL, checkOut: CHECK_OUT });

    expect('checkOut' in out).toBe(true);
    expect('checkIn' in out).toBe(false);
    expect('staffRole' in out).toBe(false);
    expect('color' in out).toBe(false);
    expect('memo' in out).toBe(false);
    expect('startTime' in out).toBe(false);
    expect('timeUndecided' in out).toBe(false);
  });

  it('🔴 역할만 바꾸면 실적 키가 없다 — 손대지 않은 출퇴근이 함께 저장되면 안 된다', () => {
    const out = resolveWorkLogEditPayload(
      { ...INITIAL, checkIn: CHECK_IN },
      { ...INITIAL, checkIn: CHECK_IN, role: 'floor' }
    );

    expect(out.staffRole).toBe('floor');
    expect('checkIn' in out).toBe(false);
    expect('checkOut' in out).toBe(false);
  });

  it('같은 시각을 가리키는 다른 Date 객체는 변경이 아니다', () => {
    const out = resolveWorkLogEditPayload(
      { ...INITIAL, checkIn: CHECK_IN },
      { ...INITIAL, checkIn: new Date(CHECK_IN.getTime()) }
    );

    expect(out).toEqual({});
  });
});

describe('resolveWorkLogEditPayload — 예정(startTime·timeUndecided)', () => {
  it('예정을 미정으로 바꾸면 timeUndecided 만 실린다', () => {
    const out = resolveWorkLogEditPayload(INITIAL, {
      ...INITIAL,
      scheduledStart: null,
      scheduledUndecided: true,
    });

    expect(out.timeUndecided).toBe(true);
    expect('startTime' in out).toBe(false);
  });

  it('원래 미정인 슬롯을 미정인 채 두면 아무것도 안 보낸다', () => {
    const undecided: WorkLogEditAxes = {
      ...INITIAL,
      scheduledStart: null,
      scheduledUndecided: true,
    };

    expect(resolveWorkLogEditPayload(undecided, { ...undecided })).toEqual({});
  });

  it('미정이던 슬롯에 시각을 고르면 startTime 이 실리고 timeUndecided 는 없다', () => {
    const undecided: WorkLogEditAxes = {
      ...INITIAL,
      scheduledStart: null,
      scheduledUndecided: true,
    };

    const out = resolveWorkLogEditPayload(undecided, {
      ...undecided,
      scheduledStart: '19:00',
      scheduledUndecided: false,
    });

    expect(out.startTime).toBe('19:00');
    expect('timeUndecided' in out).toBe(false);
  });

  it('미정을 껐는데 시각이 비어 있어도 예정을 지우지 않는다 — 조용한 삭제 금지', () => {
    // 이전 이름은 "미정 왕복"을 주장했지만 `{scheduledStart:'18:00'}` 을 그대로 넘겨 그 경로를
    // 한 번도 밟지 않았다(리뷰 지적). 왕복이 실제로 만드는 상태는 **시각이 비어 있고 미정도
    // 꺼진** 이 모양이다. 이때 `startTime: null` 이나 `timeUndecided` 를 지어내면 사용자가
    // 건드린 적 없는 예정이 조용히 지워진다.
    // (화면 표시의 왕복 복원은 시트 책임 — `WorkLogEditSheet.test.tsx` 가 덮는다.)
    const out = resolveWorkLogEditPayload(INITIAL, {
      ...INITIAL,
      scheduledStart: null,
      scheduledUndecided: false,
    });

    expect(out).toEqual({});
  });
});

describe('resolveWorkLogEditPayload — 실적 3상(미변경 / 삭제 / 설정)', () => {
  it('실적을 지우면 null 이 실린다 (미변경과 구분)', () => {
    const out = resolveWorkLogEditPayload(
      { ...INITIAL, checkIn: CHECK_IN },
      { ...INITIAL, checkIn: null }
    );

    expect('checkIn' in out).toBe(true);
    expect(out.checkIn).toBeNull();
  });

  it('출퇴근을 함께 기록하면 두 키가 Date 로 실린다', () => {
    const out = resolveWorkLogEditPayload(INITIAL, {
      ...INITIAL,
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
    });

    expect(out.checkIn).toBe(CHECK_IN);
    expect(out.checkOut).toBe(CHECK_OUT);
  });
});

describe('resolveWorkLogEditPayload — 색은 삭제할 수 없다', () => {
  it('색을 고르면 실린다', () => {
    const out = resolveWorkLogEditPayload(INITIAL, { ...INITIAL, color: 'slot-sky' });

    expect(out.color).toBe('slot-sky');
  });

  it('🔴 색이 null 이 되어도 color 키를 만들지 않는다 — 서버가 문자열만 받는다', () => {
    // 서버는 `jsonb_typeof(p_patch->'color') <> 'string'` 이면 INVALID_INPUT 을 던지고,
    // 레포 `assertSlotColor(value: string)` 도 null 을 받지 못한다. 삭제 경로 자체가 없다.
    const out = resolveWorkLogEditPayload(
      { ...INITIAL, color: 'slot-teal' },
      { ...INITIAL, color: null }
    );

    expect('color' in out).toBe(false);
  });
});

describe('resolveWorkLogEditPayload — 사유·행위자는 축이 아니라 동반값이다', () => {
  it('빈 패치면 사유·행위자를 붙이지 않는다 — 저장할 것이 없다', () => {
    const out = resolveWorkLogEditPayload(
      INITIAL,
      { ...INITIAL },
      { reason: 'QR 오류', editedBy: 'user-1' }
    );

    expect(out).toEqual({});
  });

  it('실적을 바꾸면 사유가 실린다', () => {
    const out = resolveWorkLogEditPayload(
      INITIAL,
      { ...INITIAL, checkOut: CHECK_OUT },
      { reason: 'QR 오류', editedBy: 'user-1' }
    );

    expect(out.reason).toBe('QR 오류');
    expect(out.editedBy).toBe('user-1');
  });

  it('🔴 색·메모만 바꾸면 사유를 실지 않는다 — 이력이 남는 축이 아니다', () => {
    const out = resolveWorkLogEditPayload(
      INITIAL,
      { ...INITIAL, memo: '홀 담당' },
      { reason: 'QR 오류', editedBy: 'user-1' }
    );

    expect(out.memo).toBe('홀 담당');
    expect('reason' in out).toBe(false);
    expect(out.editedBy).toBe('user-1');
  });

  it('공백뿐인 사유는 싣지 않는다', () => {
    const out = resolveWorkLogEditPayload(
      INITIAL,
      { ...INITIAL, checkOut: CHECK_OUT },
      { reason: '   ' }
    );

    expect('reason' in out).toBe(false);
  });
});
