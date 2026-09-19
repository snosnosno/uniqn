/**
 * opsFallbackHref — ops 화면의 구인자 맥락 보존 (S3-7).
 *
 * 사장이 공고 상세의 "라이브 운영"으로 ops 스택에 들어왔다가 히스토리 없는 진입
 * (콜드/딥링크/웹 직접 URL)에서 뒤로가기를 누르면, 관리하던 공고가 아니라 낯선 ops 목록에
 * 떨어져 공고를 다시 찾아야 했다.
 */

import { opsFallbackHref } from '@/utils/opsNavigation';

describe('opsFallbackHref', () => {
  it('연결된 공고가 있으면 그 공고 상세로 돌려보낸다', () => {
    expect(opsFallbackHref('posting-1', '/(ops)/tournaments')).toBe(
      '/(employer)/my-postings/posting-1'
    );
  });

  it('연결이 없으면 화면별 기본 목적지를 그대로 쓴다', () => {
    expect(opsFallbackHref(undefined, '/(ops)/tournaments')).toBe('/(ops)/tournaments');
    expect(opsFallbackHref(null, '/(app)/(tabs)/home-jobs')).toBe('/(app)/(tabs)/home-jobs');
  });

  // DB 컬럼이 nullable 이고 폼 상태는 빈 문자열을 낼 수 있다 — 둘 다 "연결 없음"이다.
  it('빈 문자열은 연결 없음으로 본다', () => {
    expect(opsFallbackHref('', '/(ops)/tournaments')).toBe('/(ops)/tournaments');
  });
});
