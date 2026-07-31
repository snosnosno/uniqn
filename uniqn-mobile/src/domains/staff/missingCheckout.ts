/**
 * missingCheckout — "퇴근 미기록" 집계 (순수 함수)
 *
 * 자동 퇴근은 만들지 않기로 했다(설계 결정: 없던 근무시간·금액이 생기므로). 그래서
 * 퇴근을 안 찍은 근무는 `checked_in` 으로 영구 잔류하고, 정산 게이트
 * (`status IN checked_out|completed`)에 **영영 도달하지 못한다**. 크론에도 미퇴근 정리
 * 잡이 없다. 즉 이 배지가 구인자에게 그 사실을 알리는 **유일한 안전망**이다.
 *
 * 🔴 지난 날짜만 센다. 오늘 근무 중인 사람도 `checked_in` 이라 함께 세면 배지가 영업시간
 * 내내 켜져 있고, 그러면 진짜 미기록과 구분되지 않아 안전망이 노이즈로 죽는다.
 */
import type { ConfirmedStaffGroup } from '@/types/confirmedStaff';

export interface MissingCheckoutSummary {
  /** 지난 날짜 중 퇴근이 기록되지 않은 근무 건수 */
  count: number;
  /** 가장 오래된 미기록 날짜(yyyy-MM-dd). 없으면 null — 배지를 눌렀을 때 갈 곳 */
  earliestDate: string | null;
}

/**
 * 날짜별 확정 스태프 그룹에서 퇴근 미기록을 집계한다.
 *
 * `stats.checkedIn` 은 `status === 'checked_in'` 인원 수다. 취소·노쇼·완료는 다른 status 라
 * 자동으로 빠지고, 노쇼는 리더 단계에서 이미 `no_show` 로 재매핑된다.
 */
export function summarizeMissingCheckouts(
  groups: readonly ConfirmedStaffGroup[]
): MissingCheckoutSummary {
  let count = 0;
  let earliestDate: string | null = null;

  for (const group of groups) {
    if (!group.isPast) continue;
    if (group.stats.checkedIn <= 0) continue;

    count += group.stats.checkedIn;
    // 정렬 순서에 기대지 않고 직접 최솟값을 고른다(yyyy-MM-dd 는 사전순=시간순).
    if (earliestDate === null || group.date < earliestDate) {
      earliestDate = group.date;
    }
  }

  return { count, earliestDate };
}
