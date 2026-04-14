import Constants from 'expo-constants';
import type { Customer, IdentityVerificationRequest } from '@portone/browser-sdk/v2';
import { supabase } from '@/lib/supabase';
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

export interface PendingPortOneIdentityRequest {
  provider: 'portone_inicis';
  request: PortOneInicisIdentityRequest;
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
  const directAgency = portOne?.inicisDirectAgency?.trim() as PortOneInicisDirectAgency | undefined;
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
): PortOneInicisIdentityRequest {
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

  return {
    storeId: config.storeId,
    channelKey: config.channelKey,
    identityVerificationId: input.identityVerificationId ?? createPortOneIdentityVerificationId(),
    customer: Object.keys(customer).length > 0 ? customer : undefined,
    customData: input.customData,
    bypass: {
      inicisUnified: {
        flgFixedUser: 'N',
        directAgency: input.directAgency ?? config.directAgency,
        logoUrl: input.logoUrl ?? config.logoUrl,
        FRGNDInfo: input.frgndInfo ?? config.frgndInfo,
      },
    },
  };
}

export function savePendingPortOneIdentityRequest(request: PortOneInicisIdentityRequest): void {
  setStorageItem<PendingPortOneIdentityRequest>(STORAGE_KEYS.PORTONE_IDENTITY_REQUEST, {
    provider: 'portone_inicis',
    request,
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

export async function callVerifyPortOneIdentity(
  payload: VerifyPortOneIdentityPayload
): Promise<VerifyPortOneIdentityResult> {
  const invoke = async () => {
    const { data, error } = await supabase.functions.invoke<VerifyPortOneIdentityResult>(
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
  const invoke = async () => {
    const { data, error } = await supabase.functions.invoke<VerifyAndSavePortOneProfileResult>(
      'verify-and-save-portone-profile',
      {
        body: payload,
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
