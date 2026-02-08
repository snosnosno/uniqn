/**
 * UNIQN Mobile - 환경 설정
 *
 * @description 환경별 설정 및 타입 안전한 환경 변수 접근
 * @version 1.1.0
 *
 * NOTE: Firebase 환경변수 검증은 lib/env.ts (Zod 기반)에서 수행
 * 이 파일은 환경별 Feature Flags, API 설정, 로깅 설정 등을 제공
 */

import { isDevelopment as libIsDevelopment, isProduction as libIsProduction } from '@/lib/env';

// ============================================================================
// Environment Types
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
  api: ApiConfig;
  features: FeatureFlags;
  logging: LoggingConfig;
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
// Environment Detection (lib/env.ts Zod 검증 기반)
// ============================================================================

function detectEnvironment(): Environment {
  const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
  const nodeEnv = process.env.NODE_ENV;

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
// API Configuration
// ============================================================================

const apiConfigs: Record<Environment, ApiConfig> = {
  development: {
    // NOTE: 실제 디바이스에서는 로컬 IP 주소 사용 필요 (예: http://192.168.x.x:5001/...)
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
 *
 * NOTE: Firebase 설정은 lib/env.ts의 getEnv()로 접근 (Zod 검증)
 */
export const env: EnvironmentConfig = {
  environment: currentEnvironment,
  isDevelopment: currentEnvironment === 'development',
  isStaging: currentEnvironment === 'staging',
  isProduction: currentEnvironment === 'production',
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

// lib/env.ts 유틸리티 re-export (하위 호환성)
export { libIsDevelopment as isDevelopmentEnv, libIsProduction as isProductionEnv };

export default env;
