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
  // OAuth / IdP tokens & codes
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
  // Identity / CI hashes
  'ci',
  'ciHash',
  'identity_ci_hash',
  'identityCiHash',
  // Generic secrets
  'password',
  'apiKey',
  'api_key',
  'secret',
  'portoneSecret',
  // PII — PortOne verifiedCustomer / user 자료 (REDACT_KEYS에 명시적 추가)
  'phone',
  'phoneNumber',
  'phone_number',
  'birthDate',
  'birth_date',
  'dateOfBirth',
  'date_of_birth',
  'email',
  'emailAddress',
  'email_address',
  'nickname',
  'displayName',
  'display_name',
  'fullName',
  'full_name',
  'userName',
  'user_name',
  // 세션 / 인증 토큰류
  'token',
  'jwt',
  'session',
  'cookie',
  'set-cookie',
  'x-api-key',
  'apikey',
  'service_role_key',
  'anon_key',
  'serviceRoleKey',
  'dsn',
  // ops 대회 claim 토큰 / PIN
  'pin',
  'claimPin',
  'claim_pin',
  'viewToken',
  'view_token',
  'monitorToken',
  'monitor_token',
  // 주민등록번호 / 주소 / 계좌 / 실명
  'rrn',
  'residentRegistrationNumber',
  'address',
  'addr',
  'accountNumber',
  'account_number',
  // 주의: 범용 'name' 키는 의도적으로 제외한다 — Error.name·event.sdk.name·thread/span
  // name 등 Sentry 구조 필드를 [REDACTED] 로 오염시킨다(원 작성자 문서화 결정 유지).
  // 실명 PII 는 아래 구체 키(realName/fullName/displayName/userName)로 커버한다.
  'realName',
  'real_name',
] as const;

const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';
const MAX_DEPTH = 8;
/** 8KB 초과 문자열은 앞부분만 정규식 스캔해 폭주(ReDoS류 성능저하)를 방지한다. */
const STRING_SCAN_LIMIT = 8192;

function matchesRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACT_KEYS.some((k) => k.toLowerCase() === lower);
}

// 값 패턴 마스킹 — 키 이름과 무관하게 문자열 값 내부에 박힌 PII/시크릿을 잡는다.
// JWT/Bearer/시크릿 접두사/hex 토큰을 이메일보다 먼저 처리해, 이미 치환된
// 자리표시자가 뒤 단계 정규식과 우연히 재매치되는 것을 피한다.
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi;
const SECRET_PREFIX_REGEX = /\b(?:sk_[A-Za-z0-9]{10,}|sb_secret_[A-Za-z0-9]{10,})\b/g;
// 주의: 범용 hex 토큰 마스킹은 의도적으로 두지 않는다. `\b[hex]{20,}\b` 는 Sentry
// 자체 구조 필드(event_id·trace_id = 32자 hex)와 MD5/SHA 해시·대시없는 UUID 까지
// [TOKEN] 으로 오염시켜 이벤트 식별·분산추적을 깨뜨린다(실측 확인). 실제 시크릿은
// JWT/Bearer/접두사(sk_·sb_secret_)/키이름 매칭이 이미 커버한다. 과잉마스킹 금지 원칙 우선.
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// 13자리(RRN)를 11자리(휴대폰) 패턴보다 먼저 소비해 부분매치 충돌을 막는다.
const RRN_REGEX = /\b\d{6}[-\s]?\d{7}\b/g;
const PHONE_KR_INTL_REGEX = /\+?82[-\s]?1[016-9][-\s]?\d{3,4}[-\s]?\d{4}\b/g;
const PHONE_KR_REGEX = /\b01[016-9][-\s]?\d{3,4}[-\s]?\d{4}\b/g;

function maskPatterns(text: string): string {
  return text
    .replace(JWT_REGEX, '[JWT]')
    .replace(BEARER_TOKEN_REGEX, '[TOKEN]')
    .replace(SECRET_PREFIX_REGEX, '[TOKEN]')
    .replace(EMAIL_REGEX, '[EMAIL]')
    .replace(RRN_REGEX, '[RRN]')
    .replace(PHONE_KR_INTL_REGEX, '[PHONE]')
    .replace(PHONE_KR_REGEX, '[PHONE]');
}

function maskStringValue(value: string): string {
  if (value.length === 0) return value;
  if (value.length <= STRING_SCAN_LIMIT) return maskPatterns(value);
  // 앞부분만 스캔하고 나머지는 그대로 이어붙인다(폭주 방지, 무손실 길이 유지).
  return maskPatterns(value.slice(0, STRING_SCAN_LIMIT)) + value.slice(STRING_SCAN_LIMIT);
}

export function redactValue(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input;
  if (input instanceof Date) return input;
  if (depth > MAX_DEPTH) {
    if (typeof input === 'string') return maskStringValue(input);
    if (typeof input === 'object') return TRUNCATED;
    return input;
  }
  if (typeof input === 'string') return maskStringValue(input);
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
