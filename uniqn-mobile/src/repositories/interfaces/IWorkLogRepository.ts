/**
 * UNIQN Mobile - WorkLog Repository Interface
 *
 * @description 근무기록(WorkLog) 관련 데이터 접근 추상화
 * @version 1.0.0
 */

import type { UnsubscribeFn } from '@/types/common';
import type {
  WorkLog,
  PayrollStatus,
  WorkLogStatus,
  QRCodeAction,
  QRProcessAction,
  StaffRole,
} from '@/types';

/**
 * 슬롯 편집(근무표 B2) 입력. 부분 업데이트 — 제공된 필드만 반영한다.
 *
 * @property startTime - 출근 예정 시각 'HH:mm' 단일값(제공 시 time_slot 갱신 — 예정 종료는 없다)
 * @property timeUndecided - 출근 예정 미정(제공 시 time_slot 을 비운다, startTime 보다 우선)
 * @property staffRole - 직무 역할(StaffRole)
 * @property color - 셀 색상 토큰(화이트리스트, 자유 hex 금지)
 * @property memo - 메모(XSS 검증 통과분만 기록)
 * @property editedBy - 수정 행위자(운영자) user id
 */
export interface UpdateSlotInput {
  /**
   * 출근 예정 시각('HH:mm' 단일값). 제공 시 time_slot 을 이 값으로 갱신한다(§K 정본).
   * 범위 저장은 폐지 — 예정 종료 시각은 더 이상 저장하지 않는다.
   */
  startTime?: string;
  /**
   * 출근 예정 미정 — true 면 time_slot 을 비운다(null). '미정'은 명시 선택으로만 도달한다.
   * startTime 보다 우선한다(인원 추가 경로 buildTimeSlot 과 동일 우선순위).
   */
  timeUndecided?: boolean;
  staffRole?: StaffRole;
  color?: string;
  memo?: string;
  editedBy?: string;
}

/**
 * 근무 기록 조회 필터 옵션
 */
export interface WorkLogFilterOptions {
  /** 날짜 범위 필터 */
  dateRange?: { start: string; end: string };
  /** 상태 필터 */
  status?: WorkLogStatus;
  /** 페이지 크기 (기본 50) */
  pageSize?: number;
}

// ============================================================================
// Types
// ============================================================================

/**
 * 근무 기록 통계
 */
export interface WorkLogStats {
  totalWorkLogs: number;
  completedCount: number;
  totalHoursWorked: number;
  averageHoursPerDay: number;
  pendingPayroll: number;
  completedPayroll: number;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * WorkLog Repository 인터페이스
 *
 * 구현체:
 * - SupabaseWorkLogRepository (프로덕션)
 * - MockWorkLogRepository (테스트)
 */
export interface IWorkLogRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 근무 기록 조회
   * @param workLogId - 근무 기록 ID
   * @returns 근무 기록 또는 null
   */
  getById(workLogId: string): Promise<WorkLog | null>;

  /**
   * 스태프의 근무 기록 목록 조회
   * @param staffId - 스태프 ID
   * @param pageSize - 페이지 크기 (기본 50)
   * @returns 근무 기록 목록
   */
  getByStaffId(staffId: string, pageSize?: number): Promise<WorkLog[]>;

  /**
   * 날짜가 비어 있는 스태프 근무 기록 조회
   *
   * @description fixed posting처럼 `date` 없이 저장되는 근무 기록의 후속 흐름 복원용
   *
   * @param staffId - 스태프 ID
   * @returns `date === ''` 인 근무 기록 목록
   */
  getUndatedByStaffId(staffId: string): Promise<WorkLog[]>;

  /**
   * 스태프의 근무 기록을 필터와 함께 조회
   *
   * @description scheduleService에서 사용하는 필터링된 조회
   * - 날짜 범위 필터
   * - 상태 필터 (scheduled, checked_in, checked_out)
   *
   * @param staffId - 스태프 ID
   * @param options - 필터 옵션
   * @returns 필터링된 근무 기록 목록
   */
  getByStaffIdWithFilters(staffId: string, options?: WorkLogFilterOptions): Promise<WorkLog[]>;

  /**
   * 특정 날짜의 근무 기록 조회
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @returns 근무 기록 목록
   */
  getByDate(staffId: string, date: string): Promise<WorkLog[]>;

  /**
   * 특정 공고의 근무 기록 조회
   * @param jobPostingId - 공고 ID
   * @returns 근무 기록 목록
   */
  getByJobPostingId(jobPostingId: string): Promise<WorkLog[]>;

