import Constants from 'expo-constants';
import type { Customer, IdentityVerificationRequest } from '@portone/browser-sdk/v2';
import { invokeEdgeFunction } from '@/lib/supabaseFunctions';
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { secureStorage } from '@/lib/secureStorage';
import { AuthError, ERROR_CODES, ValidationError, isRetryableError } from '@/errors';
import { logger } from '@/utils/logger';
import { generateUUID } from '@/utils/generateId';

/**
 * A3: Edge Function 에러 응답 body 의 `{ code, error }` 를 파싱한다.
 * Supabase FunctionsHttpError 의 `context: Response` 에서 JSON 을 추출.
 */
async function parseEdgeFunctionErrorBody(
  error: unknown
): Promise<{ code?: string; error?: string } | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: unknown }).context;
  if (!ctx || typeof ctx !== 'object') return null;
  // FunctionsHttpError.context 는 fetch Response.
  const maybeResponse = ctx as { json?: () => Promise<unknown>; clone?: () => Response };
  if (typeof maybeResponse.json !== 'function') return null;
  try {
    // Response body 는 1회 읽기 — clone 가능하면 그쪽 사용
    const target =
      typeof maybeResponse.clone === 'function' ? maybeResponse.clone() : maybeResponse;
    const body = (await (target as { json: () => Promise<unknown> }).json()) as unknown;
    if (!body || typeof body !== 'object') return null;
    const obj = body as Record<string, unknown>;
    return {
      code: typeof obj.code === 'string' ? obj.code : undefined,
      error: typeof obj.error === 'string' ? obj.error : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * C4 — bindingToken은 SecureStore(iOS 키체인 / Android 키스토어 / 웹 sessionStorage)에 저장.
 * 키 이름은 securityConfig.SENSITIVE_STORAGE_KEYS / KNOWN_STORAGE_KEYS와 일치해야 함.
 */
const BINDING_TOKEN_SECURE_KEY = 'portOneBindingToken';

/** A10: bindingToken 은 32바이트 random hex (64자). 서버도 동일 정규식으로 검증. */
const BINDING_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function assertValidBindingToken(token: string | undefined, context: string): void {
  if (token === undefined) return; // optional path 에서는 통과
  if (!BINDING_TOKEN_PATTERN.test(token)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '본인인증 토큰 형식이 올바르지 않습니다. 다시 시도해주세요.',
      metadata: { context },
    });
  }
}

export type PortOneInicisDirectAgency =
  | 'PAYCO'
  | 'PASS'
  | 'TOSS'
  | 'KFTC'
  | 'KAKAO'
  | 'NAVER'
  | 'SAMSUNG'
  | 'SHINHAN'
  | 'KB'
  | 'HANA'
  | 'WOORI'
  | 'NH'
  | 'KAKAOBANK'
  | 'SMS';

export interface PortOneInicisIdentityConfig {
  storeId: string;
  channelKey: string;
  directAgency?: PortOneInicisDirectAgency;
  logoUrl?: string;
  frgndInfo: 'Y' | 'N';
  isReady: boolean;
}

export interface PortOneInicisIdentityRequestInput {
  identityVerificationId?: string;
  customerId?: string;
  customerFullName?: string;
  customerPhoneNumber?: string;
  customData?: string;
  directAgency?: PortOneInicisDirectAgency;
  logoUrl?: string;
  frgndInfo?: 'Y' | 'N';
}

export type PortOneInicisIdentityRequest = IdentityVerificationRequest;

/**
 * `buildPortOneInicisIdentityRequest` 반환. caller binding (P0 #1) 위해
 * 클라이언트가 생성한 random `bindingToken`이 request.customData(JSON)와
 * 별도 필드 양쪽에 들어있다. caller는 token을 verify API payload의
 * `expectedBindingToken`으로 함께 전달해야 한다.
 */
export interface PortOneIdentityRequestBundle {
  request: PortOneInicisIdentityRequest;
  bindingToken: string;
}

export interface PendingPortOneIdentityRequest {
  provider: 'portone_inicis';
  request: PortOneInicisIdentityRequest;
  bindingToken: string;
  createdAt: number;
}

export interface PortOneIdentityVerificationResult {
  identityVerificationId: string;
  identityVerificationTxId: string;
  code?: string;
  message?: string;
  pgCode?: string;
  pgMessage?: string;
}

