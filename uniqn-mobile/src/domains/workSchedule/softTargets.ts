/**
 * softTargets — 운영처 컨테이너의 날짜별 목표인원(soft-target) 순수 헬퍼
 *
 * 저장소: 컨테이너 공고의 `schedule.softTargets` (JSONB). requirements 와 **분리**한다 —
 *   requirements 에 넣으면 add_direct_staff 의 MAX_CAPACITY 하드가드가 발동해 자유 슬롯이 막힌다(§4.4).
 *   softTargets 는 표시·부족신호 전용.
 * 날짜 키: YYYY-MM-DD SSOT(`toDateString`). work_logs.date / COUNT-by-date 와 동일 포맷이어야
 *   부족신호가 정합한다(E5).
 */
import { toDateString } from '@/utils/date';
import type { DateInput } from '@/utils/date/core';

/** softTargets 를 가진 schedule 의 최소 형태. */
export interface ScheduleWithSoftTargets {
  kind?: string;
  softTargets?: Record<string, number>;
  [key: string]: unknown;
}

type ScheduleLike = ScheduleWithSoftTargets | null | undefined;

/** schedule.softTargets 맵을 안전하게 반환(없으면 빈 맵). */
export function getSoftTargets(schedule: ScheduleLike): Record<string, number> {
  const raw = schedule?.softTargets;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, number>;
}

/** 해당 날짜의 목표인원. 없거나 비정상이면 0. 날짜는 YYYY-MM-DD 로 정규화해 조회(E5). */
export function getSoftTarget(schedule: ScheduleLike, date: DateInput): number {
  const key = toDateString(date);
  if (!key) return 0;
  const val = getSoftTargets(schedule)[key];
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}

/**
 * 목표인원을 불변으로 설정한 새 schedule 을 반환. target<=0 이면 키 제거(부족신호 노이즈 방지).
 * 원본 schedule 은 변경하지 않는다.
 */
export function withSoftTarget(
  schedule: ScheduleLike,
  date: DateInput,
  target: number
): ScheduleWithSoftTargets {
  const base: ScheduleWithSoftTargets = schedule ? { ...schedule } : {};
  const key = toDateString(date);
  if (!key) return base; // 정규화 불가 → no-op
  const next = { ...getSoftTargets(schedule) };
  const t = Math.floor(target);
  if (!Number.isFinite(t) || t <= 0) {
    delete next[key];
  } else {
    next[key] = t;
  }
  return { ...base, softTargets: next };
}

/** 부족 = 목표 − 인원 (0 으로 clamp). */
export function computeShortage(softTarget: number, headcount: number): number {
  return Math.max((softTarget ?? 0) - (headcount ?? 0), 0);
}
