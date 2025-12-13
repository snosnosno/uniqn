/**
 * UNIQN Mobile - 전역 상수 정의
 *
 * @version 1.0.0
 */

// ============================================================================
// 출석 상태
// ============================================================================

export const ATTENDANCE_STATUS = {
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
} as const;

export type AttendanceStatusType = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

// ============================================================================
// Firebase 컬렉션
// ============================================================================

export const COLLECTIONS = {
  USERS: 'users',
  STAFF: 'staff',
  WORK_LOGS: 'workLogs',
  ATTENDANCE_RECORDS: 'attendanceRecords',
  JOB_POSTINGS: 'jobPostings',
  APPLICATIONS: 'applications',
  NOTIFICATIONS: 'notifications',
  INQUIRIES: 'inquiries',
} as const;

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

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;

export const LAYOUT = {
  HEADER_HEIGHT: 56,
  TAB_BAR_HEIGHT: 56,
  BOTTOM_SHEET_MIN_HEIGHT: 200,
  TOUCH_TARGET_MIN: 44, // WCAG 접근성 기준
} as const;

// ============================================================================
// 급여 관련
// ============================================================================

export const PAYROLL = {
  DEFAULT_HOURLY_RATE: 15000,
  OVERTIME_MULTIPLIER: 1.5,
  TAX_RATE: 0.033,
  MIN_WORK_HOURS: 0.5,
  MAX_WORK_HOURS: 24,
} as const;

// ============================================================================
// 검증 상수
// ============================================================================

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 50,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 20,
  MAX_TITLE_LENGTH: 25,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_UPLOAD_FILES: 10,
} as const;

// ============================================================================
// 에러 메시지
// ============================================================================

export const ERROR_MESSAGES = {
  // 일반
  NETWORK_ERROR: '네트워크 연결을 확인해주세요',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다',
  PERMISSION_DENIED: '권한이 없습니다',
  DATA_NOT_FOUND: '데이터를 찾을 수 없습니다',

  // 인증
  INVALID_EMAIL: '올바른 이메일 형식이 아닙니다',
  INVALID_PASSWORD: '비밀번호가 올바르지 않습니다',
  USER_NOT_FOUND: '등록되지 않은 사용자입니다',
  EMAIL_ALREADY_EXISTS: '이미 사용 중인 이메일입니다',
  SESSION_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요',

  // 폼
  REQUIRED_FIELD: '필수 입력 항목입니다',
  INVALID_FORMAT: '올바른 형식이 아닙니다',
  VALUE_TOO_SHORT: '입력값이 너무 짧습니다',
  VALUE_TOO_LONG: '입력값이 너무 깁니다',
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
// 스토리지 키
// ============================================================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_ID: 'user_id',
  THEME: 'theme',
  FCM_TOKEN: 'fcm_token',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  LAST_NOTIFICATION_READ: 'last_notification_read',
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
// 역할 라벨
// ============================================================================

export const ROLE_LABELS = {
  dealer: '딜러',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
  staff: '스태프',
  user: '일반 사용자',
} as const;

// ============================================================================
// 급여 타입 라벨
// ============================================================================

export const SALARY_TYPE_LABELS = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '기타',
} as const;

// ============================================================================
// 공고 상태 라벨
// ============================================================================

export const JOB_STATUS_LABELS = {
  draft: '임시저장',
  active: '모집중',
  closed: '마감',
  cancelled: '취소됨',
} as const;
