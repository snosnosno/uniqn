import { summarizeMissingCheckouts, OVERNIGHT_GRACE_HOUR } from '../missingCheckout';
import type { WorkLog } from '@/types/schedule';

/** 기준 시각 — 2026-07-31 14시(유예 시각 이후) */
const NOW = new Date('2026-07-31T14:00:00');

let seq = 0;

/** 근무 기록 1행. 기본은 '출근은 찍혔고 퇴근은 없음'. */
function log(date: string, status: WorkLog['status'] = 'checked_in'): WorkLog {
  seq += 1;
  return {
    id: `wl-${seq}`,
    staffId: `staff-${seq}`,
    jobPostingId: 'jp-1',
    date,
    status,
    role: 'dealer',
  } as unknown as WorkLog;
}

/** 같은 날짜에 n 행 */
function logs(date: string, n: number, status: WorkLog['status'] = 'checked_in'): WorkLog[] {
  return Array.from({ length: n }, () => log(date, status));
}

describe('summarizeMissingCheckouts', () => {
  it('지난 날짜의 checked_in 을 모두 센다', () => {
    const summary = summarizeMissingCheckouts(
      [...logs('2026-07-28', 2), ...logs('2026-07-29', 1)],
      NOW
    );

    expect(summary.count).toBe(3);
  });

  // 🔴 오늘 근무 중인 사람은 미기록이 아니다. 세면 배너가 영업시간 내내 켜져 안전망이 죽는다.
  it('오늘·미래 날짜의 근무 중 인원은 세지 않는다', () => {
    const summary = summarizeMissingCheckouts(
      [...logs('2026-07-31', 5), ...logs('2026-08-02', 1)],
      NOW
    );

    expect(summary).toEqual({ count: 0, earliestDate: null });
  });

  describe('🔴 야간 교차 근무 (홀덤펍 표준 18:00~02:00)', () => {
    // work_logs.date 는 근무 시작일(2026-07-30)인데 새벽 1시엔 달력상 이미 '어제' 다.
    const overnight = () => logs('2026-07-30', 1);

    it('새벽에는 어제 날짜 근무를 미기록으로 세지 않는다 (아직 근무 중)', () => {
      const summary = summarizeMissingCheckouts(overnight(), new Date('2026-07-31T01:00:00'));

      expect(summary).toEqual({ count: 0, earliestDate: null });
    });

    it(`유예 시각(${OVERNIGHT_GRACE_HOUR}시) 직전까지도 세지 않는다`, () => {
      const justBefore = new Date('2026-07-31T00:00:00');
      justBefore.setHours(OVERNIGHT_GRACE_HOUR - 1);

      expect(summarizeMissingCheckouts(overnight(), justBefore).count).toBe(0);
    });

    it(`유예 시각(${OVERNIGHT_GRACE_HOUR}시)을 넘기면 어제 근무도 센다`, () => {
      const justAfter = new Date('2026-07-31T00:00:00');
      justAfter.setHours(OVERNIGHT_GRACE_HOUR);

      expect(summarizeMissingCheckouts(overnight(), justAfter).count).toBe(1);
    });

    // 그제 이전은 어떤 야간 근무여도 이미 끝났다 — 유예와 무관하게 센다.
    it('그제 이전은 새벽에도 센다', () => {
      const summary = summarizeMissingCheckouts(
        logs('2026-07-29', 1),
        new Date('2026-07-31T01:00:00')
      );

      expect(summary).toEqual({ count: 1, earliestDate: '2026-07-29' });
    });
  });

  it('가장 오래된 미기록 날짜를 돌려준다', () => {
    const summary = summarizeMissingCheckouts(
      [...logs('2026-07-29', 1), ...logs('2026-07-20', 1), ...logs('2026-07-25', 1)],
      NOW
    );

    expect(summary.earliestDate).toBe('2026-07-20');
  });

  // 미기록이 아닌 지난 날짜가 earliestDate 를 선점하면 배너가 엉뚱한 날로 보낸다.
  it('미기록이 아닌 지난 날짜는 earliestDate 후보가 아니다', () => {
    const summary = summarizeMissingCheckouts(
      [...logs('2026-07-01', 4, 'completed'), ...logs('2026-07-25', 1)],
      NOW
    );

    expect(summary).toEqual({ count: 1, earliestDate: '2026-07-25' });
  });

  it('퇴근·완료·노쇼·취소·출근전은 미기록이 아니다', () => {
    const summary = summarizeMissingCheckouts(
      [
        ...logs('2026-07-20', 1, 'checked_out'),
        ...logs('2026-07-21', 1, 'completed'),
        ...logs('2026-07-22', 1, 'no_show'),
        ...logs('2026-07-23', 1, 'cancelled'),
        ...logs('2026-07-24', 1, 'scheduled'),
      ],
      NOW
    );

    expect(summary).toEqual({ count: 0, earliestDate: null });
  });

  it('기록이 없으면 0건이다', () => {
    expect(summarizeMissingCheckouts([], NOW)).toEqual({ count: 0, earliestDate: null });
  });
});
