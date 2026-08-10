/**
 * UNIQN Mobile - WorkLog Repository Interface
 *
 * @description 근무기록(WorkLog) 관련 데이터 접근 추상화
 * @version 1.0.0
 */

import type { UnsubscribeFn } from '@/types/common';
import type { WorkLog, WorkLogStatus, QRCodeAction, QRProcessAction, StaffRole } from '@/types';

/**
 * 슬롯 편집(근무표 B2) 입력. 부분 업데이트 — 제공된 필드만 반영한다.
 *
 * @property startTime - 출근 예정 시각 'HH:mm' 단일값(제공 시 time_slot 갱신 — 예정 종료는 없다)
 * @property timeUndecided - 출근 예정 미정(제공 시 time_slot 을 비운다, startTime 보다 우선)
 * @property staffRole - 직무 역할(StaffRole)
 * @property customRole - `other` 역할의 이름. 3상 — undefined=미변경 / null=삭제 / 문자열=설정
 * @property color - 셀 색상 토큰(화이트리스트, 자유 hex 금지)
 * @property memo - 메모(XSS 검증 통과분만 기록)
 * @property editedBy - 수정 행위자(운영자) user id
 * @property checkIn - 실제 출근 시각(실적). 3상 — undefined=미변경 / null=삭제 / Date=기록
 * @property checkOut - 실제 퇴근 시각(실적). 3상 동일
 * @property reason - 수정 사유(실적 변경 이력·역할 변경 이력에 함께 실린다)
 * @property status - 근태 상태 **명시 지정**. 서버가 출퇴근 시각을 역파생한다
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
  /**
   * `other` 역할의 이름(work_logs.custom_role). 3상 — `undefined`=미변경 / `null`=삭제 / 문자열=설정.
   *
   * 🔴 서버는 **최종 역할이 'other' 일 때만** 이 값을 받는다(마이그 20260807120000 판정표 ③⑤).
   *    표준 역할과 함께 보내거나, `staffRole` 없이 보냈는데 대상 행이 'other' 가 아니면
   *    `INVALID_INPUT` 이다. 서버가 몰래 역할을 승격시키지 않는다 — 호출자가 쌍으로 보내야 한다.
   */
  customRole?: string | null;
  color?: string;
  memo?: string;
  editedBy?: string;
  /**
   * 실제 출근 시각(실적). 예정(startTime)과 다른 축이다 — 예정 변경은 근태 상태를 건드리지 않고,
   * 실적 변경만 status·수정 이력·정산 완료 잠금을 발동시킨다.
   *
   * 🔴 3상 계약: `undefined`=키를 만들지 않음(미변경) / `null`=기록 삭제 / `Date`=기록.
   *    `??`·truthy 판정으로 다루면 삭제가 조용히 무시된다.
   */
  checkIn?: Date | null;
  /** 실제 퇴근 시각(실적). checkIn 과 동일한 3상 계약. */
  checkOut?: Date | null;
  /**
   * 수정 사유. 실적을 바꾸면 `modification_history` 에, 역할을 바꾸면 `role_change_history` 에
   * 함께 실린다. 이력 배열 길이 증가가 스태프 "근무 시간 변경" 알림을 발화시킨다.
   */
  reason?: string;
  /**
   * 근태 상태 **명시 지정**(마이그 20260810100000). 서버가 이 값에서 출퇴근 시각을
   * 역파생한다 — `checked_in` 이면 출근 기록(기존 값 우선)·퇴근 비움, `scheduled` 면 양쪽 삭제.
   *
   * 🔴 `reason`·`editedBy` 와만 함께 보낼 수 있다. `checkIn` 등과 동시 지정은 어느 축이
   *    이기는지 계약에 없어 서버가 `INVALID_INPUT` 으로 거부한다 — 두 번 나눠 호출하라.
   * 🔴 `no_show`·`cancelled` 는 받지 않는다(동반 컬럼과 복귀 규칙을 갖는 별도 도메인).
   * 🔴 정산 완료건은 시각 변경 여부와 무관하게 `ALREADY_SETTLED` 다 — 실적 키와 다른 규칙이다.
   */
  status?: ManualWorkLogStatus;
}

/**
 * 수동으로 지정할 수 있는 근태 상태 — `update_work_log_slot` 의 `status` 패치 허용 값.
 *
 * `WorkLogStatus` 에서 `no_show`·`cancelled` 를 뺀 것이다. 문자열만 보고 넓히지 말 것:
 * 그 둘은 `no_show_reason`/`no_show_at` 을 동반하고 복귀 시 잔여 시각에서 상태를 재구성해야
 * 하므로 전용 경로(markAsNoShow/cancelNoShow)가 정본이다.
 */
export type ManualWorkLogStatus = Extract<
  WorkLogStatus,
  'scheduled' | 'checked_in' | 'checked_out' | 'completed'
>;

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
