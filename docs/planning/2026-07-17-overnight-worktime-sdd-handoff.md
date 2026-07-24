# 핸드오프 — 자정 넘는 근무시간 근본 처리 SDD 구현 (다음 세션 메인 프롬프트)

> 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣으면 된다.

---

자정 넘는 근무시간 근본 처리를 **subagent-driven development**로 끝까지 구현한다.

## 무엇을 / 왜

앱 전체에서 근무시간 "종료 ≤ 시작 → 익일" 처리가 화면마다 3가지 상반된 모델로 갈라져 있다(근무표=무검증 통과, 정산=오류 차단, 공고=발생불가). SSOT(`parseTimeSlotToDate` + `WorkTimeDisplay.isEndNextDay`)는 이미 있으나 우회/재구현 화면 3곳이 존재. 이걸 하나의 파서·표시·계산으로 통일한다. 홀덤펍 기본 근무(18:00~익일 04:00)가 이 업종의 표준 케이스이며, 이 작업은 후속 "공고→필요인원 자동 파생"의 기반이다.

## 착수 전 필수 로드

1. **계획서**: `docs/superpowers/plans/2026-07-17-overnight-worktime.md` — Task 1~10, 전부 TDD 스텝·완전 코드 포함. 이게 진실원.
2. **스펙**: `docs/superpowers/specs/2026-07-17-overnight-worktime-design.md` — R1~R6 규칙, 실측 근거(파일:라인), 비목표.
3. 스킬: `superpowers:subagent-driven-development` (Task마다 새 서브에이전트 + 2단계 리뷰).

## 실행 규칙 (엄수)

- **워크트리 격리 먼저.** 현재 레포 기본 트리는 `feat/seat-basis-posting-count`(다른 작업)이고 미커밋 변경이 있다. `superpowers:using-git-worktrees`로 **새 워크트리 + 새 브랜치 `feat/overnight-worktime`** 를 `master` 기준으로 만들고 거기서만 작업한다. node_modules는 `mklink /J`로 메인 트리 정션(메모리 `feedback_worktree_node_modules_junction`). Expo 라우트 0 함정 대비 `EXPO_ROUTER_APP_ROOT` 절대경로 주의(메모리 `pitfall_worktree_junction_expo_router_empty_routes`).
- **Task 순서 = 계획서 순서.** Task 1(공용 헬퍼)이 나머지 토대 → 반드시 먼저. Task 1→2→3→4→5→6→7→(P2)8→9→10.
- 각 Task: 새 서브에이전트(구현=`model: opus`)에 **해당 Task 블록만** 전달 → 완료 보고 → 메인에서 **독립 검증**(VCS diff 확인 + 그 Task의 jest 실제 실행, 성공 보고 그대로 신뢰 금지) → 통과해야 다음 Task. 리뷰 판정이 필요하면 `model: fable` 서브에이전트.
- **TDD 준수**: 실패 테스트 먼저 → 실패 확인 → 최소 구현 → 통과 → 커밋. Red-Green 스킵 금지.
- **완료 게이트**: 각 Task 커밋 전 그 Task의 테스트를 이 세션에서 실제 실행한 출력으로만 통과 주장(fablize 게이트). "될 것" 금지.
- **DB·서버 RPC 변경 절대 금지**(클라이언트 전용 PR). `mcp__supabase__*` 직접 호출 금지, 기존 마이그레이션 수정 금지.
- **UI 화면 매핑 주의(계획서 Self-Review 마지막 줄)**: Task 4·5·6·7은 부모가 넘기는 시간 데이터 형태(Date vs "HH:mm" vs timeSlot+date)를 파일을 열어 확인 후 `WorkTimeSource` 필드에 매핑. 이게 유일한 실측 의존 지점 — 서브에이전트 프롬프트에 "먼저 대상 파일을 읽고 데이터 형태 확인" 명시.
- 스펙 대비 조정 1건 이미 반영됨: **12h 확인 = 비차단 강조 배너**(차단 다이얼로그 아님). Task 4 그대로 따를 것.

## 완료 정의 (exit proof)

- Task 1~10 전부 커밋됨(각 커밋 = TDD 사이클 1개).
- `cd uniqn-mobile && npm run quality` → type-check 0 / lint 0 / format OK.
- 관련 jest 전부 통과: `npx jest src/shared/time src/components/weeklyGrid src/components/employer/settlement src/components/schedule src/domains/weeklyGrid`.
- 우회 3곳(ScheduleDetailSheet·WorkTimeSection·GroupedScheduleCard) Red-Green 스팟체크로 "익일 라벨을 실제로 잡는지" 확인(계획서 Task 10 Step 2).

## 완료 후 (사용자 게이트 — 자동 진행 금지)

- push/PR은 **명시 요청 시에만**. 로컬 커밋까지는 사전 승인(로컬만).
- PR 전 최신 master 재통합(squash 저장소 → merge). 실기기 QA(iOS 시간 피커 익일 표시)는 사용자 몫.
- 머지 후 `/ingest`로 wiki 졸업 + MEMORY.md 갱신.

## 참고 맥락 (이번 세션 산출)

이 작업은 "공유·워크스페이스·주간그리드" 세 기능 통합 개선 분석에서 **우선작업**으로 지정된 것. 개선 보드/유저플로우 목업은 바탕화면 `UNIQN-분석/` 폴더 + 아티팩트에 있음. 자정 처리는 그 로드맵의 "지금" 레인 최상단.
