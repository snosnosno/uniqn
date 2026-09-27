import { z } from 'zod';

/**
 * 브라우저 런타임 환경변수 검증 — 설계 §8.
 * 어느 DB 를 가리키는지(prod/로컬)는 빌드 가드(`config/envGuard.ts`)가 이미 막았다.
 * 여기서는 값의 존재·형식만 확인한다.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const keys = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`환경변수가 올바르지 않습니다: ${keys}. ops-web/.env.example 을 참고하세요.`);
  }
  return result.data;
}
