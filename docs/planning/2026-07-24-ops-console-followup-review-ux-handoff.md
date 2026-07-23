# 핸드오프 — ops 콘솔 전체 리뷰 + UI/UX 검토 + 후속 PR 3묶음 (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 다음 세션 첫 입력으로 붙여넣는다.

---

## 메인 프롬프트

ops 운영 콘솔 리디자인 브랜치의 전체 리뷰 + UI/UX 검토를 수행하고, 최종 리뷰 triage에서 후속으로 미룬 3묶음(a11y·L7 FAB·프리셋 UX)을 끝까지 구현한다.

### 시작 상태 (2026-07-24 SDD 세션 완료분)

- 브랜치 `docs/ops-console-redesign-specs` @ `c9df44897` — 워크트리 `C:\Users\user\Desktop\T-HOLDEM-ops-docs` 체크아웃, **미push**. 구현 커밋 14개(docs 4개 위).
- SDD 13태스크(계획 A 레이아웃 7 + 계획 B 블라인드 프리셋 6) 완주. 최종 검증 실측: `npm run quality` exit 0 · ops Jest 37스위트/227 PASS · pgTAP 813 PASS.
- fable 최종 브랜치 리뷰 "With fixes" → Critical 1(바운티 피커 RNModal 가림)+Important 2(프리셋 캐시 사용자 스코프·parity stale 주석) 전부 픽스(`c9df44897`), 재리뷰 Approved.
- ⚠️ **prod 마이그 2건 적용완료 — 재적용 절대 금지**: `20260724000000_ops_blind_presets`(테이블+RLS) · `20260724000100_ops_blind_preset_rpcs`(SECDEF 2종). prod 실측 정합: 정책 111 · anon ops SECDEF=2 · 함수 176.
- SDD 진행 원장(태스크별 커밋·리뷰 판정·Minor 롤업 전체): 워크트리 `.superpowers/sdd/progress.md` — **작업 전 필독**.

### 작업 순서 (고정)

**0. 준비**: 메인 트리(`C:\Users\user\Desktop\T-HOLDEM`) `git status`로 병렬 세션 확인 — 워크트리에서 계속 작업. node_modules junction 확인(끊겼으면 `mklink /J C:\Users\user\Desktop\T-HOLDEM-ops-docs\uniqn-mobile\node_modules C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules`). `git fetch origin master`로 base 최신화 확인 — master가 진전됐으면 리뷰 전 merge(squash 저장소라 rebase 금지) 후 재검증.

**1. 전체 리뷰 (신선한 컨텍스트 재검증)**: `8cec1a4de..HEAD` 범위를 fable 리뷰어로 1회 재검증. 직전 세션 최종 리뷰가 이미 통과시킨 것의 반복 발굴이 아니라, ① 픽스 커밋(`c9df44897`)이 들인 새 결함 ② 원장의 Minor 롤업 중 승격할 것 ③ master 재통합 시 충돌 부위를 본다. Critical/Important만 즉시 수정, Minor는 3번 묶음에 편입.

**2. UI/UX 검토**: `/design-review` 스킬(또는 emil-design-eng·apple-design 스킬 조합)로 신규 표면 검토 — OpsConsoleShell(폰 5탭+⋯/태블릿 사이드바)·OpsClockStrip/OpsSummaryStrip·OpsParticipantActionSheet·BlindPresetSheet·프리셋 바. 웹 실행으로 실관찰(fablize 그라운딩: 정적 파싱≠관찰): 워크트리 expo 함정 주의 — **`EXPO_ROUTER_APP_ROOT=<워크트리>/app` 절대경로 + `--clear` 필수**(junction 상태에서 라우트 0 "Welcome to Expo" 함정, 메모리 실증). 발견은 심각도 분류 후 3번 묶음과 함께 구현.

**3. 후속 3묶음 구현 (SDD 방식 — 태스크별 fresh 서브에이전트 구현=opus, 태스크 리뷰=opus, 최종 리뷰=fable)**:

