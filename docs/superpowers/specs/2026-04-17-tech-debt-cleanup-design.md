# 기술부채 정리: 게시판 버그 + Json Zod + Firebase 레거시

- **작성일**: 2026-04-17
- **대상 범위**: 2 PR (병렬 worktree)
- **예상 작업 기간**: 1~1.5일
- **작성자**: Claude (brainstorming 세션)

---

## 배경

2026-04-11 Supabase 이전 완료, #36 PR(2026-04-16)로 Firebase Cloud Functions 완전 제거. 이후 종합 감사에서 확인된 기술부채 중 **실제 사용자 영향이 있거나 위생적으로 정리가 필요한 항목**만 선별.

### 재평가로 제외한 항목

| 항목 | 제외 사유 |
|------|----------|
| Repository SELECT * 제거 (15개) | RLS + TypeScript `Row` 타입이 1·2차 방어선 제공. 성능 이슈 실증 없음. ROI 낮음 → 필요 시점에 점진 전환 |
| `NotificationRepository.subscribeToUnreadCounter` polling 전환 | 실측 성능 문제 없음. 이론적 이슈 |

### 포함된 항목

- **PR A**: 게시판 대타 구인 버그 4건 + Json Zod 검증 2곳
- **PR B**: Firebase 레거시 파일 archive + MCP 제거

---

## 목표

1. **사용자 영향 제거**: 대타 구인 실패 시 사용자 미노출 문제 해소
2. **의도 문서화**: 아카이브 분기 로직의 모호성 제거 (주석 + 테스트)
3. **타입 안전성**: JSONB 파싱 오류로 인한 런타임 버그 차단
4. **리포지터리 위생**: 레거시 Firebase 파일 정리, 참조 가능한 archive로 보존

## 비목표 (이 범위 아님)

- SELECT * 제거
- Realtime polling 전환
- 기타 Repository 리팩토링
- google-services.json / GoogleService-Info.plist 제거 (EAS 빌드에 필요, 유지)
- storageService.ts firebasestorage URL 파싱 (마이그레이션 호환성, 유지)

---

## PR A: 게시판 버그 4건 + Json Zod 검증

### 1. 아카이브 분기 문서화

**위치**: `uniqn-mobile/src/services/jobs/applicationService.ts:284-299`

**결정**: 현 동작(승인/거절 모두 아카이브) 유지. 의도를 JSDoc + 인라인 주석 + 테스트로 lock-in.

**변경**:
- (a) `reviewCancellationRequest` 함수 JSDoc 확장 — 왜 양쪽 모두 아카이브하는지 설명
- (b) 인라인 주석 업그레이드:
  ```
  // 아카이브 조건: 승인/거절 공통 — 취소 요청 라이프사이클 종료 시 대타글도 종료
  //   · 거절 → 원 지원자 계속 참석 → 대타 불필요
  //   · 승인 → 슬롯 재오픈, 정식 지원 루트 전환 → 대타 임무 완료
  //   · 변경 시 applicationService.substitute.test.ts 의 양방향 테스트 확인
  ```
- (c) Regression lock-in 테스트 추가 (기존 동작 고정; 전통적 RED→GREEN 아님 — 현 구현이 이미 양쪽 아카이브하므로 테스트는 처음부터 PASS):
  - `archives substitute post when cancellation approved`
  - `archives substitute post when cancellation rejected`
  - 누군가 "거절 시만 아카이브"로 축소 시 이 테스트가 실패하여 의도 변경을 명시적으로 강제

### 2. createSubstitutePost 실패 시 사용자 알림

**위치**: `uniqn-mobile/src/services/jobs/applicationService.ts:211-229`

**제약**: Service → UI store 직접 호출 금지 (`CLAUDE.md` 아키텍처 규칙).

**패턴**: Result 객체 반환 → Hook에서 toast 표시

**Service 시그니처 변경**:
```ts
type CancellationResult = {
  substitutePost: 'created' | 'skipped' | 'failed';
};

export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string,
  applicantContext?: ApplicantContext
): Promise<CancellationResult>
```

