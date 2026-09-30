import { describe, expect, it } from 'vitest';
import { DEFAULT_AFTER_LOGIN, buildLoginPath, normalizeOpsRedirect } from './redirect';

describe('normalizeOpsRedirect — 로그인 후 복귀 경로는 내부 경로만', () => {
  it.each([
    ['/tournaments', '/tournaments'],
    ['/tournaments/abc/players?x=1#top', '/tournaments/abc/players?x=1#top'],
    ['  /tournaments  ', '/tournaments'],
    // 인코딩은 URL 파서가 정규화한 모양으로 돌려준다(같은 origin 경로).
    ['/%5Cevil.com', '/%5Cevil.com'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
    ['/%0d%0aSet-Cookie', '/%0d%0aSet-Cookie'],
  ])('허용: %s → %s', (input, expected) => {
    expect(normalizeOpsRedirect(input)).toBe(expected);
  });

  it.each([
    ['//evil.com', '프로토콜 상대 URL'],
    ['/\\evil.com', '역슬래시 — 브라우저가 // 로 해석'],
    ['\\\\evil.com', '역슬래시 시작'],
    ['https://evil.com', '절대 URL'],
    ['javascript:alert(1)', 'javascript 스킴'],
    ['evil.com', '상대 경로'],
    ['/.//evil.com', '점 세그먼트 해석 후 //evil'],
    ['/%2e%2e//evil.com', '인코딩된 점 세그먼트 해석 후 //evil'],
    ['/\t/evil.com', '탭 — 브라우저가 지우면 //evil'],
    ['/\n/evil.com', '개행'],
  ])('거부 → 기본 경로: %s (%s)', (input) => {
    expect(normalizeOpsRedirect(input)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it.each([
    '/login',
    '/login?redirect=/x',
    '/Login',
    '/login/',
    '/reset-password/',
    '/FORGOT-PASSWORD',
  ])('인증 화면으로의 복귀는 루프 → 기본 경로: %s', (input) => {
    expect(normalizeOpsRedirect(input)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it('비어 있거나 문자열이 아니면 기본 경로', () => {
    expect(normalizeOpsRedirect(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(normalizeOpsRedirect(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(normalizeOpsRedirect('')).toBe(DEFAULT_AFTER_LOGIN);
  });
});

describe('buildLoginPath', () => {
  it('현재 경로를 redirect 로 인코딩', () => {
    expect(buildLoginPath('/tournaments/a b?tab=1')).toBe(
      '/login?redirect=%2Ftournaments%2Fa%2520b%3Ftab%3D1'
    );
  });

  it('기본 경로·루트면 redirect 를 붙이지 않는다', () => {
    expect(buildLoginPath(DEFAULT_AFTER_LOGIN)).toBe('/login');
    expect(buildLoginPath('/')).toBe('/login?redirect=%2F');
  });
});
