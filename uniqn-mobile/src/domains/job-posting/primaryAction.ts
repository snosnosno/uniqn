/**
 * 공고 상세 허브 — "지금 할 일" 선택 (S2-4).
 *
 * @description 관리 카드 6장이 전부 같은 크기·같은 모양이라 우선순위 표현이 0이었다.
 *   사장은 매번 여섯 장을 읽고 무엇이 급한지 스스로 판단해야 했다. 신호를 받아
 *   **딱 하나**를 고르고, 나머지는 행으로 강등한다.
 *
 *   순서의 근거는 "방치했을 때의 손해 크기"다.
 *   1. 취소 요청 — 방치하면 그 자리가 빈 채로 근무일이 온다(가장 비싸다).
 *   2. 오늘 미출근 — 현장이 이미 굴러가는 중이고, 지금 연락해야 메울 수 있다.
 *   3. 대기 지원자 — 늦으면 지원자가 다른 공고로 간다.
 *   4. 정산 대기 — 급하지만 근무는 이미 끝났다. 하루 늦어도 복구 가능.
 *   5. 라이브 운영 — 진행 중이면 사장은 이미 알고 있다(발견성 문제이지 알림 문제가 아니다).
 */

/** "지금 할 일" 후보 키 — 관리 카드의 식별자와 1:1. */
export type PostingPrimaryActionKey =
  | 'cancellationRequests'
  | 'todayAbsent'
  | 'pendingApplicants'
  | 'pendingSettlement'
  | 'liveOps';

export interface PostingActionSignals {
  /** 검토 대기 중인 취소 요청 수 */
  cancellationPendingCount: number;
  /** 오늘 근무자 중 아직 출근하지 않은 수 */
  todayAbsentCount: number;
  /** 검토 대기 중인 지원자 수 */
  pendingApplicantCount: number;
  /** 지급 완료가 아닌 근무 기록 수 */
  pendingSettlementCount: number;
  /** 이 공고에 연결된 진행 중 라이브 운영 수 */
  liveOpsCount: number;
}

/**
 * 손해가 가장 큰 신호 하나를 고른다. 처리할 일이 없으면 `null`.
 *
 * @remarks 동점 처리는 없다 — 여러 신호가 동시에 서 있어도 **하나만** 크게 보여야
 *   "지금 할 일"이라는 말이 유지된다. 나머지는 행에 배지로 남는다.
 */
export function selectPrimaryAction(signals: PostingActionSignals): PostingPrimaryActionKey | null {
  if (signals.cancellationPendingCount > 0) {
    return 'cancellationRequests';
  }
  if (signals.todayAbsentCount > 0) {
    return 'todayAbsent';
  }
  if (signals.pendingApplicantCount > 0) {
    return 'pendingApplicants';
  }
  if (signals.pendingSettlementCount > 0) {
    return 'pendingSettlement';
  }
  if (signals.liveOpsCount > 0) {
    return 'liveOps';
  }
  return null;
}
