/**
 * 근무 리마인더 예약 계획 (순수 함수).
 *
 * 확정 근무를 잊는 것이 단발 알바의 1순위 사고다. 노쇼는 스태프의 평판과 사장의 당일
 * 운영을 동시에 망가뜨리는데, 리뷰 독촉 알림은 매일 정확히 오면서 정작 돈이 걸린
 * 근무 알림만 오지 않았다 — `CHECKIN_REMINDER` 타입·템플릿·딥링크는 이미 있고
 * **발송 주체만 0** 이었다.
 *
 * 여기서는 "무엇을 언제 울릴지"만 정한다. 실제 예약/취소는 shiftReminderScheduler 가 한다.
 */
import { STATUS } from '@/constants';
import type { ScheduleEvent } from '@/types';

/**
 * 전날 알림을 울릴 시각 (로컬 20시).
 *
 * ⚠️ "정확히 24시간 전"으로 바꾸지 말 것 — 새벽 2시 근무면 전날 새벽 2시에 발사된다.
 * 고정 20시가 결과적으로 "하루 전"이면서 취침 시간을 피한다.
 */
const DAY_BEFORE_HOUR = 20;
/** 이보다 먼 근무는 아직 예약하지 않는다 (OS 예약 슬롯 낭비 방지) */
const MAX_LOOKAHEAD_DAYS = 30;

/**
 * 종류는 전날 알림 하나뿐이다.
 *
 * 예전에는 '출근 2시간 전'도 함께 울렸으나 제거했다(설계 결정 6). 키 접두사로 계속
 * 쓰이므로 단일 멤버 유니온을 유지한다 — `kind` 를 없애면 MMKV 원장의 기존 키
 * (`{workLogId}:day-before`)가 전부 stale 로 판정돼 불필요한 취소·재예약이 돈다.
 */
export type ShiftReminderKind = 'day-before';

export interface ShiftReminder {
  /** 예약 식별용 안정 키 — 같은 근무·같은 종류면 항상 같다 */
  key: string;
  workLogId: string;
  kind: ShiftReminderKind;
  fireAt: Date;
  jobPostingName: string;
  workDate: string;
  /** 알림 문구의 '출근 N 전' 자리 */
  remainingLabel: string;
}

function atLocalHour(date: string, hour: number): Date | null {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function daysBetween(from: Date, toDate: Date): number {
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(toDate) - startOfDay(from)) / (24 * 60 * 60 * 1000));
}

/**
 * 확정 근무 목록 → 예약할 리마인더 목록.
 *
 * - 확정이고 아직 퇴근하지 않은 근무만 본다.
 * - 이미 지난 시각은 예약하지 않는다(OS 가 즉시 발사해 버린다).
 * - 출근 시각은 보지 않는다 — 전날 20시 하나만 울리므로 '미정'인 근무도 동일하게 예약된다.
 */
export function planShiftReminders(
  schedules: readonly ScheduleEvent[],
  now: Date
): ShiftReminder[] {
  const reminders: ShiftReminder[] = [];

  for (const schedule of schedules) {
    if (schedule.type !== STATUS.SCHEDULE.CONFIRMED) continue;
    if (schedule.status === STATUS.ATTENDANCE.CHECKED_OUT) continue;
    if (!schedule.date || !schedule.workLogId) continue;

    const shiftDay = atLocalHour(schedule.date, 0);
    if (!shiftDay) continue;

    const lookahead = daysBetween(now, shiftDay);
    if (lookahead < 0 || lookahead > MAX_LOOKAHEAD_DAYS) continue;

    const jobPostingName = schedule.jobPostingName || '근무';

    // 전날 20시
    const dayBefore = atLocalHour(schedule.date, DAY_BEFORE_HOUR);
    if (dayBefore) {
      dayBefore.setDate(dayBefore.getDate() - 1);
      if (dayBefore.getTime() > now.getTime()) {
        reminders.push({
          key: `${schedule.workLogId}:day-before`,
          workLogId: schedule.workLogId,
          kind: 'day-before',
          fireAt: dayBefore,
          jobPostingName,
          workDate: schedule.date,
          remainingLabel: '하루',
        });
      }
    }
  }

  return reminders.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
