// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/utils/supabase.ts, uniqn-mobile/src/errors/errorUtils.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import { ERROR_CODES } from '@/core/errors/AppError';

export const POSTGREST_ERROR_MAP: Record<string, { code: string; category: string }> = {
  // 인증/권한
  '42501': { code: ERROR_CODES.INFRA_PERMISSION_DENIED, category: 'permission' },
  PGRST301: { code: ERROR_CODES.AUTH_SESSION_EXPIRED, category: 'auth' },
  // 데이터 미존재
  PGRST116: { code: ERROR_CODES.INFRA_NOT_FOUND, category: 'infrastructure' },
  // 중복 키 (unique violation)
  '23505': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  // 외래 키 위반
  '23503': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  // NOT NULL 위반
  '23502': { code: ERROR_CODES.VALIDATION_REQUIRED, category: 'validation' },
  // CHECK 위반
  '23514': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  // 잘못된 입력 타입 (예: UUID 형식 아닌 값으로 조회) → 리소스 없음으로 처리
  '22P02': { code: ERROR_CODES.INFRA_NOT_FOUND, category: 'infrastructure' },
  // 함수 미존재
  '42883': { code: ERROR_CODES.UNKNOWN, category: 'unknown' },
  // rate limit (Supabase 자체)
  '54000': { code: ERROR_CODES.INFRA_QUOTA_EXCEEDED, category: 'infrastructure' },
};

export const NETWORK_MESSAGE_PATTERNS = [
  'network',
  'timeout',
  'offline',
  'connection',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
];
