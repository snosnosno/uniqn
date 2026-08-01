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
import { syncShiftReminders } from '../shiftReminderScheduler';
import type { ScheduleEvent } from '@/types';

const LEDGER_KEY = 'shift-reminders-v1';

let mockStore: Record<string, unknown> = {};
jest.mock('@/lib/mmkvStorage', () => ({
  STORAGE_KEYS: { SHIFT_REMINDERS: 'shift-reminders-v1' },
  getStorageItem: (key: string) => mockStore[key],
  setStorageItem: (key: string, value: unknown) => {
    mockStore[key] = value;
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
    await syncShiftReminders([augustShift], AUGUST, NOW);
    expect(ledger()).toHaveProperty('wl-aug:day-before');

    mockCancelScheduledNotification.mockClear();
    await syncShiftReminders([julyShift], JULY, NOW);

    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
    expect(ledger()['wl-aug:day-before']).toEqual({ id: 'os-1', workDate: '2026-08-05' });
    // 7월 것은 정상적으로 새로 잡힌다 — 보호가 예약까지 막지는 않는다.
    expect(ledger()).toHaveProperty('wl-jul:day-before');
  });

  // 대조군 — 보호가 "아무것도 취소 못 하는" 방향으로 새면 취소·퇴근한 근무의 알림이 영영 남는다.
  it('관측한 창 안에서 계획이 사라진 예약은 그대로 취소한다', async () => {
    await syncShiftReminders([augustShift], AUGUST, NOW);
    const identifier = ledger()['wl-aug:day-before'].id;

    mockCancelScheduledNotification.mockClear();
    await syncShiftReminders([], AUGUST, NOW);

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith(identifier);
    expect(ledger()).not.toHaveProperty('wl-aug:day-before');
  });

  // 창 밖이라고 무조건 남기면 원장이 무한정 자란다. 지난 근무는 시간이 알려주는 확정 정보다.
  it('이미 지난 근무의 원장 항목은 창 밖이어도 정리한다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-old:day-before': { id: 'os-old', workDate: '2026-07-01' } };

    await syncShiftReminders([augustShift], AUGUST, NOW);

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith('os-old');
    expect(ledger()).not.toHaveProperty('wl-old:day-before');
  });
});

describe('syncShiftReminders — 원장 v1 하위호환', () => {
  // v1 은 값이 식별자 문자열 그 자체였다. 계획에 있으면 재예약하지 말고 근무일만 채워야 한다
  // — 재예약하면 같은 근무에 알림이 둘 잡힌다.
  it('문자열 항목(v1)은 재예약 없이 근무일을 채워 넣는다', async () => {
    mockStore[LEDGER_KEY] = { 'wl-jul:day-before': 'os-legacy' };

    await syncShiftReminders([julyShift], JULY, NOW);

    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
    expect(ledger()['wl-jul:day-before']).toEqual({ id: 'os-legacy', workDate: '2026-07-29' });
  });

  it('이미 예약된 키는 다시 예약하지 않는다(OS 슬롯 누수 방지)', async () => {
    await syncShiftReminders([julyShift], JULY, NOW);
    expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);

    await syncShiftReminders([julyShift], JULY, NOW);
    expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);
  });
});
