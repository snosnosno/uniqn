// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/utils/supabase.ts
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

export const KNOWN_ACRONYMS: Record<string, string> = {
  Url: 'URL',
  Urls: 'URLs',
};

export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    let camelKey = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
    // Restore known acronyms anywhere in key
    // - End of key: photoUrl → photoURL
    // - Middle of key (followed by uppercase): photoUrlBlurhash → photoURLBlurhash
    for (const [token, replacement] of Object.entries(KNOWN_ACRONYMS)) {
      if (camelKey === token.toLowerCase()) {
        continue;
      }
      if (camelKey.endsWith(token)) {
        camelKey = camelKey.slice(0, -token.length) + replacement;
        break;
      }
      // Middle occurrence: token must be followed by an uppercase letter
      // to avoid false positives like `urlParam` (= would match `url` + `P`).
      const midRegex = new RegExp(`${token}(?=[A-Z])`);
      if (midRegex.test(camelKey)) {
        camelKey = camelKey.replace(midRegex, replacement);
        break;
      }
    }
    result[camelKey] = obj[key];
  }
  return result as T;
}
