/**
 * offlineCachePolicies — **실물 값** 백스톱.
 *
 * 훅 테스트 5건은 `@/lib/queryClient` 를 손으로 쓴 부분 목으로 대체하므로 **배선만** 고정한다.
 * 즉 실물 값이 짧게 오염돼도(누군가 `offlineTtlHours(0.01)` 로 바꿔도) 그 5건은 전부 green 이다.
 * 값 자체를 지키는 곳은 여기뿐이다 — 실물 모듈을 그대로 import 한다.
 *
 * (전역 jest.setup 은 `@/lib/queryClient` 를 목하지 않는다. 목하게 되면 이 파일은 즉시
 *  vacuous 해지므로, 그때는 여기를 함께 손봐야 한다.)
 */
import { cachingPolicies, offlineCachePolicies, queryCachingOptions } from '@/lib/queryClient';

const ONE_HOUR = 60 * 60 * 1000;

describe('offlineCachePolicies 실물 값', () => {
  it('모든 보존기간이 최소 1시간 이상이다', () => {
    // 만료가 stale 표시가 아니라 **완전 삭제**라, 분 단위 값은 안전망이 아니라 폭탄이다.
    const values = Object.values(offlineCachePolicies);
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((ms) => ms < ONE_HOUR)).toEqual([]);
  });

  it('온라인 staleTime 계열 값과 하나도 겹치지 않는다', () => {
    // 겹친다는 건 누군가 다시 온라인 상수를 가져다 썼다는 신호다(감사 M6 의 원형).
    const onlineValues = new Set<number>([
      ...Object.values(cachingPolicies),
      ...Object.values(queryCachingOptions).map((options) => options.staleTime),
    ]);
    const collisions = Object.entries(offlineCachePolicies).filter(([, ms]) =>
      onlineValues.has(ms)
    );

    expect(collisions).toEqual([]);
  });

  it("'지금 근무 중인가'는 날을 넘기지 않는다", () => {
    // 24시간이면 어제의 '출근 중'이 오늘 아침까지 살아남아 스태프가 QR 을 안 찍는다.
    expect(offlineCachePolicies.currentWorkStatus).toBe(12 * ONE_HOUR);
    expect(offlineCachePolicies.currentWorkStatus).toBeLessThan(24 * ONE_HOUR);
  });
});
