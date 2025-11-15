/**
 * UnifiedDataStore Interface Contract
 *
 * Zustand Store로 마이그레이션 시 준수해야 할 인터페이스 명세
 *
 * @version 1.0.0
 * @created 2025-11-14
 * @feature 001-zustand-migration
 */

import { Staff, WorkLog, Application, AttendanceRecord, JobPosting } from '../../../app2/src/types';

/**
 * UnifiedDataStore State
 *
 * Firebase 5개 컬렉션을 Map 형태로 관리하는 전역 상태
 */
export interface UnifiedDataState {
  /**
   * 스태프 정보 컬렉션
   * Key: staffId, Value: Staff 객체
   */
  staff: Map<string, Staff>;

  /**
   * 근무 기록 컬렉션
   * Key: workLogId, Value: WorkLog 객체
   */
  workLogs: Map<string, WorkLog>;

  /**
   * 지원서 컬렉션
   * Key: applicationId, Value: Application 객체
   */
  applications: Map<string, Application>;

  /**
   * 출석 기록 컬렉션
   * Key: recordId, Value: AttendanceRecord 객체
   */
  attendanceRecords: Map<string, AttendanceRecord>;

  /**
   * 구인 공고 컬렉션
   * Key: postingId, Value: JobPosting 객체
   */
  jobPostings: Map<string, JobPosting>;

  /**
   * 로딩 상태
   * Firebase 구독 초기화 중일 때 true
   */
  isLoading: boolean;

  /**
   * 에러 상태
   * Firebase 구독 실패 시 에러 메시지 저장
   */
  error: string | null;
}

/**
 * UnifiedDataStore Selectors
 *
 * 특정 데이터만 조회하여 불필요한 리렌더링 방지
 */
export interface UnifiedDataSelectors {
  /**
   * ID로 스태프 조회
   *
   * @param id staffId
   * @returns Staff 객체 또는 undefined
   */
  getStaffById: (id: string) => Staff | undefined;

  /**
   * staffId로 근무 기록 목록 조회
   *
   * @param staffId 스태프 ID
   * @returns WorkLog 배열
   */
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];

  /**
   * eventId로 근무 기록 목록 조회
   *
   * @param eventId 이벤트 ID
   * @returns WorkLog 배열
   */
  getWorkLogsByEventId: (eventId: string) => WorkLog[];

  /**
   * eventId로 지원서 목록 조회
   *
   * @param eventId 이벤트 ID
   * @returns Application 배열
   */
  getApplicationsByEventId: (eventId: string) => Application[];

  /**
   * applicantId로 지원서 목록 조회
   *
   * @param applicantId 지원자 ID
   * @returns Application 배열
   */
  getApplicationsByApplicantId: (applicantId: string) => Application[];

  /**
   * staffId로 출석 기록 목록 조회
   *
   * @param staffId 스태프 ID
   * @returns AttendanceRecord 배열
   */
  getAttendanceByStaffId: (staffId: string) => AttendanceRecord[];

  /**
   * eventId로 출석 기록 목록 조회
   *
   * @param eventId 이벤트 ID
   * @returns AttendanceRecord 배열
   */
  getAttendanceByEventId: (eventId: string) => AttendanceRecord[];

  /**
   * 활성화된 구인 공고 목록 조회
   *
   * @returns 마감되지 않은 JobPosting 배열
   */
  getActiveJobPostings: () => JobPosting[];
}

/**
 * UnifiedDataStore Actions
 *
 * 상태를 변경하는 모든 액션
 */
export interface UnifiedDataActions {
  /**
   * 모든 Firebase 컬렉션 구독 시작
   *
   * @param userId 사용자 ID
   * @param role 사용자 역할 (admin, staff, user)
   * @returns void
   *
   * @example
   * subscribeAll('user123', 'admin');
   */
  subscribeAll: (userId: string, role: string) => void;

  /**
   * 모든 Firebase 구독 정리 (cleanup)
   *
   * @returns void
   *
   * @example
   * unsubscribeAll();
   */
  unsubscribeAll: () => void;

  /**
   * Staff Map 전체 설정
   *
   * @param staff Map<string, Staff>
   * @returns void
   */
  setStaff: (staff: Map<string, Staff>) => void;

  /**
   * 단일 Staff 업데이트
   *
   * @param staff Staff 객체
   * @returns void
   *
   * @example
   * updateStaff({ id: 'staff123', name: '홍길동', role: 'dealer' });
   */
  updateStaff: (staff: Staff) => void;

  /**
   * 단일 Staff 삭제
   *
   * @param id staffId
   * @returns void
   */
  deleteStaff: (id: string) => void;

  /**
   * WorkLog Map 전체 설정
   *
   * @param workLogs Map<string, WorkLog>
   * @returns void
   */
  setWorkLogs: (workLogs: Map<string, WorkLog>) => void;

