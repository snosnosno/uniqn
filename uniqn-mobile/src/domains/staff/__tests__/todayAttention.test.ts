/**
 * todayAttention — 내 공고 탭 "오늘 한 줄" 집계 (구인자 IA S3)
 *
 * 공고 상세의 "오늘 미출근" 과 **같은 정의**여야 한다(오늘 + scheduled + 고정 공고 제외).
 * 탭에서 누르고 들어간 상세의 숫자가 다르면 사장은 둘 중 하나를 틀렸다고 읽는다.
 */
import { summarizeTodayAttention } from '../todayAttention';
import type { WorkLog } from '@/types/schedule';

let seq = 0;

function log(overrides: Partial<WorkLog>): WorkLog {
  seq += 1;
  return {
    id: `wl-${seq}`,
    staffId: `staff-${seq}`,
    jobPostingId: 'jp-1',
    date: '2026-07-31',
    status: 'scheduled',
    role: 'dealer',
    ...overrides,
  } as unknown as WorkLog;
}

// 오후 2시 — 어제 날짜 퇴근 미기록이 유예 시각(10시)을 넘겨 집계되는 시각
const NOW = new Date('2026-07-31T14:00:00');

describe('summarizeTodayAttention', () => {
  it('신호가 없으면 0건이고 이동할 곳이 없다', () => {
    expect(summarizeTodayAttention([], NOW)).toEqual({
      absentCount: 0,
      missingCheckoutCount: 0,
      target: null,
    });
  });

  it('오늘 scheduled 만 미출근으로 센다 — 출근·퇴근·노쇼·취소는 빼고, 다른 날짜도 뺀다', () => {
    const summary = summarizeTodayAttention(
      [
        log({ status: 'scheduled' }),
        log({ status: 'checked_in' }),
        log({ status: 'checked_out' }),
        log({ status: 'no_show' }),
        log({ status: 'cancelled' }),
        log({ status: 'scheduled', date: '2026-08-01' }),
      ],
      NOW
    );

    expect(summary.absentCount).toBe(1);
  });

  it('고정 공고는 미출근에서 뺀다 — QR 진입점이 없어 출근이 영원히 비기 때문이다', () => {
    const summary = summarizeTodayAttention(
      [log({ status: 'scheduled', isFixedPosting: true })],
      NOW
    );

    expect(summary.absentCount).toBe(0);
    expect(summary.target).toBeNull();
  });

  it('퇴근 미기록은 기존 집계(summarizeMissingCheckouts)의 야간 유예를 그대로 따른다', () => {
    const early = new Date('2026-07-31T01:00:00');
    const rows = [log({ status: 'checked_in', date: '2026-07-30' })];

    expect(summarizeTodayAttention(rows, early).missingCheckoutCount).toBe(0);
    expect(summarizeTodayAttention(rows, NOW).missingCheckoutCount).toBe(1);
  });

  it('신호가 공고 하나에만 있으면 그 공고의 [근무] 로 보낸다', () => {
    const summary = summarizeTodayAttention(
      [
        log({ status: 'scheduled', jobPostingId: 'jp-9' }),
        log({ status: 'checked_in', date: '2026-07-29', jobPostingId: 'jp-9' }),
      ],
      NOW
    );

    expect(summary.target).toEqual({ kind: 'posting', jobPostingId: 'jp-9' });
  });

  it('여러 공고에 걸치면 근무표로 보낸다 — 미출근이 있으면 오늘 날짜', () => {
    const summary = summarizeTodayAttention(
      [
        log({ status: 'scheduled', jobPostingId: 'jp-1' }),
        log({ status: 'checked_in', date: '2026-07-28', jobPostingId: 'jp-2' }),
      ],
      NOW
    );

    expect(summary.target).toEqual({ kind: 'schedule', date: '2026-07-31' });
  });

  it('여러 공고에 퇴근 미기록만 있으면 가장 오래된 날짜로 보낸다', () => {
    const summary = summarizeTodayAttention(
      [
        log({ status: 'checked_in', date: '2026-07-29', jobPostingId: 'jp-1' }),
        log({ status: 'checked_in', date: '2026-07-27', jobPostingId: 'jp-2' }),
      ],
      NOW
    );

    expect(summary.target).toEqual({ kind: 'schedule', date: '2026-07-27' });
  });

  it('집계되지 않은 행의 공고는 이동 판정에 끼지 않는다', () => {
    // jp-2 의 행은 퇴근한 기록이라 신호가 아니다 → 신호는 jp-1 하나뿐
    const summary = summarizeTodayAttention(
      [
        log({ status: 'scheduled', jobPostingId: 'jp-1' }),
        log({ status: 'checked_out', jobPostingId: 'jp-2' }),
      ],
      NOW
    );

    expect(summary.target).toEqual({ kind: 'posting', jobPostingId: 'jp-1' });
  });
});
