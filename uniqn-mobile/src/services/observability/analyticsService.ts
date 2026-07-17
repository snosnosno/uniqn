/**
 * UNIQN Mobile - Analytics 서비스
 *
 * @description Firebase Analytics 이벤트 추적 및 사용자 속성 관리
 * @version 2.0.0
 *
 * 구현 상태:
 * - 웹: Firebase Analytics SDK
 * - 네이티브: 로깅 (추후 네이티브 SDK 추가 예정)
 *
 * 이벤트 카테고리:
 * - 인증: login, signup, logout
 * - 구인구직: job_view, job_apply, job_create
 * - 스케줄: schedule_view, check_in, check_out
 * - 정산: settlement_complete
 * - 알림: notification_receive, notification_click
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import {
  analyticsEventRepository,
  type OpsFunnelEvent,
} from '@/repositories/supabase/AnalyticsEventRepository';

// ============================================================================
// Types
// ============================================================================

/**
 * 표준 이벤트 이름
 */
export type AnalyticsEvent =
  // 인증
  | 'login'
  | 'signup'
  | 'logout'
  | 'password_reset'
  // 구인구직
  | 'job_view'
  | 'job_apply'
  | 'job_create'
  | 'job_edit'
  | 'job_close'
  | 'job_delete'
  // 지원 관리
  | 'application_confirm'
  | 'application_reject'
  | 'application_cancel'
  // 스케줄
  | 'schedule_view'
  | 'check_in'
  | 'check_out'
  // 정산
  | 'settlement_view'
  | 'settlement_complete'
  // 알림
  | 'notification_receive'
  | 'notification_click'
  | 'notification_settings_change'
  // 화면
  | 'screen_view'
  // 검색/필터
  | 'search'
  | 'filter_apply'
  // 에러
  | 'error'
  // 튜토리얼
  | 'tutorial_start'
  | 'tutorial_complete'
  | 'tutorial_skip'
  | 'tutorial_timeout'
  // 커스텀
  | string;

/**
 * 이벤트 파라미터
 */
export interface AnalyticsEventParams {
  // 공통
  screen_name?: string;
  content_type?: string;
  content_id?: string;

  // 인증
  method?: 'email' | 'google' | 'apple' | 'kakao';

  // 구인구직
  job_id?: string;
  job_title?: string;
  job_location?: string;
  job_role?: string;
  job_salary_type?: string;

  // 지원
  application_id?: string;
  application_status?: string;

  // 스케줄
  schedule_date?: string;
  work_hours?: number;

  // 정산
  settlement_amount?: number;
  settlement_count?: number;

  // 검색
  search_term?: string;
  filter_type?: string;
  filter_value?: string;

  // 에러
  error_code?: string;
  error_message?: string;
  error_category?: string;

  // 튜토리얼
  tutorial_type?: string;
  tutorial_page?: number;
  tutorial_total_pages?: number;

  // 추가 파라미터
  [key: string]: string | number | boolean | undefined;
}

/**
 * 사용자 속성
 */
export interface UserProperties {
  user_role?: 'staff' | 'employer' | 'admin';
  account_created_date?: string;
  total_applications?: number;
  total_jobs_posted?: number;
  has_verified_phone?: boolean;
  preferred_roles?: string;
  preferred_location?: string;
}

// ============================================================================
// Analytics Instance Management
// ============================================================================

let isAnalyticsInitialized = false;
let isAnalyticsEnabled = true;

/**
 * Analytics 초기화
 * 웹: Firebase Analytics SDK
 * 네이티브: 로깅 (추후 네이티브 SDK 추가)
 */
async function initializeAnalytics(): Promise<boolean> {
  if (isAnalyticsInitialized) return true;

  // Firebase Analytics 제거됨 — 로깅 모드로 동작
  logger.info('Analytics: 로깅 모드 (Firebase 제거됨)', {
    platform: Platform.OS,
  });
  isAnalyticsInitialized = true;
  return true;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Analytics 활성화/비활성화
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  isAnalyticsEnabled = enabled;
  logger.info('Analytics 상태 변경', { enabled });
}

/**
 * 이벤트 추적
 */
export async function trackEvent(
  eventName: AnalyticsEvent,
  params?: AnalyticsEventParams
): Promise<void> {
  if (!isAnalyticsEnabled) return;

  try {
    // 초기화 확인
    if (!isAnalyticsInitialized) {
      await initializeAnalytics();
    }

    // 이벤트 파라미터 정제 (undefined 값 제거)
    const cleanParams = params
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
      : {};

    // 로깅 모드 (Firebase Analytics 제거됨)
    if (__DEV__) {
      logger.debug('Analytics Event', {
        event: eventName,
        params: cleanParams,
      });
    }
  } catch (error) {
    // Analytics 에러는 앱 동작에 영향을 주지 않도록 조용히 처리
    if (__DEV__) {
      logger.error('Analytics 이벤트 추적 실패', toError(error), { eventName });
    }
  }
}

/**
 * 화면 조회 추적
 */
export async function trackScreenView(screenName: string, screenClass?: string): Promise<void> {
  if (!isAnalyticsEnabled) return;

  try {
    if (!isAnalyticsInitialized) {
      await initializeAnalytics();
    }

    if (__DEV__) {
      logger.debug('Analytics Screen View', {
        screen: screenName,
        class: screenClass,
      });
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('화면 조회 추적 실패', toError(error), { screenName });
    }
  }
}

