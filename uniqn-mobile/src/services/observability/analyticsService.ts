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
import {
  leaveBreadcrumb,
  setAttributes as setSentryAttributes,
  setUserId as setSentryUserId,
} from './sentryService';
import { getBuildIdentity } from './buildIdentity';
import type { ShareSource } from '@/constants/shareSource';

/** `leaveBreadcrumb` 이 받는 데이터 형태 — 정제된 이벤트 파라미터를 그대로 태운다. */
type BreadcrumbData = Record<string, string | number | boolean | undefined>;

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

    if (__DEV__) {
      logger.debug('Analytics Event', {
        event: eventName,
        params: cleanParams,
      });
    }

    // 프로덕션 레일 — 예전엔 이 함수 전체가 `__DEV__` 안에만 있어서
    // 출시 빌드에서는 문자 그대로 아무 일도 하지 않았다(testgap-01).
    // Sentry 브레드크럼으로 남기면 에러 리포트에 "그 직전에 무엇을 했는가"가 붙는다.
    void leaveBreadcrumb(`analytics:${eventName}`, cleanParams as BreadcrumbData);
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

    void leaveBreadcrumb('analytics:screen_view', {
      screen: screenName,
      class: screenClass,
    });
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

    // 태그로 올려 두면 Sentry 이슈를 역할·이용량 축으로 가를 수 있다.
    // 값은 전부 비-PII 축(역할·건수·플래그)이고, redact 훅이 한 겹 더 거른다.
    const tags: Record<string, string> = {};
    Object.entries(properties).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        tags[`user_${key}`] = String(value);
      }
    });
    if (Object.keys(tags).length > 0) {
      void setSentryAttributes(tags);
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

    // 에러가 특정 사용자에게만 나는지 판별하려면 이 배선이 있어야 한다.
    void setSentryUserId(userId);
  } catch (error) {
    if (__DEV__) {
      logger.error('사용자 ID 설정 실패', toError(error));
    }
  }
}

/**
 * 앱 세션 시작 — 이 실행본의 정체를 **서버에** 한 줄 남긴다 (testgap-01).
 *
 * ## 왜 서버인가
 * Sentry 태그는 "에러가 난 세션"만 표본으로 잡는다. 롤아웃이 얼마나 퍼졌는지,
 * 아직 구버전에 남은 사용자가 몇인지는 **정상 세션까지 세야** 알 수 있다.
 * 이 값이 없어서 #407 REVOKE 가 "롤아웃 확인 다음"에 묶인 채 무기한 대기 중이었고,
 * data-01 직접 PATCH 차단 트리거도 구클라 파손을 감지할 수단이 없어 투입을 못 했다.
 *
 * ## 계약
 * - **세션당 1회**. 콜드 스타트마다 한 줄이며 화면 이동으로는 늘지 않는다
 *   (서버 rate limit 은 사용자당 시간당 240건이라 여유가 크다).
 * - 로그인 사용자 전용이다. anon 은 RLS 상 `ops_public_view_opened` 만 넣을 수 있고,
 *   버전 분포는 어차피 계정 단위로 봐야 의미가 있다.
 * - fire-and-forget. 실패는 전부 무시한다 — 계측이 앱을 막으면 안 된다.
 */
let hasReportedSessionStart = false;

export function reportAppSessionStart(): void {
  if (hasReportedSessionStart) return;
  hasReportedSessionStart = true;

  const identity = getBuildIdentity();

  // `.catch` 를 여기서도 건다 — 리포지토리가 지금은 절대 reject 하지 않지만,
  // 그 계약이 깨지는 순간 `void` 만으로는 unhandled rejection 이 되어 계측이
  // 앱 프로세스를 죽인다. 방어는 부르는 쪽에도 있어야 한다.
  void analyticsEventRepository
    .insert('app_session_start', {
      v: identity.appVersion,
      build: identity.buildNumber,
      rt: identity.runtimeVersion,
      platform: identity.platform,
      // 내장 번들이면 'embedded' — OTA 가 아직 안 닿은 기기를 이 값으로 센다
      ota: identity.otaUpdateId ?? 'embedded',
      channel: identity.otaChannel ?? 'unknown',
    })
    .catch(() => undefined);
}

/** 테스트 전용 — 세션 1회 가드를 되돌린다. */
export function resetAppSessionStartForTests(): void {
  hasReportedSessionStart = false;
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
  void analyticsEventRepository.insert(event, props ?? {}).catch(() => undefined);
}

/**
 * 공고 공유 퍼널 (S3-5) — 로깅 레일 + Supabase 영속 레일 동시 기록.
 *
 * 🔑 `trackEvent` 만 부르면 **Sentry 브레드크럼만 남고 서버에는 아무것도 안 남는다.**
 *    실제로 기존 `trackEvent('job_shared', ...)` 가 그 상태였다 — 화이트리스트에도 없는 값이라
 *    어디에도 집계되지 않았다. 출처를 세려면 영속 레일이 반드시 함께 가야 한다.
 */
export function trackShareFunnel(
  event: Extract<OpsFunnelEvent, 'job_share_created' | 'job_share_opened'>,
  props: { job_id: string; src?: ShareSource }
): void {
  // 🔑 `tk` 는 **비로그인 경로의 통행권이다.** analytics_events 가드 트리거는 anon INSERT 에
  //    `props.tk`(4~16자)를 요구하고(20260717090500:51-54), 없으면 P0001 로 거부한다.
  //    그런데 이 두 이벤트의 주 대상은 앱이 없는 구직자 — 정의상 anon 이다. tk 를 안 실으면
  //    repository 가 에러를 삼켜(계측은 throw 금지) **가장 중요한 유입이 무음으로 사라진다.**
  //    공고 id 앞 8자를 쓴다: ops_public_view_opened 의 토큰 prefix 관례와 같고,
  //    anon 상한(시간당 120건)이 공고 단위로 걸려 한 공고의 폭주가 다른 공고를 막지 않는다.
  const payload: Record<string, string> = {
    job_id: props.job_id,
    tk: props.job_id.slice(0, 8),
  };
  if (props.src) {
    payload.src = props.src;
  }
  void trackEvent(event, payload as AnalyticsEventParams);
  void analyticsEventRepository.insert(event, payload).catch(() => undefined);
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
  trackShareFunnel,
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
