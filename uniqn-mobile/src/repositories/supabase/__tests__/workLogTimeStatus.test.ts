/**
 * 근무 시간 수정 → work_log status 파생 계약 (SET-1)
 *
 * @description 정산 화면의 '시간 수정' 은 타임스탬프만 쓰고 status 를 승격하지 않았다. 그런데
 *   서버 정산 게이트(SettlementRepository.settleWorkLogWithTransaction)는 **status** 로 판정하므로,
 *   정산 화면에서만 시간을 넣은 행은 `status='scheduled'` 로 고착돼 영구히 정산 거부됐다.
 *   같은 일을 하는 형제 경로(ConfirmedStaffRepository)는 승격하고 있어 비대칭이 명백했다.
 *
 *   이 파일은 두 경로가 공유하는 순수 헬퍼 `resolveWorkTimeStatus` 의 값 계약을 고정한다.
 *   payload 키 계약(실재 컬럼 부분집합)은 workLogWriteColumns.test.ts 가 담당한다.
 */

import { resolveWorkTimeStatus } from '../workLogTimeStatus';
import { STATUS } from '@/constants';

const IN = new Date('2026-07-01T09:00:00.000Z');
const OUT = new Date('2026-07-01T18:00:00.000Z');

/** 기본은 '둘 다 미변경, 기존 값 없음' — 케이스마다 필요한 축만 덮어쓴다. */
function input(overrides: Partial<Parameters<typeof resolveWorkTimeStatus>[0]> = {}) {
  return {
    currentStatus: STATUS.WORK_LOG.SCHEDULED,
    incomingCheckIn: undefined,
    incomingCheckOut: undefined,
    existingCheckIn: null,
    existingCheckOut: null,
    ...overrides,
  };
}

describe('resolveWorkTimeStatus — 출퇴근 시각에서 status 파생', () => {
  it('출근·퇴근 시각이 모두 있으면 checked_out 으로 승격한다', () => {
    expect(resolveWorkTimeStatus(input({ incomingCheckIn: IN, incomingCheckOut: OUT }))).toBe(
      STATUS.WORK_LOG.CHECKED_OUT
    );
  });

  it('출근 시각만 있으면 checked_in 으로 승격한다', () => {
    expect(resolveWorkTimeStatus(input({ incomingCheckIn: IN }))).toBe(STATUS.WORK_LOG.CHECKED_IN);
  });

  it('출근 시각이 없으면 scheduled 로 강등한다 — CHECK 제약(23514) 회피', () => {
    // work_logs_status_timestamp_consistency 는 checked_in→check_in_ts, checked_out→양쪽을
    // NOT NULL 로 강제한다. 시각을 지우면서 status 를 그대로 두면 UPDATE 전체가 23514 로 거부된다.
    expect(
      resolveWorkTimeStatus(
        input({
          currentStatus: STATUS.WORK_LOG.CHECKED_OUT,
          incomingCheckIn: null,
          incomingCheckOut: null,
          existingCheckIn: IN,
          existingCheckOut: OUT,
        })
      )
    ).toBe(STATUS.WORK_LOG.SCHEDULED);
  });

  it('이미 completed 인 행은 강등하지 않는다 (undefined = status 미변경)', () => {
    expect(
      resolveWorkTimeStatus(
        input({
          currentStatus: STATUS.WORK_LOG.COMPLETED,
          incomingCheckIn: IN,
          incomingCheckOut: OUT,
        })
      )
    ).toBeUndefined();
  });

  it('근태 생애주기 밖 상태(no_show·cancelled)는 시간 수정으로 되살리지 않는다', () => {
    // 시간 수정이 노쇼를 조용히 checked_out 으로 뒤집으면 없던 유급 근무가 생긴다.
    // 노쇼 정정은 전용 경로(cancelNoShow)만 담당한다.
    const args = { incomingCheckIn: IN, incomingCheckOut: OUT };
    expect(
      resolveWorkTimeStatus(input({ currentStatus: STATUS.WORK_LOG.NO_SHOW, ...args }))
    ).toBeUndefined();
    expect(
      resolveWorkTimeStatus(input({ currentStatus: STATUS.WORK_LOG.CANCELLED, ...args }))
    ).toBeUndefined();
  });

  it('이미 checked_out 이고 양쪽 시각이 있으면 같은 값을 반환한다 (멱등)', () => {
    expect(
      resolveWorkTimeStatus(
        input({
          currentStatus: STATUS.WORK_LOG.CHECKED_OUT,
          existingCheckIn: IN,
          existingCheckOut: OUT,
        })
      )
    ).toBe(STATUS.WORK_LOG.CHECKED_OUT);
  });
});

describe('3-값 병합 — undefined(미변경) 와 null(삭제) 를 구분한다', () => {
  it('미변경(undefined)은 기존 값으로 폴백한다', () => {
    // 이번엔 퇴근만 넣었지만 기존 출근 시각이 있으므로 checked_out.
    expect(
      resolveWorkTimeStatus(
        input({
          currentStatus: STATUS.WORK_LOG.CHECKED_IN,
          incomingCheckOut: OUT,
          existingCheckIn: IN,
        })
      )
    ).toBe(STATUS.WORK_LOG.CHECKED_OUT);
  });

  it('삭제(null)는 기존 값으로 폴백하지 않는다 — `?? ` 로 쓰면 삭제가 무시된다', () => {
    // 기존 출근 시각이 있어도 이번에 null 로 지웠으면 checked_in 으로 남으면 안 된다.
    expect(
      resolveWorkTimeStatus(
        input({
          currentStatus: STATUS.WORK_LOG.CHECKED_OUT,
          incomingCheckIn: null,
          existingCheckIn: IN,
          existingCheckOut: OUT,
        })
      )
    ).toBe(STATUS.WORK_LOG.SCHEDULED);
  });
});
