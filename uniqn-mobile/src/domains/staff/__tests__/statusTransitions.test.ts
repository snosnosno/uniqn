/**
 * 수동 상태 전이 규칙 — 파괴적 조합 차단 (ATT-3 / ATT-1 / STAFF-2)
 *
 * @description 상태 시트가 "현재 상태와 다르기만 하면" 전부 노출해, 출근 기록이 없는 스태프에게도
 *   '퇴근 처리'가 떴다. 그걸 누르면 buildStatusTimestampPatch 가 check_in·check_out 을 **같은 시각**으로
 *   박아 근무 0분이 확정되고, 정산이 그 값으로 계산된다. 시트가 세로로 5개를 나열하는데
 *   '출근 처리'와 '퇴근 처리'가 붙어 있어 영업 중 한 손 조작에서 오탭이 난다.
 *
 *   반대로 기록이 있는 행을 '출근 예정'으로 되돌리는 것은 QR 실측값 삭제라 파괴적인데
 *   확인 절차가 없었다(노쇼만 확인 모달 경유).
 */

import { getManualStatusTransitions } from '../statusTransitions';
import { STATUS } from '@/constants';

describe('getManualStatusTransitions', () => {
  it('현재 상태는 선택지에서 뺀다', () => {
    const values = getManualStatusTransitions(STATUS.WORK_LOG.CHECKED_IN, true).map((o) => o.value);
    expect(values).not.toContain(STATUS.WORK_LOG.CHECKED_IN);
  });

  it('출근 기록이 없으면 퇴근·완료 처리를 노출하지 않는다 (근무 0분 확정 방지)', () => {
    const values = getManualStatusTransitions(STATUS.WORK_LOG.SCHEDULED, false).map((o) => o.value);

    expect(values).toContain(STATUS.WORK_LOG.CHECKED_IN);
    expect(values).not.toContain(STATUS.WORK_LOG.CHECKED_OUT);
    expect(values).not.toContain(STATUS.WORK_LOG.COMPLETED);
  });

  it('출근 기록이 있으면 퇴근·완료 처리를 노출한다', () => {
    const values = getManualStatusTransitions(STATUS.WORK_LOG.CHECKED_IN, true).map((o) => o.value);

    expect(values).toContain(STATUS.WORK_LOG.CHECKED_OUT);
    expect(values).toContain(STATUS.WORK_LOG.COMPLETED);
  });

  it('기록이 있는 행의 출근 예정 되돌리기는 파괴적으로 표시하고 확인을 요구한다', () => {
    const revert = getManualStatusTransitions(STATUS.WORK_LOG.CHECKED_OUT, true).find(
      (o) => o.value === STATUS.WORK_LOG.SCHEDULED
    );

    expect(revert).toBeDefined();
    expect(revert?.destructive).toBe(true);
    expect(revert?.requiresConfirm).toBe(true);
  });

  it('기록이 없는 행의 출근 예정 되돌리기는 지울 것이 없어 확인을 요구하지 않는다', () => {
    const revert = getManualStatusTransitions(STATUS.WORK_LOG.NO_SHOW, false).find(
      (o) => o.value === STATUS.WORK_LOG.SCHEDULED
    );

    expect(revert?.destructive).toBe(false);
    expect(revert?.requiresConfirm).toBe(false);
  });

  it('노쇼 처리는 항상 파괴적이고 확인을 요구한다 (정산 0원 동반)', () => {
    const noShow = getManualStatusTransitions(STATUS.WORK_LOG.SCHEDULED, false).find(
      (o) => o.value === STATUS.WORK_LOG.NO_SHOW
    );

    expect(noShow?.destructive).toBe(true);
    expect(noShow?.requiresConfirm).toBe(true);
  });

  it('선택지 순서는 운영 흐름(예정→출근→퇴근→완료→노쇼)을 따른다', () => {
    const values = getManualStatusTransitions(STATUS.WORK_LOG.CHECKED_IN, true).map((o) => o.value);

    expect(values).toEqual([
      STATUS.WORK_LOG.SCHEDULED,
      STATUS.WORK_LOG.CHECKED_OUT,
      STATUS.WORK_LOG.COMPLETED,
      STATUS.WORK_LOG.NO_SHOW,
    ]);
  });
});
