/**
 * 전역 상수 정의 파일
 * 프로젝트 전체에서 사용되는 상수들을 중복 없이 관리
 */

import { toISODateString } from '../utils/dateUtils';

// 출석 상태 관련 상수
export const ATTENDANCE_STATUS = {
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

// 시간 포맷 관련 상수
export const TIME_FORMATS = {
  HH_MM: 'HH:MM',
  KOREAN: 'korean',
  FULL: 'full',
} as const;

// 기본값 상수
export const DEFAULT_VALUES = {
  TIME_PENDING: '미정',
  TIME_NOT_SET: '시간 미정',
  EMPTY_STRING: '',
  TODAY: toISODateString(new Date()) || '',
} as const;

// Firebase 컬렉션 이름
export const COLLECTIONS = {
  STAFF: 'staff',
  WORK_LOGS: 'workLogs',
  ATTENDANCE_RECORDS: 'attendanceRecords',
  JOB_POSTINGS: 'jobPostings',
  TOURNAMENTS: 'tournaments',
  TABLES: 'tables',
} as const;

// 시간 검증 정규식
export const TIME_REGEX = {
  HH_MM: /^\d{1,2}:\d{2}$/,
  HH_MM_SS: /^\d{1,2}:\d{2}:\d{2}$/,
  YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
  SHORT_DATE: /^\d{2}-\d{2}-\d{2}\([일월화수목금토]\)$/,
} as const;

// 색상 관련 상수
export const COLORS = {
  ATTENDANCE: {
    NOT_STARTED: {
      text: 'text-attendance-notStarted-text',
      bg: 'bg-attendance-notStarted-bg',
    },
    CHECKED_IN: {
      text: 'text-attendance-checkedIn-text',
      bg: 'bg-attendance-checkedIn-bg',
    },
    CHECKED_OUT: {
      text: 'text-attendance-checkedOut-text',
      bg: 'bg-attendance-checkedOut-bg',
    },
  },
  TIME_SLOT: {
    DEFAULT: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300',
    PENDING: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
    ASSIGNED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  },
} as const;

// 성능 관련 상수
export const PERFORMANCE = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  CACHE_TTL: 5 * 60 * 1000, // 5분
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
} as const;

// 검증 상수
export const VALIDATION = {
  MIN_HOUR: 0,
  MAX_HOUR: 23,
  MIN_MINUTE: 0,
  MAX_MINUTE: 59,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_UPLOAD_FILES: 10,
} as const;

// 날짜 관련 유틸리티 상수
export const DATE_CONSTANTS = {
  WEEKDAYS_KO: ['일', '월', '화', '수', '목', '금', '토'],
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
  ],
  TIMEZONE: 'Asia/Seoul',
} as const;

// 에러 메시지 상수
export const ERROR_MESSAGES = {
  INVALID_TIME: '올바른 시간 형식이 아닙니다',
  INVALID_DATE: '올바른 날짜 형식이 아닙니다',
  REQUIRED_FIELD: '필수 입력 항목입니다',
  NETWORK_ERROR: '네트워크 연결을 확인해주세요',
  PERMISSION_DENIED: '권한이 없습니다',
  DATA_NOT_FOUND: '데이터를 찾을 수 없습니다',
} as const;

// API 관련 상수
export const API_CONSTANTS = {
  TIMEOUT: 10000, // 10초
  RETRY_DELAY: 1000, // 1초
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

// UI 상수
export const UI_CONSTANTS = {
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1280,
  SIDEBAR_WIDTH: 256,
  HEADER_HEIGHT: 64,
} as const;

// 파일 업로드 관련 상수
export const FILE_CONSTANTS = {
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const;

// 로깅 레벨
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

// 환경 관련 상수
export const ENV_CONSTANTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

// 캐시 키 접두사
export const CACHE_KEYS = {
  STAFF: 'staff',
  WORK_LOGS: 'workLogs',
  JOB_POSTINGS: 'jobPostings',
  ATTENDANCE: 'attendance',
} as const;

// 토너먼트 관련 상수
export const TOURNAMENT_CONSTANTS = {
  DEFAULT_MAX_SEATS: 9,
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 1000,
  CHIP_DENOMINATIONS: [25, 100, 500, 1000, 5000, 25000],
} as const;

// 급여 관련 상수
export const PAYROLL_CONSTANTS = {
  DEFAULT_HOURLY_RATE: 15000,
  OVERTIME_MULTIPLIER: 1.5,
  TAX_RATE: 0.033,
  MIN_WORK_HOURS: 0.5,
  MAX_WORK_HOURS: 24,
} as const;
