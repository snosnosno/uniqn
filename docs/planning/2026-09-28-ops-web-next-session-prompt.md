# ops-web 다음 세션 인계 프롬프트 (W1 → W8 완주)

> 아래 `---` 사이를 새 세션 첫 메시지로 그대로 붙여 넣는다.

---

ops.uniqn.app(ops-web) 을 **W1 부터 W8 까지 끝까지** 진행해줘. 사람 게이트에서만 멈추고, 나머지는 슬라이스마다 구현 → 검증 → 코드 리뷰 → 커밋을 반복해.

## 0. 먼저 읽을 것 (이 순서, 추측 금지)

1. 메모리 `project_ops_web_split.md` — 확정 결정·진행 상태·사람 게이트
2. `docs/planning/2026-09-27-ops-web-design.md` — 설계 정본. **§9 슬라이스 표의 완료 기준이 곧 종료 조건**
3. `ops-web/DESIGN.md` — 피트월 디자인 정본(UI 작업 전 필독)
4. `ops-web/README.md`, `docs/planning/2026-09-28-ops-web-design-research.md`

## 1. 작업 위치

- 워크트리 `C:\Users\user\Desktop\T-HOLDEM-ops-web`, 브랜치 `feat/ops-web-w0`(설계 → W0 `fc636d558` → D1 `cae36cccd`, **미푸시**).
- 착수 직전 `git worktree list`·`git status` 재실측(병렬 세션 상시 활성). 메인 체크아웃 `T-HOLDEM` 은 읽기 전용.
- 슬라이스마다 새 브랜치를 이어서 딴다(`feat/ops-web-w1` ← 직전 슬라이스). 커밋은 사전 승인, **push·PR 은 내가 요청할 때만**.

## 2. 확정 결정 (재논의 금지)

Vite + React Router SPA · Cloudflare Workers 정적 자산 무료 · 같은 Supabase(DB·RPC·계정) · 새 RPC 0 목표 ·
개발 DB = 로컬 Supabase(`uniqn-mobile` 에서 `npx supabase start`), 원격 프리뷰 없음 · 가입은 UNIQN 웹 링크(외부 redirect 없음) ·
공유는 **동기화 사본 + CI 파리티**(packages 공유 기각) · 확인창 유지(Enter/Esc, 반드시 `ConfirmDialog`) · 단축키는 `useHotkey` ·
다크 기본 · 골드는 상금에만 · magic-mcp 미사용.

## 3. 슬라이스 순서와 핵심 (상세·완료 기준은 설계 §9)

