/**
 * JobPosting 시간필드 타입 계약 회귀 가드.
 *
 * 런타임 진실 = ISO string (zod timestampSchema → normalizeToIsoString). 타입 선언이 다시
 * Date 로 드리프트하면 과거 크래시 클래스(`p.createdAt.getTime is not a function`)가 재발한다.
 * 아래 계약이 깨지면(= 필드가 Date 를 수용하게 되면) `@ts-expect-error` 지시가 무효화되어
 * tsc 가 실패하고, npm run quality 게이트가 회귀를 차단한다.
 *
 * 참고: 이 계약은 JobPosting 스코프 전용이다. Application 도 createdAt/updatedAt 는
 * 동일하게 string 으로 졸업했으나 processedAt/confirmedAt/cancelledAt 은 별도 스코프.
 */
import type { JobPosting } from '@/types/jobPosting';

describe('JobPosting 시간필드 타입 계약 (ISO string)', () => {
  it('createdAt/updatedAt/closedAt 는 string 을 수용한다', () => {
    const createdAt: JobPosting['createdAt'] = '2026-07-17T00:00:00Z';
    const updatedAt: JobPosting['updatedAt'] = '2026-07-17T00:00:00Z';
    const closedAt: JobPosting['closedAt'] = '2026-07-17T00:00:00Z';
    expect(typeof createdAt).toBe('string');
    expect(typeof updatedAt).toBe('string');
    expect(typeof closedAt).toBe('string');
  });

  it('Date 로의 드리프트를 tsc 레벨에서 차단한다', () => {
    // Date 는 string 계약에 할당 불가 — 필드가 Date(또는 Date|string)로 되돌아가면
    // 아래 @ts-expect-error 가 "unused directive"가 되어 tsc 컴파일이 실패한다.
    // @ts-expect-error createdAt 은 ISO string 계약이라 Date 를 허용하지 않는다
    const drift: JobPosting['createdAt'] = new Date();
    // 정적 타입은 string 이나 런타임 값은 Date — 가드가 살아있음을 런타임에서도 표기.
    expect(drift).toBeInstanceOf(Date);
  });
});
