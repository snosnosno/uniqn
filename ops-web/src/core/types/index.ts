// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/types/user.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/** UserProfile 발췌 — 진입 판정(authRedirect)이 읽는 필드만. */
export interface UserProfile {
  socialProvider?: 'apple' | 'google' | 'kakao' | 'naver';
}
