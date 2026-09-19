/**
 * 참가자 상태 전이 머신 (순수). 합법 전이의 단일출처(SSOT) — set_status 류 RPC 가 동일 규칙을 강제.
 * 1a 는 'register'(→active 생성, RPC) 와 rebuy/addon(상태 무변) 만 와이어링. bust/reenter/checkIn/
 * markNoShow 전이는 후속 슬라이스용으로 표에 정의(워크인 전용 1a 에서는 미사용).
 */
import type { OpsParticipantStatus } from '@/types/ops';

export type OpsParticipantAction =
  | 'register'
  | 'checkIn'
  | 'activate'
  | 'bust'
  | 'reenter'
  | 'markNoShow';

export interface OpsTransitionResult {
  allowed: boolean;
  nextStatus?: OpsParticipantStatus;
  reason?: string;
}

/**
 * from 상태 → (action → to 상태). 표에 없는 (from, action) 조합은 불법.
 *
 * ⚠️ `registered` 는 **도달 불가**다 — 이 값을 쓰거나 읽는 서버 함수가 0개다
 *    (2026-08-08 prod `pg_proc` 실측: `ops_register_participant` 는 active|checked_in 만 만든다).
 *    행을 만들 수 있는 경로가 생기면 살아나므로 표에서 지우지는 않는다(전방 호환).
 *    DB enum 값 제거는 하지 않는다 — Postgres 는 enum 값을 DROP 할 수 없어 타입 재생성 +
 *    의존 컬럼·함수 전량 재작성이 필요하고, 얻는 것이 없다.
 */
const TRANSITION_TABLE: Record<
  OpsParticipantStatus,
  Partial<Record<OpsParticipantAction, OpsParticipantStatus>>
> = {
  registered: { checkIn: 'checked_in', activate: 'active', markNoShow: 'no_show' },
  checked_in: { activate: 'active', markNoShow: 'no_show' },
  active: { bust: 'busted' },
  busted: { reenter: 'active' },
  // 🔑 노쇼 되돌리기는 **대기열로** 돌아간다(active 아님). `active` 는 "착석"의 의미이고,
  //    좌석 없는 active 는 ops_live_stats 의 playing/average_stack 을 오염시킨다.
  //    서버 `ops_set_participant_no_show(…, false)` 와 같은 규칙(결함②).
  no_show: { checkIn: 'checked_in' },
};

/** 전이 합법성 판정. 불법이면 allowed=false + reason. */
export function canTransition(
  from: OpsParticipantStatus,
  action: OpsParticipantAction
): OpsTransitionResult {
  const nextStatus = TRANSITION_TABLE[from]?.[action];
  if (!nextStatus) {
    return { allowed: false, reason: `'${from}' 상태에서 '${action}' 전이는 허용되지 않습니다` };
  }
  return { allowed: true, nextStatus };
}

/**
 * 종료(불가역) 상태 여부. ops 참가자는 busted→reenter, no_show→activate 경로가 있어 종료 상태가 없음.
 * 후속 슬라이스에서 종료 의미가 생기면 여기서만 변경 (일관 API 보존).
 */
export function isFinalStatus(_status: OpsParticipantStatus): boolean {
  return false;
}
