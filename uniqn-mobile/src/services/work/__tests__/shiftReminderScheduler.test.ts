/**
 * syncShiftReminders — 원장(MMKV) 취소·유지 규칙.
 *
 * 이 파일이 생기기 전까지 **원장을 실제로 건드리는 로직에는 테스트가 0건**이었다.
 * 기존 두 스위트는 순수 계획 함수(planShiftReminders)와 게이트(shouldSyncShiftReminders)만
 * 봤고, 그 사이를 잇는 "월 스코프 입력이 원장 취소에 미치는 영향"은 아무도 보지 않았다 —
 * 그래서 감사의 유일한 HIGH(H1)가 아무 테스트도 깨뜨리지 않고 들어왔다.
 *
 * 계획 함수는 목하지 않는다. 목하면 "어떤 입력이 어떤 계획을 낳는가"가 사라져
 * 정작 이 결함(입력 범위 ↔ 취소 판정의 어긋남)을 못 잡는다.
 */
import { clearShiftReminders, syncShiftReminders } from '../shiftReminderScheduler';
import type { ScheduleEvent } from '@/types';

const LEDGER_KEY = 'shift-reminders-v1';

let mockStore: Record<string, unknown> = {};
jest.mock('@/lib/mmkvStorage', () => ({
  STORAGE_KEYS: { SHIFT_REMINDERS: 'shift-reminders-v1' },
  getStorageItem: (key: string) => mockStore[key],
  setStorageItem: (key: string, value: unknown) => {
    mockStore[key] = value;
  },
  removeStorageItem: (key: string) => {
    delete mockStore[key];
  },
}));

const mockScheduleLocalNotification = jest.fn();
const mockCancelScheduledNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/notifications/internal/pushNotificationHandlers', () => ({
  scheduleLocalNotification: (...args: unknown[]) => mockScheduleLocalNotification(...args),
  cancelScheduledNotification: (...args: unknown[]) => mockCancelScheduledNotification(...args),
}));