**내부 처리**:
```ts
let substitutePost: CancellationResult['substitutePost'] = 'skipped';
if (validationResult.data.wantsSubstitutePost && applicantContext) {
  try {
    await createSubstitutePost({ ... });
    substitutePost = 'created';
  } catch (substituteError) {
    logger.warn(...);
    substitutePost = 'failed';
  }
}
return { substitutePost };
```

**Hook/UI 변경**:
- `requestCancellation`을 호출하는 모든 위치에서 result 확인 → `'failed'`면 `useToastStore.warning('대타 구인 글 생성에 실패했습니다. 게시판에서 수동으로 작성해 주세요.')`

**영향 파일 (조사 필요 — 계획 단계에서 확정)**:
- `src/services/jobs/applicationService.ts` (변경)
- 호출처: `src/components/schedule/CancelRequestModal.tsx` 또는 유사 파일
- `src/services/__tests__/applicationService.substitute.test.ts` (확장)

### 3. linkedJobPostingId 런타임 검증 강화

**위치**: `uniqn-mobile/src/services/boardService.ts:1729` (createSubstitutePost)

**결정**: 타입 자체를 non-optional로 바꾸면 다른 board type 영향 → 런타임 validation 추가 (최소 침습).

**변경**:
```ts
export async function createSubstitutePost(input: CreateSubstitutePostInput): Promise<string> {
  await requireMatchingCurrentUser(input.authorId);

  // 대타 글은 원 공고 연결이 필수 (아카이브/필터링에 사용)
  if (!input.jobSummary?.jobPostingId) {
    throw toValidationError('jobSummary.jobPostingId은 대타 구인 글 작성 시 필수입니다.');
  }
  // ... 기존 로직
}
```

**JSDoc 추가**: `BoardJobSummary.jobPostingId` 필드에 "대타 작성 시 필수" 명시.

### 4. archiveSubstitutePostByLinkedPosting 단위 테스트

**위치**: `uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts` 확장

**추가 케이스** (6):
1. active 대타글 1건 존재 → `setPostStatus('archived')` 1회 호출
2. active 대타글 N건 존재 → `setPostStatus('archived')` N회 호출
3. active 대타글 없음 → 호출 0회, 예외 없음
4. 다른 `authorId` 대타글 → 필터링되어 호출 안됨 (권한 격리)
5. `boardTypes: ['substitute']` 필터 적용 검증 (notice/free 글 건드리지 않음)
6. Repository 예외 발생 → `logger.warn` 호출, throw 안됨 (non-blocking 계약)

### 5. Json Zod 검증 (2개 필드)

**대상 1: `board_posts.metadata`**
- **위치**: `uniqn-mobile/src/repositories/supabase/BoardRepository*.ts` (매핑 함수)
- **영향**: 대타글 `jobSummary` 저장처. 파싱 실패 시 UI 대타 정보 미표시
- **스키마**: `uniqn-mobile/src/schemas/boardMetadata.schema.ts` (신규)
  ```ts
  export const BoardPostMetadataSchema = z.object({
    jobSummary: BoardJobSummarySchema.optional(),
    applicationId: z.string().optional(),
  }).passthrough();
  ```
- **적용**: `safeParse` → 실패 시 `logger.error` + 빈 객체 fallback

**대상 2: `applications.cancellation_request`**
- **위치**: `uniqn-mobile/src/repositories/supabase/ApplicationRepository*.ts`
- **영향**: 과거 `cancellationRequest timestamp 스키마 순서` 버그 이력(`6e24a4868`)
- **스키마**: 구현 단계에서 `src/schemas/` 하위에 기존 `cancellationRequestSchema` 존재 여부 확인 → 있으면 재사용, 없으면 `src/schemas/cancellationRequest.schema.ts` 신규 작성
- **적용**: 위와 동일 패턴

**미포함 JSONB 필드** (후속 PR 대상):
- `announcements.images`, `announcements.target_audience`
- `applications.assignments`, `confirmation_history`, `original_application`, `pre_question_answers`
- `app_config.value`

---

## PR B: Firebase 레거시 정리

### 1. 파일 archive

