/**
 * UNIQN Mobile - 전역 상수 정의
 *
 * @version 1.0.0
 */

import { USER_ROLE_LABELS, STAFF_ROLE_LABELS } from '@/types/role';

// ============================================================================
// 앱 버전 정보 (version.ts에서 재export)
// ============================================================================

export {
  APP_VERSION,
  BUILD_NUMBER,
  ENVIRONMENT,
  BUILD_DATE,
  RUNTIME_VERSION,
  UPDATE_POLICY,
  parseVersion,
  compareVersions,
  isVersionAtLeast,
  checkUpdateRequired,
  getStoreUrl,
  resolveInstallStoreUrl,
  versionInfo,
  type UpdateType,
} from './version';

// ============================================================================
// 출석 상태 (statusConfig.ts에서 re-export)
// ============================================================================
// ATTENDANCE_STATUS, AttendanceStatusType은 statusConfig.ts에서 export됨

export { STATUS } from './statusValues';

// ============================================================================
// 정규식
// ============================================================================

export const REGEX = {
  TIME_HH_MM: /^\d{1,2}:\d{2}$/,
  TIME_HH_MM_SS: /^\d{1,2}:\d{2}:\d{2}$/,
  DATE_YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
  PHONE_KR: /^01[0-9]{8,9}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// ============================================================================
// 날짜 관련
// ============================================================================

export const DATE = {
  WEEKDAYS_KO: ['일', '월', '화', '수', '목', '금', '토'] as const,
  WEEKDAYS_EN: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const,
  MONTHS_KO: [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ] as const,
  TIMEZONE: 'Asia/Seoul',
} as const;

// ============================================================================
// 성능 관련
// ============================================================================

export const PERFORMANCE = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  CACHE_TTL: 5 * 60 * 1000, // 5분
  STALE_TIME: 5 * 60 * 1000, // 5분 (React Query)
  GC_TIME: 10 * 60 * 1000, // 10분 (React Query)
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
} as const;

// ============================================================================
// UI 상수
// ============================================================================

export const ANDROID_COMPLIANCE = {
  LARGE_SCREEN_MIN_WIDTH_DP: 600,
} as const;

export const LAYOUT = {
  HEADER_HEIGHT: 56,
  TAB_BAR_HEIGHT: 56,
  BOTTOM_SHEET_MIN_HEIGHT: 200,
  TOUCH_TARGET_MIN: 44, // WCAG 접근성 기준
} as const;

// ============================================================================
// 성공 메시지
// ============================================================================

export const SUCCESS_MESSAGES = {
  SAVED: '저장되었습니다',
  DELETED: '삭제되었습니다',
  APPLIED: '지원이 완료되었습니다',
  CONFIRMED: '확정되었습니다',
  CANCELLED: '취소되었습니다',
  CHECKED_IN: '출근 처리되었습니다',
  CHECKED_OUT: '퇴근 처리되었습니다',
  PASSWORD_RESET_SENT: '비밀번호 재설정 메일이 발송되었습니다',
} as const;

// ============================================================================
// API 상수
// ============================================================================

