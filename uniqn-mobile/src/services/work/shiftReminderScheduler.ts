/**
 * 근무 리마인더 로컬 알림 동기화.
 *
 * `CHECKIN_REMINDER` 타입·템플릿·딥링크는 이미 있었고 **발송 주체만 0** 이었다.
 * 서버 크론 없이 즉시 가능한 경로로, 확정 근무마다 전날 20시를 예약한다.
 *
 * 원칙:
 * - 화면을 절대 막지 않는다(fire-and-forget). 어떤 실패도 스케줄 조회를 방해하지 않는다.
 * - 예약 식별자를 MMKV 원장에 키로 보관해, 취소·시간변경·퇴근 시 남은 알림을 정리한다.
 * - 계획(무엇을 언제)은 shiftReminderPlan 의 순수 함수가 정하고 여기선 반영만 한다.
 */
import {
  scheduleLocalNotification,
  cancelScheduledNotification,
} from '@/services/notifications/internal/pushNotificationHandlers';
import { createNotificationMessage } from '@/constants/notificationTemplates';
import { NotificationType } from '@/types/notification';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import { planShiftReminders, type ShiftReminder } from './shiftReminderPlan';
import type { ScheduleEvent } from '@/types';

/** key → OS 알림 식별자 */
type ReminderLedger = Record<string, string>;

/**
 * 지금 동기화를 돌려도 되는가.
 *
 * 🔴 게이트는 "목록이 비었나" 가 아니라 **"로드가 끝났나"** 다.
 *
 * - 성공했는데 0건이면 **돌려야 한다.** sync 는 예약뿐 아니라 원장 정리도 하므로,
 *   빈 목록에서 건너뛰면 계획에서 사라진 예약(취소·퇴근·종류 폐지)이 영영 취소되지 않는다.
 * - 로딩·에러 중에는 **돌리면 안 된다.** 그 구간의 목록은 실제 0건이 아니라 폴백 빈 배열이라,
 *   그대로 넘기면 원장의 모든 키가 "계획에서 사라진 것" 으로 판정돼 취소된다. 조회가 에러로
 *   끝나면 재예약도 없어 확정 근무 알림이 통째로 무음 소실된다.
 */
export function shouldSyncShiftReminders(state: { isLoading: boolean; error?: unknown }): boolean {
  return !state.isLoading && !state.error;
}

function readLedger(): ReminderLedger {
  return getStorageItem<ReminderLedger>(STORAGE_KEYS.SHIFT_REMINDERS) ?? {};
}

function writeLedger(ledger: ReminderLedger): void {
  setStorageItem(STORAGE_KEYS.SHIFT_REMINDERS, ledger);
}

async function scheduleOne(reminder: ShiftReminder): Promise<string | null> {
  const message = createNotificationMessage(NotificationType.CHECKIN_REMINDER, {
    jobTitle: reminder.jobPostingName,
    workDate: reminder.workDate,
    remainingTime: reminder.remainingLabel,
  });

  return scheduleLocalNotification(
    {
      title: message.title,
      body: message.body,
      data: {
        type: NotificationType.CHECKIN_REMINDER,
        workLogId: reminder.workLogId,
        workDate: reminder.workDate,
        link: message.link,
      },
    },
    { trigger: { date: reminder.fireAt } }
  );
}

/**
 * 현재 확정 근무 목록에 맞춰 예약을 맞춘다.
 *
 * 계획에 없어진 예약은 취소하고(취소·시간변경·퇴근), 새로 생긴 것만 예약한다.
 * 이미 같은 키로 예약돼 있으면 건드리지 않는다 — 매 렌더마다 재예약하면 OS 슬롯이 샌다.
 */
export async function syncShiftReminders(
  schedules: readonly ScheduleEvent[],
  now: Date = new Date()
): Promise<void> {
  try {
    const planned = planShiftReminders(schedules, now);
    const plannedKeys = new Set(planned.map((reminder) => reminder.key));
    const ledger = readLedger();

    // 1. 계획에서 사라진 예약 취소
    const staleKeys = Object.keys(ledger).filter((key) => !plannedKeys.has(key));
    for (const key of staleKeys) {
      await cancelScheduledNotification(ledger[key]);
      delete ledger[key];
    }

    // 2. 아직 예약되지 않은 것만 예약
    for (const reminder of planned) {
      if (ledger[reminder.key]) continue;

      const identifier = await scheduleOne(reminder);
      if (identifier) {
        ledger[reminder.key] = identifier;
      }
    }

    writeLedger(ledger);

    if (staleKeys.length > 0 || planned.length > 0) {
      logger.info('근무 리마인더 동기화', {
        planned: planned.length,
        cancelled: staleKeys.length,
        active: Object.keys(ledger).length,
      });
    }
  } catch (error) {
    // 알림 예약 실패가 스케줄 화면을 막아선 안 된다.
    logger.warn('근무 리마인더 동기화 실패', { message: (error as Error).message });
  }
}
