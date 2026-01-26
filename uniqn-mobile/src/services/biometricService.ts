/**
 * UNIQN Mobile - 생체 인증 서비스
 *
 * @description expo-local-authentication 기반 생체 인증 (Face ID / 지문)
 * @version 1.0.0
 *
 * 지원 기능:
 * - 생체 인증 가능 여부 확인
 * - 생체 인증 타입 확인 (Face ID / 지문)
 * - 생체 인증 수행
 * - 자격 증명 저장/복원 (SecureStore 연동)
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { authStorage } from '@/lib/secureStorage';

// ============================================================================
// Types
// ============================================================================

/**
 * 생체 인증 타입
 */
export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

/**
 * 생체 인증 상태
 */
export interface BiometricStatus {
  /** 생체 인증 하드웨어 존재 여부 */
  isHardwareAvailable: boolean;
  /** 생체 인증 데이터 등록 여부 */
  isEnrolled: boolean;
  /** 지원되는 생체 인증 타입 */
  biometricTypes: BiometricType[];
  /** 생체 인증 사용 가능 여부 (하드웨어 + 등록) */
  isAvailable: boolean;
  /** 보안 레벨 (높음: 생체인증, 중간: PIN/패턴) */
  securityLevel: 'biometric' | 'device' | 'none';
}

/**
 * 생체 인증 결과
 */
export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * 저장된 자격 증명
 */
export interface BiometricCredentials {
  userId: string;
  refreshToken: string;
  savedAt: number;
}

// ============================================================================
// Constants
// ============================================================================

const BIOMETRIC_CREDENTIALS_KEY = 'biometricCredentials';
const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

// ============================================================================
// Dynamic Import
// ============================================================================

/**
 * expo-local-authentication 모듈 타입
 * NOTE: 패키지 설치 후에는 실제 타입 사용
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LocalAuthModule = any;

let LocalAuthentication: LocalAuthModule | null = null;

/**
 * LocalAuthentication 모듈 로드 (네이티브 전용)
 */
async function loadLocalAuthentication(): Promise<LocalAuthModule | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (LocalAuthentication) {
    return LocalAuthentication;
  }

  try {
    LocalAuthentication = await import('expo-local-authentication');
    return LocalAuthentication;
  } catch (error) {
    logger.warn('expo-local-authentication 로드 실패', { error });
    return null;
  }
}

// ============================================================================
// Status Check Functions
// ============================================================================

/**
 * 생체 인증 상태 확인
 *
 * @returns BiometricStatus
 */
export async function checkBiometricStatus(): Promise<BiometricStatus> {
  // 웹에서는 생체 인증 불가
  if (Platform.OS === 'web') {
    return {
      isHardwareAvailable: false,
      isEnrolled: false,
      biometricTypes: [],
      isAvailable: false,
      securityLevel: 'none',
    };
  }

  try {
    const auth = await loadLocalAuthentication();
    if (!auth) {
      return {
        isHardwareAvailable: false,
        isEnrolled: false,
        biometricTypes: [],
        isAvailable: false,
        securityLevel: 'none',
      };
    }

    // 하드웨어 존재 여부
    const hasHardware = await auth.hasHardwareAsync();

    // 생체 인증 데이터 등록 여부
    const isEnrolled = await auth.isEnrolledAsync();

    // 지원되는 인증 타입
    const authTypes = await auth.supportedAuthenticationTypesAsync();
    const biometricTypes: BiometricType[] = authTypes.map((type: number) => {
      switch (type) {
        case auth.AuthenticationType.FINGERPRINT:
          return 'fingerprint';
        case auth.AuthenticationType.FACIAL_RECOGNITION:
          return 'facial';
        case auth.AuthenticationType.IRIS:
          return 'iris';
        default:
          return 'none';
      }
    }).filter((t: BiometricType | 'none'): t is BiometricType => t !== 'none');

    // 보안 레벨 확인
    const securityLevel = await auth.getEnrolledLevelAsync();
    let level: BiometricStatus['securityLevel'] = 'none';
    if (securityLevel === auth.SecurityLevel.BIOMETRIC_STRONG ||
        securityLevel === auth.SecurityLevel.BIOMETRIC_WEAK) {
      level = 'biometric';
    } else if (securityLevel === auth.SecurityLevel.SECRET) {
      level = 'device';
    }

    const status: BiometricStatus = {
      isHardwareAvailable: hasHardware,
      isEnrolled,
      biometricTypes,
      isAvailable: hasHardware && isEnrolled,
      securityLevel: level,
    };

    logger.debug('생체 인증 상태 확인', { status });
    return status;
  } catch (error) {
    logger.error('생체 인증 상태 확인 실패', error as Error);
    return {
      isHardwareAvailable: false,
      isEnrolled: false,
      biometricTypes: [],
      isAvailable: false,
      securityLevel: 'none',
    };
  }
}

/**
 * 생체 인증 타입 이름 반환
 */
export function getBiometricTypeName(types: BiometricType[]): string {
  if (types.includes('facial')) {
    return Platform.OS === 'ios' ? 'Face ID' : '얼굴 인식';
  }
  if (types.includes('fingerprint')) {
    return Platform.OS === 'ios' ? 'Touch ID' : '지문 인식';
  }
  if (types.includes('iris')) {
    return '홍채 인식';
  }
  return '생체 인증';
}

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * 생체 인증 수행
 *
 * @param options 인증 옵션
 * @returns BiometricAuthResult
 */
