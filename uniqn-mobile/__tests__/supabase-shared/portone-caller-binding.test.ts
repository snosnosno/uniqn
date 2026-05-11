/**
 * @file PortOne caller binding — P0 #1 root-cause mitigation.
 *
 * 클라이언트가 본인인증 시작 시 생성한 random `bindingToken`을 PortOne SDK
 * customData에 박고, 서버가 응답에서 추출한 token이 verify API payload의
 * `expectedBindingToken`과 일치하는지 검증한다. Apple의 JWKS sub matching과
 * 대칭되는 PortOne 경로 layer.
 */
import {
  extractBindingToken,
  isBindingMatch,
} from '../../supabase/functions/_shared/portone-caller-binding';

describe('extractBindingToken', () => {
  it('정상 JSON customData에서 bindingToken 반환', () => {
    const customData = JSON.stringify({ bindingToken: 'abc-123' });
    expect(extractBindingToken(customData)).toBe('abc-123');
  });

  it('다른 필드와 함께 있어도 bindingToken만 추출', () => {
    const customData = JSON.stringify({ bindingToken: 'tok', other: 'noise' });
    expect(extractBindingToken(customData)).toBe('tok');
  });

  it('customData 없음 → undefined', () => {
    expect(extractBindingToken(undefined)).toBeUndefined();
    expect(extractBindingToken(null)).toBeUndefined();
    expect(extractBindingToken('')).toBeUndefined();
  });

  it('JSON 파싱 실패 (legacy / 손상) → undefined', () => {
    expect(extractBindingToken('not-json')).toBeUndefined();
    expect(extractBindingToken('{{{broken')).toBeUndefined();
  });

  it('JSON 안에 bindingToken 키 없음 → undefined', () => {
    expect(extractBindingToken(JSON.stringify({ foo: 'bar' }))).toBeUndefined();
  });

  it('bindingToken 빈문자열 / 타입 불일치 → undefined (fail-closed)', () => {
    expect(extractBindingToken(JSON.stringify({ bindingToken: '' }))).toBeUndefined();
    expect(extractBindingToken(JSON.stringify({ bindingToken: 123 }))).toBeUndefined();
    expect(extractBindingToken(JSON.stringify({ bindingToken: null }))).toBeUndefined();
  });

  it('object / array 입력 → undefined (string만 허용)', () => {
    expect(extractBindingToken({ bindingToken: 'tok' } as unknown)).toBeUndefined();
    expect(extractBindingToken(['tok'] as unknown)).toBeUndefined();
  });
});

describe('isBindingMatch', () => {
  it('정상 동일 token → true', () => {
    expect(isBindingMatch('tok-123', 'tok-123')).toBe(true);
  });

  it('다른 token → false (caller binding 위반)', () => {
    expect(isBindingMatch('tok-123', 'tok-999')).toBe(false);
  });

  it('한 쪽 누락 → false (fail-closed)', () => {
    expect(isBindingMatch(undefined, 'tok')).toBe(false);
    expect(isBindingMatch('tok', undefined)).toBe(false);
    expect(isBindingMatch('', 'tok')).toBe(false);
    expect(isBindingMatch('tok', '')).toBe(false);
  });

  it('길이 다른 token → false (timing 비교 short-circuit 전 길이 확인)', () => {
    expect(isBindingMatch('short', 'longer-token')).toBe(false);
  });

  it('case-sensitive 검증', () => {
    expect(isBindingMatch('Tok', 'tok')).toBe(false);
  });
});