**이동 대상 (`git mv`)**:

| 원 위치 | 목적지 |
|--------|--------|
| `firestore.rules` (137KB) | `docs/archive/firebase-legacy/2026-04/firestore.rules` |
| `firestore.indexes.json` (30KB) | `docs/archive/firebase-legacy/2026-04/firestore.indexes.json` |
| `storage.rules` (6.4KB) | `docs/archive/firebase-legacy/2026-04/storage.rules` |
| `specs/react-native-app/06-firebase.md` | `docs/archive/firebase-legacy/2026-04/06-firebase.md` |
| `docs/firestore-canonical-contract.md` | `docs/archive/firebase-legacy/2026-04/firestore-canonical-contract.md` |

### 2. 새 README 작성

**경로**: `docs/archive/firebase-legacy/2026-04/README.md`

**내용 요지**:
- Firebase → Supabase 이전 완료 일자(2026-04-11)
- 각 파일의 Supabase 대체 위치 매핑표
- `git log --all -- <path>` 로 전체 이력 조회 가능 안내
- 제거 대신 archive 선택 이유 (감사/규제 대응, Supabase 마이그레이션 검증 필요 시 참조)

### 3. Firebase MCP 제거

**기본값(이 spec)**: **제거**. Supabase MCP가 이미 있고, Firebase는 readonly 이력 조회도 불필요.

**변경 파일**:
- `scripts/firebase-mcp-stdio-wrapper.js` → `docs/archive/firebase-legacy/2026-04/` 로 archive (삭제 아님)
- `.mcp.json:36-44` → `firebase` 서버 블록 제거

**사용자 확정 필요**: 이 spec 리뷰 시 최종 결정.

### 4. 로컬 정리 (git 무관)

- `.firebase/` 디렉터리 삭제 (CLI 캐시, 재생성 가능)
- `firestore-debug.log` 삭제 (로컬 로그)
- `tholdem-ebc18-firebase-adminsdk-*.json`: **로컬 유지** (gitignored 확인됨, 과거 커밋 이력 없음). Firebase Console에서 필요 시 revoke는 사용자 판단.

### 5. 문서 갱신

- `CLAUDE.md`: "Firebase 제거 완료 + Supabase 100% 이전" 섹션 날짜 업데이트 또는 추가
- `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\MEMORY.md`: Firebase 정리 완료 기록 추가 (auto-memory)

### 6. 검증

- `grep -r "firestore\.rules\|storage\.rules" --exclude-dir=docs/archive --exclude-dir=node_modules` → 참조 0건
- `grep -r "firebase-mcp-stdio-wrapper" --exclude-dir=docs/archive --exclude-dir=node_modules` → 참조 0건
- `npm run quality` 통과
- 앱 smoke test: `npm start` → 홈 화면 로드 성공

---

## 병렬 실행 계획

### worktree 생성

```
.claude/worktrees/
  fix-board-bugs-json-zod/        # PR A (브랜치: fix/board-bugs-json-zod-2026-04-17)
  chore-firebase-legacy-cleanup/  # PR B (브랜치: chore/firebase-legacy-cleanup-2026-04-17)
```

### Agent Dispatch

**메인 세션 역할**:
- worktree 2개 동시 생성
- 서브에이전트 2명 동시 dispatch (superpowers:dispatching-parallel-agents)
- 보고 수령 → git diff 검증 → /review 스킬 (선택)
- 커밋 + push + `gh pr create`
- worktree cleanup

**Agent A (PR A) 책임**:
- TDD 규율 준수 (RED → GREEN → IMPROVE)
- 6 버그의 구체 수정
- `npm run quality` 통과
- 로컬 커밋까지

**Agent B (PR B) 책임**:
- `git mv` 5건
- README.md 작성
- `.mcp.json` 수정 (Firebase 섹션 제거, 사용자 최종 승인 반영)
- CLAUDE.md 갱신
- 참조 grep 검증
- 로컬 커밋까지

### 커밋 메시지 (CLAUDE.md 컨벤션)

