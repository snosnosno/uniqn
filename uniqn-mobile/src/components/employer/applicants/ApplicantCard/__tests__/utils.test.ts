import { formatTimeSlotDisplay, resolveFixedStartTime } from '../utils';

describe('ApplicantCard utils', () => {
  it('shows 미정 when time is not fixed', () => {
    expect(formatTimeSlotDisplay('', true)).toBe('미정');
  });

  it('includes the tentative description when provided', () => {
    expect(formatTimeSlotDisplay('', true, '현장 공지')).toBe('미정 (현장 공지)');
  });

  // 🔴 [R1] 사장 화면에 영문 토큰이 새면 안 된다. 레거시 지원서의 timeSlot 은 'NEGOTIABLE' 인데
  //    이 함수는 "빈 문자열이 아니면 원문" 규칙이라 그 값을 그대로 렌더했다.
  it.each(['NEGOTIABLE', '미정', '   ', ''])('센티널 %p 는 미정으로 표기한다', (raw) => {
    expect(formatTimeSlotDisplay(raw)).toBe('미정');
  });

  it('실제 시각과 사람이 적어둔 자유 텍스트는 원문을 살린다', () => {
    expect(formatTimeSlotDisplay('19:00')).toBe('19:00');
    expect(formatTimeSlotDisplay('협의')).toBe('협의');
  });
});

/**
 * 🔴 고정공고 '출근시간 협의' 카드의 표시 시각 결정.
 *
 * 예전엔 ApplicantCard 안에 인라인 `??` 체인으로 있었고, 마지막 폴백이
 * `postingFacts.schedule.timeSlot`(= `getPostingLegacyTimeSlot`) 이었다. 협의 고정공고에서 그 값이
 * `'NEGOTIABLE'` 이라 **사장 화면에 "출근시간 NEGOTIABLE" 이 그대로 떴다.**
 * 순수 함수로 떼어내야 렌더 없이 이 회귀를 가둘 수 있다.
 */
describe('resolveFixedStartTime', () => {
  it('명시 startTime 이 최우선', () => {
    expect(resolveFixedStartTime('09:00', '10:00', '11:00')).toBe('09:00');
  });

  it('공고 fixed.startTime 으로 폴백한다', () => {
    expect(resolveFixedStartTime(undefined, '10:00', '11:00')).toBe('10:00');
  });

  it('레거시 timeSlot 은 시작 시각만 취한다', () => {
    expect(resolveFixedStartTime(undefined, undefined, '11:00~19:00')).toBe('11:00');
  });

  // 이 단언이 무너지면 사장 화면에 영문 토큰이 다시 뜬다.
  it.each(['NEGOTIABLE', '미정', '', '   ', undefined])(
    '센티널 %p 는 시각 없음(undefined)으로 접어 협의 라벨이 뜨게 한다',
    (legacy) => {
      expect(resolveFixedStartTime(undefined, undefined, legacy)).toBeUndefined();
    }
  );

  it('센티널이 명시 startTime 자리에 와도 접는다', () => {
    expect(resolveFixedStartTime('NEGOTIABLE', undefined, undefined)).toBeUndefined();
  });
});
