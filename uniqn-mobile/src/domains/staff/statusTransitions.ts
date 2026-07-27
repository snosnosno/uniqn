/**
 * statusTransitions — 확정 스태프 수동 상태 변경의 허용 전이 규칙(순수)
 *
 * @description 상태 시트가 "현재 상태와 다르기만 하면" 전부 노출하던 것을 **출퇴근 기록 유무**로
 *   좁힌다. 두 가지 사고를 막는다.
 *
 *   ① 출근 기록이 없는 행에 '퇴근 처리'를 누르면 `buildStatusTimestampPatch` 가
 *      `check_in_ts: now, check_out_ts: now` 로 같은 시각을 박아 **근무 0분**이 확정되고
 *      정산이 그 값으로 계산된다. 시트가 세로 5개라 '출근 처리' 바로 아래 '퇴근 처리'가
 *      붙어 있어 한 손 조작에서 오탭이 잦다.
 *   ② 기록이 있는 행을 '출근 예정'으로 되돌리면 QR 실측 시각이 삭제된다. 노쇼만 확인 모달을
 *      경유했고 이쪽은 즉시 실행이었다.
 *
 * @remarks UI(아이콘·색)는 호출부가 붙인다. 여기서는 값·라벨·파괴성만 결정한다.
 */

import { STATUS } from '@/constants';

export interface ManualStatusTransition {
  value: string;
  label: string;
  /** 파괴적 액션 — 시트에서 경고 색으로 표시한다. */
  destructive: boolean;
  /** 실행 전 확인 모달을 경유해야 한다. */
  requiresConfirm: boolean;
}

/**
 * 현재 상태와 출퇴근 기록 유무로 노출할 수동 전이 목록을 만든다.
 *
 * @param currentStatus 현재 work_log status
 * @param hasAttendanceRecord check_in_ts 또는 check_out_ts 가 하나라도 있는가
 * @returns 운영 흐름 순서(예정 → 출근 → 퇴근 → 완료 → 노쇼)로 정렬된 전이 목록
 */
export function getManualStatusTransitions(
  currentStatus: string,
  hasAttendanceRecord: boolean
): ManualStatusTransition[] {
  const transitions: ManualStatusTransition[] = [];

  if (currentStatus !== STATUS.WORK_LOG.SCHEDULED) {
    transitions.push({
      value: STATUS.WORK_LOG.SCHEDULED,
      label: '출근 예정으로 변경',
      // 지울 기록이 있을 때만 파괴적이다 — 없는데 경고하면 경고가 값싸진다.
      destructive: hasAttendanceRecord,
      requiresConfirm: hasAttendanceRecord,
    });
  }

  if (currentStatus !== STATUS.WORK_LOG.CHECKED_IN) {
    transitions.push({
      value: STATUS.WORK_LOG.CHECKED_IN,
      label: '출근 처리',
      destructive: false,
      requiresConfirm: false,
    });
  }

  // 출근 기록 없이 퇴근/완료로 보내면 출근·퇴근이 같은 시각으로 박혀 근무 0분이 된다.
  if (hasAttendanceRecord) {
    if (currentStatus !== STATUS.WORK_LOG.CHECKED_OUT) {
      transitions.push({
        value: STATUS.WORK_LOG.CHECKED_OUT,
        label: '퇴근 처리',
        destructive: false,
        requiresConfirm: false,
      });
    }

    if (currentStatus !== STATUS.WORK_LOG.COMPLETED) {
      transitions.push({
        value: STATUS.WORK_LOG.COMPLETED,
        label: '근무 완료 처리',
        destructive: false,
        requiresConfirm: false,
      });
    }
  }

  // 노쇼는 정산 0원을 동반하는 운영 사실 기록이라 항상 확인을 요구한다.
  if (currentStatus !== STATUS.WORK_LOG.NO_SHOW) {
    transitions.push({
      value: STATUS.WORK_LOG.NO_SHOW,
      label: '노쇼 처리',
      destructive: true,
      requiresConfirm: true,
    });
  }

  return transitions;
}
