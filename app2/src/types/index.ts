/**
 * T-HOLDEM 프로젝트 타입 정의 중앙 인덱스
 * 
 * 이 파일은 프로젝트의 모든 타입들을 중앙에서 관리하고 export합니다.
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 * 
 * 사용법:
 * ```typescript
 * // 개별 import (권장)
 * import { UnifiedWorkLog } from './types/unified/workLog';
 * import { AttendanceRecord } from './types/attendance';
 * 
 * // 중앙 index에서 import
 * import { UnifiedWorkLog, AttendanceRecord } from './types';
 * ```
 */

// 공통 타입 (기본 타입들)
export type {
  FirebaseDocument,
  Staff,
  Participant,
  Table,
  Tournament,
  ApiResponse,
  PaginationInfo,
  QueryConstraint,
  FormErrors,
  User
} from './common';

// 공통 타입에서 WorkLog, AttendanceRecord는 기본 버전
export type {
  WorkLog as CommonWorkLog,
  AttendanceRecord as CommonAttendanceRecord
} from './common';

// 출석 관련 타입 (완전한 기능 버전)
export type {
  AttendanceStatus,
  AttendanceRecord,
  WorkLog,
  AttendanceSummary,
  WorkTimeEditData,
  BulkTimeEditData,
  QRCodeData,
  QRScanResult,
  QRScanError,
  AttendanceStats,
  AttendanceFilterOptions
} from './attendance';

// 통합 WorkLog 타입 (우선 사용 권장) - 타입과 함수 분리
export type {
  UnifiedWorkLog,
  LegacyWorkLog,
  WorkLogCreateInput,
  WorkLogUpdateInput,
  WorkLogFilter,
  WorkLogSortOption,
  WorkLogStatus,
  WorkLogType
} from './unified/workLog';

export {
  isUnifiedWorkLog,
  isLegacyWorkLog,
  validateWorkLog,
  WORKLOG_STATUS,
  WORKLOG_TYPE
} from './unified/workLog';

// 스케줄 관련 타입
export type {
  ScheduleType,
  PayrollStatus,
  ScheduleEvent,
  EventColorConfig,
  ScheduleFilters,
  ScheduleStats,
  CalendarView,
  ScheduleGroup,
  AttendanceRequest,
  TimeSlotInfo
} from './schedule';

export {
  SCHEDULE_COLORS,
  ATTENDANCE_STATUS_COLORS
} from './schedule';

// 스케줄의 AttendanceStatus는 별칭으로 export
export type {
  AttendanceStatus as ScheduleAttendanceStatus
} from './schedule';

// 구인공고 관련 타입
export * from './jobPosting';

// 급여 관련 타입
export * from './payroll';
export * from './simplePayroll';

// 기타 타입들
export * from './permissions';

// ============================================================================
// 표준화된 타입 사용 가이드
// ============================================================================

/**
 * 권장 타입 사용 우선순위
 * 
 * 1. **WorkLog 관련**:
 *    - UnifiedWorkLog (types/unified/workLog.ts) - 최우선 권장
 *    - WorkLog (types/attendance.ts) - 출석 관련 확장 기능
 *    - WorkLog (types/common.ts) - 기본 공통 타입
 * 
 * 2. **AttendanceRecord 관련**:
 *    - AttendanceRecord (types/attendance.ts) - 완전한 기능
 *    - AttendanceRecord (types/common.ts) - 기본 공통 타입
 * 
 * 3. **Staff 관련**:
 *    - Staff (types/common.ts) - 표준 스태프 타입
 * 
 * 4. **Schedule 관련**:
 *    - ScheduleEvent (types/schedule.ts) - 통합 스케줄 이벤트
 * 
 * 5. **JobPosting 관련**:
 *    - JobPosting (types/jobPosting/index.ts) - 완전한 구인공고 타입
 *    - 기타 세부 타입들 (types/jobPosting/base.ts)
 */

/**
 * 필드 표준화 매핑
 * 
 * 표준 필드 → deprecated 필드:
 * - staffId → dealerId, userId
 * - eventId → jobPostingId
 * - staffName → dealerName
 * - scheduledStartTime/EndTime → assignedTime
 * - actualStartTime/EndTime → checkInTime/checkOutTime
 * 
 * 권장 사용 패턴:
 * ```typescript
 * // ✅ 안전한 필드 접근
 * const staffId = data.staffId || data.dealerId || data.userId;
 * const startTime = data.actualStartTime || data.checkInTime;
 * 
 * // ✅ 타입 가드 사용
 * import { isUnifiedWorkLog, validateWorkLog } from './unified/workLog';
 * 
 * if (isUnifiedWorkLog(data)) {
 *   // 안전하게 UnifiedWorkLog로 사용
 * }
 * 
 * const validation = validateWorkLog(data);
 * if (validation.isValid) {
 *   // 유효한 데이터로 처리
 * }
 * ```
 */