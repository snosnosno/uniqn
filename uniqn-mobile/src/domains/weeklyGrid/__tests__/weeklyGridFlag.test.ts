/**
 * weeklyGridFlag — 원격 플래그 파서 단위 테스트
 *
 * 신뢰 불가 경계(app_config row)의 다양한 모양을 boolean 으로 정규화하는지 검증.
 * 핵심 불변식: 검증 실패 시 항상 fallback 으로 흡수(예외 throw 금지).
 */
import { parseWeeklyGridFlag } from '../weeklyGridFlag';

describe('parseWeeklyGridFlag', () => {
  it('{"enabled": true} → true', () => {
    expect(parseWeeklyGridFlag({ enabled: true }, false)).toBe(true);
  });

  it('{"enabled": false} → false', () => {
    expect(parseWeeklyGridFlag({ enabled: false }, true)).toBe(false);
  });

  it('null → fallback', () => {
    expect(parseWeeklyGridFlag(null, false)).toBe(false);
    expect(parseWeeklyGridFlag(null, true)).toBe(true);
  });

  it('undefined → fallback', () => {
    expect(parseWeeklyGridFlag(undefined, false)).toBe(false);
  });

  it('잘못된 모양(enabled 누락) → fallback', () => {
    expect(parseWeeklyGridFlag({}, false)).toBe(false);
    expect(parseWeeklyGridFlag({ other: 1 }, true)).toBe(true);
  });

  it('enabled 가 boolean 아님(문자열/숫자) → fallback', () => {
    expect(parseWeeklyGridFlag({ enabled: 'true' }, false)).toBe(false);
    expect(parseWeeklyGridFlag({ enabled: 1 }, false)).toBe(false);
  });

  it('객체 아님(문자열/숫자/배열) → fallback', () => {
    expect(parseWeeklyGridFlag('enabled', false)).toBe(false);
    expect(parseWeeklyGridFlag(42, true)).toBe(true);
    expect(parseWeeklyGridFlag([true], false)).toBe(false);
  });

  it('추가 키가 있어도 enabled 가 boolean 이면 그 값 사용', () => {
    expect(parseWeeklyGridFlag({ enabled: true, extra: 'x' }, false)).toBe(true);
  });
});
