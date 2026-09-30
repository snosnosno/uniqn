export type GateState = 'invalid' | 'offline' | 'loading';

/** 공개뷰 첫 상태 판정(순수). null = 데이터가 있어 본 화면을 그린다. */
export function gateOf(s: {
  isMalformed: boolean;
  isTokenInvalid: boolean;
  isDisconnected: boolean;
  hasData: boolean;
}): GateState | null {
  if (s.isTokenInvalid || s.isMalformed) return 'invalid';
  if (s.hasData) return null;
  return s.isDisconnected ? 'offline' : 'loading';
}

/** 슬립 PIN 입력 정규화 — 대문자·영숫자만·8자(모바일과 같다). */
export const normalizePin = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 8);
