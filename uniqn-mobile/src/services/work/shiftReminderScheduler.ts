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
import { getStorageItem, setStorageItem, removeStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { toDateString } from '@/utils/date';
import { logger } from '@/utils/logger';
import { planShiftReminders, type ShiftReminder } from './shiftReminderPlan';
import type { ScheduleEvent } from '@/types';

/**
 * 이번 동기화에 넘어온 `schedules` 가 **실제로 관측한 날짜 창**(양끝 포함, YYYY-MM-DD).
 *
 * 호출자는 자기가 가진 목록이 전체가 아닐 수 있음을 여기서 밝힌다. 이 선언이 없으면
 * 스케줄러는 "계획에 없다" 를 "취소됐다" 로 읽을 수밖에 없다 — 두 명제는 다르다.
 */
export interface ShiftReminderCoverage {
  start: string;
  end: string;
}

interface ReminderLedgerEntry {
  /** OS 알림 식별자 */
  id: string;
  /**
   * 이 예약이 가리키는 근무일(YYYY-MM-DD).
   * 없으면 이 필드 도입 이전(v1)에 쓰인 항목이다 — 취소 규칙의 주석 참조.
   */
  workDate?: string;
}

/** key → 예약 항목 */
type ReminderLedger = Record<string, ReminderLedgerEntry>;

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

/**
 * 원장 raw 값 → 항목. v1 은 값이 **식별자 문자열 그 자체**였으므로 그 형태도 읽는다.
 * 형태를 못 알아보는 값은 버린다(식별자를 모르면 취소도 못 하고 재예약도 못 한다).
 */
function toLedgerEntry(raw: unknown): ReminderLedgerEntry | null {
  if (typeof raw === 'string') {
    return raw.length > 0 ? { id: raw } : null;
  }
  if (raw !== null && typeof raw === 'object') {
    const { id, workDate } = raw as { id?: unknown; workDate?: unknown };
    if (typeof id !== 'string' || id.length === 0) return null;
    return typeof workDate === 'string' && workDate.length > 0 ? { id, workDate } : { id };
  }
  return null;
}

function readLedger(): ReminderLedger {
  const raw = getStorageItem<Record<string, unknown>>(STORAGE_KEYS.SHIFT_REMINDERS) ?? {};
  return Object.entries(raw).reduce<ReminderLedger>((acc, [key, value]) => {
    const entry = toLedgerEntry(value);
    return entry ? { ...acc, [key]: entry } : acc;
  }, {});
}

function writeLedger(ledger: ReminderLedger): void {
  setStorageItem(STORAGE_KEYS.SHIFT_REMINDERS, ledger);
}

/**
 * 계획에 없는 원장 항목을 **취소해도 되는가**.
 *
 * 🔴 이 판정이 없던 시절, 스케줄러는 '이번 입력의 계획에 없음' 을 그대로 '취소됨' 으로 읽었다.
 *    입력이 이미 한 달로 좁혀져 있었기 때문에, 스태프가 지난 정산을 보려고 달력을 **한 번만
 *    넘겨도** 다음 달 확정 근무의 알림이 조용히 취소됐다(감사 H1). 더 나쁜 쪽은 다음 달 초
 *    근무다 — 기본 뷰(이번 달)에 아예 없어서 '다음 달 보기 → 돌아오기' 만으로 파괴됐다.
 */
function canCancel(
  entry: ReminderLedgerEntry,
  coverage: ShiftReminderCoverage,
  todayStr: string
): boolean {
  // 근무일을 모르는 v1 항목은 판단 근거가 없다 → 예전 규칙 그대로 정리한다.
  //
  // ⚠️ "업그레이드 직후엔 어차피 전부 계획에 포함된다"는 **보장이 아니다.** 마지막으로 본 달과
  //    전환 후 첫 화면의 달이 다르면(예: 8월을 보다가 종료 → 7월에 재실행) v1 항목은 여기서
  //    취소된다. 그래도 받아들이는 이유는 **손실 상한이 구 동작과 같기 때문**이다 —
  //    구 코드의 취소 조건도 자구 그대로 "계획에 없음"이었다. 즉 이 분기는 회귀가 아니라
  //    전환 주기 1회에 한한 잔여이고, 해당 달을 다시 열면 재예약으로 치유된다.
  if (!entry.workDate) return true;

  // 이미 지난 근무 — 알림은 발사됐거나 무의미하다. 창 밖이어도 정리해야 원장이 무한정 자라지 않는다.
  if (entry.workDate < todayStr) return true;

  // 관측하지 못한 날짜는 건드리지 않는다. 그 날을 실제로 본 동기화가 정리한다.
  //
  // 감수하는 트레이드오프: 창 밖에서 근무가 취소되면 그 달을 다시 열기 전까지 알림이 남아
  // "내일 출근"이 한 번 잘못 울릴 수 있다. 그러나 이건 **거짓 양성**이고, 이 함수가 막으려는
  // 거짓 음성(유효한 근무의 알림이 사라져 노쇼)보다 훨씬 가볍다.
  return entry.workDate >= coverage.start && entry.workDate <= coverage.end;
}

/**
 * 원장의 모든 예약을 취소하고 원장을 비운다. **로그아웃 전용.**
 *
 * 🔴 원장(MMKV `shift-reminders-v1`)은 **사용자 스코프가 아니다.** 그래서 공용 기기에서
 *    A 가 로그아웃하고 B 가 로그인하면, A 의 예약이 그대로 남아 B 의 기기에서
 *    A 의 지점명·근무일을 띄운다. 같은 위협을 `signOut` 은 푸시 토큰에 대해 이미 다루고
 *    있었는데(authCoreService: "공용 기기에서 이전 계정으로 푸시가 잔존하는 것을 막기 위해")
 *    **로컬 알림만 빠져 있었다.**
 *
 *    이전에는 H1 결함이 이걸 우연히 가렸다 — B 가 스케줄 탭을 열면 sync 가 계획에 없는 키를
 *    전량 취소했기 때문이다. 관측 창을 도입해 그 부수 효과가 사라졌으므로 명시적으로 닫는다.
 *
 * fire-and-forget: 정리 실패가 로그아웃을 막아선 안 된다.
 */
export async function clearShiftReminders(): Promise<void> {
  try {
    const ledger = readLedger();
    for (const entry of Object.values(ledger)) {
      await cancelScheduledNotification(entry.id);
    }
    removeStorageItem(STORAGE_KEYS.SHIFT_REMINDERS);
  } catch (error) {
    logger.warn('근무 리마인더 원장 정리 실패', { message: (error as Error).message });
  }
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
 *
 * 🔴 `coverage` 는 선택이 아니다. 호출자가 넘기는 `schedules` 는 대개 전체가 아니라
 *    화면이 보고 있는 구간(예: 이번 달)이라, 그 사실을 함께 넘겨야 창 밖의 유효 예약을
 *    "사라진 것" 으로 오판하지 않는다. 목록 전체를 가진 호출자는 그 전체 범위를 넘기면 된다.
 */
export async function syncShiftReminders(
  schedules: readonly ScheduleEvent[],
  coverage: ShiftReminderCoverage,
  now: Date = new Date()
): Promise<void> {
  try {
    const planned = planShiftReminders(schedules, now);
    const plannedKeys = new Set(planned.map((reminder) => reminder.key));
    const previous = readLedger();
    const todayStr = toDateString(now);

    // 1. 계획에서 사라졌고, **이번 입력이 실제로 관측한 날짜**인 예약만 취소
    const next: ReminderLedger = {};
    let cancelled = 0;
    for (const [key, entry] of Object.entries(previous)) {
      if (plannedKeys.has(key) || !canCancel(entry, coverage, todayStr)) {
        next[key] = entry;
        continue;
      }
      await cancelScheduledNotification(entry.id);
      cancelled += 1;
    }

    // 2. 아직 예약되지 않은 것만 예약. 이미 있는 v1 항목은 근무일을 채워 넣는다
    //    — 그래야 다음 동기화부터 창 판정이 가능해진다.
    for (const reminder of planned) {
      const existing = next[reminder.key];
      if (existing) {
        if (!existing.workDate) {
          next[reminder.key] = { ...existing, workDate: reminder.workDate };
        }
        continue;
      }

      const identifier = await scheduleOne(reminder);
      if (identifier) {
        next[reminder.key] = { id: identifier, workDate: reminder.workDate };
      }
    }

    writeLedger(next);

    if (cancelled > 0 || planned.length > 0) {
      logger.info('근무 리마인더 동기화', {
        planned: planned.length,
        cancelled,
        active: Object.keys(next).length,
        coverage: `${coverage.start}~${coverage.end}`,
      });
    }
  } catch (error) {
    // 알림 예약 실패가 스케줄 화면을 막아선 안 된다.
    logger.warn('근무 리마인더 동기화 실패', { message: (error as Error).message });
  }
}