export interface VerifiedPortOneIdentity {
  provider: 'portone';
  channel: 'inicis_unified';
  identityVerificationId: string;
  verifiedAt: string;
  name: string;
  birthDate: string;
  gender?: 'male' | 'female';
  phoneNumber?: string;
  ciHash?: string;
  isForeigner?: boolean;
}

export interface VerifyPortOneIdentityPayload {
  identityVerificationId: string;
  /** P0 #1 caller binding — client가 PortOne SDK에 박은 token과 서버 검증 */
  expectedBindingToken?: string;
}

export interface VerifyPortOneIdentityResult {
  success: true;
  identityVerified: true;
  phoneVerified: boolean;
  hasDuplicatePhone: boolean;
  hasDuplicateIdentity: boolean;
  identity: VerifiedPortOneIdentity;
}

export interface VerifyAndSavePortOneProfilePayload {
  identityVerificationId: string;
  /** P0 #1 caller binding — verify-portone-identity와 동일 검증 layer */
  expectedBindingToken?: string;
  /**
   * 2026-05-16: PortOne 이니시스 통합인증이 gender 를 응답하지 않을 때 클라가 사용자에게
   * 받은 값. 서버는 PortOne 응답의 gender 가 우선이며, 없을 때만 이 값을 fallback 으로 사용.
   */
  gender?: 'male' | 'female';
  nickname?: string;
  region?: string;
  experienceYears?: number;
  career?: string;
  note?: string;
  /** reverify 모드에서는 무시 (기존 동의 유지) — true 전송 권장 */
  termsAgreed: boolean;
  /** reverify 모드에서는 무시 (기존 동의 유지) — true 전송 권장 */
  privacyAgreed: boolean;
  /** reverify 모드에서는 무시 (기존 동의 유지) — true 전송 권장 (개보법 §17 별도 동의) */
  thirdPartyAgreed: boolean;
  /** reverify 모드에서는 무시 (기존 동의 유지) */
  marketingAgreed: boolean;
  email?: string;
  /**
   * - `signup`: 일반 회원가입 (auth.users 신규 + 프로필 upsert)
   * - `social`: 소셜 로그인(Apple) 후 프로필 완성
   * - `reverify`: 기존 사용자가 identity_verified=false 상태에서 재인증
   *               (본인인증 핵심 필드만 update; 약관/프로필/role 미변경)
   */
  mode: 'signup' | 'social' | 'reverify';
}

export interface VerifyAndSavePortOneProfileResult {
  success: boolean;
  uid: string;
}

interface ExpoExtraWithPortOne {
  portOne?: {
    storeId?: string;
    inicisChannelKey?: string;
    inicisDirectAgency?: string;
    inicisLogoUrl?: string;
    inicisFrgndInfo?: string;
  };
}

/**
 * Cryptographically random bindingToken 생성.
 *
 * RN/Web 모두 `crypto.getRandomValues`가 표준 — generateUUID()는 fallback
 * 경로가 Math.random일 수 있으니 별도로 발급해 entropy 보장.
 */
function generateBindingToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function sanitizePhoneNumber(phoneNumber?: string): string | undefined {
  if (!phoneNumber) {
    return undefined;
  }

  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
  return digitsOnly.length > 0 ? digitsOnly : undefined;
}

export function createPortOneIdentityVerificationId(prefix = 'inicis-identity'): string {
  return `${prefix}-${generateUUID()}`;
}

export function getPortOneInicisIdentityConfig(): PortOneInicisIdentityConfig {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithPortOne | undefined;
  const portOne = extra?.portOne;

  const storeId = portOne?.storeId?.trim() ?? '';
  const channelKey = portOne?.inicisChannelKey?.trim() ?? '';
  const directAgencyRaw = portOne?.inicisDirectAgency?.trim();
  const directAgency = directAgencyRaw ? (directAgencyRaw as PortOneInicisDirectAgency) : undefined;
  const logoUrl = portOne?.inicisLogoUrl?.trim() || undefined;
  const frgndInfo = portOne?.inicisFrgndInfo === 'Y' ? 'Y' : 'N';

  return {
    storeId,
    channelKey,
    directAgency,
    logoUrl,
    frgndInfo,
    isReady: storeId.length > 0 && channelKey.length > 0,
  };
}

export function isPortOneInicisIdentityConfigured(): boolean {
  return getPortOneInicisIdentityConfig().isReady;
}