- PR A: `fix(board): 대타 구인 버그 4건 + Json Zod 검증 추가`
- PR B: `chore(firebase): 레거시 규칙/스펙 아카이브 + Firebase MCP 제거`

### PR 생성/머지

- push 후 `gh pr create`로 PR 생성 (제목/본문/체크리스트 포함)
- **머지는 사용자가 직접** CI green 확인 후 수행

### 롤백

- PR A: `git revert <sha>` (repository/service 레이어, 단독 revert 안전)
- PR B: `docs/archive/firebase-legacy/2026-04/` → 원 위치 `git mv` 역방향 + `.mcp.json` 복원

---

## 테스트 전략

### PR A

| 대상 | 파일 | 추가 케이스 수 |
|------|------|---------------|
| Bug #1 아카이브 분기 | `applicationService.substitute.test.ts` | +2 |
| Bug #2 result 객체 계약 | 위 파일 | +3 |
| Bug #3 jobPostingId 검증 | `boardService.substitute.test.ts` | +1 |
| Bug #4 archive 함수 | 위 파일 | +6 |
| Json Zod (board metadata) | `BoardRepository.test.ts` (신규 or 확장) | +3 |
| Json Zod (cancellation_request) | `ApplicationRepository.test.ts` (확장) | +2 |

**합계**: +17 테스트. 영향 파일 로컬 커버리지 85%+ 목표.

### PR B

- 코드 변경 0건 → 새 테스트 불필요
- 검증: `npm run quality`, 참조 grep 0건, 앱 smoke test

---

## 리스크 & 완화

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| PR A result 시그니처 변경이 예상 외 호출처 다수 영향 | 중 | 중 | 컴파일러가 모두 잡아줌 (타입 변경이므로). Agent가 호출처 grep으로 확인 |
| `.mcp.json` Firebase 섹션 제거 후 누군가 실수로 MCP 호출 | 저 | 저 | archive 경로에 wrapper 보존, revert 쉬움 |
| worktree 두 개 동시 생성 시 husky/pre-commit 간섭 | 저 | 중 | `5ffeca172` 에서 worktree 대응 버그 수정됨. 추가 모니터링 |
| PR B 머지 시 CI가 archive 경로의 `.md` 파일을 lint 대상으로 인식 | 저 | 저 | 현 markdown lint 규칙 `docs/**` 포함 여부 확인. 필요 시 `.eslintignore` 또는 markdown lint 설정 조정 |
| Json Zod `safeParse` 실패 시 fallback 처리 누락 → 런타임 에러 | 저 | 고 | 테스트에서 invalid JSON 케이스 명시적 검증 |

---

## 성공 기준

### PR A
- [ ] +17 테스트 추가, 모두 GREEN
- [ ] `npm run quality` 통과
- [ ] `requestCancellation` 호출처 전부 result 확인 + toast 연결
- [ ] `archiveSubstitutePostByLinkedPosting` 커버리지 90%+
- [ ] CI E2E green (기존 테스트 영향 없음)

### PR B
- [ ] `git ls-files` 에 firestore/storage.rules 미존재 (archive 경로만 존재)
- [ ] `.mcp.json` Firebase 섹션 제거 (사용자 확정 시)
- [ ] 참조 grep 0건
- [ ] CLAUDE.md/MEMORY.md 반영
- [ ] 앱 smoke test 통과

### 공통
- [ ] 두 PR 모두 merge 가능 상태 (사용자가 직접 merge)
- [ ] worktree cleanup 완료 (ExitWorktree)

---

## 미확정 항목 (spec 승인 시 확정)

1. **Firebase MCP 제거**: 이 spec 기본값은 "archive로 이동 + `.mcp.json`에서 제거". 사용자가 보존 원하면 변경.
2. **Admin SDK 키 로컬 처리**: 이 spec 기본값은 "로컬 유지(gitignored 확인됨)". Firebase Console revoke는 사용자 판단.
3. **`requestCancellation` 호출처 정확한 목록**: 구현 계획 단계에서 grep으로 확정.
4. **`cancellationRequestSchema` 재사용 가능 여부**: Json Zod Target 2 구현 시 확인.
