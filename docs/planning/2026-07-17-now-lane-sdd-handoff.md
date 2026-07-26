# 핸드오프 — "지금" 레인 개선 SDD 구현 (다음 세션 메인 프롬프트)

> 아래 `---` 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣는다.

---

"지금" 레인 개선(공유 신뢰성 · 용어 교정 · 진입점 통일)을 **subagent-driven development**로 끝까지 구현한다. 3개 독립 PR.

## 무엇을 / 왜

세 기능(공유·워크스페이스·주간그리드) 통합 개선 분석의 "지금" 레인. 공유는 이 앱의 유일한 성장 루프인데 죽은 링크 무방비 + 카톡 미리보기 부재로 새고 있고, 개발자 어휘가 화면에 유출됐고, 워크스페이스 진입점이 3곳으로 분산돼 있다.

## 착수 전 필수 로드

1. **계획서**: `docs/superpowers/plans/2026-07-17-now-lane-improvements.md` — Task 1~8, TDD 스텝·완전 코드. 진실원.
2. **스펙**: `docs/superpowers/specs/2026-07-17-now-lane-improvements-design.md` — 3 PR 결정·비목표·실측 근거(파일:라인).
3. 스킬: `superpowers:subagent-driven-development`.

## PR 구성 (독립 — 순서 무관, 권장 순서 아래)

- **PR-1 공유 신뢰성**: Task 1(canShareJob 가드) → 2(useShare 단일 게이트) → 3(OG HTML 순수 헬퍼) → 4(OG Pages Function 본체). ⭐최고 ROI.
- **PR-2 용어 교정**: Task 5(개발자 어휘→자연어 일괄). 제로 리스크.
- **PR-3 진입점 통일**: Task 6(⋯ ActionSheet 메뉴) → 7(설정 협업 섹션·워크스페이스 배너 제거).
- 마무리: Task 8(전체 검증).

## 실행 규칙 (엄수)

- **워크트리 격리 먼저.** 레포 기본 트리는 `feat/seat-basis-posting-count`(다른 작업)에 자정 처리 등 미커밋 문서가 쌓여 있다. `superpowers:using-git-worktrees`로 **새 워크트리 + 브랜치 `feat/now-lane-improvements`** 를 `master` 기준 생성, node_modules는 `mklink /J` 정션(메모리 `feedback_worktree_node_modules_junction`), Expo 라우트 0 함정 시 `EXPO_ROUTER_APP_ROOT` 절대경로(메모리 `pitfall_worktree_junction_expo_router_empty_routes`).
- **Task 순서 = 계획서 순서.** 각 Task: 새 서브에이전트(구현=`model: opus`)에 해당 Task 블록만 → 완료 보고 → 메인에서 **독립 검증**(VCS diff + 그 Task jest 실제 실행) → 통과 후 다음.
- **TDD 준수**: 실패 테스트 → 실패 확인 → 최소 구현 → 통과 → 커밋. Red-Green 스킵 금지.
- **완료 게이트**: 커밋 전 그 Task 테스트를 이 세션에서 실제 실행한 출력으로만 통과 주장(fablize).
- **DB·RLS·서버 변경 절대 금지.** OG는 anon 읽기만. `mcp__supabase__*` 직접 호출·기존 마이그레이션 수정 금지.
- **핵심 보안**: OG Function은 공고 title 등 사용자 입력을 HTML에 삽입 → `escapeHtml` 필수(Task 3에 구현·테스트됨). 이스케이프 없는 삽입 발견 시 즉시 차단.
- **용어**: "워크스페이스"→"사업장" 개명은 **하지 않는다**(isSolo 다음 레인). 그리드/슬롯/풀/운영처/목표인원/배치만 교정.
- jest가 `functions/`를 수집하는지 확인(Task 3 Step 2 주석) — 미수집이면 jest config `roots`에 `functions` 추가도 그 Task에 포함.

## 완료 정의 (exit proof)

- Task 1~8 전부 커밋됨.
- `cd uniqn-mobile && npm run quality` → 0/0/OK.
- `npx jest src/domains/job-posting src/hooks functions src/components/weeklyGrid "app/(app)"` → PASS.
- 용어 잔여 grep 0: `rg -n "주간 배치 그리드|풀 꽂기|배치 슬롯|운영처|목표 인원" src app`(화면 문자열 0).

## 완료 후 (사용자 게이트 — 자동 진행 금지)

- **OG Function 배포는 사용자만** — CF 대시보드에 `SUPABASE_URL`/`SUPABASE_ANON_KEY`(공개값) 등록 → `node scripts/deploy-cloudflare.js --force` → 실측 3종: ①`curl -A "facebookexternalhit" https://uniqn.app/jobs/<실제id>` OG 태그 확인 ②일반 UA SPA 로드 ③`_redirects` 우선순위 문제 시만 `/jobs/*` 예외 추가. `public/og-default.png`(1200×630) 자산 필요.
- push/PR은 **명시 요청 시에만**(로컬 커밋까지 사전 승인). PR 전 최신 master 재통합(squash→merge).
- 실기기 QA(공유 시트·⋯ 메뉴·용어)는 사용자. 머지 후 `/ingest` wiki 졸업 + MEMORY.md 갱신.

## 참고 맥락 (이번 세션 산출)

같은 통합 분석에서 나온 다른 산출물: 자정 근무시간(`docs/superpowers/plans/2026-07-17-overnight-worktime.md` + 핸드오프, 별도 세션 진행 예정), 분석 아티팩트 4종(바탕화면 `UNIQN-분석/`). "다음" 레인(공고→필요인원 자동 파생, isSolo 사업장 숨김, 홈 스트립)은 이 PR들 이후 별도 설계.