  /**
   * 운영처(venue) 스팬 + 날짜범위 근무 기록 조회 (근무표 Phase 4 정산)
   *
   * @description 운영처 컨테이너 V 의 정산 대상 근무 기록을 SQL 레벨에서 좁혀 조회한다.
   * - E1: venue 스팬은 `venue_span_posting_ids`(SSOT) RPC 경유 — 컨테이너 자기행(id=V)과
   *   venue_id=V 인 open 공고를 합친 posting id 집합. `venue_id=:V OR id=:V` 를 손수
   *   재작성하지 않는다(발산 방지).
   * - R5: 날짜범위(from..to inclusive)는 SQL 경계(.gte/.lte) — 전기간 풀 pull/클라잘림 금지.
   * - status NOT IN(cancelled,no_show) 도 SQL 레벨 제외(정산 비대상).
   *
   * 기존 getByJobPostingId(날짜필터 없음)는 무회귀로 유지하고, venue 정산은 본 메서드를 쓴다.
   *
   * @param venueId - 운영처 컨테이너 id
   * @param fromDate - 시작 날짜(YYYY-MM-DD, inclusive)
   * @param toDate - 종료 날짜(YYYY-MM-DD, inclusive)
   * @returns 스팬 내 날짜범위 근무 기록(정산 비대상 상태 제외). 스팬이 비면 빈 배열.
   */
  getByVenueSpanInRange(venueId: string, fromDate: string, toDate: string): Promise<WorkLog[]>;

  /**
   * 구인자(ownerId)의 완료된 근무 기록 조회
   *
   * @description 미작성 평가 목록에서 employer-side pending reviews 조회용
   * @param ownerId - 구인자 ID
   * @returns 리뷰 대상이 될 수 있는 완료 근무 기록 목록 (checked_out, completed)
   */
  getCompletedByOwnerId(
    ownerId: string,
    dateRange?: { start: string; end: string }
  ): Promise<WorkLog[]>;

  /**
   * 날짜가 비어 있는 구인자 기준 완료 근무 기록 조회
   *
   * @description fixed posting처럼 `date` 없이 저장되는 employer-side pending review 보강용
   *
   * @param ownerId - 구인자 ID
   * @returns `date === ''` 이면서 리뷰 대상이 될 수 있는 완료 근무 기록 목록
   */
  getUndatedCompletedByOwnerId(ownerId: string): Promise<WorkLog[]>;

  /**
   * 오늘 출근한 근무 기록 조회
   * @param staffId - 스태프 ID
   * @returns 출근 중인 근무 기록 또는 null
   */
  getTodayCheckedIn(staffId: string): Promise<WorkLog | null>;

  /**
   * 근무 기록 통계 조회
   * @param staffId - 스태프 ID
   * @returns 통계 정보
   */
  getStats(staffId: string): Promise<WorkLogStats>;

  /**
   * 날짜 범위로 근무 기록 조회
   * @param staffId - 스태프 ID
   * @param startDate - 시작 날짜 (YYYY-MM-DD)
   * @param endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns 근무 기록 목록
   */
  getByDateRange(staffId: string, startDate: string, endDate: string): Promise<WorkLog[]>;

  /**
   * 공고-스태프-날짜로 근무 기록 조회
   * @param jobPostingId - 공고 ID
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @returns 근무 기록 또는 null
   */
  findByJobPostingStaffDate(
    jobPostingId: string,
    staffId: string,
    date: string,
    assignmentGroupId?: string | null,
    timeSlot?: string | null
  ): Promise<WorkLog | null>;

  /**
   * QR 스캔용 work_log 후보 조회
   *
   * @description 고정 공고(date='FIXED_SCHEDULE')와 일반 공고(date=오늘/어제)를 한 쿼리로 조회.
   *   하루 다중 배정이 정상 케이스이므로 예외를 던지지 않고 배열을 그대로 반환한다.
   *   (job_posting_id, staff_id, date)에 UNIQUE 제약이 없어 2건 이상이 정상 발생한다.
   *
   *   어제를 포함하는 이유는 **자정 넘는 근무의 퇴근 스캔**이다 — 18:00~02:00 근무의
   *   work_logs.date 는 시작일 D 라서, D+1 새벽에 찍는 퇴근 QR 을 오늘 날짜로만 조회하면
   *   후보가 0건이 되어 근무 중인 스태프가 퇴근을 찍지 못한다.
   * @param jobPostingId - 공고 ID
   * @param staffId - 스태프 ID
   * @param today - 오늘 날짜 (YYYY-MM-DD)
   * @param yesterday - 어제 날짜 (YYYY-MM-DD) — 자정 넘는 근무의 퇴근 스캔용
   * @returns 후보 근무 기록 목록 (없으면 빈 배열)
   */
  findQRCandidates(
    jobPostingId: string,
    staffId: string,
    today: string,
    yesterday: string
  ): Promise<WorkLog[]>;