export const API = {
  TIMEOUT: 10000, // 10초
  RETRY_DELAY: 1000, // 1초
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

// ============================================================================
// Query 키
// ============================================================================

export const QUERY_KEYS = {
  USER: 'user',
  JOB_POSTINGS: 'jobPostings',
  JOB_POSTING: 'jobPosting',
  APPLICATIONS: 'applications',
  APPLICATION: 'application',
  SCHEDULES: 'schedules',
  NOTIFICATIONS: 'notifications',
  WORK_LOGS: 'workLogs',
} as const;

// ============================================================================
// 파일 관련
// ============================================================================

export const FILE = {
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

// ============================================================================
// 역할 라벨 (types/role.ts의 정본 라벨 합성)
// ============================================================================

/**
 * 역할 ID → 표시명 매핑
 *
 * @description types/role.ts의 USER_ROLE_LABELS + STAFF_ROLE_LABELS를 합성
 * - 영문 키와 한글 키 모두 지원 (역호환성)
 * - 새 역할 추가 시 types/role.ts 수정 → 여기에 자동 반영
 */
export const ROLE_LABELS: Record<string, string> = {
  // 사용자 역할 + 스태프 역할 (types/role.ts에서 합성)
  ...USER_ROLE_LABELS,
  ...STAFF_ROLE_LABELS,
  // staff 키 충돌: UserRole.staff('스태프')와 StaffRole.staff('직원')가 같은 키를 쓴다.
  // 이 맵의 살아있는 소비처는 전부 UserRole 문맥(게시판 작성자/댓글 뱃지)이므로
  // UserRole 기준 '스태프'가 맞다. 직무 문맥은 STAFF_ROLE_LABELS 를 직접 쓸 것.
  //
  // 과거에 '일반'이라는 제3의 값을 넣어 충돌을 회피했으나, 그 값이 맞는 문맥은
  // 어디에도 없었고 두 화면이 각자 로컬 우회를 만들어 쓰고 있었다 (2026-07-19 정리).
  staff: '스태프',
  // 추가 매핑 (types/role.ts에 없는 키)
  user: '일반 사용자',
  supervisor: '슈퍼바이저', // 레거시 역호환 (StaffRole에서 제거되었지만 기존 데이터 존재)
  // 한글 키 (역호환성 - 기존 데이터 지원)
  딜러: '딜러',
  플로어: '플로어',
  서빙: '서빙',
  매니저: '매니저',
  직원: '직원',
  슈퍼바이저: '슈퍼바이저', // 레거시 역호환
  관리자: '관리자',
  어드민: '관리자',
  기타: '기타',
};

// ============================================================================
// 급여 타입 라벨
// ============================================================================

export const SALARY_TYPE_LABELS = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '협의',
} as const;

// ============================================================================
// 공고 상태 라벨
// ============================================================================

export const JOB_STATUS_LABELS = {
  active: '모집중',
  closed: '마감',
  cancelled: '취소됨',
} as const;

// ============================================================================
// 알림 템플릿
// ============================================================================

export {
  NotificationTemplates,
  createNotificationMessage,
  type NotificationTemplate,
} from './notificationTemplates';

// ============================================================================
// 구인공고 관련
// ============================================================================

export {
  DATE_CONSTRAINTS,
  MAX_TIME_SLOTS_PER_DATE,
  MAX_ROLES_PER_SLOT,
  STAFF_ROLES,
  ROLE_ICONS,
  DEFAULT_ROLE_ICON,
  DEFAULT_START_TIME,
  type StaffRoleOption,
} from './jobPosting';

// ============================================================================
// 색상 상수
// ============================================================================

export {
  // Icon colors
  ICON_COLORS,
  getIconColor,
  // Status colors
  STATUS_COLORS,
  PRIMARY_COLORS,
  // Badge colors (v1.1.0)
  type BadgeVariant,
  // Text colors (v1.1.0)
  TEXT_CLASSES,
  // Header colors/classes
  HEADER_CLASSES,
  // Layout helpers
  getLayoutColor,
} from './colors';

// ============================================================================
// 상태 설정 통합 (v1.1.0)
// ============================================================================

export {
  // Types
  type StatusConfig,
  type AttendanceStatusConfig,
  type ApplicationStatusType,
  type ApplicationStatsKey,
  type ScheduleStatusType,
  type AttendanceStatusType,
  type PayrollStatusType,
  type ConfirmedStaffStatusType,
  type JobPostingStatusType,
  type InquiryStatusType,
  type AnnouncementPriorityType,
  // Status Configs
  APPLICATION_STATUS,
  SCHEDULE_STATUS,
  ATTENDANCE_STATUS,
  PAYROLL_STATUS,
  CONFIRMED_STAFF_STATUS,
  JOB_POSTING_STATUS,
  INQUIRY_STATUS,
  ANNOUNCEMENT_PRIORITY,
  // Status-to-Stats Mapping
  STATUS_TO_STATS_KEY,
  // Utility Functions
  getStatusConfig,
  getStatusLabel,
  getStatusHexColor,
  getStatusVariant,
} from './statusConfig';

// ============================================================================
// 리스트 스타일 상수 (v1.1.0)
// ============================================================================

export { LIST_CONTAINER_STYLES, HIT_SLOP } from './listStyles';
