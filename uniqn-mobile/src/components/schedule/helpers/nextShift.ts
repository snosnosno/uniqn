/**
 * '내 다음 근무' 선택 규칙.
 *
 * 스케줄 탭을 여는 이유의 대부분은 "나 오늘/내일 언제 어디로 가지?"인데,
 * 화면 최상단은 월 집계였고 오늘 일정이 없는 날(단발 알바의 대부분)엔 달력 아래가
 * 비어 다음 근무를 알려면 점을 눈으로 찾아 탭해야 했다. 그 질문에 한 번에 답하는
 * 카드가 무엇을 골라야 하는지를 여기서 정한다.
 */
import { STATUS } from '@/constants';
import type { AttendanceStatus } from '@/shared/status';
import type { ScheduleEvent } from '@/types';

/**
 * 아직 '내 앞에 남아있는' 근무로 볼 출퇴근 상태.
 *
 * `ScheduleEvent.status` 는 WorkLogStatus 가 아니라 **AttendanceStatus**
 * (`not_started | checked_in | checked_out`)다. 여기에 'scheduled' 를 쓰면
 * 아직 출근 전인 근무가 하나도 매치되지 않아 히어로가 영원히 비어버린다.
 */
const PENDING_ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  STATUS.ATTENDANCE.NOT_STARTED,
  STATUS.ATTENDANCE.CHECKED_IN,
];

/**
 * 다음 근무 1건을 고른다.
 *
 * - 확정(confirmed) 건만 본다. 지원 중은 갈지 안 갈지 모르는 일정이라 히어로에 올리지 않는다.
 * - 퇴근·완료·노쇼·취소된 건은 이미 끝난 일이므로 건너뛴다(출근 중인 건은 남긴다).
 * - 오늘 것을 먼저, 같은 날이면 시작 시각이 이른 것을 먼저.
 *
 * @param candidates 오늘 스케줄과 이번 달 스케줄을 합친 목록 (중복 허용 — id 로 접는다)
 * @param todayStr   오늘 날짜 (YYYY-MM-DD)
 */
export function pickNextShift(
  candidates: readonly ScheduleEvent[],
  todayStr: string
): ScheduleEvent | null {
  const seen = new Set<string>();
  const eligible: ScheduleEvent[] = [];

  for (const schedule of candidates) {
    if (seen.has(schedule.id)) continue;
    seen.add(schedule.id);

    if (schedule.type !== STATUS.SCHEDULE.CONFIRMED) continue;
    if (!schedule.date || schedule.date < todayStr) continue;
    if (!PENDING_ATTENDANCE_STATUSES.includes(schedule.status)) continue;

    eligible.push(schedule);
  }

  if (eligible.length === 0) return null;

  // startTime 은 Date | null 이다. 문자열로 비교하면 로케일 표기가 섞여 정렬이 조용히 깨진다.
  const startMs = (schedule: ScheduleEvent) =>
    schedule.startTime ? schedule.startTime.getTime() : Number.POSITIVE_INFINITY;

  eligible.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return startMs(a) - startMs(b);
  });

  return eligible[0];
}
