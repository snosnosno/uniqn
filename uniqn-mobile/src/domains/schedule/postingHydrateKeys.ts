/**
 * 확정 수(work_logs) hydrate 키 파생 — 서버 `_posting_slot_key`/`_posting_role_key` 정합 규칙의 단일 소스.
 *
 * 카드/상세 표면(`postingSurfaceModel`)과 지원 선택(`AssignmentSelector`)이 각자 중복 구현하던 키 규칙을
 * 이 파일로 통합한다. 두 소비처의 입력 셰이프(필드명)가 달라 유니온 파라미터로 수용하되,
 * **두 기존 구현의 출력이 모든 입력에서 동일하게 유지되는 것**이 이 모듈의 계약이다.
 *
 * domains 배치 사유: 키 규칙이 `WorkLogCreator.extractStartTime`(range 문자열→시작시각)에 의존.
 * utils 에 두면 utils→domains 역류가 생긴다.
 */
import { WorkLogCreator } from './WorkLogCreator';

/** 시간 미정(TBA)·시작시각 부재 슬롯의 키 폴백. 서버 규칙과 동일하게 '미정' 리터럴. */
export const UNKNOWN_TIME_KEY = '미정';

/**
 * hydrate 슬롯 키 소스.
 * - `postingSurfaceModel` 의 `TimeSlotSource`: `startTime?: string`, `time?: string`
 * - `AssignmentSelector` 의 `TimeSlotInfo`: `startTime: string | null`(`time` 없음)
 * 둘의 합집합을 수용한다.
 */
export interface HydrateSlotSource {
  startTime?: string | null;
  time?: string | null;
  isTimeToBeAnnounced?: boolean;
}

/**
 * hydrate 역할 키 소스.
 * - `postingSurfaceModel` 의 `RoleSource`: `role`/`name`/`customRole`
 * - `AssignmentSelector` 의 `RoleInfo`: `roleId`/`customName`
 * 둘의 합집합을 수용한다.
 */
export interface HydrateRoleSource {
  role?: string;
  roleId?: string;
  name?: string;
  customRole?: string;
  customName?: string;
}

/**
 * 슬롯 hydrate 키 파생.
 * TBA 면 '미정', 아니면 range 문자열("14:00~22:00")에서 시작시각만 추출(discrete HH:MM 은 항등).
 * 시작시각이 없으면 '미정' 폴백.
 *
 * 기존 두 구현 동작 보존: `startTime || time || ''` 로 결합해
 * `postingSurfaceModel`(time 폴백 있음)과 `AssignmentSelector`(time 필드 없음) 모두를 동일 출력으로 유지한다.
 */
export function slotHydrateKey(slot: HydrateSlotSource): string {
  if (slot.isTimeToBeAnnounced) {
    return UNKNOWN_TIME_KEY;
  }
  const normalized = WorkLogCreator.extractStartTime(slot.startTime || slot.time || '');
  return normalized || UNKNOWN_TIME_KEY;
}

/**
 * 역할 hydrate 키 파생.
 * 서버 `_posting_role_key` 와 정합: role='other' 면 custom 유무와 무관하게 'other:' 접두
 * (custom 없는 bare 'other' 도 SQL 은 'other:' 를 만들므로 키가 일치해야 함).
 * 그 외에는 역할 id 그대로.
 *
 * 필드명 차이 수용: 역할 id = `role ?? roleId`, custom = `customRole ?? customName`.
 * 비-other 폴백 `roleId || name || ''` 는 두 소비처 출력을 동일하게 유지한다
 * (`AssignmentSelector` 는 name 이 없어 `roleId` 와 동일, `postingSurfaceModel` 은 name 폴백 보존).
 */
export function roleHydrateKey(role: HydrateRoleSource): string {
  const roleId = role.role ?? role.roleId;
  const custom = role.customRole ?? role.customName;
  if (roleId === 'other') {
    return `other:${custom ?? ''}`;
  }
  return roleId || role.name || '';
}
