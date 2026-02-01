/**
 * UNIQN Mobile - 환경 설정
 *
 * @description 환경별 설정 및 타입 안전한 환경 변수 접근
 * @version 1.0.0
 */

// ============================================================================
// Environment Types
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
  firebase: FirebaseConfig;
  api: ApiConfig;
  features: FeatureFlags;
  logging: LoggingConfig;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

export interface FeatureFlags {
  enablePushNotifications: boolean;
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enableDebugMode: boolean;
  enableOfflineMode: boolean;
  enableBiometricAuth: boolean;
}

export interface LoggingConfig {
  minLevel: 'debug' | 'info' | 'warn' | 'error';
  enableConsole: boolean;
  enableRemote: boolean;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * 현재 환경 감지
 */
function detectEnvironment(): Environment {
  // Expo의 릴리즈 채널 또는 NODE_ENV로 환경 결정
  const nodeEnv = process.env.NODE_ENV;
  const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;

  if (releaseChannel === 'production' || nodeEnv === 'production') {
    return 'production';
  }

  if (releaseChannel === 'staging') {
    return 'staging';
  }

  return 'development';
}

const currentEnvironment = detectEnvironment();

// ============================================================================
// Environment Variables (Type-Safe)
// ============================================================================

/**
 * 필수 환경 변수 가져오기
 * NOTE: Expo에서는 process.env 동적 접근 대신 직접 참조 사용
 */
function getRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    // 개발 환경에서는 경고만, 프로덕션에서는 에러
    if (currentEnvironment === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`Missing environment variable: ${name}`);
    return '';
  }
  return value;
}

/**
 * 선택적 환경 변수 가져오기 (추후 활용 예정)
 * export for future use - suppresses unused warning
 */
export function getOptionalEnvVar(
  name: string,
  value: string | undefined,
  defaultValue: string
): string {
  void name; // 변수명 로깅에 사용 가능
  return value || defaultValue;
}

// ============================================================================
// Firebase Configuration
// ============================================================================

const firebaseConfig: FirebaseConfig = {
  apiKey: getRequiredEnvVar(
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY
  ),
  authDomain: getRequiredEnvVar(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),
  projectId: getRequiredEnvVar(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
  ),
  storageBucket: getRequiredEnvVar(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  ),
  messagingSenderId: getRequiredEnvVar(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: getRequiredEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

// ============================================================================
// API Configuration
// ============================================================================

const apiConfigs: Record<Environment, ApiConfig> = {
  development: {
    baseUrl: 'http://localhost:5001/tholdem-ebc18/us-central1',
    timeout: 30000,
  },
  staging: {
    baseUrl: 'https://us-central1-tholdem-ebc18-staging.cloudfunctions.net',
    timeout: 15000,
  },
  production: {
    baseUrl: 'https://us-central1-tholdem-ebc18.cloudfunctions.net',
    timeout: 10000,
  },
};

// ============================================================================
// Feature Flags
// ============================================================================

const featureFlagsConfig: Record<Environment, FeatureFlags> = {
  development: {
    enablePushNotifications: false,
    enableAnalytics: false,
    enableCrashReporting: false,
    enableDebugMode: true,
    enableOfflineMode: true,
    enableBiometricAuth: true,
  },
  staging: {
    enablePushNotifications: true,
    enableAnalytics: true,
    enableCrashReporting: true,
    enableDebugMode: true,
    enableOfflineMode: true,
    enableBiometricAuth: true,
  },
  production: {
    enablePushNotifications: true,
    enableAnalytics: true,
    enableCrashReporting: true,
    enableDebugMode: false,
    enableOfflineMode: true,
    enableBiometricAuth: true,
  },
};

// ============================================================================
// Logging Configuration
// ============================================================================

const loggingConfigs: Record<Environment, LoggingConfig> = {
  development: {
    minLevel: 'debug',
    enableConsole: true,
    enableRemote: false,
  },
  staging: {
    minLevel: 'info',
    enableConsole: true,
    enableRemote: true,
  },
  production: {
    minLevel: 'warn',
    enableConsole: false,
    enableRemote: true,
  },
};

// ============================================================================
// Exported Configuration
// ============================================================================

/**
 * 전체 환경 설정
 */
export const env: EnvironmentConfig = {
  environment: currentEnvironment,
  isDevelopment: currentEnvironment === 'development',
  isStaging: currentEnvironment === 'staging',
  isProduction: currentEnvironment === 'production',
  firebase: firebaseConfig,
  api: apiConfigs[currentEnvironment],
  features: featureFlagsConfig[currentEnvironment],
  logging: loggingConfigs[currentEnvironment],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 특정 기능이 활성화되어 있는지 확인
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return env.features[feature];
}

/**
 * 현재 환경 확인
 */
export function isEnvironment(environment: Environment): boolean {
  return env.environment === environment;
}

/**
 * 개발 환경에서만 실행
 */
export function runInDevelopment(fn: () => void): void {
  if (env.isDevelopment) {
    fn();
  }
}

/**
 * 프로덕션 환경에서만 실행
 */
export function runInProduction(fn: () => void): void {
  if (env.isProduction) {
    fn();
  }
}

export default env;