export async function authenticateWithBiometric(options?: {
  /** 인증 프롬프트 메시지 */
  promptMessage?: string;
  /** 취소 버튼 텍스트 */
  cancelLabel?: string;
  /** PIN/패턴 폴백 허용 여부 */
  disableDeviceFallback?: boolean;
}): Promise<BiometricAuthResult> {
  if (Platform.OS === 'web') {
    return {
      success: false,
      error: '웹에서는 생체 인증을 사용할 수 없습니다',
      errorCode: 'WEB_NOT_SUPPORTED',
    };
  }

  try {
    const auth = await loadLocalAuthentication();
    if (!auth) {
      return {
        success: false,
        error: '생체 인증 모듈을 로드할 수 없습니다',
        errorCode: 'MODULE_LOAD_FAILED',
      };
    }

    const {
      promptMessage = 'UNIQN 로그인',
      cancelLabel = '취소',
      disableDeviceFallback = false,
    } = options ?? {};

    const result = await auth.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback,
      fallbackLabel: '비밀번호로 로그인',
    });

    if (result.success) {
      logger.info('생체 인증 성공');
      return { success: true };
    }

    // 인증 실패 원인 분석
    let errorCode = 'UNKNOWN';
    let errorMessage = '생체 인증에 실패했습니다';

    if (result.error === 'user_cancel') {
      errorCode = 'USER_CANCELLED';
      errorMessage = '사용자가 취소했습니다';
    } else if (result.error === 'user_fallback') {
      errorCode = 'USER_FALLBACK';
      errorMessage = '비밀번호 로그인으로 전환합니다';
    } else if (result.error === 'system_cancel') {
      errorCode = 'SYSTEM_CANCELLED';
      errorMessage = '시스템에 의해 취소되었습니다';
    } else if (result.error === 'not_enrolled') {
      errorCode = 'NOT_ENROLLED';
      errorMessage = '등록된 생체 정보가 없습니다';
    } else if (result.error === 'lockout' || result.error === 'lockout_permanent') {
      errorCode = 'LOCKOUT';
      errorMessage = '너무 많은 시도로 인해 잠겼습니다. 나중에 다시 시도해주세요';
    }

    logger.warn('생체 인증 실패', { error: result.error, errorCode });
    return {
      success: false,
      error: errorMessage,
      errorCode,
    };
  } catch (error) {
    logger.error('생체 인증 오류', error as Error);
    return {
      success: false,
      error: '생체 인증 중 오류가 발생했습니다',
      errorCode: 'EXCEPTION',
    };
  }
}

// ============================================================================
// Credential Storage Functions
// ============================================================================

/**
 * 생체 인증용 자격 증명 저장
 *
 * @param userId 사용자 ID
 * @param refreshToken Refresh Token
 */
export async function saveBiometricCredentials(
  userId: string,
  refreshToken: string
): Promise<void> {
  try {
    const credentials: BiometricCredentials = {
      userId,
      refreshToken,
      savedAt: Date.now(),
    };

    // SecureStore에 암호화 저장
    await authStorage.setRefreshToken(refreshToken);

    // MMKV에 메타데이터 저장
    const { setItem } = await import('@/lib/secureStorage');
    await setItem(BIOMETRIC_CREDENTIALS_KEY, credentials);

    logger.info('생체 인증 자격 증명 저장 완료', { userId });
  } catch (error) {
    logger.error('생체 인증 자격 증명 저장 실패', error as Error);
    throw error;
  }
}

/**
 * 생체 인증용 자격 증명 조회
 *
 * @returns BiometricCredentials | null
 */
export async function getBiometricCredentials(): Promise<BiometricCredentials | null> {
  try {
    const { getItem } = await import('@/lib/secureStorage');
    const credentials = await getItem<BiometricCredentials>(BIOMETRIC_CREDENTIALS_KEY);

    if (!credentials) {
      return null;
    }

    // Refresh Token 복원
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) {
      logger.warn('저장된 Refresh Token 없음');
      return null;
    }

    return {
      ...credentials,
      refreshToken,
    };
  } catch (error) {
    logger.error('생체 인증 자격 증명 조회 실패', error as Error);
    return null;
  }
}

/**
 * 생체 인증용 자격 증명 삭제
 */
export async function clearBiometricCredentials(): Promise<void> {
  try {
    const { deleteItem } = await import('@/lib/secureStorage');
    await deleteItem(BIOMETRIC_CREDENTIALS_KEY);
    await authStorage.clearTokens();

    logger.info('생체 인증 자격 증명 삭제 완료');
  } catch (error) {
    logger.error('생체 인증 자격 증명 삭제 실패', error as Error);
    throw error;
  }
}

// ============================================================================
// Settings Functions
// ============================================================================

/**
 * 생체 인증 활성화 상태 저장
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    const { setItem } = await import('@/lib/secureStorage');
    await setItem(BIOMETRIC_ENABLED_KEY, enabled);

    if (!enabled) {
      // 비활성화 시 자격 증명도 삭제
      await clearBiometricCredentials();
    }

    logger.info('생체 인증 설정 변경', { enabled });
  } catch (error) {
    logger.error('생체 인증 설정 변경 실패', error as Error);
    throw error;
  }
}

/**
 * 생체 인증 활성화 상태 조회
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const { getItem } = await import('@/lib/secureStorage');
    const enabled = await getItem<boolean>(BIOMETRIC_ENABLED_KEY);
    return enabled ?? false;
  } catch (error) {
    logger.error('생체 인증 설정 조회 실패', error as Error);
    return false;
  }
}

// ============================================================================
// Export
// ============================================================================

export const biometricService = {
  // Status
  checkBiometricStatus,
  getBiometricTypeName,

  // Authentication
  authenticateWithBiometric,

  // Credentials
  saveBiometricCredentials,
  getBiometricCredentials,
  clearBiometricCredentials,

  // Settings
  setBiometricEnabled,
  isBiometricEnabled,
};

export default biometricService;
