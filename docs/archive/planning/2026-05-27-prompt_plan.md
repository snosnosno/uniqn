# 구현 계획: 800줄 초과 파일 구조적 분할

> 상태: 승인됨 (2026-05-26). 베이스 브랜치 `refactor/simplify-hotspots` (인-파일 단순화 4커밋 완료 위).
> 진행 방식: 전체 5파일, 단계적 (Phase 1→5, 각 Phase 끝 `npm run quality` + `npm test` 게이트).

## 전략
기존 파일을 **re-export 진입점**으로 유지하고 책임을 형제 모듈로 추출. 신규 배럴 index 만들지 않음.
public export·시그니처·렌더 불변 → 테스트 4286개(304 suites) 수정 0건 목표. supabase MCP/마이그레이션/DB/의존성 변경 금지.
화면 보조 파일은 Expo Router 라우트 오인 방지 위해 `app/` 밖(`src/features/`)에 배치.

## 범위 조정
- ✅ 분할: boardService / [postId].tsx / JobPostingRepository / useAppInitialize / settlements.tsx
- ⏭️ ApplicationRepository: 스킵 (이미 Helpers/Transactions로 분할됨)
- ❌ BusinessErrors.ts: 제외 (플랫 에러 클래스 나열)

## Phase별 (위험 낮은 순)

### Phase 1 — JobPostingRepository (Low, 신규 2파일)
- `JobPostingRepositoryHelpers.ts`: TABLE, DEFAULT_PAGE_SIZE, TABLE_COLUMNS, ALLOWED_CAMEL_COLUMNS, toJobPosting, rowsToJobPostings, dataToJobPostings, rethrowOrHandle, loadJobPostingForVerify, loadAndVerifyMutateAccess, loadAndVerifyDeleteAccess, assertCanonical, buildSlotRoleKey
- `JobPostingRepositorySettlement.ts`: SettlementRolePayload, settlementRoleKey, mergeSettlementRoles, normalizeRoleKeys, hasRoleCatalogIdentityMutation
- 진입점: 클래스 잔존 + 헬퍼 import + `export { buildSlotRoleKey } from './JobPostingRepositoryHelpers'` (테스트가 경로 직접 import — 필수)

### Phase 2 — useAppInitialize (Med, 신규 3파일 in `hooks/internal/`)
- appInitializeImports.ts (importWithFallback, isDynamicImportUnsupported, describeError)
- appInitializeProfile.ts (loadLatestProfile, initializeUnreadCount, getRoleFromUser, shouldSynchronizeClaims, isFatalAuthError, toStoreProfile 사용부)
- appInitializeSession.ts (bootstrapCore, signOutAndResetSession, resolveSession, runPostLoginTasks, reconcileSessionFromServer 등 + 타입)
- 진입점 re-export: resolveSession, reconcileSessionFromServer, waitForInitialAuthUser(기존), OfflineBootstrapState, default

### Phase 3 — boardService (High, 신규 7파일 in `src/services/board/`)
- boardServiceShared / boardPostService / boardCommentService / boardReactionService / boardReportService / boardScheduleService / boardSubstituteService
- import 단방향 강제: shared ← 나머지, post → schedule만. getBoardPostInternal/OrThrow는 shared에.
- 진입점: `export * from './board/...'` 전부 + boardService 객체 + default. 소비자 services/index.ts·테스트 무손상.

### Phase 4 — [postId].tsx (Med, 신규 6파일 in `src/features/board/postDetail/`)
- Skeleton/CommentSectionHeader/InlineComposerRow/PostHeader 컴포넌트 + boardPostDetailUtils + useBoardPostDetailScreen 훅
- 진입점: default BoardPostDetailScreen만 (훅+JSX 조립), ~250줄

### Phase 5 — settlements.tsx (Med, 신규 3~4파일 in `src/features/employer/settlements/`)
- settlementCalc / useStaffSettlementsHandlers / TabHeader (+ SettlementModals 선택)
- 진입점: default StaffSettlementsScreen만, ~280줄

## 호환 체크리스트 (누락 시 즉시 테스트 실패로 검출)
- buildSlotRoleKey re-export (Phase 1)
- resolveSession / waitForInitialAuthUser / reconcileSessionFromServer / OfflineBootstrapState re-export (Phase 2)
- boardService named/type export 전부 re-export (Phase 3)

## 게이트 (각 Phase 끝)
`cd uniqn-mobile && npm run quality && npm test` → tsc 0, lint 0 err, format OK, test 4286/304 pass.

## 병렬화 (참고, 이번엔 미사용)
파일 소유권 완전 비중첩. 원하면 Agent Teams 3트랙(Repository/Service+Hook/Screens) 가능.
