/**
 * missingCheckout — "퇴근 미기록" 집계 (순수 함수)
 *
 * 자동 퇴근은 만들지 않기로 했다(설계 결정: 없던 근무시간·금액이 생기므로). 그래서
 * 퇴근을 안 찍은 근무는 `checked_in` 으로 영구 잔류하고, 정산 게이트
 * (`status IN checked_out|completed`)에 **영영 도달하지 못한다**. 크론에도 미퇴근 정리
 * 잡이 없다. 이 배너가 구인자에게 그 사실을 알리는 유일한 경로다.
 *
 * ⚠️ 스코프 1: 세는 것은 **출근은 찍혔는데 퇴근이 없는(`checked_in`)** 근무뿐이다.
 * 지난 날짜의 `scheduled`(출근조차 안 찍힌) 행도 정산 게이트에 도달하지 못하지만,
 * 그건 노쇼 처리 문제라 다른 축이고 이 배너의 이름과도 맞지 않는다.
 *
 * ⚠️ 스코프 2: 입력으로 받은 목록의 **날짜 범위만큼만** 본다. 화면이 보이는 달을 넣으면
 * 그 달의 미기록만 나온다 — 더 오래된 달은 사용자가 월을 넘겨야 발견된다.
 *
 * 🔴 **날짜만으로 "지났다"를 판정하면 안 된다.** 홀덤펍의 표준 근무는 18:00~02:00 라
 * `work_logs.date` 는 전날인데 새벽 1시에는 달력상 이미 "어제" 다. 사전 비교만 쓰면
 * **아직 근무 중인 사람이 매일 밤 미기록으로 잡힌다** — 그리고 근무표를 새벽에 보는
 * 사람이 바로 홀덤펍 사장이다. 그래서 어제 날짜는 야간 근무가 끝났다고 볼 수 있는
 * 시각(`OVERNIGHT_GRACE_HOUR`) 이후에만 센다.
 *
 * 오늘·미래 날짜도 세지 않는다. 근무 중인 사람을 세면 배너가 영업시간 내내 켜져 있고,
 * 그러면 진짜 미기록과 구분되지 않아 안전망이 노이즈로 죽는다.
 */
import { STATUS } from '@/constants';
import { toDateString } from '@/utils/date';
import type { WorkLog } from '@/types/schedule';

/**
 * 어제 날짜를 "지난 근무" 로 인정하기 시작하는 로컬 시각.
 *
 * 새벽 근무의 실질 종료(02~04시)와 그 뒤 퇴근 처리 여유를 덮는 값이다. 낮추면 근무 중인
 * 스태프가 미기록으로 잡히고, 올리면 진짜 미기록 발견이 늦어진다.
 */
export const OVERNIGHT_GRACE_HOUR = 10;

export interface MissingCheckoutSummary {
  /** 지난 날짜 중 퇴근이 기록되지 않은 근무 건수 */
  count: number;
  /** 가장 오래된 미기록 날짜(yyyy-MM-dd). 없으면 null — 배너를 눌렀을 때 갈 곳 */
  earliestDate: string | null;
}

/**
 * 이 날짜를 "이미 끝난 근무" 로 볼 수 있는가.
 *
 * 그룹 리더가 붙여주는 `isPast` 같은 파생 플래그를 쓰지 않는다 — 그건 **조회 시점** 에
 * 계산된 스냅샷이라 화면을 열어둔 채 자정을 넘기면 낡고, 애초에 야간 교차 근무를
 * 구분하지 못한다.
 */
function isFinishedWorkDate(date: string, now: Date): boolean {
  if (!date) return false;

  const today = toDateString(now);
  if (date >= today) return false;

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toDateString(yesterdayDate);

  // 그제 이전은 어떤 야간 근무여도 끝났다.
  if (date < yesterday) return true;

  // 어제 = 아직 근무 중일 수 있다. 유예 시각을 넘겨야 센다.
  return now.getHours() >= OVERNIGHT_GRACE_HOUR;
}

/**
 * 근무 기록 목록에서 퇴근 미기록을 집계한다.
 *
 * `checked_in` = 출근은 찍혔는데 퇴근이 없는 상태. 취소·노쇼·완료는 다른 status 라 자동으로
 * 빠진다.
 *
 * 🔑 입력은 **지점 스팬**(컨테이너 직접 배치 + 그 지점에 걸린 공고 전부) 이어야 한다.
 * 컨테이너 직속 행만 넣으면 지점에서 공고로 뽑은 스태프의 미기록이 통째로 빠져,
 * "유일한 안전망" 이 조용히 절반만 본다.
 */
export function summarizeMissingCheckouts(
  workLogs: readonly WorkLog[],
  now: Date
): MissingCheckoutSummary {
  let count = 0;
  let earliestDate: string | null = null;

  for (const log of workLogs) {
    if (log.status !== STATUS.WORK_LOG.CHECKED_IN) continue;
    if (!isFinishedWorkDate(log.date, now)) continue;

    count += 1;
    // 정렬 순서에 기대지 않고 직접 최솟값을 고른다(yyyy-MM-dd 는 사전순=시간순).
    if (earliestDate === null || log.date < earliestDate) {
      earliestDate = log.date;
    }
  }

  return { count, earliestDate };
}
