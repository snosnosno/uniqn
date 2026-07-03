/**
 * gridPrefill — 주간 배치 그리드 "부족 N명 → 공고 열기" 초기 draft 프리필(P2-1).
 *
 * 그리드가 이미 아는 것(운영처·날짜·부족 인원)을 공고 폼 초기값으로 실어, 사장이 50+필드
 * 폼을 처음부터 채우지 않게 한다. 신규 영속 필드 없음 — 기존 draft 필드(schedule.requirements)
 * 프리필만이라 draftAdapter 직렬화 무변경(#194 함정 회피). date 가 없거나 잘못되면 일정
 * 프리필 없이 기존 venueId-only 동작으로 폴백(무회귀).
 */
import { INITIAL_JOB_POSTING_DRAFT, type JobPostingDraft } from '@/types/jobPostingDraft';
import type { PostingTimeSlot } from '@/types/jobPosting';
import { generateId } from '@/utils/generateId';
import { parseDateString } from '@/utils/date';

/** 그리드 슬롯 기본 시작시간(EditSlotSheet DEFAULT_START)과 정합 — 사장이 폼에서 조정. */
const PREFILL_DEFAULT_START = '18:00';

export interface GridPrefillParams {
  venueId?: string;
  /** YYYY-MM-DD (그리드 선택일) */
  date?: string;
  /** 모집 인원(부족 인원). 미지정/비정상은 1로 클램프. */
  count?: number;
}

/** requirements 와 templateTimeSlots 가 참조를 공유하지 않도록 호출마다 새 슬롯 생성. */
function buildPrefillTimeSlot(count: number): PostingTimeSlot {
  return {
    id: generateId(),
    startTime: PREFILL_DEFAULT_START,
    isTimeToBeAnnounced: false,
    roles: [{ id: generateId(), role: 'dealer', count }],
  };
}

export function buildGridPrefillDraft({
  venueId,
  date,
  count,
}: GridPrefillParams): JobPostingDraft {
  // 일반 생성(파라미터 없음)은 venueId 키 자체를 만들지 않아 무회귀(draftAdapter hasVenueIdField 가드).
  const base = venueId ? { ...INITIAL_JOB_POSTING_DRAFT, venueId } : INITIAL_JOB_POSTING_DRAFT;

  if (!date || !parseDateString(date)) {
    return base;
  }

  const headcount =
    typeof count === 'number' && Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;

  return {
    ...base,
    schedule: {
      kind: 'dated',
      primaryDate: date,
      allDates: [date],
      requirements: [{ date, timeSlots: [buildPrefillTimeSlot(headcount)] }],
      templateTimeSlots: [buildPrefillTimeSlot(headcount)],
    },
  };
}