| 슬라이스 | 핵심 | 주의 |
|---|---|---|
| **W1 동기화** | `scripts/sync-ops-core.mjs`(정본 `uniqn-mobile/src` → `ops-web/src/core`, `@/`→`@/core/` 치환, 해시 매니페스트) + `--check` CI | 대상·의존은 설계 §3.2(xssValidation·VALID_STAFF_ROLES·uuidLikeSchema·publicPollingPolicy·getAuthenticatedEntryRoute, `Constants` 는 ops enum 만 발췌). **레드-그린**: 정본 1줄 바꾸면 `--check` 실패 |
| **W2 인증** | 로그인·로그아웃·비번 찾기/재설정, 클라 라우트 가드, 진입 판정(4컬럼) + 미완성 안내 | redirect 는 내부 경로만(`//evil`·`\` 거부 테스트). 로컬 Supabase 테스트 계정으로 Playwright |
| **W3 목록·생성** | 대회 목록(보관)·생성·복제·공고 연결 + **로컬 ops 시드** + `docs/qa/ops-web-parity.md` 동등성 체크리스트 | ⚠️ **W3 화면 올리기 전 Cloudflare Access 게이트(사람)** |
| **W4 콘솔 1** | 콘솔 셸(DESIGN.md 레이아웃)·상태·클럭 스트립(서버시각 offset)·참가자(등록·리바이·애드온·탈락·재입장·칩) | realtime 재접속·탭 복귀 무효화, 1시간 방치 검증. 탈락 = `ops_bust_participant` + `ops_undo_bust` 되돌리기 토스트 |
| **W5 콘솔 2** | 테이블/좌석(좌석표·이동·재배치·웨이팅)·블라인드/프리셋 | 좌석표 시안은 착수 시 `/design-shotgun` 으로 먼저 승인 |
| **W6 콘솔 3** | 상금 구조·지급 장부·보정, 스태프(공고 가져오기·출퇴근), 이력 | 동등성 체크리스트 100% |
| **W7 공개뷰** | 전광판(프리셋 3종)·플레이어뷰(claim → ops 로그인 → 복귀) | 시안 먼저 승인. **SUIT 서브셋(624KB) 여기서 처리**(fonttools 도입 전 `/oss-vet`). anon RPC 는 기존 2개만 |
| **W8 개통** | noindex 해제, `uniqn-mobile/public/_redirects` 302(**SPA 규칙보다 위**), `EXPO_PUBLIC_OPS_URL` + 웹 origin 분기, Supabase Redirect URL | 모바일 변경은 `npm run quality` + 영향권 jest **디렉터리 단위**. OTA·웹 배포는 `/deploy` 스킬로, 내 확인 후 |

## 4. 슬라이스마다 지키는 루프

1. fablize 스토리 원장: 레포 루트에서 `python3 ~/.claude/fablize/scripts/goals.py create ...` → `next` → `checkpoint` (마지막 스토리는 `--verify-cmd`).
2. **테스트 먼저**(순수 로직은 vitest). 화면 로직은 순수 함수로 빼서 테스트.
3. 라이브러리 API 는 **context7 로 확인** 후 사용(Vite·React Router·supabase-js·TanStack Query).
4. 검증: `cd ops-web && npm run quality && npm run build` + **실제 브라우저 관찰**(Playwright = `uniqn-mobile/node_modules/playwright` 를 require, 375/768/1280 · 라이트/다크 스크린샷 직접 확인). 정적 확인만으로 완료 주장 금지.
5. 버그 수정은 **레드-그린**(가드 빼면 실패 → 복원하면 통과)을 실제로 돌린다.
6. 코드 리뷰: `code-reviewer` 에이전트 `model: "opus"` → CRITICAL/HIGH 전부, MEDIUM 가능한 만큼 반영 → 재검증.
7. 커밋(한글 conventional, `feat(ops-web): W? — ...`) → 설계 §9 표에 ✅ → 메모리 `project_ops_web_split.md` 진행 줄 갱신.
8. 띄운 로컬 서버(4173·6006·6007·8788)는 끝나면 반드시 종료 확인(`netstat` LISTENING 0).

## 5. 사람 게이트 — 여기서만 멈추고 체크리스트로 요청

- [ ] **push·PR**(각 슬라이스 끝에 올릴지 물어볼 것)
- [ ] **W3 전**: Cloudflare Access(무료)로 `ops.uniqn.app` 운영자 이메일만 허용
- [ ] **첫 배포 전**: GitHub Environment `ops-web-production` 시크릿 4종(`VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`·`CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`) + 저장소 변수 `OPS_WEB_DEPLOY_ENABLED=true`
- [ ] **W8**: Supabase Auth Redirect URLs 에 `https://ops.uniqn.app/**`, 모바일 OTA·웹 배포 승인
- [ ] 새 RPC·마이그레이션이 **불가피**해지면 설계 결정 재요청(마이그 규칙: prod 재적용 금지 목록·`prod-migrate` 사용법은 메모리 참조)
- [ ] 화면 시안 승인(W5 좌석표, W7 전광판·플레이어뷰)

## 6. 금지

- 가드 우회 경로 추가(`VITEST` 오용 등) · 운영 빌드에 prod 아닌 URL · 원격 프리뷰에 prod 키
- `git reset --hard`·`worktree remove --force`·`rm -rf`(권한 설정이 막음 — 필요하면 나에게 요청)
- `console.log`, 하드코딩 색(`gray-*` 등 — 토큰만), 라임 글자를 라이트 바탕에
- 에이전트 "성공" 보고를 그대로 믿기(diff·실행으로 재확인)

## 7. 끝났을 때 보고

슬라이스별: 무엇을 했고 · 검증 증거(명령·수치·스크린샷 관찰) · 리뷰 반영 · 남은 사람 게이트. 결론 먼저, 한글로.

---
