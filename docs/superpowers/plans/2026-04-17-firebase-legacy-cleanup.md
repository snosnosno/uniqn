# Firebase 레거시 정리 Implementation Plan (PR B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase 레거시 파일(rules/indexes/spec)을 `docs/archive/firebase-legacy/2026-04/`로 이동 + Firebase MCP 제거 + 문서/auto-memory 갱신.

**Architecture:** 파일 이동만, 코드 변경 0건. git mv로 이력 보존. README로 Supabase 대체 매핑 문서화. `.mcp.json` Firebase 섹션 제거.

**Tech Stack:** git, markdown, JSON. Node/TypeScript 변경 없음.

**Spec:** `docs/superpowers/specs/2026-04-17-tech-debt-cleanup-design.md` §PR B

**Branch:** `chore/firebase-legacy-cleanup-2026-04-17`
**Worktree:** `.claude/worktrees/chore-firebase-legacy-cleanup/`

---

## File Structure

### Create
- `docs/archive/firebase-legacy/2026-04/README.md` (~60 lines)

### Move (git mv)
| From | To |
|------|------|
| `firestore.rules` | `docs/archive/firebase-legacy/2026-04/firestore.rules` |
| `firestore.indexes.json` | `docs/archive/firebase-legacy/2026-04/firestore.indexes.json` |
| `storage.rules` | `docs/archive/firebase-legacy/2026-04/storage.rules` |
| `specs/react-native-app/06-firebase.md` | `docs/archive/firebase-legacy/2026-04/06-firebase.md` |
| `docs/firestore-canonical-contract.md` | `docs/archive/firebase-legacy/2026-04/firestore-canonical-contract.md` |
| `scripts/firebase-mcp-stdio-wrapper.js` | `docs/archive/firebase-legacy/2026-04/firebase-mcp-stdio-wrapper.js` |

### Modify
- `.mcp.json` — `firebase` 서버 블록 제거 (라인 36-44 영역)
- `CLAUDE.md` — Firebase 제거 상태 섹션 갱신

### Local Delete (not git-tracked)
- `.firebase/` (디렉터리)
- `firestore-debug.log`

### Auto-memory update
- `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\MEMORY.md` — Firebase 정리 완료 항목 추가

---

## Task 1: Worktree 생성 + archive 디렉터리 준비

**Files:**
- Create: `docs/archive/firebase-legacy/2026-04/` (디렉터리)

- [ ] **Step 1: 메인 세션에서 worktree 생성**

Run (in main session, not worktree):
```
EnterWorktree({ name: "chore-firebase-legacy-cleanup" })
```

이후 모든 step은 이 worktree 내부에서 실행.

- [ ] **Step 2: Archive 디렉터리 생성**

```bash
mkdir -p docs/archive/firebase-legacy/2026-04
```

- [ ] **Step 3: 작업 확인용 snapshot**

```bash
git status
# 출력: working tree clean (worktree 방금 생성)
ls docs/archive/firebase-legacy/2026-04/
# 출력: (빈 디렉터리)
```

---

## Task 2: README.md 작성

**Files:**
- Create: `docs/archive/firebase-legacy/2026-04/README.md`

- [ ] **Step 1: README 작성**

Write `docs/archive/firebase-legacy/2026-04/README.md` with:

```markdown
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

- `uniqn-mobile/google-services.json` (Android)
- `uniqn-mobile/android/app/google-services.json` (Android, 중복)
- `uniqn-mobile/GoogleService-Info.plist` (iOS)
- `uniqn-mobile/src/services/storage/storageService.ts:164,189` (firebasestorage.googleapis.com URL 파싱, 마이그레이션 호환성)

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
```

- [ ] **Step 2: 확인**

```bash
cat docs/archive/firebase-legacy/2026-04/README.md | head -5
# 출력: # Firebase 레거시 아카이브 (2026-04) ...
```

---

## Task 3: 레거시 파일 git mv (6개)

**Files:** 위 File Structure의 "Move" 표 참조

- [ ] **Step 1: firestore.rules 이동**

```bash
git mv firestore.rules docs/archive/firebase-legacy/2026-04/firestore.rules
```

