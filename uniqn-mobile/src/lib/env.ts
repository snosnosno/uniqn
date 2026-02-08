/**
 * UNIQN Mobile - 환경변수 검증 모듈
 * Zod를 사용한 타입 안전 환경변수 검증
 */

import { z } from 'zod';

/**
 * 환경변수 스키마 정의
 */
const envSchema = z.object({
  // Firebase 필수 설정
  EXPO_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API Key가 필요합니다'),
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase Auth Domain이 필요합니다'),
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID가 필요합니다'),
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase Storage Bucket이 필요합니다'),
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z
    .string()
    .min(1, 'Firebase Messaging Sender ID가 필요합니다'),
  EXPO_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase App ID가 필요합니다'),

  // 플랫폼별 Firebase App ID (설정 시 EXPO_PUBLIC_FIREBASE_APP_ID 대신 사용)
  EXPO_PUBLIC_FIREBASE_APP_ID_WEB: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_APP_ID_IOS: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID: z.string().optional(),

  // Firebase Analytics (웹 전용, 선택적)
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),

  // 선택적 설정
  EXPO_PUBLIC_RELEASE_CHANNEL: z
    .enum(['development', 'staging', 'production'])
    .optional()
    .default('development'),

  // Firebase Functions 리전 (선택적, 기본값: asia-northeast3)
  EXPO_PUBLIC_FIREBASE_REGION: z.string().optional().default('asia-northeast3'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 환경변수 검증 결과 캐시
 */
let cachedEnv: Env | null = null;
let validationError: Error | null = null;

/**
 * 환경변수 검증 및 반환
 * 최초 호출 시 검증 수행, 이후 캐시된 결과 반환
 */
export function getEnv(): Env {
  // 이미 검증 실패한 경우 동일 에러 재발생
  if (validationError) {
    throw validationError;
  }

  // 캐시된 환경변수 반환
  if (cachedEnv) {
    return cachedEnv;
  }

  // 환경변수 수집
  const rawEnv = {
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID_WEB: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_WEB,
    EXPO_PUBLIC_FIREBASE_APP_ID_IOS: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_IOS,
    EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID,
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL,
    EXPO_PUBLIC_FIREBASE_REGION: process.env.EXPO_PUBLIC_FIREBASE_REGION,
  };

  // 스키마 검증
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missingFields = Object.keys(errors);
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  - ${field}: ${messages?.join(', ')}`)
      .join('\n');

    const message =
      `환경변수 검증 실패 (${missingFields.length}개 누락):\n${errorMessages}\n\n` +
      `EAS Build: eas secret:create로 환경변수를 등록하세요.\n` +
      `로컬 개발: .env.local 파일을 확인하세요. .env.example을 참고하여 필수 환경변수를 설정해주세요.`;

    // 프로덕션 빌드에서 환경변수 누락 시 콘솔에 명확한 에러 출력
    if (!__DEV__) {
      console.error('[UNIQN] ' + message);
    }

    validationError = new Error(message);

    throw validationError;
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * 환경변수 검증 상태 확인 (에러 발생 없이)
 */
export function validateEnv(): { success: boolean; error?: string } {
  try {
    getEnv();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 에러',
    };
  }
}

/**
 * 개발 환경 여부 확인
 */
export function isDevelopment(): boolean {
  try {
    return getEnv().EXPO_PUBLIC_RELEASE_CHANNEL === 'development';
  } catch {
    return true; // 검증 실패 시 개발 환경으로 간주
  }
}

/**
 * 프로덕션 환경 여부 확인
 */
export function isProduction(): boolean {
  try {
    return getEnv().EXPO_PUBLIC_RELEASE_CHANNEL === 'production';
  } catch {
    return false;
  }
}