// 알림 문구는 이 테스트의 관심사가 아니다 — 템플릿이 바뀌어도 원장 규칙 검증이 흔들리면 안 된다.
jest.mock('@/constants/notificationTemplates', () => ({
  createNotificationMessage: () => ({ title: '제목', body: '본문', link: '/schedule' }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const NOW = new Date('2026-07-27T09:00:00');
const JULY = { start: '2026-07-01', end: '2026-07-31' };
const AUGUST = { start: '2026-08-01', end: '2026-08-31' };

function shift(overrides: Record<string, unknown> = {}): ScheduleEvent {
  return {
    id: 's1',
    workLogId: 'wl-1',
    type: 'confirmed',
    status: 'not_started',
    date: '2026-07-29',
    startTime: new Date('2026-07-29T18:00:00'),
    jobPostingName: '강남 홀덤펍',
    ...overrides,
  } as unknown as ScheduleEvent;
}

const julyShift = shift({ workLogId: 'wl-jul', date: '2026-07-29' });
const augustShift = shift({
  workLogId: 'wl-aug',
  date: '2026-08-05',
  startTime: new Date('2026-08-05T18:00:00'),
});

function ledger(): Record<string, { id: string; workDate?: string }> {
  return (mockStore[LEDGER_KEY] ?? {}) as Record<string, { id: string; workDate?: string }>;
}

beforeEach(() => {
  mockStore = {};
  mockScheduleLocalNotification.mockReset();
  mockCancelScheduledNotification.mockReset().mockResolvedValue(undefined);
  let seq = 0;
  mockScheduleLocalNotification.mockImplementation(() => Promise.resolve(`os-${++seq}`));
});

describe('syncShiftReminders — 관측 창 밖 보호(감사 H1)', () => {
  // 🔴 이 스위트의 본체. 스태프가 8월 근무로 알림을 잡아둔 뒤 지난 정산을 보려고 7월로
  //    한 번 넘기면, 7월 목록에는 8월 근무가 없다. 예전 규칙은 그것을 "계획에서 사라졌다"로
  //    읽고 즉시 취소했고, 8월로 돌아오지 않은 채 7/31 20시가 지나면 알림이 오지 않았다.
  it('다른 달을 보는 동안에도 그 달 밖의 유효 예약을 취소하지 않는다', async () => {
    await syncShiftReminders([augustShift], AUGUST, { offline: false, now: NOW });
    expect(ledger()).toHaveProperty('wl-aug:day-before');

    mockCancelScheduledNotification.mockClear();
    await syncShiftReminders([julyShift], JULY, { offline: false, now: NOW });

    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
    expect(ledger()['wl-aug:day-before']).toEqual({ id: 'os-1', workDate: '2026-08-05' });
    // 7월 것은 정상적으로 새로 잡힌다 — 보호가 예약까지 막지는 않는다.
    expect(ledger()).toHaveProperty('wl-jul:day-before');
  });

  // 대조군 — 보호가 "아무것도 취소 못 하는" 방향으로 새면 취소·퇴근한 근무의 알림이 영영 남는다.
  it('관측한 창 안에서 계획이 사라진 예약은 그대로 취소한다', async () => {
    await syncShiftReminders([augustShift], AUGUST, { offline: false, now: NOW });
    const identifier = ledger()['wl-aug:day-before'].id;

    mockCancelScheduledNotification.mockClear();
    await syncShiftReminders([], AUGUST, { offline: false, now: NOW });

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith(identifier);
    expect(ledger()).not.toHaveProperty('wl-aug:day-before');
  });

  // 창 밖이라고 무조건 남기면 원장이 무한정 자란다. 지난 근무는 시간이 알려주는 확정 정보다.
  it('이미 지난 근무의 원장 항목은 창 밖이어도 정리한다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-old:day-before': { id: 'os-old', workDate: '2026-07-01' } };

    await syncShiftReminders([augustShift], AUGUST, { offline: false, now: NOW });

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith('os-old');
    expect(ledger()).not.toHaveProperty('wl-old:day-before');
  });
});

describe('syncShiftReminders — 오프라인 빈 폴백 보호', () => {
  // 🔴 이 스위트의 본체. 오프라인이면 `useSchedules` 가 `error` 를 항상 null 로 접고
  //    (`error: isOnline ? … : null`) 쿼리는 `enabled: … && isOnline` 이라 아예 돌지 않아
  //    `isLoading` 도 false 다. 그래서 게이트(`shouldSyncShiftReminders`)는 열리는데 목록은
  //    캐시가 없으면 `EMPTY_SCHEDULE_QUERY_PAYLOAD` 빈 배열이다. 그 빈 배열을 '계획'으로
  //    믿으면 관측 창 안의 유효 예약이 전부 취소된다.
  it('오프라인에서 목록이 비어도 앞으로의 예약을 취소하지 않는다', async () => {
    await syncShiftReminders([augustShift], AUGUST, { offline: false, now: NOW });
    expect(ledger()).toHaveProperty('wl-aug:day-before');

    mockCancelScheduledNotification.mockClear();
    await syncShiftReminders([], AUGUST, { offline: true, now: NOW });

    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
    expect(ledger()['wl-aug:day-before']).toEqual({ id: 'os-1', workDate: '2026-08-05' });
  });

  // 대조군 — 같은 입력이 온라인이면 취소돼야 한다. 이게 red 가 되지 않으면 위 테스트는
  // '오프라인 보호'가 아니라 '아무것도 취소 안 함'을 확인하는 공허한 단언이다.
  it('같은 입력이라도 온라인이면 취소한다(보호가 오프라인 한정임을 못박는다)', async () => {
    await syncShiftReminders([augustShift], AUGUST, { offline: false, now: NOW });
    const identifier = ledger()['wl-aug:day-before'].id;

    mockCancelScheduledNotification.mockClear();
    await syncShiftReminders([], AUGUST, { offline: false, now: NOW });

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith(identifier);
    expect(ledger()).not.toHaveProperty('wl-aug:day-before');
  });

  // 🔴 "오프라인이면 통째로 건너뛴다" 와 구별되는 지점. 지난 근무 정리는 근거가 시계뿐이라
  //    네트워크가 필요 없다 — 이것까지 막으면 원장이 무한정 자란다.
  it('오프라인이어도 이미 지난 근무의 원장 항목은 정리한다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-old:day-before': { id: 'os-old', workDate: '2026-07-01' } };

    await syncShiftReminders([], AUGUST, { offline: true, now: NOW });

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith('os-old');
    expect(ledger()).not.toHaveProperty('wl-old:day-before');
  });

  // 취소만 막고 예약은 살린다 — 오프라인 캐시로 목록이 살아 있으면 새 근무는 잡혀야 한다.
  it('오프라인이어도 계획에 있는 새 근무는 예약한다', async () => {
    await syncShiftReminders([julyShift], JULY, { offline: true, now: NOW });

    expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);
    expect(ledger()).toHaveProperty('wl-jul:day-before');
  });

  // 근무일을 모르는 v1 항목은 창 판정이 불가능하다. 온라인이면 예전 규칙대로 정리하지만,
  // 오프라인의 빈 폴백에서까지 지우면 전환 직후 사용자의 알림이 통째로 사라진다.
  it('오프라인에서는 근무일을 모르는 v1 항목도 보존한다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-aug:day-before': 'os-legacy-aug' };

    await syncShiftReminders([], AUGUST, { offline: true, now: NOW });

    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
    expect(ledger()).toHaveProperty('wl-aug:day-before');
  });
});