export function buildPortOneInicisIdentityRequest(
  input: PortOneInicisIdentityRequestInput = {}
): PortOneIdentityRequestBundle {
  const config = getPortOneInicisIdentityConfig();

  if (!config.isReady) {
    // B1: 운영자 메시지 → 사용자 친화적. 설정 누락은 사용자가 해결 불가 → 재시도 안내
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '본인인증 서비스 일시 점검 중이에요. 잠시 후 다시 시도해주세요.',
    });
  }

  const customer: Customer = {};
  if (input.customerId) {
    customer.customerId = input.customerId;
  }
  if (input.customerFullName) {
    customer.fullName = input.customerFullName.trim();
  }

  const sanitizedPhoneNumber = sanitizePhoneNumber(input.customerPhoneNumber);
  if (sanitizedPhoneNumber) {
    customer.phoneNumber = sanitizedPhoneNumber;
  }

  // 빈 값을 SDK에 넘기면 KG이니시스가 "파라미터가 유효하지 않습니다"로 거부하므로
  // 명시적으로 값이 있을 때만 키를 추가한다.
  const resolvedDirectAgency = input.directAgency ?? config.directAgency;
  const resolvedLogoUrl = input.logoUrl ?? config.logoUrl;

  // P0 #1 caller binding — client가 생성한 token을 customData(JSON)에 박고
  // 같은 token을 verify API payload로 함께 보내 서버에서 일치 검증.
  // caller가 customData 직접 지정 시 binding 비활성(legacy 호환).
  const bindingToken = generateBindingToken();
  const customData = input.customData ?? JSON.stringify({ bindingToken });

  const request: PortOneInicisIdentityRequest = {
    storeId: config.storeId,
    channelKey: config.channelKey,
    identityVerificationId: input.identityVerificationId ?? createPortOneIdentityVerificationId(),
    customer: Object.keys(customer).length > 0 ? customer : undefined,
    customData,
    bypass: {
      inicisUnified: {
        flgFixedUser: 'N',
        FRGNDInfo: input.frgndInfo ?? config.frgndInfo,
        ...(resolvedDirectAgency ? { directAgency: resolvedDirectAgency } : {}),
        ...(resolvedLogoUrl ? { logoUrl: resolvedLogoUrl } : {}),
      },
    },
  };

  return { request, bindingToken };
}

export function savePendingPortOneIdentityRequest(
  request: PortOneInicisIdentityRequest,
  bindingToken: string
): void {
  setStorageItem<PendingPortOneIdentityRequest>(STORAGE_KEYS.PORTONE_IDENTITY_REQUEST, {
    provider: 'portone_inicis',
    request,
    bindingToken,
    createdAt: Date.now(),
  });
}

export function getPendingPortOneIdentityRequest(): PendingPortOneIdentityRequest | null {
  return getStorageItem<PendingPortOneIdentityRequest>(STORAGE_KEYS.PORTONE_IDENTITY_REQUEST);
}

export function clearPendingPortOneIdentityRequest(): void {
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_REQUEST);
}

export function savePortOneIdentityVerificationResult(
  result: PortOneIdentityVerificationResult
): void {
  setStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_RESULT, result);
}

export function clearPortOneIdentityVerificationResult(): void {
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_RESULT);
}

/**
 * Caller binding token storage (P0 #1, C4 hardening).
 *
 * 본인인증 success path에서 컴포넌트가 token을 storage에 박아두고,
 * 후속 `callVerifyAndSavePortOneProfile` 호출(signUp 후) 시 자동으로
 * payload에 포함된다. 컴포넌트 unmount 후에도 token이 유지되어야 한다.
 *
 * C4 — MMKV → SecureStore (iOS 키체인 / Android 키스토어). XSS·다른 앱에서
 * 토큰 추출을 방지한다.
 */
export async function savePortOneIdentityBindingToken(token: string): Promise<void> {
  await secureStorage.setItem(BINDING_TOKEN_SECURE_KEY, token, {
    keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  });
  // legacy MMKV 값이 있으면 정리 (이전 빌드 잔존분)
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
}

/**
 * C3 fix — read-only로 token 조회. 명시적 clear는 호출자가 success 후 수행.
 * consume(read+remove) 패턴은 retry 시 두 번째 호출에서 token 누락 → binding
 * bypass 위험. 본 함수는 idempotent.
 *
 * C4 — SecureStore 우선 조회. 값이 없으면 legacy MMKV에서 1회 마이그레이션.
 */
