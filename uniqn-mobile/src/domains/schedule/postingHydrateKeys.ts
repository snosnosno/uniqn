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
import { isTimeTBD } from '@/shared/time';

import { WorkLogCreator } from './WorkLogCreator';

/** 시간 미정(TBA)·시작시각 부재 슬롯의 키 폴백. 서버 규칙과 동일하게 '미정' 리터럴. */
export const UNKNOWN_TIME_KEY = '미정';

/**
 * 원문 시간 문자열 → 슬롯 키. 서버 `_posting_slot_key` 의 클라이언트 동치.
 *
 * 비유: 예약 장부에 "미정"이라 적혔든 "NEGOTIABLE"이라 적혔든 빈칸이든, 같은 서랍에 넣는다.
 *
 * ## 왜 두 값이 아니라 하나로 접는가
 * 공고 측 키와 지원서/work_log 측 키가 **같은 함수**를 통과해야 정원 조회가 행을 만난다.
 * 한쪽만 센티널을 접으면 조회가 0행을 내고, 화면에는 에러 없이 `0/N` 이 뜬다(사장 관리 화면 포함).
 *
 * ## 전환기에 특히 중요한 점
 * 레거시 `'NEGOTIABLE'` 은 서버 DB 행에만 있는 게 아니라 **기기 MMKV 오프라인 캐시**에도
 * TTL 동안 남는다(`criticalOfflineCache` 는 형태 검증 없이 캐스트한다). 그래서 이 함수는
 * 신규 값(`'미정'`)만이 아니라 옛 값도 반드시 함께 접어야 한다.
 *
 * ## 0패딩을 하는 이유
 * 서버는 저장 시점에 `_normalize_time_slot` 으로 `'9:00'` → `'09:00'` 을 만든다. 그래서 서버가
 * 돌려주는 슬롯 키는 **항상 0패딩**이다. 클라가 공고의 `'9:00'` 을 그대로 키로 쓰면 그 두 키가
 * 영영 만나지 못해 **에러 없이 확정 인원이 0/N** 으로 보인다.
 * (현재 prod 공고 시각은 전부 0패딩이라 노출은 0이지만, 계약을 맞춰 두지 않으면 비패딩 값이
 *  하나 생기는 날 조용히 깨진다.)
 *
 * 서버 대응(prod 실측): `_posting_slot_key(NULL|''|'미정'|'NEGOTIABLE')` = `'미정'`,
 * `_posting_slot_key('18:30 - 03:00')` = `'18:30'`, `_normalize_time_slot('9:00')` = `'09:00'`.
 */
export function timeSlotKey(raw: string | null | undefined): string {
  if (isTimeTBD(raw)) {
    return UNKNOWN_TIME_KEY;
  }

  // 범위형("14:00~22:00")은 시작시각만, 단일 'HH:MM' 은 항등.
  const start = WorkLogCreator.extractStartTime(raw!);
  if (!start) {
    return UNKNOWN_TIME_KEY;
  }

  // 시각으로 읽히는 값만 0패딩한다. 해석 불가 자유텍스트('협의' 등)는 서버와 똑같이 원문 유지 —
  // 여기서 손대면 사람이 적어둔 값이 조용히 다른 값으로 둔갑한다.
  const match = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.exec(start);
  return match ? `${match[1]!.padStart(2, '0')}:${match[2]}` : start;
}

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
  return timeSlotKey(slot.startTime || slot.time);
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
