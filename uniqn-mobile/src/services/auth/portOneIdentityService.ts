import Constants from 'expo-constants';
import type { Customer, IdentityVerificationRequest } from '@portone/browser-sdk/v2';
import { invokeEdgeFunction } from '@/lib/supabaseFunctions';
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { ERROR_CODES, ValidationError, isRetryableError } from '@/errors';
import { logger } from '@/utils/logger';
import { generateUUID } from '@/utils/generateId';

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
  nickname?: string;
  region?: string;
  experienceYears?: number;
  career?: string;
  note?: string;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed: boolean;
  email?: string;
  mode: 'signup' | 'social';
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
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '포트원 KG이니시스 본인인증 설정이 아직 완료되지 않았습니다.',
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

export function consumePortOneIdentityVerificationResult(): PortOneIdentityVerificationResult | null {
  const result = getStorageItem<PortOneIdentityVerificationResult>(
    STORAGE_KEYS.PORTONE_IDENTITY_RESULT
  );
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_RESULT);
  return result;
}

export function clearPortOneIdentityVerificationResult(): void {
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_RESULT);
}

/**
 * Caller binding token storage (P0 #1).
 *
 * 본인인증 success path에서 컴포넌트가 token을 storage에 박아두고,
 * 후속 `callVerifyAndSavePortOneProfile` 호출(signUp 후) 시 자동으로
 * payload에 포함된다. 컴포넌트 unmount 후에도 token이 유지되어야 한다.
 */
export function savePortOneIdentityBindingToken(token: string): void {
  setStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN, token);
}

export function consumePortOneIdentityBindingToken(): string | null {
  const token = getStorageItem<string>(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
  return token;
}

export function clearPortOneIdentityBindingToken(): void {
  removeStorageItem(STORAGE_KEYS.PORTONE_IDENTITY_BINDING_TOKEN);
}

export async function callVerifyPortOneIdentity(
  payload: VerifyPortOneIdentityPayload
): Promise<VerifyPortOneIdentityResult> {
  const invoke = async () => {
    const { data, error } = await invokeEdgeFunction<VerifyPortOneIdentityResult>(
      'verify-portone-identity',
      { body: payload }
    );
    if (error) throw error;
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

export async function callVerifyAndSavePortOneProfile(
  payload: VerifyAndSavePortOneProfilePayload,
  accessToken?: string
): Promise<VerifyAndSavePortOneProfileResult> {
  // P0 #1 — caller가 payload에 token 명시 안 했으면 storage에서 자동 consume.
  // signUp / completeSocialProfile 호출자 코드 수정 없이도 binding 검증 보장.
  const resolvedPayload: VerifyAndSavePortOneProfilePayload = {
    ...payload,
    expectedBindingToken:
      payload.expectedBindingToken ?? consumePortOneIdentityBindingToken() ?? undefined,
  };
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

  try {
    return await invoke();
  } catch (error) {
    if (!isRetryableError(error)) {
      throw error;
    }

    logger.warn('verifyAndSavePortOneProfile network error - retrying once', {
      component: 'portOneIdentityService',
      error: error instanceof Error ? error.message : String(error),
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await invoke();
  }
}
