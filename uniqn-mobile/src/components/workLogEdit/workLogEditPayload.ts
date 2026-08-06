/**
 * workLogEditPayload — 통합 편집 시트의 폼 상태 → `update_work_log_slot` 패치
 *
 * 🔴 **안 건드린 축은 키 자체가 없다.** 이건 편의가 아니라 안전장치다. 한 시트가 되면
 *    "퇴근만 고치려다 역할 칩을 스쳐 역할까지 저장"이 가능해지는데, 역할은
 *    `role_change_history` 가 남는 축이라 오탐 저장이 이력을 오염시킨다(설계 §8-5).
 *
 * 🔑 키 부재(미변경)와 JSON null(삭제)은 서버에서 **다른 뜻**이다(`p_patch ? 'checkIn'`).
 *    `??` 나 truthy 판정으로 다루면 삭제가 조용히 무시된다.
 */
import type { UpdateSlotInput } from '@/repositories';
import type { StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 패치 계산에 쓰이는 축만 모은 형태. 초기값과 현재 폼이 **같은 타입**이라 비교가 대칭이다.
 *
 * ⚠️ 시트 prop(`WorkLogEditInitial`)과 일부러 분리했다 — 날짜·근태 상태·스태프 이름 같은
 *    "보여주기 위한 값"이 패치 비교에 섞이면 안 바뀐 축이 dirty 로 보일 수 있다.
 */
export interface WorkLogEditAxes {
  /** 출근 예정 시각 'HH:mm'. null = 값 없음. */
  scheduledStart: string | null;
  /** 예정 '미정' 명시 선택. 시각보다 우선한다(서버·레포와 같은 우선순위). */
  scheduledUndecided: boolean;
  /** 실제 출근. null = 기록 없음. */
  checkIn: Date | null;
  /** 실제 퇴근. null = 기록 없음. */
  checkOut: Date | null;
  role: StaffRole;
  /** 배치 구분 색 토큰. 퇴역 팔레트 값일 수 있어 좁히지 않는다. */
  color: string | null;
  /** 배치 메모. 서버 RPC 키는 `memo` 지만 저장되는 컬럼은 `work_logs.notes` 다. */
  memo: string;
}

/** 축이 아니라 **동반값**. 그 자체로는 저장할 것이 되지 못한다. */
export interface WorkLogEditPayloadOptions {
  /** 수정 사유. 이력이 남는 축(실적·역할)이 함께 바뀔 때만 실린다. */
  reason?: string;
  /** 수정 행위자. 값은 서버가 auth.uid() 로 덮어쓰고, 키는 "기록할지"만 정한다. */
  editedBy?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Date | null 동치 비교. 두 값이 모두 null 이면 같다. */
function sameInstant(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

// ============================================================================
// resolveWorkLogEditPayload
// ============================================================================

/**
 * 초기값과 현재 폼을 비교해 **바뀐 축만** RPC 패치로 만든다.
 *
 * @param initial 시트를 열었을 때의 값
 * @param current 지금 폼의 값
 * @param options 사유·행위자(축이 아닌 동반값)
 * @returns 바뀐 축만 담긴 패치. 바뀐 것이 없으면 **빈 객체**(동반값도 붙이지 않는다).
 */
export function resolveWorkLogEditPayload(
  initial: WorkLogEditAxes,
  current: WorkLogEditAxes,
  options: WorkLogEditPayloadOptions = {}
): UpdateSlotInput {
  const patch: UpdateSlotInput = {};

  // 예정 — '미정'이 시각보다 우선한다. 미정 여부가 **바뀐 경우에만** 보낸다:
  // 원래 미정이던 슬롯에 timeUndecided=true 를 다시 보내면 바뀐 것이 없는데도 저장이 열린다.
  if (current.scheduledUndecided) {
    if (!initial.scheduledUndecided) patch.timeUndecided = true;
  } else if (current.scheduledStart !== null && current.scheduledStart !== initial.scheduledStart) {
    patch.startTime = current.scheduledStart;
  }

  // 실적 3상 — 삭제(null)를 미변경(키 부재)과 구분해 그대로 싣는다.
  if (!sameInstant(current.checkIn, initial.checkIn)) patch.checkIn = current.checkIn;
  if (!sameInstant(current.checkOut, initial.checkOut)) patch.checkOut = current.checkOut;

  if (current.role !== initial.role) patch.staffRole = current.role;

  // 🔴 색은 **삭제할 수 없다.** 서버가 `jsonb_typeof(p_patch->'color') <> 'string'` 을 거부하고
  //    (20260806140000:217) 레포 `assertSlotColor(value: string)` 도 null 을 받지 못한다.
  //    `color ?? undefined` 로 두면 `'color' in patch` 가 true 인데 값이 undefined 인 유령 키가
  //    생겨 3상 계약이 깨진다 — 아예 키를 만들지 않는다.
  if (current.color !== null && current.color !== initial.color) patch.color = current.color;

  if (current.memo !== initial.memo) patch.memo = current.memo;

  // 바뀐 축이 하나도 없으면 동반값도 붙이지 않는다 — 사유만 적은 것은 저장할 거리가 아니다.
  if (Object.keys(patch).length === 0) return patch;

  // 사유는 `modification_history`(실적)·`role_change_history`(역할)에만 실린다. 색·메모만
  // 바꾼 저장에 사유를 딸려 보내면 이력에 남지 않으면서 남은 것처럼 읽힌다.
  const reason = options.reason?.trim() ?? '';
  const touchesHistory = 'checkIn' in patch || 'checkOut' in patch || 'staffRole' in patch;
  if (reason !== '' && touchesHistory) patch.reason = reason;

  if (options.editedBy !== undefined) patch.editedBy = options.editedBy;

  return patch;
}