describe('syncShiftReminders — 원장 v1 하위호환', () => {
  // v1 은 값이 식별자 문자열 그 자체였다. 계획에 있으면 재예약하지 말고 근무일만 채워야 한다
  // — 재예약하면 같은 근무에 알림이 둘 잡힌다.
  it('문자열 항목(v1)은 재예약 없이 근무일을 채워 넣는다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-jul:day-before': 'os-legacy' };

    await syncShiftReminders([julyShift], JULY, { offline: false, now: NOW });

    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
    expect(ledger()['wl-jul:day-before']).toEqual({ id: 'os-legacy', workDate: '2026-07-29' });
  });

  it('이미 예약된 키는 다시 예약하지 않는다(OS 슬롯 누수 방지)', async () => {
    await syncShiftReminders([julyShift], JULY, { offline: false, now: NOW });
    expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);

    await syncShiftReminders([julyShift], JULY, { offline: false, now: NOW });
    expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);
  });

  // 창 보호는 근무일을 아는 항목에만 적용된다. v1 항목은 판단 근거가 없어 예전 규칙대로
  // 정리되며, 이 손실 상한은 구 동작과 같다 — 그 사실을 단언으로 못박아 둔다.
  // (마지막으로 본 달 ≠ 전환 후 첫 화면의 달이면 실제로 여기까지 온다.)
  it('근무일을 모르는 v1 항목은 창 밖이어도 계획에 없으면 취소된다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-aug:day-before': 'os-legacy-aug' };

    await syncShiftReminders([julyShift], JULY, { offline: false, now: NOW });

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith('os-legacy-aug');
    expect(ledger()).not.toHaveProperty('wl-aug:day-before');
  });
});

describe('clearShiftReminders — 공용 기기 계정 전환', () => {
  // 🔴 원장은 사용자 스코프가 아니다. 관측 창을 도입하기 전에는 H1 결함이 이걸 우연히 가렸다
  //    — B 가 스케줄 탭을 열면 sync 가 계획에 없는 키를 전량 취소했기 때문이다.
  //    이제 창 밖 항목이 살아남으므로, 로그아웃에서 명시적으로 지우지 않으면
  //    A 의 지점명·근무일이 B 의 기기에서 발화한다.
  it('원장의 모든 예약을 취소하고 원장을 비운다', async () => {
    await syncShiftReminders(
      [julyShift, augustShift],
      { start: '2026-07-01', end: '2026-08-31' },
      {
        offline: false,
        now: NOW,
      }
    );
    const identifiers = Object.values(ledger()).map((entry) => entry.id);
    expect(identifiers).toHaveLength(2);

    mockCancelScheduledNotification.mockClear();
    await clearShiftReminders();

    for (const identifier of identifiers) {
      expect(mockCancelScheduledNotification).toHaveBeenCalledWith(identifier);
    }
    expect(mockStore[LEDGER_KEY]).toBeUndefined();
  });

  it('원장이 비어 있어도 안전하다(로그아웃을 막지 않는다)', async () => {
    await expect(clearShiftReminders()).resolves.toBeUndefined();
    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
  });
});
