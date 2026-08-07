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

import { foldRoleSelection, trimmedCustomRole } from './roleSelection';

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
  /**
   * `other` 역할의 이름.
   *
   * ⚠️ `initial` 쪽은 **DB 원시 값**이라 `role !== 'other'` 인데 이름이 있을 수 있다(표류 행 —
   *    `work_logs` 에 정합 CHECK 가 없다). `current` 쪽은 칩이 쌍으로만 만들어 불변식을 만족한다.
   *    그래서 두 쪽을 **다르게** 다룬다(아래 비교부 주석 참고).
   *
   * 🔴 서버는 **최종 custom_role 이 비어 있지 않으면 최종 role 은 'other'** 를 불변식으로 요구하고
   *    (마이그 20260807120000 판정표 ③⑤) 어기면 `INVALID_INPUT` 이다. 접기(`foldRoleSelection`)는
   *    칩과 **같은 한 벌**을 쓴다 — 두 벌이 되면 화면과 패치가 갈린다.
   */
  customRole: string | null;
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

/**
 * 이 패치가 **실적 축을 건드리는가** — 서버 `v_touch_attendance`(= `v_set_check_in OR
 * v_set_check_out`, 마이그 20260806140000:367)의 클라 재현.
 *
 * 🔴 서버는 이 값이 true 일 때만 status 를 파생한다. 화면의 "저장 후 상태" 배지도 같은 게이트를
 *    타야 한다 — 안 그러면 `status='scheduled'` 인데 `check_in_ts` 가 있는 표류 행에서 배지가
 *    '출근'이라고 말하고, 사용자가 메모만 고쳐 저장하면 서버는 `scheduled` 를 유지한다.
 *    **배지가 거짓말한다.** 실패 방향이 이번 작업의 원래 신고("손대지 않은 근태가 출근으로
 *    뒤집힘")와 같아서 더 나쁘다.
 *
 * 🔑 폼 값을 다시 비교하지 않고 **완성된 패치의 키 존재**로 본다. 그 키가 곧 서버로 가는 것이라
 *    판정이 원리적으로 어긋날 수 없다(비교 규칙이 두 벌이 되지 않는다).
 */
export function touchesAttendance(patch: UpdateSlotInput): boolean {
  return 'checkIn' in patch || 'checkOut' in patch;
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

  // 커스텀 역할명 3상 — 키 없음=미변경 / null=삭제 / 문자열=설정.
  //
  // 🔴 키는 **최종 역할이 'other' 일 때만** 만든다. 표준 역할로 옮기면서 옛 이름을 지우는 것은
  //    서버가 알아서 한다(`v_clear_custom_role` — role 이 실제로 바뀌고 새 role 이 other 가
  //    아니면 custom_role 을 NULL 로 정리한다). 여기서 `customRole:null` 을 굳이 동봉하면
  //    "표준 칩은 staffRole 하나만 보낸다"는 계약이 흐려지고, 서버 판정표 ③ 을 스치는 조합
  //    (표준 역할 + customRole 키)이 패치에 실제로 등장하게 된다.
  //
  // 🔴 비교 기준은 **저장돼 있는 원시 이름**이다 — `initial.role` 로 접으면 안 된다. 서버가
  //    안 보낸 축에 쓰는 값이 `v_wl.custom_role`(원시)이기 때문이다. `role='floor'` +
  //    `custom_role='바리스타'` 표류 행에서 기준을 접어 null 로 보면, `기타` 칩을 눌러도
  //    "이름도 null → 변경 없음" 으로 판정해 키를 안 싣는다. 그런데 서버의
  //    `v_clear_custom_role := (v_new_role <> 'other')` 은 false 라 **옛 이름을 유지**하므로
  //    저장 결과는 `기타 · 바리스타` 다 — 화면은 "이름 없이 저장된다"고 말한 뒤였다.
  if (current.role === 'other') {
    const nextCustom = foldRoleSelection(current).customRole;
    if (nextCustom !== trimmedCustomRole(initial.customRole)) patch.customRole = nextCustom;
  }

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
  // 🔑 `customRole` 도 이력이 남는 축이다 — 서버는 **최종 custom_role 이 바뀌면** role 컬럼이
  //    그대로여도 `role_change_history` 를 남긴다('바리스타'→'플로어장'은 둘 다 role='other').
  const reason = options.reason?.trim() ?? '';
  const touchesHistory = touchesAttendance(patch) || 'staffRole' in patch || 'customRole' in patch;
  if (reason !== '' && touchesHistory) patch.reason = reason;

  if (options.editedBy !== undefined) patch.editedBy = options.editedBy;

  return patch;
}
