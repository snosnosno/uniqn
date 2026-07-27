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

/** 전날 알림을 울릴 시각 (로컬 20시) */
const DAY_BEFORE_HOUR = 20;
/** 당일 알림을 울릴 시점 — 출근 N시간 전 */
const HOURS_BEFORE_START = 2;
/** 이보다 먼 근무는 아직 예약하지 않는다 (OS 예약 슬롯 낭비 방지) */
const MAX_LOOKAHEAD_DAYS = 30;

export type ShiftReminderKind = 'day-before' | 'hours-before';

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
 * - 시작 시각을 모르면 당일 알림은 건너뛰고 전날 알림만 남긴다.
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

    // 출근 2시간 전
    if (schedule.startTime) {
      const hoursBefore = new Date(schedule.startTime.getTime() - HOURS_BEFORE_START * 3600_000);
      if (hoursBefore.getTime() > now.getTime()) {
        reminders.push({
          key: `${schedule.workLogId}:hours-before`,
          workLogId: schedule.workLogId,
          kind: 'hours-before',
          fireAt: hoursBefore,
          jobPostingName,
          workDate: schedule.date,
          remainingLabel: `${HOURS_BEFORE_START}시간`,
        });
      }
    }
  }

  return reminders.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
