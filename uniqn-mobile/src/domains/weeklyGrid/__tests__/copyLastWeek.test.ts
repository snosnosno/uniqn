/**
 * copyLastWeek 순수 로직 테스트 — 7일 시프트 매핑 / 그룹핑 / 중복 제거 / 취소·노쇼 제외 / 요일 정합.
 */
import {
  COPY_LAST_WEEK_SHIFT_DAYS,
  shiftDateByDays,
  toLastWeekDate,
  toThisWeekDate,
  buildCopyLastWeekPayload,
} from '../copyLastWeek';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';

function mkLog(partial: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl-x',
    staffId: 'staff-1',
    jobPostingId: 'container-1',
    date: '2026-06-22',
    status: STATUS.WORK_LOG.SCHEDULED,
    role: 'dealer',
    ...partial,
  } as WorkLog;
}

describe('copyLastWeek 날짜 매핑', () => {
  it('시프트 상수는 7일(주 단위 — 요일 보존)', () => {
    expect(COPY_LAST_WEEK_SHIFT_DAYS).toBe(7);
  });

  it('shiftDateByDays 는 +7/-7/-1 을 정확히 이동한다', () => {
    expect(shiftDateByDays('2026-06-22', 7)).toBe('2026-06-29');
    expect(shiftDateByDays('2026-06-22', -7)).toBe('2026-06-15');
    expect(shiftDateByDays('2026-06-29', -1)).toBe('2026-06-28');
  });

  it('월말/월경계를 넘는 이동도 정확하다', () => {
    expect(shiftDateByDays('2026-06-29', 7)).toBe('2026-07-06');
    expect(shiftDateByDays('2026-07-01', -7)).toBe('2026-06-24');
  });

  it('파싱 불가 입력은 빈 문자열을 반환한다(경계 방어)', () => {
    expect(shiftDateByDays('', 7)).toBe('');
    expect(shiftDateByDays('not-a-date', 7)).toBe('');
  });

  it('toLastWeekDate/toThisWeekDate 는 7일 역/정방향', () => {
    expect(toLastWeekDate('2026-06-29')).toBe('2026-06-22');
    expect(toThisWeekDate('2026-06-22')).toBe('2026-06-29');
  });

  it('요일 정합 — 월~일 전체 +7 시프트가 요일을 보존한다', () => {
    // 2026-06-22(월) ~ 2026-06-28(일) 한 주 전체
    const weekStart = '2026-06-22';
    for (let i = 0; i < 7; i += 1) {
      const src = shiftDateByDays(weekStart, i);
      const tgt = toThisWeekDate(src);
      expect(new Date(src).getDay()).toBe(new Date(tgt).getDay());
    }
  });
});

describe('buildCopyLastWeekPayload', () => {
  it('빈 소스는 빈 배열', () => {
    expect(buildCopyLastWeekPayload([])).toEqual([]);
  });

  it('단일 work_log → 1그룹, 날짜 +7, 필드 매핑', () => {
    const groups = buildCopyLastWeekPayload([
      mkLog({
        staffId: 'staff-1',
        jobPostingId: 'container-1',
        date: '2026-06-22',
        role: 'dealer',
        timeSlot: '18:00 - 02:00',
        notes: '메인 테이블',
      }),
    ]);
    expect(groups).toEqual([
      {
        jobPostingId: 'container-1',
        staffId: 'staff-1',
        assignments: [
          {
            date: '2026-06-29',
            role: 'dealer',
            timeSlot: '18:00 - 02:00',
            notes: '메인 테이블',
          },
        ],
      },
    ]);
  });

  it("role='other' 는 customRole 을 함께 운반한다", () => {
    const [group] = buildCopyLastWeekPayload([
      mkLog({ role: 'other', customRole: '발렛', date: '2026-06-22' }),
    ]);
    expect(group.assignments[0]).toMatchObject({ role: 'other', customRole: '발렛' });
  });

  it('스태프가 다르면 별도 그룹', () => {
    const groups = buildCopyLastWeekPayload([
      mkLog({ staffId: 'staff-1', jobPostingId: 'container-1', date: '2026-06-22' }),
      mkLog({ staffId: 'staff-2', jobPostingId: 'container-1', date: '2026-06-22' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.staffId).sort()).toEqual(['staff-1', 'staff-2']);
  });

  it('같은 스태프라도 공고가 다르면 별도 그룹(소스 job_posting_id 보존)', () => {
    const groups = buildCopyLastWeekPayload([
      mkLog({ staffId: 'staff-1', jobPostingId: 'container-1', date: '2026-06-22' }),
      mkLog({ staffId: 'staff-1', jobPostingId: 'posting-9', date: '2026-06-22' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.jobPostingId).sort()).toEqual(['container-1', 'posting-9']);
  });

  it('같은 (공고,스태프) 의 서로 다른 날짜는 한 그룹의 여러 배정', () => {
    const [group] = buildCopyLastWeekPayload([
      mkLog({ staffId: 'staff-1', jobPostingId: 'container-1', date: '2026-06-22' }),
      mkLog({ staffId: 'staff-1', jobPostingId: 'container-1', date: '2026-06-23' }),
    ]);
    expect(group.assignments.map((a) => a.date)).toEqual(['2026-06-29', '2026-06-30']);
  });

  it('동일 (date,role,customRole,timeSlot) 배정은 중복 제거(멱등)', () => {
    const [group] = buildCopyLastWeekPayload([
      mkLog({ date: '2026-06-22', role: 'dealer', timeSlot: '18:00 - 02:00' }),
      mkLog({ date: '2026-06-22', role: 'dealer', timeSlot: '18:00 - 02:00' }),
    ]);
    expect(group.assignments).toHaveLength(1);
  });

  it('취소/노쇼(status 또는 noShowAt)는 복사 대상에서 제외', () => {
    const groups = buildCopyLastWeekPayload([
      mkLog({ staffId: 'a', status: STATUS.WORK_LOG.CANCELLED }),
      mkLog({ staffId: 'b', status: STATUS.WORK_LOG.NO_SHOW }),
      mkLog({ staffId: 'c', noShowAt: '2026-06-22T19:00:00Z' }),
      mkLog({ staffId: 'd', status: STATUS.WORK_LOG.SCHEDULED }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].staffId).toBe('d');
  });

  it('파싱 불가 날짜/식별자 누락 행은 스킵', () => {
    const groups = buildCopyLastWeekPayload([
      mkLog({ staffId: 'a', date: 'bad-date' }),
      mkLog({ staffId: '', jobPostingId: 'container-1' }),
      mkLog({ staffId: 'a', jobPostingId: '' }),
      mkLog({ staffId: 'a', jobPostingId: 'container-1', date: '2026-06-22' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].assignments).toHaveLength(1);
  });

  it('입력 배열을 변형하지 않는다(불변성)', () => {
    const source = [mkLog({ date: '2026-06-22' })];
    const snapshot = JSON.parse(JSON.stringify(source));
    buildCopyLastWeekPayload(source);
    expect(source).toEqual(snapshot);
  });
});
