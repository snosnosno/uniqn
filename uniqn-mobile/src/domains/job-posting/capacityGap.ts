import type { JobPosting } from '@/types';

/**
 * 근무일 D-day 정원 미달 판정 (S3-1).
 *
 * 서버 크론 `fn_notify_posting_capacity_gap`(마이그 20260813110000)이 알림으로 보내는 것과
 * **같은 판정을 화면에서도** 한다. 알림은 하루 한 번 지나가지만 근무표는 사장이 계속 보는 곳이라
 * 여기에 없으면 "알림은 왔는데 어느 날인지 화면에서 못 찾는" 상태가 된다.
 *
 * 🔑 판정축을 서버와 맞춰 두는 것이 이 파일의 존재 이유다.
 *   필요 인원 = schedule.requirements[].timeSlots[].roles[].count 합 (날짜별)
 *   채운 인원 = work_logs 활성 행 수 (날짜별) — `get_posting_filled_counts` RPC 경유
 * 축이 갈라지면 알림과 화면이 다른 숫자를 말한다.
 *
 * ⚠️ 날짜별로 판정한다(공고 합계가 아니다). 여러 날짜 공고에서 D-2 인 날은 다 찼는데
 *    다른 날이 비어 있으면 합계로는 "다 참"이 되어 경고가 사라진다.
 */

/** 경고를 띄우는 D-offset. 서버 크론의 `(v_today + 1, v_today + 2)` 와 같은 범위다. */
export const CAPACITY_GAP_WARNING_OFFSETS: readonly number[] = [1, 2];

export interface PostingCapacityGap {
  /** 근무일 (`YYYY-MM-DD`) */
  date: string;
  /** 필요 인원 (좌석 합) */
  required: number;
  /** 채운 인원 */
  filled: number;
  /** 부족 인원 — 항상 1 이상 (0 이하면 gap 이 아니므로 목록에 담기지 않는다) */
  missing: number;
  /** 오늘로부터 며칠 뒤인가 (1 = 내일 = D-1) */
  dOffset: number;
}

/**
 * `YYYY-MM-DD` 를 UTC 기준 일수로 바꾼다.
 *
 * 형식이 아니면 null — 고정 공고의 `'FIXED_SCHEDULE'` 센티널이 여기서 걸러진다
 * (서버 함수의 `~ '^\d{4}-\d{2}-\d{2}$'` 정규식 가드와 같은 역할).
 * Date 로 파싱해 빼지 않고 UTC 일수로 환산하는 이유는 서머타임·타임존 경계에서
 * 하루가 밀리는 것을 막기 위해서다.
 */
function toUtcDayNumber(dateString: string): number | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!matched) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  // Date.UTC 는 존재하지 않는 날짜(2026-02-31)를 조용히 이월시킨다 — 왕복 대조로 거른다.
  const roundTrip = new Date(utcMs);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.round(utcMs / 86_400_000);
}

/** 공고의 날짜별 필요 인원(좌석 합). 서버 함수의 `required` CTE 와 같은 축. */
export function aggregatePostingDateRequired(posting: JobPosting): Map<string, number> {
  const totals = new Map<string, number>();
  // 고정 공고는 근무일이 특정되지 않아 D-day 판정 대상이 아니다.
  if (posting.schedule.kind !== 'dated') {
    return totals;
  }

  for (const requirement of posting.schedule.requirements) {
    const date = requirement.date;
    if (!date || toUtcDayNumber(date) === null) {
      continue;
    }
    let sum = totals.get(date) ?? 0;
    for (const slot of requirement.timeSlots) {
      for (const role of slot.roles) {
        sum += Number.isFinite(role.count) ? role.count : 0;
      }
    }
    totals.set(date, sum);
  }

  return totals;
}

/**
 * 공고 서브맵(`date__slot__role` 키)을 **날짜별** 확정 인원으로 접는다.
 *
 * `aggregateRoleFilledFromSubmap`(selectors.ts)의 대칭 함수 — 저쪽은 날짜를 버리고 역할을 남기고,
 * 이쪽은 역할·슬롯을 버리고 날짜를 남긴다. 키 형식이 같으므로 파싱 규약도 같게 유지한다.
 */
export function aggregateDateFilledFromSubmap(
  submap: Map<string, number> | undefined
): Map<string, number> {
  const totals = new Map<string, number>();
  if (!submap) {
    return totals;
  }

  for (const [key, value] of submap) {
    const segments = key.split('__');
    // 키 형식: `${date}__${slot}__${role}`. role 이 '__' 를 품을 수 있어 앞 두 조각만 신뢰한다.
    if (segments.length < 3) {
      continue;
    }
    const date = segments[0];
    if (!date) {
      continue;
    }
    totals.set(date, (totals.get(date) ?? 0) + value);
  }

  return totals;
}

/**
 * 경고 대상 날짜별 정원 미달 목록.
 *
 * @param posting 대상 공고
 * @param filledSubmap `extractPostingFilledSubmap` 이 만든 한 공고의 `date__slot__role` 서브맵
 * @param todayString 오늘 (`YYYY-MM-DD`) — `getTodayString()` 주입. 테스트 결정성을 위해 인자로 받는다.
 */
export function selectPostingCapacityGaps(
  posting: JobPosting,
  filledSubmap: Map<string, number> | undefined,
  todayString: string
): PostingCapacityGap[] {
  const today = toUtcDayNumber(todayString);
  if (today === null) {
    return [];
  }

  const required = aggregatePostingDateRequired(posting);
  const filled = aggregateDateFilledFromSubmap(filledSubmap);

  const gaps: PostingCapacityGap[] = [];
  for (const [date, requiredCount] of required) {
    const day = toUtcDayNumber(date);
    if (day === null) {
      continue;
    }
    const dOffset = day - today;
    if (!CAPACITY_GAP_WARNING_OFFSETS.includes(dOffset)) {
      continue;
    }
    const filledCount = filled.get(date) ?? 0;
    const missing = requiredCount - filledCount;
    if (missing <= 0) {
      continue;
    }
    gaps.push({ date, required: requiredCount, filled: filledCount, missing, dOffset });
  }

  return gaps.sort((a, b) => a.dOffset - b.dOffset);
}

/** 날짜로 바로 찾을 수 있게 맵으로 만든다 (근무표 셀이 자기 날짜만 조회). */
export function toCapacityGapByDate(
  gaps: PostingCapacityGap[]
): Map<string, PostingCapacityGap> {
  return new Map(gaps.map((gap) => [gap.date, gap]));
}

/**
 * 배정 줄에 띄울 짧은 문구.
 *
 * 셀 안에 들어가야 하므로 짧게 — "왜 급한지"는 D-N 이 말하고, "무엇을 해야 하는지"는
 * 숫자가 말한다. 서버 알림 제목(`D-%s · 아직 %s자리가 비었어요`)과 같은 어휘를 쓴다.
 */
export function formatCapacityGapLabel(gap: PostingCapacityGap): string {
  return `D-${gap.dOffset} · ${gap.missing}자리 비었어요`;
}
