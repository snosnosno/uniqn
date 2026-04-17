# Firebase 레거시 아카이브 (2026-04)

> 2026-04-11 Supabase 이전 완료. 이 디렉터리는 historical reference용.

## 배경

T-HOLDEM 프로젝트는 2026-04-11까지 Firebase(Auth + Firestore + Storage + Cloud Functions)를 사용했으나, Supabase(PostgreSQL + Auth + Realtime + Edge Functions)로 전면 이전 완료했다.

- #36 PR (2026-04-16): Firebase Cloud Functions 완전 제거, Supabase 백엔드 100% 이전
- 본 아카이브: 나머지 레거시 규칙/스펙 파일 정리 (2026-04-17)

## Supabase 대체 매핑

| 레거시 파일 | Supabase 대체 위치 |
|------------|-------------------|
| `firestore.rules` | `uniqn-mobile/supabase/migrations/*_rls_*.sql` (RLS policies) |
| `firestore.indexes.json` | 각 마이그레이션의 `CREATE INDEX` 구문 |
| `storage.rules` | Supabase Dashboard → Storage → Policies |
| `06-firebase.md` (스펙) | `docs/ARCHITECTURE.md` (작성 예정) + CLAUDE.md |
| `firestore-canonical-contract.md` | Supabase `database.types.ts` (자동 생성) |
| `firebase-mcp-stdio-wrapper.js` | `.mcp.json`의 Supabase MCP 서버 |

## Scheduled Functions 대응

Firebase `onSchedule` 함수 8개는 `pg_cron`으로 전환됨. 매핑:

| Firebase 함수 | Supabase 구현 | 참조 |
|--------------|---------------|------|
| cleanupExpiredTokens | cleanup-expired-fcm-tokens (daily 03:03 KST) | `20260417060000_firebase_scheduled_jobs.sql` |
| cleanupRateLimits | cleanup-rate-limits (daily 00:07 KST) | 상동 |
| expireFixedPostings | expire-fixed-postings (hourly) | 상동 |
| expireByLastWorkDate | expire-by-last-work-date (daily 00:17 KST) | 상동 |
| sendReviewReminders | send-review-reminders (daily 10:03 KST) | 상동 |
| scheduledDeletion | Edge Function (Auth Admin API 필요) | Phase 4 |
| cleanupOrphanAccounts | Edge Function (Auth Admin API 필요) | Phase 4 |
| retryFailedCounterOps | 불필요 (Supabase SQL 원자 연산으로 대체) | — |

## 유지되는 Firebase 자산

다음은 **아카이브하지 않고 유지** — EAS 네이티브 빌드 또는 마이그레이션 호환성에 필요:

- `uniqn-mobile/google-services.json` (Android — Expo managed workflow)
- `uniqn-mobile/GoogleService-Info.plist` (iOS)
- `uniqn-mobile/src/services/auth/storageService.ts:164` (firebasestorage.googleapis.com URL 파싱, 마이그레이션 호환성)

## 복구 필요 시

```bash
# 전체 이력 조회
git log --all --follow -- docs/archive/firebase-legacy/2026-04/firestore.rules

# 특정 커밋에서 원 파일 복구
git show <sha>:firestore.rules > firestore.rules
```

## 마지막 Firebase 활성 상태 (참조용)

- Firebase 프로젝트 ID: `tholdem-ebc18`
- 전환 완료일: 2026-04-11
- 최종 정리일: 2026-04-17
