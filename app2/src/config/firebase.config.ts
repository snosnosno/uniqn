/**
 * Firebase 설정 관리
 * 환경 변수 기반 설정 및 보안 강화
 */

import { logger } from '../utils/logger';

// 환경 변수 검증 (프로덕션에서 강제)
const validateEnvVar = (key: string, defaultValue?: string, required = false): string => {
  const value = process.env[key] || defaultValue;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!value) {
    const message = `환경 변수 ${key}가 설정되지 않았습니다.`;

    // 프로덕션에서 필수 변수가 없으면 에러
    if (isProduction && required) {
      throw new Error(`[CRITICAL] ${message} - 프로덕션 환경에서 필수 환경 변수입니다.`);
    }

    logger.warn(message, {
      component: 'firebase.config'
    });
  }

  return value || '';
};

// Firebase 프록시 사용 여부
const useProxy = process.env.REACT_APP_USE_FIREBASE_PROXY === 'true';
const proxyUrl = process.env.REACT_APP_FIREBASE_PROXY_URL;

// Firebase 설정 (프로덕션 필수 변수 강제)
export const firebaseConfig = {
  // 프록시 사용 시 API 키를 숨김
  apiKey: useProxy ? 'proxy' : validateEnvVar('REACT_APP_FIREBASE_API_KEY', undefined, true),
  authDomain: validateEnvVar('REACT_APP_FIREBASE_AUTH_DOMAIN', undefined, true),
  projectId: validateEnvVar('REACT_APP_FIREBASE_PROJECT_ID', undefined, true),
  storageBucket: validateEnvVar('REACT_APP_FIREBASE_STORAGE_BUCKET', undefined, true),
  messagingSenderId: validateEnvVar('REACT_APP_FIREBASE_MESSAGING_SENDER_ID', undefined, true),
  appId: validateEnvVar('REACT_APP_FIREBASE_APP_ID', undefined, true),
  measurementId: validateEnvVar('REACT_APP_FIREBASE_MEASUREMENT_ID') // 선택적
};

// 에뮬레이터 설정
export const emulatorConfig = {
  useEmulator: process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true',
  auth: 'localhost:9099',
  firestore: 'localhost:8080',
  functions: 'localhost:5001',
  storage: 'localhost:9199'
};

// 환경 설정
export const environment = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTesting: process.env.NODE_ENV === 'test',
  env: process.env.REACT_APP_ENV || process.env.NODE_ENV || 'development'
};

// 보안 설정
export const securityConfig = {
  useProxy,
  proxyUrl,
  // Content Security Policy 설정
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
    connectSrc: [
      "'self'",
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'wss://*.firebaseio.com',
      ...(useProxy && proxyUrl ? [proxyUrl] : [])
    ]
  }
};

// Feature Flags
export const featureFlags = {
  kakaoLogin: process.env.REACT_APP_FEATURE_KAKAO_LOGIN === 'true',
  qrAttendance: process.env.REACT_APP_FEATURE_QR_ATTENDANCE === 'true',
  payrollCalculation: process.env.REACT_APP_FEATURE_PAYROLL_CALCULATION !== 'false', // 기본값 true
  devTools: process.env.REACT_APP_ENABLE_DEV_TOOLS === 'true' && environment.isDevelopment
};

// 모니터링 설정
export const monitoringConfig = {
  sentryDsn: process.env.REACT_APP_SENTRY_DSN,
  gaTrackingId: process.env.REACT_APP_GA_MEASUREMENT_ID,
  logLevel: process.env.REACT_APP_LOG_LEVEL || (environment.isDevelopment ? 'debug' : 'warn')
};

// 설정 검증
export const validateConfig = (): boolean => {
  const requiredVars = [
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_AUTH_DOMAIN'
  ];

  const missingVars = requiredVars.filter(key => !process.env[key]);

  if (missingVars.length > 0) {
    logger.error('필수 환경 변수가 설정되지 않았습니다:', new Error('Missing environment variables'), {
      component: 'firebase.config',
      missingFields: missingVars
    });
    return false;
  }

  if (useProxy && !proxyUrl) {
    logger.error('프록시 사용이 설정되었으나 REACT_APP_FIREBASE_PROXY_URL이 없습니다.', new Error('Missing proxy URL'), {
      component: 'firebase.config'
    });
    return false;
  }

  return true;
};

// 설정 내보내기
export default {
  firebase: firebaseConfig,
  emulator: emulatorConfig,
  environment,
  security: securityConfig,
  features: featureFlags,
  monitoring: monitoringConfig,
  validate: validateConfig
};