/**
 * UNIQN Mobile - Analytics 서비스
 *
 * @description Firebase Analytics 이벤트 추적 및 사용자 속성 관리
 * @version 1.0.0
 *
 * 구현 상태:
 * - 웹: Firebase Analytics SDK 사용
 * - 네이티브: expo-analytics-firebase 또는 @react-native-firebase/analytics 필요 (TODO [출시 전])
 *
 * 이벤트 카테고리:
 * - 인증: login, signup, logout
 * - 구인구직: job_view, job_apply, job_create
 * - 스케줄: schedule_view, check_in, check_out
 * - 정산: settlement_complete
 * - 알림: notification_receive, notification_click
 */

import { Platform } from 'react-native';
import { getFirebaseApp } from '@/lib/firebase';
import { logger } from '@/utils/logger';

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

/**
 * Analytics 인스턴스 (플랫폼별)
 */
let analyticsInstance: unknown = null;
let isAnalyticsInitialized = false;
let isAnalyticsEnabled = true;

/**
 * Analytics 초기화
 * 웹에서만 Firebase Analytics SDK 사용
 * 네이티브는 별도 네이티브 모듈 필요
 */
async function initializeAnalytics(): Promise<boolean> {
  if (isAnalyticsInitialized) return true;

  try {
    if (Platform.OS === 'web') {
      // 웹 환경: Firebase Analytics SDK
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      const app = getFirebaseApp();

      const supported = await isSupported();
      if (supported) {
        analyticsInstance = getAnalytics(app);
        isAnalyticsInitialized = true;
        logger.info('Firebase Analytics 초기화 완료 (웹)');
        return true;
      } else {
        logger.warn('Firebase Analytics가 지원되지 않는 환경입니다', {
          platform: Platform.OS,
        });
        return false;
      }
    } else {
      // 네이티브 환경: 별도 구현 필요
      // TODO [출시 전]: @react-native-firebase/analytics 또는 expo-analytics 연동
      logger.info('Analytics 네이티브 SDK 연동 필요', {
        platform: Platform.OS,
      });
      // 네이티브에서는 이벤트만 로깅 (개발용)
      isAnalyticsInitialized = true;
      return true;
    }
  } catch (error) {
    logger.error('Analytics 초기화 실패', error as Error);
    return false;
  }
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
      ? Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined)
        )
      : {};

    if (Platform.OS === 'web' && analyticsInstance) {
      // 웹: Firebase Analytics SDK
      const { logEvent } = await import('firebase/analytics');
      // @ts-expect-error - analyticsInstance is dynamically imported
      logEvent(analyticsInstance, eventName, cleanParams);
    } else {
      // 네이티브 또는 개발 환경: 로깅만
      if (__DEV__) {
        logger.debug('Analytics Event', {
          event: eventName,
          params: cleanParams,
        });
      }
    }
  } catch (error) {
    // Analytics 에러는 앱 동작에 영향을 주지 않도록 조용히 처리
    if (__DEV__) {
      logger.error('Analytics 이벤트 추적 실패', error as Error, { eventName });
    }
  }
}

/**
 * 화면 조회 추적
 */
export async function trackScreenView(
  screenName: string,
  screenClass?: string
): Promise<void> {
  if (!isAnalyticsEnabled) return;

  try {
    if (!isAnalyticsInitialized) {
      await initializeAnalytics();
    }

    if (Platform.OS === 'web' && analyticsInstance) {
      const { logEvent } = await import('firebase/analytics');
      // @ts-expect-error - analyticsInstance is dynamically imported
      logEvent(analyticsInstance, 'screen_view', {
        firebase_screen: screenName,
        firebase_screen_class: screenClass || screenName,
      });
    } else {
      if (__DEV__) {
        logger.debug('Analytics Screen View', {
          screen: screenName,
          class: screenClass,
        });
      }
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('화면 조회 추적 실패', error as Error, { screenName });
    }
  }
}

/**
 * 사용자 속성 설정
 */
export async function setUserProperties(
  properties: UserProperties
): Promise<void> {
  if (!isAnalyticsEnabled) return;

  try {
    if (!isAnalyticsInitialized) {
      await initializeAnalytics();
    }

    if (Platform.OS === 'web' && analyticsInstance) {
      const { setUserProperties: setProps } = await import('firebase/analytics');
      // @ts-expect-error - analyticsInstance is dynamically imported
      setProps(analyticsInstance, properties);
    } else {
      if (__DEV__) {
        logger.debug('Analytics User Properties', { properties });
      }
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('사용자 속성 설정 실패', error as Error);
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

    if (Platform.OS === 'web' && analyticsInstance) {
      const { setUserId: setId } = await import('firebase/analytics');
      // @ts-expect-error - analyticsInstance is dynamically imported
      setId(analyticsInstance, userId);
    } else {
      if (__DEV__) {
        logger.debug('Analytics User ID', { userId: userId || 'null' });
      }
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('사용자 ID 설정 실패', error as Error);
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
export function trackJobApply(
  jobId: string,
  jobTitle?: string,
  role?: string
): void {
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
export function trackSettlementComplete(
  amount: number,
  count: number = 1
): void {
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
export function trackError(
  errorCode: string,
  errorMessage: string,
  category?: string
): void {
  trackEvent('error', {
    error_code: errorCode,
    error_message: errorMessage,
    error_category: category,
  });
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
};

export default analyticsService;
