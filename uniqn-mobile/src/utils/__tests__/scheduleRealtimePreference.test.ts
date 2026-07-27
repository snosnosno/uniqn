import {
  shouldPreferQuerySchedulePayload,
  type SchedulePayloadPreferenceInput,
} from '@/utils/scheduleRealtimePreference';

const base: SchedulePayloadPreferenceInput = {
  realtime: true,
  hasReceivedRealtimeSnapshot: true,
  hasQueryPayload: true,
  queryUpdatedAt: 1_000,
  realtimeSnapshotAt: 2_000,
  realtimeScheduleCount: 3,
  queryScheduleCount: 3,
};

describe('shouldPreferQuerySchedulePayload', () => {
  it('realtime을 끈 화면은 항상 월 쿼리를 쓴다', () => {
    expect(shouldPreferQuerySchedulePayload({ ...base, realtime: false })).toBe(true);
  });

  it('아직 스냅샷을 못 받았으면 월 쿼리를 쓴다', () => {
    expect(shouldPreferQuerySchedulePayload({ ...base, hasReceivedRealtimeSnapshot: false })).toBe(
      true
    );
  });

  it('월 쿼리 데이터가 없으면 스냅샷을 쓴다', () => {
    expect(
      shouldPreferQuerySchedulePayload({
        ...base,
        hasQueryPayload: false,
        queryScheduleCount: 0,
      })
    ).toBe(false);
  });

  it('월 쿼리가 스냅샷보다 나중에 갱신됐으면 월 쿼리를 쓴다', () => {
    expect(
      shouldPreferQuerySchedulePayload({
        ...base,
        queryUpdatedAt: 3_000,
        realtimeSnapshotAt: 2_000,
      })
    ).toBe(true);
  });

  it('건수가 같으면 더 최신인 스냅샷을 쓴다 — 지원→확정 상태 변경이 실시간 반영되는 경로', () => {
    expect(shouldPreferQuerySchedulePayload(base)).toBe(false);
  });

  it('스냅샷이 더 많이 알고 있으면 스냅샷을 쓴다 — 새 확정이 실시간으로 들어온 경로', () => {
    expect(
      shouldPreferQuerySchedulePayload({ ...base, realtimeScheduleCount: 4, queryScheduleCount: 3 })
    ).toBe(false);
  });

  // 회귀 방어: 전기간 최신 50건 스냅샷을 조회 중인 달로 자르면 창 밖 달은 0건이 된다.
  // 이 0건이 정확한 월 쿼리를 덮으면 과거 근무·수익이 통째로 사라져 보였다.
  it('스냅샷이 0건이어도 월 쿼리에 데이터가 있으면 월 쿼리를 지킨다', () => {
    expect(
      shouldPreferQuerySchedulePayload({
        ...base,
        realtimeScheduleCount: 0,
        queryScheduleCount: 12,
      })
    ).toBe(true);
  });

  it('스냅샷이 부분적으로만 덮어도(창 경계 달) 월 쿼리를 지킨다', () => {
    expect(
      shouldPreferQuerySchedulePayload({
        ...base,
        realtimeScheduleCount: 5,
        queryScheduleCount: 18,
      })
    ).toBe(true);
  });

  it('둘 다 0건이면 어느 쪽이든 같으므로 더 최신인 스냅샷을 쓴다', () => {
    expect(
      shouldPreferQuerySchedulePayload({ ...base, realtimeScheduleCount: 0, queryScheduleCount: 0 })
    ).toBe(false);
  });
});