  /**
   * 단일 WorkLog 업데이트
   *
   * @param workLog WorkLog 객체
   * @returns void
   */
  updateWorkLog: (workLog: WorkLog) => void;

  /**
   * 단일 WorkLog 삭제
   *
   * @param id workLogId
   * @returns void
   */
  deleteWorkLog: (id: string) => void;

  /**
   * Application Map 전체 설정
   *
   * @param applications Map<string, Application>
   * @returns void
   */
  setApplications: (applications: Map<string, Application>) => void;

  /**
   * 단일 Application 업데이트
   *
   * @param application Application 객체
   * @returns void
   */
  updateApplication: (application: Application) => void;

  /**
   * 단일 Application 삭제
   *
   * @param id applicationId
   * @returns void
   */
  deleteApplication: (id: string) => void;

  /**
   * AttendanceRecord Map 전체 설정
   *
   * @param records Map<string, AttendanceRecord>
   * @returns void
   */
  setAttendanceRecords: (records: Map<string, AttendanceRecord>) => void;

  /**
   * 단일 AttendanceRecord 업데이트
   *
   * @param record AttendanceRecord 객체
   * @returns void
   */
  updateAttendanceRecord: (record: AttendanceRecord) => void;

  /**
   * 단일 AttendanceRecord 삭제
   *
   * @param id recordId
   * @returns void
   */
  deleteAttendanceRecord: (id: string) => void;

  /**
   * JobPosting Map 전체 설정
   *
   * @param jobPostings Map<string, JobPosting>
   * @returns void
   */
  setJobPostings: (jobPostings: Map<string, JobPosting>) => void;

  /**
   * 단일 JobPosting 업데이트
   *
   * @param posting JobPosting 객체
   * @returns void
   */
  updateJobPosting: (posting: JobPosting) => void;

  /**
   * 단일 JobPosting 삭제
   *
   * @param id postingId
   * @returns void
   */
  deleteJobPosting: (id: string) => void;

  /**
   * 로딩 상태 설정
   *
   * @param isLoading boolean
   * @returns void
   */
  setLoading: (isLoading: boolean) => void;

  /**
   * 에러 상태 설정
   *
   * @param error 에러 메시지 또는 null
   * @returns void
   */
  setError: (error: string | null) => void;
}

/**
 * UnifiedDataStore 전체 인터페이스
 *
 * State + Selectors + Actions의 통합 인터페이스
 */
export interface UnifiedDataStore extends UnifiedDataState, UnifiedDataSelectors, UnifiedDataActions {}

/**
 * Zustand Store Hook 타입
 *
 * @example
 * // 단일 값 조회
 * const staff = useUnifiedDataStore((state) => state.staff);
 *
 * @example
 * // 여러 값 조회 (shallow 비교)
 * const { staff, workLogs, getStaffById } = useUnifiedDataStore(
 *   (state) => ({
 *     staff: state.staff,
 *     workLogs: state.workLogs,
 *     getStaffById: state.getStaffById,
 *   }),
 *   shallow
 * );
 *
 * @example
 * // Action 호출
 * const subscribeAll = useUnifiedDataStore((state) => state.subscribeAll);
 * subscribeAll('user123', 'admin');
 */
export type UseUnifiedDataStore = <T>(
  selector: (state: UnifiedDataStore) => T,
  equalityFn?: (a: T, b: T) => boolean
) => T;

/**
 * 타입 가드 함수
 *
 * @param value unknown
 * @returns value is Staff
 */
export function isStaff(value: unknown): value is Staff {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'role' in value
  );
}

/**
 * 타입 가드 함수
 *
 * @param value unknown
 * @returns value is WorkLog
 */
export function isWorkLog(value: unknown): value is WorkLog {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'staffId' in value &&
    'eventId' in value &&
    'date' in value
  );
}

/**
 * 타입 가드 함수
 *
 * @param value unknown
 * @returns value is Application
 */
export function isApplication(value: unknown): value is Application {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'applicantId' in value &&
    'eventId' in value &&
    'status' in value
  );
}

/**
 * 타입 가드 함수
 *
 * @param value unknown
 * @returns value is AttendanceRecord
 */
export function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'staffId' in value &&
    'eventId' in value &&
    'status' in value
  );
}

/**
 * 타입 가드 함수
 *
 * @param value unknown
 * @returns value is JobPosting
 */
export function isJobPosting(value: unknown): value is JobPosting {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'description' in value
  );
}

/**
 * Firebase 구독 Unsubscribe 함수 타입
 */
export type Unsubscribe = () => void;

/**
 * 성능 모니터링 인터페이스 (선택적)
 */
export interface PerformanceMetrics {
  lastUpdateTime: number;
  renderCount: number;
  subscriptionCount: number;
}
