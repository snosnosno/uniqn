/**
 * UNIQN Mobile - Sentry 래퍼의 플랫폼 공통부
 *
 * @description
 * `sentryService.ts`(네이티브)와 `sentryService.web.ts`(웹 폴백)가 **글자 그대로 같게**
 * 들고 있던 조각을 한곳으로 모은 것이다. 두 파일은 진짜 플랫폼 분기(네이티브는 Sentry SDK,
 * 웹은 logger.observability 싱크)를 가지므로 파일 분리 자체는 옳다 — 다만 아래 조각들에는
 * 분기가 없어 복붙만 남아 있었다.
 *
 * ⚠️ 여기에 플랫폼 분기를 넣지 말 것. 분기가 필요해지면 각 `sentryService*.ts` 로 올린다.
 *
 * ⚠️ breadcrumb 링과 enabled 플래그는 **모듈 스코프 상태**다. 번들에는 두 sentryService 중
 * 하나만 실리므로(metro 가 `.web.ts` 를 웹에서 우선 해석) 이 모듈의 인스턴스도 하나뿐이다.
 */

import { type AppErrorTelemetryChannel, isAppError, type AppError } from '@/errors/AppError';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export type SentrySeverity = 'fatal' | 'error' | 'warning';

export interface SentryContext {
  screen?: string;
  component?: string;
  action?: string;
  domain?: string;
  userId?: string;
  handlingKind?: string;
  telemetryChannel?: AppErrorTelemetryChannel;
  [key: string]: string | number | boolean | undefined;
}

export interface SentryAttributes {
  [key: string]: string;
}

export interface SentryUser {
  id?: string;
  email?: string;
  name?: string;
}

// ============================================================================
// Breadcrumb 링 버퍼
// ============================================================================

const MAX_BREADCRUMBS = 50;
const breadcrumbs: string[] = [];

export function addBreadcrumb(message: string): void {
  const timestamp = new Date().toISOString();
  breadcrumbs.push(`[${timestamp}] ${message}`);

  while (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

export function getBreadcrumbs(): string[] {
  return [...breadcrumbs];
}

export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}

// ============================================================================
// 수집 on/off
// ============================================================================

let isEnabled = true;

export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
  logger.info('Sentry observability 상태 변경', {
    component: 'sentryService',
    enabled,
  });
}

/** 현재 수집 활성 여부. 캡처 경로가 매 호출마다 읽는다(모듈 로드 시점 캡처 금지). */
export function isObservabilityEnabled(): boolean {
  return isEnabled;
}

// ============================================================================
// AppError → Sentry attributes
// ============================================================================

/**
 * AppError 의 분류 축을 문자열 속성으로 펼친다. 일반 Error 는 빈 객체.
 * `metadata_*` 접두사는 Sentry 대시보드에서 앱이 실은 값과 SDK 기본 속성을 구분하기 위한 것.
 */
export function extractErrorAttributes(error: Error | AppError): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (!isAppError(error)) {
    return attributes;
  }

  attributes.error_code = error.code;
  attributes.error_category = error.category;
  attributes.error_severity = error.severity;
  attributes.is_retryable = String(error.isRetryable);

  if (error.metadata) {
    Object.entries(error.metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        attributes[`metadata_${key}`] = String(value);
      }
    });
  }

  return attributes;
}
