/**
 * toApplicantFilter — 쿼리 파라미터 → 지원자 목록 필터 (S2-8).
 *
 * 허브의 통계 숫자("대기중 3")가 `?filter=applied` 로 넘겨 주는 값을 받는다.
 * 검증 없이 통과시키면 어떤 탭에도 해당하지 않는 필터가 걸려 목록이 영구히 비어 보인다 —
 * 사용자는 지원자가 사라졌다고 읽는다.
 */

import { toApplicantFilter } from '@/components/employer';

describe('toApplicantFilter', () => {
  it('알려진 상태는 그대로 통과시킨다', () => {
    expect(toApplicantFilter('applied')).toBe('applied');
    expect(toApplicantFilter('confirmed')).toBe('confirmed');
    expect(toApplicantFilter('cancellation_pending')).toBe('cancellation_pending');
  });

  it("'all' 은 유효한 값이다", () => {
    expect(toApplicantFilter('all')).toBe('all');
  });

  it('파라미터가 없으면 전체로 연다', () => {
    expect(toApplicantFilter(undefined)).toBe('all');
    expect(toApplicantFilter('')).toBe('all');
  });

  // 딥링크·수기 URL 로 아무 문자열이나 들어올 수 있다.
  it('모르는 값은 조용히 전체로 떨어진다 — 빈 목록으로 오해시키지 않는다', () => {
    expect(toApplicantFilter('nope')).toBe('all');
    expect(toApplicantFilter('APPLIED')).toBe('all');
  });

  // expo-router 는 같은 키가 중복되면 배열을 준다.
  it('배열로 들어오면 첫 값을 쓴다', () => {
    expect(toApplicantFilter(['confirmed', 'applied'])).toBe('confirmed');
    expect(toApplicantFilter([])).toBe('all');
  });
});
