/**
 * UNIQN Mobile - 환경변수 검증 모듈
 * Zod를 사용한 타입 안전 환경변수 검증
 */

import { z } from 'zod';

/**
 * 환경변수 스키마 정의
 */
const envSchema = z.object({
  // Supabase 설정
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // 선택적 설정
  EXPO_PUBLIC_RELEASE_CHANNEL: z
    .enum(['development', 'staging', 'production'])
    .optional()
    .default('development'),
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
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL,
  };

  // 스키마 검증
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missingFields = Object.keys(errors);
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  - ${field}: ${messages?.join(', ')}`)
      .join('\n');

    // 개발 환경: 필드명 포함 상세 메시지, 프로덕션: 필드명 제외
    const message = __DEV__
      ? `환경변수 검증 실패 (${missingFields.length}개 누락):\n${errorMessages}\n\n` +
        `EAS Build: eas secret:create로 환경변수를 등록하세요.\n` +
        `로컬 개발: .env.local 파일을 확인하세요. .env.example을 참고하여 필수 환경변수를 설정해주세요.`
      : `환경변수 검증 실패 (${missingFields.length}개 누락). .env 파일을 확인하세요.`;

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