  // ==========================================================================
  // 실시간 구독 (Realtime)
  // ==========================================================================

  /**
   * 스태프의 전체 근무 기록 실시간 구독 (최근 50개)
   *
   * @description scheduleService의 subscribeToSchedules에서 사용
   *
   * @param staffId - 스태프 ID
   * @param onData - 데이터 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeByStaffId(
    staffId: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn;

  /**
   * 단일 근무 기록 실시간 구독
   * @param workLogId - 근무 기록 ID
   * @param onData - 데이터 콜백 (삭제 시 null)
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeById(
    workLogId: string,
    onData: (workLog: WorkLog | null) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn;

  /**
   * 스태프의 근무 기록 실시간 구독 (날짜 범위 필터 지원)
   *
   * @description workLogService의 subscribeToMyWorkLogs에서 사용
   *
   * @param staffId - 스태프 ID
   * @param options - 날짜 범위, 페이지 크기
   * @param onData - 데이터 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeByStaffIdWithFilters(
    staffId: string,
    options: { dateRange?: { start: string; end: string }; pageSize?: number },
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn;

  /**
   * 오늘의 활성 근무 기록 실시간 구독 (출근 가능/출근 중)
   *
   * @description workLogService의 subscribeToTodayWorkStatus에서 사용
   *
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @param statuses - 구독할 상태 목록
   * @param onData - 데이터 콜백 (없으면 null)
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeTodayActive(
    staffId: string,
    date: string,
    statuses: string[],
    onData: (workLog: WorkLog | null) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn;

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  /**
   * 정산 상태 변경
   * @param workLogId - 근무 기록 ID
   * @param status - 새 정산 상태
   */
  updatePayrollStatus(workLogId: string, status: PayrollStatus): Promise<void>;

  /**
   * 정산 상태 업데이트 (트랜잭션, 중복 검증 포함)
   *
   * @description 중복 정산 방지 및 금액 지원
   * @param workLogId - 근무 기록 ID
   * @param status - 정산 상태
   * @param amount - 정산 금액 (선택)
   * @throws BusinessError - 중복 정산 시도 시
   */
  updatePayrollStatusTransaction(
    workLogId: string,
    status: PayrollStatus,
    amount?: number
  ): Promise<void>;

  /**
   * 음수 정산 플래그 기록 (관리자 알림 트리거용)
   *
   * @description Cloud Function onNegativeSettlement 트리거를 위한 플래그 기록
   * @param workLogId - 근무 기록 ID
   * @param amount - 음수 정산 금액
   */
  flagNegativeSettlement(workLogId: string, amount: number): Promise<void>;

  /**
   * QR 체크인/체크아웃 트랜잭션 처리
   *
   * @description 원자적으로 WorkLog 상태 확인 + 업데이트
   * - 출근: scheduled → checked_in (중복 출근 방지)
   * - 퇴근: checked_in → checked_out (미출근 상태 방지)
   *
   * @param workLogId - 근무 기록 ID
   * @param staffId - 스태프 ID (방어적 검증용)
   * @param jobPostingId - 공고 ID (방어적 검증용)
   * @param action - 출근/퇴근, 또는 'auto'(서버가 status 로 결정 — 고정 운영처 QR)
   * @param checkTime - 체크 시각
   * @param date - 근무 날짜 (YYYY-MM-DD, timeSlot 파싱용)
   * @returns action 결과 (출근/퇴근으로 해소됨, 근무시간)
   */
  processQRCheckInOutTransaction(
    workLogId: string,
    staffId: string,
    jobPostingId: string,
    action: QRProcessAction,
    checkTime: Date,
    date: string
  ): Promise<{
    action: QRCodeAction;
    hasExistingCheckInTime: boolean;
    workDuration: number;
  }>;

  /**
   * 슬롯 편집(근무표 B2) — 시간/역할/색상/메모 부분 수정.
   *
   * 검증 경계(Repository): color 는 토큰 화이트리스트(자유 hex 거부), memo 는 XSS 검증
   * 통과분만 기록한다(S1/U3). 시간은 출근 예정 **단일값**만 저장하고(§K), 미정이면 비운다.
   * 시간 축을 안 보내면 time_slot 키를 만들지 않아 기존 값이 보존된다.
   *
   * @param workLogId - 근무 기록 ID
   * @param input - 수정할 필드(제공된 것만 반영)
   * @throws ValidationError - 색상 화이트리스트 위반/메모 XSS·길이 위반/시각 형식 위반 시
   */
  updateSlot(workLogId: string, input: UpdateSlotInput): Promise<void>;
}
