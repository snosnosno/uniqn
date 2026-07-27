/**
 * 월 스케줄 화면의 두 데이터 소스(월 쿼리 vs 실시간 스냅샷) 중 무엇을 화면에 쓸지 판정.
 *
 * 두 소스는 **범위가 다르다**:
 * - 월 쿼리: 조회 중인 달로 정확히 스코프됨 (`getSchedulesByMonth`).
 * - 실시간 스냅샷: `work_logs` 는 전기간 최신 50건(`WorkLogRepository.subscribeByStaffId` →
 *   `getByStaffId(staffId, DEFAULT_PAGE_SIZE)`)을 가져온 뒤 화면에서 해당 달로 잘라낸다.
 *
 * 그래서 조회 중인 달이 그 50건 창(window) 밖이면 스냅샷은 **정상적으로 0건**이 된다.
 * 이 0건이 정확한 월 쿼리 결과를 덮으면 과거 근무와 수익이 통째로 사라진 것처럼 보인다 —
 * 월 20일 일하는 스태프는 2~3개월만 거슬러 올라가도 재현되고, 정산 이의 제기 근거가
 * 앱에서 소실된 것처럼 읽혀 신뢰가 무너진다.
 *
 * 판정 원칙: **스냅샷이 월 쿼리보다 적게 알고 있으면 월 쿼리를 신뢰한다.**
 * 지원 상태 변경(지원→확정)은 건수가 줄지 않으므로 실시간 반영이 그대로 유지되고,
 * 건수가 줄어드는 변화(취소·삭제)는 화면의 명시적 refresh 로 수렴한다.
 */
export interface SchedulePayloadPreferenceInput {
  /** 실시간 구독을 켠 화면인지 */
  realtime: boolean;
  /** 실시간 스냅샷을 한 번이라도 받았는지 */
  hasReceivedRealtimeSnapshot: boolean;
  /** 월 쿼리가 실제 데이터를 갖고 있는지 */
  hasQueryPayload: boolean;
  /** 월 쿼리 데이터 갱신 시각 (react-query dataUpdatedAt) */
  queryUpdatedAt: number;
  /** 마지막 실시간 스냅샷 수신 시각 */
  realtimeSnapshotAt: number;
  /** 월로 필터링한 실시간 스냅샷 건수 */
  realtimeScheduleCount: number;
  /** 월 쿼리 건수 */
  queryScheduleCount: number;
}

/**
 * 월 쿼리 payload 를 화면에 쓸지 여부.
 * false 면 실시간 스냅샷 payload 를 쓴다.
 */
export function shouldPreferQuerySchedulePayload({
  realtime,
  hasReceivedRealtimeSnapshot,
  hasQueryPayload,
  queryUpdatedAt,
  realtimeSnapshotAt,
  realtimeScheduleCount,
  queryScheduleCount,
}: SchedulePayloadPreferenceInput): boolean {
  if (!realtime) return true;
  if (!hasReceivedRealtimeSnapshot) return true;
  if (!hasQueryPayload) return false;

  // 월 쿼리가 스냅샷보다 나중에 갱신됐으면 더 최신이다.
  if (queryUpdatedAt > realtimeSnapshotAt) return true;

  // 스냅샷이 월 쿼리보다 적게 알고 있으면 창(window) 밖 달이라는 뜻 —
  // 스냅샷이 정확한 월 데이터를 지우게 두지 않는다.
  return realtimeScheduleCount < queryScheduleCount;
}
