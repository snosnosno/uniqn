/**
 * IWeeklyGridRepository — 주간 배치 그리드 읽기 RPC 계약
 *
 * 두 RPC(get_venue_grid_summary / get_venue_day_slots)는 SECDEF + 워크스페이스 게이트 +
 * anon REVOKE 이며 venue_span_posting_ids(SSOT)를 경유한다(E1 발산 방지). 응답은 camelCase 로
 * 투영해 반환한다(CLAUDE.md 필드명 규칙).
 */
import type { GridSummaryRow } from '@/domains/weeklyGrid';

/** get_venue_day_slots 한 행(camelCase 투영). 그 날 venue 스팬 배치 work_log. */
export interface VenueDaySlot {
  workLogId: string;
  staffId: string | null;
  staffName: string | null;
  staffNickname: string | null;
  staffPhotoUrl: string | null;
  /** StaffRole(dealer/floor/serving 등) */
  role: string | null;
  customRole: string | null;
  timeSlot: string | null;
  status: string;
  jobPostingId: string;
  /** 컨테이너 직속 배치 여부(job_posting_id = venue) */
  isContainer: boolean;
  color: string | null;
  notes: string | null;
}

export interface IWeeklyGridRepository {
  /** 월 그리드 요약: venue 스팬 날짜별 headcount + jobCount. */
  getVenueGridSummary(venueId: string, fromDate: string, toDate: string): Promise<GridSummaryRow[]>;

  /** 하루 슬롯 상세: 그 날 venue 스팬 배치 work_log 목록. */
  getVenueDaySlots(venueId: string, date: string): Promise<VenueDaySlot[]>;

  /**
   * 운영처 날짜별 목표인원(soft-target) 설정. 컨테이너 schedule.softTargets[date]=count.
   * date 는 write 경계에서 YYYY-MM-DD 로 정규화(E5)한다. count=0 은 키 제거(부족신호 노이즈 방지).
   * restrictive 정책 우회 유일 경로인 SECDEF RPC(set_venue_soft_target) 전용.
   */
  setVenueSoftTarget(venueId: string, date: string, count: number): Promise<void>;
}