export async function getPortOneIdentityBindingToken(): Promise<string | null> {
  const secureValue = await secureStorage.getItem<string>(BINDING_TOKEN_SECURE_KEY);
  if (secureValue) return secureValue;

  // C4 migration — 이전 빌드가 MMKV에 저장한 토큰을 SecureStore로 옮긴다.
  const legacyValue = getStorageItem<string>(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
  if (legacyValue) {
    await secureStorage.setItem(BINDING_TOKEN_SECURE_KEY, legacyValue, {
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    });
    removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
    logger.info('bindingToken MMKV → SecureStore migration 완료', {
      component: 'portOneIdentityService',
    });
    return legacyValue;
  }

  return null;
}

export async function clearPortOneIdentityBindingToken(): Promise<void> {
  await secureStorage.deleteItem(BINDING_TOKEN_SECURE_KEY);
  // legacy MMKV 값도 함께 제거 (방어적)
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
}

/**
 * 2026-05-16 — Edge Function `verify-portone-identity` 의 IdP 에러 코드를 사용자 친화
 * 한글 메시지의 ValidationError 로 변환.
 *
 * Supabase FunctionsHttpError 는 `Edge Function returned a non-2xx status code` 영문
 * generic 메시지만 가짐. 그대로 UI 노출되는 사고(2026-05-16 14:29 KST) 재발 방지.
 * 매핑 대상: `supabase/functions/_shared/idp-errors.ts` 의 IDP_ERROR_CODES.
 */
function mapIdpErrorCodeToAppError(code: string, serverMessage?: string): ValidationError {
  switch (code) {
    case 'IV_BINDING_MISMATCH':
    case 'IV_TIMESTAMP_EXPIRED':
    case 'PORTONE_NOT_VERIFIED':
    case 'PORTONE_INCOMPLETE':
    case 'IV_INVALID':
      return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage:
          '본인인증을 완료하지 못했어요. 다른 인증 수단(PASS·토스·카카오·네이버·신한·KB)으로 다시 시도해주세요.',
        metadata: { code, serverMessage },
      });
    case 'PORTONE_FETCH_FAILED':
      return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '본인인증 정보 조회에 실패했어요. 잠시 후 다시 시도해주세요.',
        metadata: { code, serverMessage },
      });
    case 'PORTONE_AGE_RESTRICTED':
      return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '14세 이상만 가입할 수 있어요.',
        metadata: { code, serverMessage },
      });
    case 'IV_RATE_LIMITED':
      return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
        metadata: { code, serverMessage },
      });
    default:
      return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: serverMessage ?? '본인인증 처리 중 오류가 발생했어요. 다시 시도해주세요.',
        metadata: { code, serverMessage },
      });
  }
}