- **(a) a11y 일괄**: OpsClockStrip accessibilityLabel에 레벨·남은시간 동적 포함 · OpsSummaryStrip `numberOfLines={1}` · OpsConsoleShell 탭 `role="tab"`+`accessibilityState={{selected}}`+터치높이 40px(py-2→min-h 보강) · BlindPresetSheet 삭제 버튼 44px · OpsClockStrip 테스트 죽은 모킹(useOpsBlindLevels) 정리. `/a11y` 스킬 기준 준수.
- **(b) L7 등록 FAB**: spec `2026-07-23-ops-console-layout-redesign-design.md` L7 — OpsConsoleShell의 미배선 `fab` 슬롯을 소비해 참가 등록 진입을 FAB로. 착수 전 PlayersTab의 현행 인라인 등록 폼/흐름 실측 후 설계 결정(인라인 폼 → 시트화 여부 포함, 계획 A Self-Review "미커버 주의" 항목). 3+ 파일이면 간단 설계 먼저.
- **(c) 프리셋 UX 폴리시**: 초기 표시 "사용자 정의"→중립 라벨(예: "저장된 구조") · 이름 길이 정합(TextInput maxLength 40 vs zod/DB 60 — 60으로 통일 권장, 제품 판단) · 좌석 진입 액션시트에도 `onOpenPayouts` 스레딩(TablesTab — busted는 좌석 미점유라 실도달 낮음, 대칭성 목적) · levels 개수 상한(클라 zod `.max()` 우선; **서버 RPC 상한은 새 마이그 필요 — 하려면 `/guard` + 로컬 db:reset+test:db GREEN + 리뷰 후 MCP prod, 기존 마이그 수정 금지. SECDEF `CREATE OR REPLACE`는 proconfig 유실 이력 — 이 RPC들은 inline `SET search_path`라 안전하지만 적용 후 proconfig 실측 확인**) · (선택 Minor 소진) OpsStatusTab 상태 영문 원문 한글화 · 좌석 비우기 destructive 스타일 복원 · TablesTab useOpsTournament realtime 구독 중복 검토.

### 게이트·금지

- 완료 주장 전 태스크별 검증 증거(`npm run quality` + 해당 Jest, DB 변경 시 `npm run db:reset && npm run test:db`). 최종에 전체 ops Jest + quality 재실행.
- 서브에이전트에 `mcp__supabase__*` 직접 호출 금지 명시. prod 적용은 메인 세션이 로컬 GREEN+리뷰 후 직접. **적용완료 마이그 2건 재적용 금지.**
- push/PR·머지는 사용자 명시 요청 시만. 실기기 QA(바운티 피커 표시·600dp 사이드바·⋯ 시트 터치·프리셋 키보드/다크모드)는 사용자 게이트로 잔존.
- 리뷰 디스패치된 커밋 amend 금지(append 커밋).

### 완료 후

- 메모리 `project_ops_console_redesign_20260723` 갱신(후속 3묶음 상태·잔여). `.superpowers/sdd/progress.md` 원장 이어서 기록.
- 실기기 QA 체크리스트를 최종 보고에 명시(위 4항목 + 신규 표면).

---

## 참고 — 직전 세션 경과 요약 (안 읽어도 되는 배경)

- SDD 루프: 태스크별 fresh opus 구현 → opus 태스크 리뷰(재리뷰 포함 픽스 3회) → fable 최종 브랜치 리뷰 → 픽스 1커밋 → 재리뷰 Approved. DB 슬라이스는 database-reviewer(GO)·security-reviewer(GO, 정규식 선검증 Important 픽스 후 prod 적용).
- 🔑 세션이 남긴 교훈: RNModal(SheetModal)+gorhom BottomSheet 동시 오픈은 네이티브에서 피커가 모달 뒤에 가려짐(jest 스텁 사각지대 — visible 게이트로 해소) · per-user 캐시는 queryKeys 팩토리+userId 스코프 필수 · `@/constants` 소비 훅 테스트는 `jest.mock('@/constants')` 필요 · react-test-renderer는 typed require 문형(TS7016).
- Minor 롤업 전문과 태스크별 리뷰 판정은 `.superpowers/sdd/progress.md`.
