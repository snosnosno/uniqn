/**
 * buildStatusTimestampPatch 단위 테스트
 *
 * 회귀 방지: 수동 상태 변경이 status 만 쓰고 타임스탬프를 안 써서 정산이 영구
 * 차단되던 버그(스태프관리=완료 / 정산=출퇴근 미완료 모순). 종결 status 는
 * 반드시 타임스탬프를 동반해야 한다 — 서버 정산 게이트는 status 로, 화면 게이트는 타임스탬프로
 * 판정하므로 두 축을 함께 맞춰야 '버튼은 눌리는데 서버가 거부' 가 안 생긴다. 정방향(타임스탬프
 * → status) 파생은 workLogTimeStatus.resolveWorkTimeStatus 가 담당한다.
 */
import { buildStatusTimestampPatch } from '../ConfirmedStaffRepository';
import { STATUS } from '@/constants';

const NOW = '2026-06-18T10:00:00.000Z';
const EARLIER = '2026-06-18T08:00:00.000Z';

describe('buildStatusTimestampPatch', () => {
  it('출근 예정(scheduled)은 타임스탬프를 정리한다', () => {
    expect(buildStatusTimestampPatch(STATUS.WORK_LOG.SCHEDULED, EARLIER, EARLIER, NOW)).toEqual({
      check_in_ts: null,
      check_out_ts: null,
    });
  });

  it('출근 처리(checked_in)는 check_in 을 현재 시각으로 기록하고 check_out 을 비운다', () => {
    expect(buildStatusTimestampPatch(STATUS.WORK_LOG.CHECKED_IN, null, null, NOW)).toEqual({
      check_in_ts: NOW,
      check_out_ts: null,
    });
  });

  it('출근 처리 시 기존 check_in 이 있으면 보존한다', () => {
    expect(buildStatusTimestampPatch(STATUS.WORK_LOG.CHECKED_IN, EARLIER, null, NOW)).toEqual({
      check_in_ts: EARLIER,
      check_out_ts: null,
    });
  });

  it('퇴근 처리(checked_out)는 check_in·check_out 을 모두 기록한다 (정산 게이트 충족)', () => {
    expect(buildStatusTimestampPatch(STATUS.WORK_LOG.CHECKED_OUT, null, null, NOW)).toEqual({
      check_in_ts: NOW,
      check_out_ts: NOW,
    });
  });

  it('완료 처리(completed)도 check_in·check_out 을 모두 기록한다', () => {
    expect(buildStatusTimestampPatch(STATUS.WORK_LOG.COMPLETED, null, null, NOW)).toEqual({
      check_in_ts: NOW,
      check_out_ts: NOW,
    });
  });

  it('퇴근/완료 시 기존 타임스탬프가 있으면 보존한다', () => {
    expect(buildStatusTimestampPatch(STATUS.WORK_LOG.CHECKED_OUT, EARLIER, EARLIER, NOW)).toEqual({
      check_in_ts: EARLIER,
      check_out_ts: EARLIER,
    });
  });

  it('알 수 없는 status 는 타임스탬프를 건드리지 않는다', () => {
    expect(buildStatusTimestampPatch('unknown', null, null, NOW)).toEqual({});
  });
});