- [ ] **Step 2: firestore.indexes.json 이동**

```bash
git mv firestore.indexes.json docs/archive/firebase-legacy/2026-04/firestore.indexes.json
```

- [ ] **Step 3: storage.rules 이동**

```bash
git mv storage.rules docs/archive/firebase-legacy/2026-04/storage.rules
```

- [ ] **Step 4: 06-firebase.md 이동**

```bash
git mv specs/react-native-app/06-firebase.md docs/archive/firebase-legacy/2026-04/06-firebase.md
```

- [ ] **Step 5: firestore-canonical-contract.md 이동**

```bash
git mv docs/firestore-canonical-contract.md docs/archive/firebase-legacy/2026-04/firestore-canonical-contract.md
```

- [ ] **Step 6: firebase-mcp-stdio-wrapper.js 이동**

```bash
git mv scripts/firebase-mcp-stdio-wrapper.js docs/archive/firebase-legacy/2026-04/firebase-mcp-stdio-wrapper.js
```

- [ ] **Step 7: 이동 결과 확인**

```bash
git status --short
# 출력 예:
#   R  firestore.rules -> docs/archive/firebase-legacy/2026-04/firestore.rules
#   R  firestore.indexes.json -> docs/archive/firebase-legacy/2026-04/firestore.indexes.json
#   ...
```

- [ ] **Step 8: Commit (파일 이동만 분리 커밋)**

```bash
git add docs/archive/firebase-legacy/2026-04/README.md
git commit -m "$(cat <<'EOF'
chore(firebase): 레거시 Firebase 규칙/스펙 아카이브 이동

2026-04-11 Supabase 이전 완료 후 남은 레거시 파일을 보존하며 이동.
- firestore.rules, firestore.indexes.json, storage.rules
- specs/react-native-app/06-firebase.md
- docs/firestore-canonical-contract.md
- scripts/firebase-mcp-stdio-wrapper.js

README에 Supabase 대체 매핑 + 복구 방법 문서화.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `.mcp.json` Firebase 서버 섹션 제거

**Files:**
- Modify: `.mcp.json`

- [ ] **Step 1: 현재 `.mcp.json` 확인**

```bash
cat .mcp.json | grep -A 10 "\"firebase\":"
# 출력: firebase 서버 정의 블록 (라인 36~44)
```

- [ ] **Step 2: firebase 블록 제거**

Edit `.mcp.json`. 다음 블록을 통째로 제거:

```json
    "firebase": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:\\Users\\user\\Desktop\\T-HOLDEM\\scripts\\firebase-mcp-stdio-wrapper.js",
        "--dir",
        "C:\\Users\\user\\Desktop\\T-HOLDEM"
      ],
      "env": {}
    },
```

포함하여 선행 콤마도 정리. 결과:

```json
    "playwright": {
      ...
    },
    "tosspayments-integration-guide": {
      ...
    },
```

- [ ] **Step 3: JSON 문법 검증**

```bash
node -e "JSON.parse(require('fs').readFileSync('.mcp.json', 'utf8')); console.log('valid');"
# 출력: valid
```

- [ ] **Step 4: 참조 grep 검증**

```bash
grep -r "firebase-mcp-stdio-wrapper" --include="*.json" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v "docs/archive"
# 출력: (비어있어야 함)
```

- [ ] **Step 5: Commit**

```bash
git add .mcp.json
git commit -m "$(cat <<'EOF'
chore(mcp): Firebase MCP 서버 제거

Supabase MCP로 완전 대체 완료. firebase-mcp-stdio-wrapper는
docs/archive/firebase-legacy/2026-04/로 archive됨.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: CLAUDE.md 갱신

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 현재 CLAUDE.md 하단 확인**

```bash
tail -5 CLAUDE.md
# 출력: *2026-04-13 업데이트 — Expo 55/RN 0.83.4 업그레이드, Supabase 이전 완료, Black & Gold 완료*
```

- [ ] **Step 2: 날짜 스탬프 업데이트 + Firebase 상태 추가**

Edit `CLAUDE.md` 마지막 줄을:

