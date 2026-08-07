/**
 * IWorkScheduleRepository — 근무표 읽기 RPC 계약
 *
 * 두 RPC(get_venue_grid_summary / get_venue_day_slots)는 SECDEF + 워크스페이스 게이트 +
 * anon REVOKE 이며 venue_span_posting_ids(SSOT)를 경유한다(E1 발산 방지). 응답은 camelCase 로
 * 투영해 반환한다(CLAUDE.md 필드명 규칙).
 */
import type { GridSummaryRow } from '@/domains/workSchedule';

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
  /** 실제 출근 시각(ISO timestamptz). 미기록이면 null. */
  checkInTs: string | null;
  /** 실제 퇴근 시각(ISO timestamptz). 미기록이면 null. */
  checkOutTs: string | null;
  /** 정산 상태 — 'completed' 면 시트가 읽기 전용으로 열린다. */
  payrollStatus: string | null;
  /** YYYY-MM-DD. 시트가 시각을 Date 로 조립할 때 기준 날짜. */
  date: string;
}

/**
 * 공고 슬롯 시간 일괄 변경(3-C) 입력.
 *
 * 대상 축(공고·날짜·역할 키·출발 시각 키)과 **구인자가 고른 대상 목록**을 함께 보낸다.
 * 서버가 넘어온 id 가 전부 그 축에 속하는지 검증하고, 하나라도 벗어나면 전체를 거부한다.
 */
export interface UpdatePostingSlotTimeInput {
  jobPostingId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 서버 `_posting_role_key` 동치 (domains/workSchedule `workLogRoleKey`). */
  roleKey: string;
  /** 서버 `_posting_slot_key` 동치 (domains/workSchedule `workLogSlotKey`). */
  fromSlotKey: string;
  /** 옮길 work_log id 들. 비면 서버가 거부한다. */
  workLogIds: readonly string[];
  /** 새 출근 예정 시각 'HH:mm'. `timeUndecided` 가 true 면 무시된다. */
  startTime?: string;
  /** 미정으로 바꾼다. `startTime` 보다 우선한다(서버·클라 동일 우선순위). */
  timeUndecided?: boolean;
}

/** 공고 슬롯 시간 일괄 변경 결과. 부분 성공을 숨기지 않는다. */
export interface UpdatePostingSlotTimeResult {
  /** 요청한 대상 수. */
  total: number;
  /** 실제로 시각이 바뀐 수. */
  updated: number;
  /** 지원서 배정까지 함께 맞춘 수(직접 배치 인원은 상대가 없어 제외된다). */
  assignmentSynced: number;
  /** 지원서 동기화를 건너뛴 건과 사유. 편집 자체는 성사됐다. */
  skipped: readonly { workLogId: string; reason: string }[];
  /** 공고 원문 정원을 옮기지 못한 사유(컨테이너·고정공고 등). 정상이면 undefined. */
  capacitySkipReason?: string;
}

/** 지점 역할별 단가 upsert/삭제 입력. salary:null = 해당 역할 단가 삭제. */
export interface SetVenueRoleSalaryInput {
  role: string;
  customRole?: string;
  salary: { type: 'hourly' | 'daily' | 'monthly'; amount: number } | null;
}

export interface IWorkScheduleRepository {
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

  /**
   * 지점 역할별 단가 upsert/삭제. 컨테이너 schedule.roleSalaries — RESTRICTIVE 정책 우회
   * 유일 경로인 SECDEF RPC(set_venue_role_salary) 전용. salary:null = 해당 역할 삭제.
   */
  setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void>;

  /**
   * 공고 슬롯 시간 일괄 변경(3-C). SECDEF RPC `update_posting_slot_time` 전용.
   * 근무 시각과 공고 원문 정원을 한 트랜잭션에서 함께 옮긴다.
   */
  updatePostingSlotTime(input: UpdatePostingSlotTimeInput): Promise<UpdatePostingSlotTimeResult>;
}