/**
 * 사용자 속성 설정
 */
export async function setUserProperties(properties: UserProperties): Promise<void> {
  if (!isAnalyticsEnabled) return;

  try {
    if (!isAnalyticsInitialized) {
      await initializeAnalytics();
    }

    if (__DEV__) {
      logger.debug('Analytics User Properties', { properties });
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('사용자 속성 설정 실패', toError(error));
    }
  }
}

/**
 * 사용자 ID 설정
 */
export async function setUserId(userId: string | null): Promise<void> {
  if (!isAnalyticsEnabled) return;

  try {
    if (!isAnalyticsInitialized) {
      await initializeAnalytics();
    }

    if (__DEV__) {
      logger.debug('Analytics User ID', { userId: userId || 'null' });
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('사용자 ID 설정 실패', toError(error));
    }
  }
}

// ============================================================================
// Pre-defined Event Helpers
// ============================================================================

/**
 * 로그인 이벤트
 */
export function trackLogin(method: 'email' | 'google' | 'apple' | 'kakao'): void {
  trackEvent('login', { method });
}

/**
 * 회원가입 이벤트
 */
export function trackSignup(method: 'email' | 'google' | 'apple' | 'kakao'): void {
  trackEvent('signup', { method });
}

/**
 * 로그아웃 이벤트
 */
export function trackLogout(): void {
  trackEvent('logout');
}

/**
 * 공고 조회 이벤트
 */
export function trackJobView(jobId: string, jobTitle?: string): void {
  trackEvent('job_view', {
    job_id: jobId,
    job_title: jobTitle,
    content_type: 'job_posting',
    content_id: jobId,
  });
}

/**
 * 공고 지원 이벤트
 */
export function trackJobApply(jobId: string, jobTitle?: string, role?: string): void {
  trackEvent('job_apply', {
    job_id: jobId,
    job_title: jobTitle,
    job_role: role,
    content_type: 'application',
  });
}

/**
 * 공고 생성 이벤트
 */
export function trackJobCreate(jobId: string, jobTitle: string): void {
  trackEvent('job_create', {
    job_id: jobId,
    job_title: jobTitle,
    content_type: 'job_posting',
  });
}

/**
 * 출근 체크 이벤트
 */
export function trackCheckIn(scheduleDate: string): void {
  trackEvent('check_in', {
    schedule_date: scheduleDate,
  });
}

/**
 * 퇴근 체크 이벤트
 */
export function trackCheckOut(scheduleDate: string, workHours?: number): void {
  trackEvent('check_out', {
    schedule_date: scheduleDate,
    work_hours: workHours,
  });
}

/**
 * 정산 완료 이벤트
 */
export function trackSettlementComplete(amount: number, count: number = 1): void {
  trackEvent('settlement_complete', {
    settlement_amount: amount,
    settlement_count: count,
  });
}

/**
 * 검색 이벤트
 */
export function trackSearch(searchTerm: string): void {
  trackEvent('search', {
    search_term: searchTerm,
  });
}

/**
 * 에러 이벤트
 */
export function trackError(errorCode: string, errorMessage: string, category?: string): void {
  trackEvent('error', {
    error_code: errorCode,
    error_message: errorMessage,
    error_category: category,
  });
}

/** 튜토리얼 시작 추적 */
export function trackTutorialStart(type: string, totalPages: number): void {
  trackEvent('tutorial_start', { tutorial_type: type, tutorial_total_pages: totalPages });
}

/** 튜토리얼 완료 추적 */
export function trackTutorialComplete(type: string): void {
  trackEvent('tutorial_complete', { tutorial_type: type });
}

/** 튜토리얼 건너뛰기 추적 (현재 페이지 번호 포함) */
export function trackTutorialSkip(type: string, currentPage: number, totalPages: number): void {
  trackEvent('tutorial_skip', {
    tutorial_type: type,
    tutorial_page: currentPage,
    tutorial_total_pages: totalPages,
  });
}

/** 튜토리얼 타임아웃 추적 */
export function trackTutorialTimeout(type: string): void {
  trackEvent('tutorial_timeout', { tutorial_type: type });
}

/**
 * ops S1 퍼널 이벤트(D1/F8) — 로깅 레일 + Supabase 영속 레일 동시 기록.
 * 분모 = 노출(ops_hub_impression) 대비 진입율(ops_hub_entered). 실패는 조용히 무시(fire-and-forget).
 */
export function trackOpsFunnel(
  event: OpsFunnelEvent,
  props?: Record<string, string | number | boolean>
): void {
  void trackEvent(event, props as AnalyticsEventParams | undefined);
  void analyticsEventRepository.insert(event, props ?? {});
}

// ============================================================================
// Export
// ============================================================================

export const analyticsService = {
  // 초기화
  initialize: initializeAnalytics,
  setEnabled: setAnalyticsEnabled,

  // 핵심 기능
  trackEvent,
  trackScreenView,
  trackOpsFunnel,
  setUserProperties,
  setUserId,

  // 헬퍼 함수
  trackLogin,
  trackSignup,
  trackLogout,
  trackJobView,
  trackJobApply,
  trackJobCreate,
  trackCheckIn,
  trackCheckOut,
  trackSettlementComplete,
  trackSearch,
  trackError,
  trackTutorialStart,
  trackTutorialComplete,
  trackTutorialSkip,
  trackTutorialTimeout,
};

export default analyticsService;