export async function callVerifyPortOneIdentity(
  payload: VerifyPortOneIdentityPayload
): Promise<VerifyPortOneIdentityResult> {
  assertValidBindingToken(payload.expectedBindingToken, 'callVerifyPortOneIdentity');
  const invoke = async () => {
    const { data, error } = await invokeEdgeFunction<VerifyPortOneIdentityResult>(
      'verify-portone-identity',
      { body: payload }
    );
    if (error) {
      // FunctionsHttpError 의 영문 generic 메시지가 UI 에 노출되지 않도록 IdP code 로 typed 변환.
      const parsed = await parseEdgeFunctionErrorBody(error);
      if (parsed?.code) {
        logger.info('verifyPortOneIdentity edge error mapped to ValidationError', {
          component: 'portOneIdentityService',
          code: parsed.code,
        });
        throw mapIdpErrorCodeToAppError(parsed.code, parsed.error);
      }
      throw error;
    }
    return data!;
  };

  try {
    return await invoke();
  } catch (error) {
    if (!isRetryableError(error)) {
      throw error;
    }

    logger.warn('verifyPortOneIdentity network error - retrying once', {
      component: 'portOneIdentityService',
      error: error instanceof Error ? error.message : String(error),
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await invoke();
  }
}

/**
 * 본인인증 재인증 (identity_verified=false → true).
 *
 * `callVerifyAndSavePortOneProfile({ mode: 'reverify' })` 단축 호출. 약관 필드는
 * 서버에서 무시되지만 schema 충족 위해 true 채움.
 */
export async function callReverifyIdentity(
  identityVerificationId: string,
  expectedBindingToken?: string
): Promise<VerifyAndSavePortOneProfileResult> {
  return callVerifyAndSavePortOneProfile({
    identityVerificationId,
    expectedBindingToken,
    termsAgreed: true,
    privacyAgreed: true,
    thirdPartyAgreed: true,
    marketingAgreed: false,
    mode: 'reverify',
  });
}

export async function callVerifyAndSavePortOneProfile(
  payload: VerifyAndSavePortOneProfilePayload,
  accessToken?: string
): Promise<VerifyAndSavePortOneProfileResult> {
  // P0 #1 — caller가 payload에 token 명시 안 했으면 storage에서 자동 조회.
  // C3 fix: read-only로 가져옴. 성공 후 명시적 clear (실패 시 재시도 가능).
  // C4: SecureStore 비동기 조회.
  const tokenFromStorage = payload.expectedBindingToken
    ? null
    : await getPortOneIdentityBindingToken();
  const resolvedPayload: VerifyAndSavePortOneProfilePayload = {
    ...payload,
    expectedBindingToken: payload.expectedBindingToken ?? tokenFromStorage ?? undefined,
  };
  assertValidBindingToken(resolvedPayload.expectedBindingToken, 'callVerifyAndSavePortOneProfile');
  const invoke = async () => {
    const { data, error } = await invokeEdgeFunction<VerifyAndSavePortOneProfileResult>(
      'verify-and-save-portone-profile',
      {
        body: resolvedPayload,
        // signUp 직후 AsyncStorage 미동기화 대비: 토큰 명시 전달
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }
    );
    if (error) throw error;
    return data!;
  };

  // C4 — clear 실패는 swallow. invoke() 가 이미 성공했으면 orphan token 은
  // 회복 가능한 부채(다음 get 호출에서 재정리)이지만, throw 시 caller 가 success
  // 결과를 잃고 retry 하면 서버에 중복 프로필 생성 시도 발생.
  const clearOnSuccess = async () => {
    if (!tokenFromStorage) return;
    try {
      await clearPortOneIdentityBindingToken();
    } catch (clearError) {
      logger.warn('bindingToken clear 실패 - orphan token 잔존, 다음 호출에서 정리', {
        component: 'portOneIdentityService',
        error: clearError instanceof Error ? clearError.message : String(clearError),
      });
    }
  };

  try {
    const result = await invoke();
    // C3 fix — success 후에만 storage token clear (재시도 가능성 보존)
    await clearOnSuccess();
    return result;
  } catch (error) {
    // A3: PROFILE_ALREADY_COMPLETED — signUp 후 signInWithPassword fallback 가 기존 계정에 적중한 케이스.
    // 사용자에게 명확한 안내를 위해 typed AuthError 로 변환 (signup.tsx 가 code 분기).
    const parsed = await parseEdgeFunctionErrorBody(error);
    if (parsed?.code === 'PROFILE_ALREADY_COMPLETED') {
      logger.info('verifyAndSavePortOneProfile detected PROFILE_ALREADY_COMPLETED', {
        component: 'portOneIdentityService',
      });
      throw new AuthError(ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS, {
        userMessage:
          '이미 가입된 계정입니다. 로그인 화면에서 비밀번호로 로그인하거나 비밀번호 찾기를 이용해주세요.',
        metadata: { reason: 'PROFILE_ALREADY_COMPLETED' },
      });
    }

    // A-1 — verify-identity 경로와 동일하게 IdP code 를 한글 ValidationError 로 변환.
    // (PORTONE_CONFIG_MISSING 등 서버 설정/검증 에러의 영문 generic 메시지 UI 노출 방지.)
    if (parsed?.code) {
      logger.info('verifyAndSavePortOneProfile edge error mapped to ValidationError', {
        component: 'portOneIdentityService',
        code: parsed.code,
      });
      throw mapIdpErrorCodeToAppError(parsed.code, parsed.error);
    }

    if (!isRetryableError(error)) {
      throw error;
    }

    logger.warn('verifyAndSavePortOneProfile network error - retrying once', {
      component: 'portOneIdentityService',
      error: error instanceof Error ? error.message : String(error),
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const result = await invoke();
    await clearOnSuccess();
    return result;
  }
}