```markdown
*2026-04-17 업데이트 — Firebase 레거시 규칙/스펙 archive 완료 (docs/archive/firebase-legacy/2026-04/), Firebase MCP 제거. 유지: google-services/GoogleService-Info (EAS 네이티브 빌드용), storageService firebasestorage URL 파싱 (마이그레이션 호환성)*

*2026-04-13 업데이트 — Expo 55/RN 0.83.4 업그레이드, Supabase 이전 완료, Black & Gold 완료*
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): Firebase 레거시 정리 완료 상태 반영

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Auto-memory 갱신

**Files:**
- Modify: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\MEMORY.md`
- Create: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\project_firebase_legacy_cleanup.md`

이 파일들은 git 외부(사용자 글로벌 메모리). worktree 안에서도 접근 가능.

- [ ] **Step 1: 새 memory 파일 작성**

Write `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\project_firebase_legacy_cleanup.md`:

```markdown
---
name: Firebase 레거시 정리 완료 (2026-04-17)
description: Firebase 레거시 규칙/스펙 파일을 docs/archive/firebase-legacy/2026-04/로 이동하고 Firebase MCP를 제거한 작업 기록
type: project
---

# Firebase 레거시 정리 (PR B)

**완료일**: 2026-04-17
**관련 PR**: (merge 후 sha 기록)

## 수행 내역

- `firestore.rules`, `firestore.indexes.json`, `storage.rules` → `docs/archive/firebase-legacy/2026-04/`
- `specs/react-native-app/06-firebase.md`, `docs/firestore-canonical-contract.md` → archive
- `scripts/firebase-mcp-stdio-wrapper.js` → archive, `.mcp.json`에서 firebase 서버 블록 제거
- `docs/archive/firebase-legacy/2026-04/README.md` 신규: Supabase 대체 매핑 + 복구 방법

