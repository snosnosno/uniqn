/**
 * Sentry beforeSend / beforeBreadcrumb redact filter.
 *
 * spec: docs/specs/apple-portone-caller-binding.md (Spec A — Sentry SDK 통합 후
 * leak filter). PortOne identityVerificationId / Apple authorizationCode /
 * OAuth tokens 등 sensitive payload가 Sentry breadcrumb·event로 새지 않도록
 * 깊은 key-match 기반 마스킹.
 *
 * @sentry/react-native v7는 beforeSend/beforeBreadcrumb 콜백에서 null 반환 시
 * 해당 event/breadcrumb을 drop. 우리는 sensitive value만 [REDACTED]로 치환하고
 * event 자체는 그대로 통과시킨다.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

export const REDACT_KEYS: readonly string[] = [
  'authorizationCode',
  'authorization_code',
  'identityVerificationId',
  'identity_verification_id',
  'id_token',
  'idToken',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'authorization',
  'ci',
  'ciHash',
  'identity_ci_hash',
  'identityCiHash',
  'password',
  'apiKey',
  'api_key',
  'secret',
  'portoneSecret',
] as const;

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 8;

function matchesRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACT_KEYS.some((k) => k.toLowerCase() === lower);
}

export function redactValue(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return input;
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactValue(item, depth + 1));
  }
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (matchesRedactKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return input;
}

export function applyRedactToEvent(event: ErrorEvent, _hint?: unknown): ErrorEvent | null {
  return redactValue(event) as ErrorEvent;
}

export function applyRedactToBreadcrumb(
  breadcrumb: Breadcrumb,
  _hint?: unknown
): Breadcrumb | null {
  return redactValue(breadcrumb) as Breadcrumb;
}
