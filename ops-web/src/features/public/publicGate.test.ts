import { describe, expect, it } from 'vitest';
import { gateOf, normalizePin } from './publicGate';

const base = { isMalformed: false, isTokenInvalid: false, isDisconnected: false, hasData: false };

describe('gateOf — 공개뷰 첫 상태(모바일과 같은 순서)', () => {
  it('토큰 무효·형식 오류는 데이터가 있어도 무효 안내(폴링 영구 정지)', () => {
    expect(gateOf({ ...base, isTokenInvalid: true, hasData: true })).toBe('invalid');
    expect(gateOf({ ...base, isMalformed: true })).toBe('invalid');
  });
  it('한 번도 못 받았는데 연결 실패면 offline, 아니면 loading', () => {
    expect(gateOf({ ...base, isDisconnected: true })).toBe('offline');
    expect(gateOf(base)).toBe('loading');
  });
  it('데이터가 있으면 연결이 끊겨도 화면 유지(배지만)', () => {
    expect(gateOf({ ...base, isDisconnected: true, hasData: true })).toBeNull();
  });
});

describe('normalizePin', () => {
  it('대문자·영숫자만·8자', () => {
    expect(normalizePin('7f3k-9a2c')).toBe('7F3K9A2C');
    expect(normalizePin('abcdefghij')).toBe('ABCDEFGH');
    expect(normalizePin(' 한글12 ')).toBe('12');
  });
});