**Why:** Supabase 이전 완료(#36, 2026-04-16) 후 남은 레거시 파일 정리. 제거 대신 archive 선택 — 감사/마이그레이션 검증 시 참조.

**How to apply:**
- Firebase/Firestore 관련 질문: 최신 구현은 Supabase. 레거시 규칙 비교가 필요하면 `docs/archive/firebase-legacy/2026-04/` 참조
- `google-services.json`/`GoogleService-Info.plist`는 **유지** (EAS 네이티브 빌드 필요)
- `storageService.ts:164,189`의 firebasestorage URL 파싱은 **유지** (마이그레이션 호환성)
- Firebase MCP는 더 이상 `.mcp.json`에 없음 → Supabase MCP(`mcp__supabase__*`) 사용
```

- [ ] **Step 2: MEMORY.md 인덱스에 추가**

Edit `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\MEMORY.md`, "Supabase 이전" 섹션 아래에 추가:

```markdown
- [Firebase 레거시 정리 (2026-04-17)](project_firebase_legacy_cleanup.md) — 레거시 파일 archive + MCP 제거
```

- [ ] **Step 3: (이 step은 커밋 없음 — memory는 git 외부)**

메모리 파일은 worktree/repo와 무관. 다음 task로 진행.

---

## Task 7: 로컬 cleanup (git 무관)

**Files:**
- Delete: `.firebase/` (디렉터리)
- Delete: `firestore-debug.log`

- [ ] **Step 1: .firebase/ 디렉터리 삭제**

```bash
rm -rf .firebase
ls .firebase 2>&1
# 출력: ls: cannot access '.firebase': No such file or directory
```

- [ ] **Step 2: firestore-debug.log 삭제**

```bash
rm -f firestore-debug.log
ls firestore-debug.log 2>&1
# 출력: ls: cannot access 'firestore-debug.log': No such file or directory
```

- [ ] **Step 3: git status 확인 (untracked이므로 영향 없어야 함)**

```bash
git status --short
# 출력: (비어있거나, 다음 task의 변경만 표시)
```

---

## Task 8: 최종 검증

**No Files Modified**

- [ ] **Step 1: 참조 grep 검증 (archive 경로 제외)**

```bash
grep -rn "firestore\.rules\|storage\.rules" \
  --exclude-dir=docs/archive \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.json" --include="*.md" \
  . 2>/dev/null
# 출력: (비어있어야 함 — archive README 내부만 매칭되면 OK, 그건 예외)
```

- [ ] **Step 2: firebase-mcp-stdio-wrapper 참조 grep**

```bash
grep -rn "firebase-mcp-stdio-wrapper" \
  --exclude-dir=docs/archive --exclude-dir=node_modules --exclude-dir=.git \
  . 2>/dev/null
# 출력: (비어있어야 함)
```

- [ ] **Step 3: uniqn-mobile quality gate**

```bash
cd uniqn-mobile && npm run quality
# 출력: type-check, lint, format:check 모두 통과
```

- [ ] **Step 4: 앱 smoke test (선택, 시간 있으면)**

```bash
cd uniqn-mobile && timeout 30 npm start 2>&1 | head -20
# 출력: Metro bundler 시작, "Waiting on exp://..." 로그 확인 후 중단
```

- [ ] **Step 5: 최종 git log 확인**

```bash
git log --oneline master..HEAD
# 출력 예:
#   <sha>  docs(claude): Firebase 레거시 정리 완료 상태 반영
#   <sha>  chore(mcp): Firebase MCP 서버 제거
#   <sha>  chore(firebase): 레거시 Firebase 규칙/스펙 아카이브 이동
```

---

## Task 9: Push + PR 생성

**No Files Modified**

- [ ] **Step 1: 브랜치 push**

```bash
git push -u origin chore/firebase-legacy-cleanup-2026-04-17
```

- [ ] **Step 2: PR 생성 (gh)**

```bash
gh pr create --title "chore(firebase): 레거시 규칙/스펙 아카이브 + Firebase MCP 제거" --body "$(cat <<'EOF'
## Summary
- Firebase 레거시 파일 6건을 `docs/archive/firebase-legacy/2026-04/`로 archive (git mv, 이력 보존)
- `.mcp.json`에서 Firebase MCP 서버 블록 제거 (Supabase MCP로 완전 대체)
- README에 Supabase 대체 매핑 + 복구 방법 문서화
- CLAUDE.md + auto-memory 상태 갱신

## 유지되는 Firebase 자산 (archive 안함)
- `google-services.json` × 2, `GoogleService-Info.plist` — EAS 네이티브 빌드 필요
- `storageService.ts` firebasestorage URL 파싱 — 마이그레이션 호환성

## Test plan
- [x] `grep -rn "firestore.rules\|storage.rules"` → archive 외 참조 0건
- [x] `grep -rn "firebase-mcp-stdio-wrapper"` → 참조 0건
- [x] `.mcp.json` JSON 문법 유효
- [x] `npm run quality` 통과
- [ ] Reviewer: `docs/archive/firebase-legacy/2026-04/README.md` Supabase 매핑 정확성 확인
- [ ] Reviewer: Firebase MCP 없어도 개발 워크플로우 영향 없는지 확인

## Spec
`docs/superpowers/specs/2026-04-17-tech-debt-cleanup-design.md` §PR B

## Rollback
1. `docs/archive/firebase-legacy/2026-04/`의 파일을 `git mv` 역방향
2. `.mcp.json`에 firebase 서버 블록 복원

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: PR URL 확인**

```bash
gh pr view --web
# 브라우저에서 PR 페이지 열림. URL을 사용자에게 보고.
```

- [ ] **Step 4: 메인 세션으로 복귀**

메인 세션으로 worktree 정리 준비. (이 step은 서브에이전트가 아닌 메인 세션에서 실행):

```
ExitWorktree({ action: "keep" })
# 사용자가 merge 후 별도 단계에서 "remove"로 정리
```

---

## 완료 기준

- [ ] `git ls-files` 에 `firestore.rules`, `firestore.indexes.json`, `storage.rules` 미존재 (archive 경로만 존재)
- [ ] `.mcp.json`에서 firebase 서버 블록 제거됨
- [ ] CLAUDE.md 2026-04-17 상태 반영됨
- [ ] auto-memory에 `project_firebase_legacy_cleanup.md` 추가됨
- [ ] 참조 grep 0건 (archive 제외)
- [ ] `npm run quality` 통과
- [ ] PR 생성됨 (사용자 merge 대기)
