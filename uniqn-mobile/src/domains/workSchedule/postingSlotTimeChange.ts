/**
 * 공고 시간 변경(3-C) — 하루 슬롯 목록을 "시간 일괄 변경이 가능한 묶음"으로 접는 순수 로직.
 *
 * 설계: docs/planning/2026-08-03-3c-posting-time-change-design.md §10
 *
 * 묶음의 축은 서버 RPC `update_posting_slot_time` 의 대상 축과 **글자 그대로 같아야 한다**:
 *   (jobPostingId, date, _posting_role_key(role, customRole), _posting_slot_key(timeSlot))
 *   + status NOT IN ('cancelled', 'no_show')
 * 축이 갈리면 화면이 한 묶음으로 보여준 것을 서버가 다른 집합으로 받아 `SLOT_MISMATCH` 로
 * 통째로 거부한다 — 사용자에겐 "아무 이유 없이 안 되는" 화면이 된다.
 *
 * 🔑 `jobPostingId` 가 축에 있는 이유: 근무표 하루 목록은 venue 스팬이라 **여러 공고**의
 *    배치가 섞여 있다(`get_venue_day_slots`). 공고를 빼고 묶으면 서로 다른 공고의 인원이
 *    한 묶음에 들어가고, 서버는 공고 하나만 받으므로 나머지가 축 밖으로 떨어진다.
 */
import { isTimeTBD } from '@/shared/time';

import type { VenueDaySlot } from '@/repositories/interfaces/IWorkScheduleRepository';

/** 시간 미정 슬롯의 키. 서버 `_posting_slot_key` 와 같은 리터럴. */
export const UNDECIDED_SLOT_KEY = '미정';

/** 근무표에서 제외되는 소프트 취소 상태. 서버 축 필터와 동일. */
const EXCLUDED_STATUSES: readonly string[] = ['cancelled', 'no_show'];

/**
 * work_log 의 역할 키. 서버 `_posting_role_key(p_role, p_custom_role)` 의 **정확한** 동치.
 *
 * ⚠️ `roleHydrateKey`(domains/schedule/postingHydrateKeys)를 재사용하지 않는다. 그쪽은
 *    **공고 원문의 역할 객체**를 위한 것이라 `role === 'other'` 일 때만 커스텀을 본다.
 *    서버 규칙은 반대로 **customRole 이 있으면 role 과 무관하게** `other:<custom>` 이다.
 *    두 규칙은 `role='dealer' + customRole='바리스타'` 같은 (드물지만 가능한) 조합에서 갈린다.
 *    여기서는 work_logs 행을 다루므로 서버 규칙을 그대로 따른다.
 */
export function workLogRoleKey(
  role: string | null | undefined,
  customRole: string | null | undefined
): string {
  const custom = (customRole ?? '').trim();
  if (custom !== '') return `other:${custom}`;
  if (role === 'other') return 'other:';
  return role ?? '';
}

/**
 * work_log 의 시각 키. 서버 `_posting_slot_key(time_slot)` 의 동치.
 *
 * R0(#409) 이후 서버는 `NULL`·`''`·`'미정'`·`'NEGOTIABLE'` 을 전부 `'미정'` 으로 접는다.
 * 판정은 `isTimeTBD` 하나로 모은다 — 그 함수가 같은 센티널 집합의 단일 소스다.
 * 범위 문자열('18:00-22:00')은 시작 시각으로 접힌다(레거시 데이터 하위호환).
 */
export function workLogSlotKey(timeSlot: string | null | undefined): string {
  if (isTimeTBD(timeSlot)) return UNDECIDED_SLOT_KEY;
  const head = timeSlot!.split(/[-~]/)[0]?.trim() ?? '';
  return head === '' ? UNDECIDED_SLOT_KEY : head;
}

/** 시간 일괄 변경 후보 한 묶음. */
export interface SlotTimeChangeGroup {
  /** 안정 키(리스트 key + 선택 상태 보관용). */
  key: string;
  jobPostingId: string;
  roleKey: string;
  slotKey: string;
  /** 화면 표기용 원문 시각. 미정이면 null. */
  displayTimeSlot: string | null;
  /** 이 묶음의 대상 후보(취소·노쇼 제외). */
  members: readonly VenueDaySlot[];
}

/**
 * 하루 슬롯 목록 → 시간 변경 묶음 목록.
 *
 * 정렬은 화면이 읽히는 순서를 따른다: 시각(미정은 맨 뒤) → 역할 키.
 * 미정을 맨 뒤로 보내는 이유는 시각순 정렬에서 `'미정'` 문자열이 숫자 시각들 사이에
 * 끼어들면 목록이 깨져 보이기 때문이다.
 */
export function buildSlotTimeChangeGroups(slots: readonly VenueDaySlot[]): SlotTimeChangeGroup[] {
  const byKey = new Map<string, SlotTimeChangeGroup>();

  for (const slot of slots) {
    if (EXCLUDED_STATUSES.includes(slot.status)) continue;

    const roleKey = workLogRoleKey(slot.role, slot.customRole);
    const slotKey = workLogSlotKey(slot.timeSlot);
    const key = `${slot.jobPostingId}__${slotKey}__${roleKey}`;

    const existing = byKey.get(key);
    if (existing) {
      // 불변 갱신 — 원본 그룹 객체를 건드리지 않는다.
      byKey.set(key, { ...existing, members: [...existing.members, slot] });
      continue;
    }
    byKey.set(key, {
      key,
      jobPostingId: slot.jobPostingId,
      roleKey,
      slotKey,
      displayTimeSlot: slotKey === UNDECIDED_SLOT_KEY ? null : slotKey,
      members: [slot],
    });
  }

  return [...byKey.values()].sort((a, b) => {
    const aUndecided = a.slotKey === UNDECIDED_SLOT_KEY;
    const bUndecided = b.slotKey === UNDECIDED_SLOT_KEY;
    if (aUndecided !== bUndecided) return aUndecided ? 1 : -1;
    if (a.slotKey !== b.slotKey) return a.slotKey < b.slotKey ? -1 : 1;
    return a.roleKey < b.roleKey ? -1 : a.roleKey > b.roleKey ? 1 : 0;
  });
}

/**
 * 목적지 슬롯에 지금 몇 명이 있는가 — 실행 전 안내용.
 *
 * 🔑 정원 초과를 경고하지 않는다. 사용자 결정 ⑤(설계 §10-3)로 공고 원문 정원이 실제 배치를
 *    따라 함께 이동하므로 **초과 상황 자체가 생기지 않는다.** 여기서 보여주는 것은
 *    "옮기고 나면 그 시간대가 몇 명이 되는가" 라는 사실 하나뿐이다.
 */
export function countAtDestination(
  slots: readonly VenueDaySlot[],
  params: { jobPostingId: string; roleKey: string; slotKey: string }
): number {
  return slots.filter(
    (s) =>
      !EXCLUDED_STATUSES.includes(s.status) &&
      s.jobPostingId === params.jobPostingId &&
      workLogRoleKey(s.role, s.customRole) === params.roleKey &&
      workLogSlotKey(s.timeSlot) === params.slotKey
  ).length;
}
