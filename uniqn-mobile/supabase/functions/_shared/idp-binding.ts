/**
 * Shared helpers for verify-portone-identity / verify-and-save-portone-profile
 * (그리고 향후 Apple/PortOne IdP caller binding 함수들).
 *
 * Web Crypto API + 표준 TextEncoder만 사용 — Deno deploy / Node 19+ / jsdom
 * 모두에서 동일하게 동작 (jest 단위 테스트 가능).
 */
import { IDP_ERROR_CODES, type IdpErrorCode } from './idp-errors.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function idpError(code: IdpErrorCode, detail?: string): Response {
  const { status, message } = IDP_ERROR_CODES[code];
  return new Response(JSON.stringify({ error: message, code, ...(detail ? { detail } : {}) }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Supabase 쿼리처럼 `{ error }` 를 반환(throw 하지 않음)하는 작업을 재시도한다.
 *
 * 멱등성 롤백 DELETE 같이 "일시 장애로 실패하면 dangling row 가 후속 재시도를
 * 영구 차단하는" 작업을 위한 best-effort 하드닝. 마지막 결과를 그대로 반환하므로
 * 호출자가 최종 error 를 직접 처리한다 (A7 dangling-row 가시성 유지).
 */
export async function retryOnError<T extends { error: unknown }>(
  // PostgREST 쿼리 빌더는 Promise 가 아닌 PromiseLike(thenable) 이므로 PromiseLike 로 받는다.
  op: () => PromiseLike<T>,
  opts: { attempts: number; delayMs: number; sleep?: (ms: number) => Promise<void> }
): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let result = await op();
  for (let attempt = 1; attempt < opts.attempts && result.error; attempt += 1) {
    await sleep(opts.delayMs);
    result = await op();
  }
  return result;
}

export function isVerificationRecent(
  verifiedAt: string | undefined,
  maxAgeMs = 5 * 60 * 1000
): boolean {
  if (!verifiedAt || typeof verifiedAt !== 'string') return false;
  const ms = new Date(verifiedAt).getTime();
  if (isNaN(ms)) return false;
  const delta = Date.now() - ms;
  // delta < 0 (미래 timestamp): clock skew 가능성 — 차단하지 않음 (window 내 간주)
  // delta > maxAgeMs: 만료
  return delta <= maxAgeMs;
}

export function normalizeBirthDate(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/-/g, '');
  if (!/^\d{8}$/.test(cleaned)) return undefined;
  return cleaned;
}

export function normalizeGender(value?: string): 'male' | 'female' | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper === 'MALE') return 'male';
  if (upper === 'FEMALE') return 'female';
  return undefined;
}

export function toE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+82')) return cleaned;
  if (cleaned.startsWith('010') || cleaned.startsWith('011')) {
    return '+82' + cleaned.substring(1);
  }
  return cleaned;
}

export function validateAge(birthDate: string, minAge: number): boolean {
  if (!/^\d{8}$/.test(birthDate)) return false;
  const year = parseInt(birthDate.substring(0, 4), 10);
  const month = parseInt(birthDate.substring(4, 6), 10) - 1;
  const day = parseInt(birthDate.substring(6, 8), 10);
  const birth = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= minAge;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * PortOne 응답의 `verifiedCustomer.di` 필드 존재/길이만 로깅 (Spec C 진단).
 *
 * INICIS/KCP 등 PG사가 `di`를 실제로 응답에 포함하는지 1-2주 운영 데이터로 검증
 * 후 di_hash dedup 본 구현 결정. PII 자체는 로깅 안 함, 길이/타입만 기록.
 */
export function logDiDiagnostic(
  verifiedCustomer: { di?: unknown } | null | undefined,
  context: string
): void {
  const di = verifiedCustomer?.di;
  const hasDi = typeof di === 'string' && di.length > 0;
  console.log('[di-diagnostic]', {
    context,
    hasDi,
    diLength: hasDi ? (di as string).length : 0,
    diType: di === undefined ? 'undefined' : typeof di,
  });
}

export async function createDeterministicHash(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * A6: PortOne CI 해시 전용. pepper(IDENTITY_HASH_PEPPER) 를 HMAC key 로 사용.
 *
 * 기존 구현이 portoneSecret 을 그대로 HMAC key 로 사용해서 PortOne API 시크릿
 * 회전 시 모든 기존 hash 가 무효화되어 중복 검사가 깨지는 문제(A6) 해결.
 * pepper 는 PortOne 과 분리 회전 가능한 32바이트 random hex.
 *
 * 즉시 cutover 정책 — pepper 미설정·길이 부족 시 throw. Deploy 전 secret 등록 필수.
 * caller 가 `Deno.env.get('IDENTITY_HASH_PEPPER')` 로 읽어서 전달 — pure 함수 유지로
 * 단위 테스트 / Edge Function / 향후 다른 환경 호환.
 */
export async function createCiHash(ci: string, pepper: string | undefined): Promise<string> {
  if (!pepper || pepper.length < 32) {
    throw new Error('IDENTITY_HASH_PEPPER env not configured (min 32 chars)');
  }
  return createDeterministicHash(ci, pepper);
}
