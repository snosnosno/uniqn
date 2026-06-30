/**
 * slotEdit 순수 로직 단위테스트 (B2)
 *
 * 검증 대상(쓰기 경계 순수함수):
 * - 색상 화이트리스트: 자유 hex/미등록 토큰 거부 + 팔레트 토큰 통과
 * - 메모 XSS: 위험 문자열/초과 길이 거부 + 정상 메모 통과
 * - 시작시간 자동정렬 비교자: timeSlot 시작시각 기준 오름차순(불변성)
 * - timeSlot 조합/분해 + 중복충돌 경고(차단 아님)
 */
import { ValidationError } from '@/errors';
import {
  SLOT_COLOR_TOKENS,
  isValidSlotColor,
  assertSlotColor,
  isSafeSlotMemo,
  assertSlotMemo,
  MAX_SLOT_MEMO_LENGTH,
  parseSlotStartMinutes,
  compareSlotsByStartTime,
  sortSlotsByStartTime,
  composeTimeSlot,
  parseTimeSlotParts,
  detectSlotConflicts,
} from '../slotEdit';

describe('slotEdit — 색상 화이트리스트', () => {
  it('팔레트 토큰은 통과한다', () => {
    expect(isValidSlotColor('primary-500')).toBe(true);
    expect(isValidSlotColor('success')).toBe(true);
    expect(isValidSlotColor('secondary-900')).toBe(true);
    // 정의된 모든 토큰이 통과
    for (const token of SLOT_COLOR_TOKENS) {
      expect(isValidSlotColor(token)).toBe(true);
    }
  });

  it('자유 hex/미등록 토큰은 거부한다', () => {
    expect(isValidSlotColor('#ff0000')).toBe(false);
    expect(isValidSlotColor('rgb(255,0,0)')).toBe(false);
    expect(isValidSlotColor('red')).toBe(false);
    expect(isValidSlotColor('primary-999')).toBe(false);
    expect(isValidSlotColor('')).toBe(false);
    expect(isValidSlotColor(null)).toBe(false);
    expect(isValidSlotColor(123)).toBe(false);
  });

  it('assertSlotColor 는 유효 토큰을 반환하고 무효 색상에 ValidationError 를 던진다', () => {
    expect(assertSlotColor('primary-700')).toBe('primary-700');
    expect(() => assertSlotColor('#ff0000')).toThrow(ValidationError);
    expect(() => assertSlotColor('javascript:alert(1)')).toThrow(ValidationError);
  });
});

describe('slotEdit — 메모 XSS/길이', () => {
  it('정상 메모는 통과한다', () => {
    expect(isSafeSlotMemo('오늘 1시간 늦게 시작')).toBe(true);
    expect(assertSlotMemo('  공백 트림됨  ')).toBe('공백 트림됨');
    expect(isSafeSlotMemo('')).toBe(true);
  });

  it('XSS 문자열은 거부한다', () => {
    expect(isSafeSlotMemo('<script>alert(1)</script>')).toBe(false);
    expect(isSafeSlotMemo('<iframe src=//evil')).toBe(false);
    expect(isSafeSlotMemo('onclick=alert(1)')).toBe(false);
    expect(() => assertSlotMemo('<script>alert(1)</script>')).toThrow(ValidationError);
  });

  it('최대 길이를 초과하면 거부한다', () => {
    const tooLong = 'a'.repeat(MAX_SLOT_MEMO_LENGTH + 1);
    expect(isSafeSlotMemo(tooLong)).toBe(false);
    expect(() => assertSlotMemo(tooLong)).toThrow(ValidationError);
  });
});

describe('slotEdit — 시작시간 정렬', () => {
  it('timeSlot 시작시각을 분으로 파싱한다', () => {
    expect(parseSlotStartMinutes('18:00 - 02:00')).toBe(18 * 60);
    expect(parseSlotStartMinutes('09:30~12:00')).toBe(9 * 60 + 30);
    expect(parseSlotStartMinutes('07:05')).toBe(7 * 60 + 5);
  });

  it('파싱 불가/누락은 맨 뒤로 정렬되도록 Infinity 를 반환한다', () => {
    expect(parseSlotStartMinutes(null)).toBe(Number.POSITIVE_INFINITY);
    expect(parseSlotStartMinutes('')).toBe(Number.POSITIVE_INFINITY);
    expect(parseSlotStartMinutes('미정')).toBe(Number.POSITIVE_INFINITY);
    expect(parseSlotStartMinutes('99:99 - 10:00')).toBe(Number.POSITIVE_INFINITY);
  });

  it('비교자로 시작시간 오름차순 정렬되고 원본은 불변한다', () => {
    const slots = [
      { timeSlot: '18:00 - 02:00' },
      { timeSlot: null },
      { timeSlot: '09:30 - 12:00' },
      { timeSlot: '12:00 - 15:00' },
    ];
    const sorted = sortSlotsByStartTime(slots);
    expect(sorted.map((s) => s.timeSlot)).toEqual([
      '09:30 - 12:00',
      '12:00 - 15:00',
      '18:00 - 02:00',
      null,
    ]);
    // 불변성: 원본 배열 비변경
    expect(slots[0].timeSlot).toBe('18:00 - 02:00');
    // 직접 비교자 부호 확인
    expect(
      compareSlotsByStartTime({ timeSlot: '09:00 - 10:00' }, { timeSlot: '10:00 - 11:00' })
    ).toBeLessThan(0);
  });
});

describe('slotEdit — timeSlot 조합/분해 + 중복충돌', () => {
  it('조합/분해는 앱 표준 구분자(" - ")를 사용한다', () => {
    expect(composeTimeSlot('18:00', '02:00')).toBe('18:00 - 02:00');
    expect(parseTimeSlotParts('18:00 - 02:00')).toEqual({ start: '18:00', end: '02:00' });
    expect(parseTimeSlotParts('09:30~12:00')).toEqual({ start: '09:30', end: '12:00' });
    expect(parseTimeSlotParts(null)).toEqual({ start: '', end: '' });
  });

  it('같은 스태프 + 같은 시작시각만 충돌로 경고하고 자기 자신은 제외한다', () => {
    const target = { workLogId: 'w1', staffId: 's1', timeSlot: '18:00 - 02:00' };
    const siblings = [
      { workLogId: 'w1', staffId: 's1', timeSlot: '18:00 - 02:00' }, // 자기 자신
      { workLogId: 'w2', staffId: 's1', timeSlot: '18:00 - 22:00' }, // 충돌
      { workLogId: 'w3', staffId: 's2', timeSlot: '18:00 - 02:00' }, // 다른 스태프
      { workLogId: 'w4', staffId: 's1', timeSlot: '12:00 - 15:00' }, // 다른 시작
    ];
    const conflicts = detectSlotConflicts(target, siblings);
    expect(conflicts).toEqual([{ workLogId: 'w2', reason: 'sameStaffSameStart' }]);
  });

  it('staffId 가 없으면 충돌 없음', () => {
    const conflicts = detectSlotConflicts(
      { workLogId: 'w1', staffId: null, timeSlot: '18:00 - 02:00' },
      [{ workLogId: 'w2', staffId: null, timeSlot: '18:00 - 02:00' }]
    );
    expect(conflicts).toEqual([]);
  });
});
