# 핸드오프 — 지점 역할별 급여(JIT) 구현 실행 (다음 세션 메인 프롬프트)

> 작성: 2026-07-23. 이전 세션 = 설계 spec + 9태스크 구현 계획 완성·커밋.
> **이번 세션 = 실행만. 실행 방식 = SDD(`superpowers:subagent-driven-development`) — 사용자 확정.**

## 첫 액션 (순서 고정 — 격리 먼저, 그 다음 SDD)

1. **워크트리 격리** (메인 체크아웃은 타 세션 점유 중 — `feat/order-sheet-chain-polish` 위에
   타 세션 커밋·미커밋 변경 존재. 메인 체크아웃에서 브랜치 전환 절대 금지):
   ```bash
   cd /c/Users/user/Desktop/T-HOLDEM
   git fetch origin
   git worktree add ../T-HOLDEM-salary -b feat/venue-role-salary-jit origin/master
   # ⚠️ 계획·spec 문서 커밋 3개는 feat/order-sheet-chain-polish 에 있음 → 새 브랜치로 가져온다(docs-only, 충돌 없음)
   cd ../T-HOLDEM-salary
   git cherry-pick 5527cb6d7 2550ebf8a 1d1b1c80e
   # node_modules junction (5분 npm install 절약 — feedback_worktree_node_modules_junction)
   cmd //c mklink //J "uniqn-mobile\\node_modules" "C:\\Users\\user\\Desktop\\T-HOLDEM\\uniqn-mobile\\node_modules"
   ```
   Expo 실행이 필요한 태스크(Task 8 그라운딩)에서는 `EXPO_ROUTER_APP_ROOT=<워크트리>/app` 절대경로
   + `--clear` 필수(`pitfall_worktree_junction_expo_router_empty_routes`).
2. **SDD 실행**: `superpowers:subagent-driven-development` 스킬 호출 → 계획의 Task 1~9를
   태스크당 fresh 서브에이전트로 실행 + 태스크 사이 2단계 리뷰. 모델 라우팅: 구현=opus ·
   리뷰/판정=fable(orchestration.md). 디스패치 프롬프트에 금지 3종 명시
   (`mcp__supabase__*` 직접 호출 금지 · 기존 마이그 수정 금지 · PROD 우회 금지).
3. 계획 문서가 유일한 진실원: `docs/superpowers/plans/2026-07-23-venue-role-salary-jit.md`
   (Task 1~9, TDD 스텝·전체 코드 포함). spec: `docs/superpowers/specs/2026-07-23-venue-role-salary-jit-design.md`.
   계획 Self-Review에 명시된 "실행 시 확인 필요 4종"(형제 테스트 mock 셋업·아이콘 실명·
   SettlementCard 배럴 경로·db:test 스크립트)은 각 태스크 실행자가 해당 파일을 열어 실측 후 대입.

## 상태 스냅샷

- 채택 확정(사용자): **JIT안 + v1 범위 = 접점 1(AddSlotSheet JIT)+2(지점 정산 배지)+3(단가표 시트) 전부**.
- 문서 커밋: `5527cb6d7`(spec) · `2550ebf8a`(spec 교정+계획) — ⚠️ 타 세션 점유로
  `feat/order-sheet-chain-polish` 브랜치에 얹혀 있음. 머지/PR 시 docs 커밋 분리 여부는 사용자 판단.

## 핵심 발견 (이전 핸드오프 대비 변경)

- **"마이그 0" 전제 붕괴**: baseline `jp_container_no_direct_update`(RESTRICTIVE)가 컨테이너
  직접 UPDATE 차단 → 단가표 쓰기는 **신규 SECDEF RPC `set_venue_role_salary` 마이그 1건 필요**
  (계획 Task 2에 SQL 전문 + pgTAP 8종 포함). secdef-hardening 3규칙 준수.
- 지점 정산 UI는 소비처 0(`getVenueSettlementWorkLogs` 서비스만 존재) → Task 8이 첫 소비 화면 신규.
- 지점 설정 표면도 부재(생성만 있음) → Task 7이 VenueSelector 선택 칩 ⚙ + 시트 신규.
- 출처 헬퍼 타입명은 **`roleTable`**(spec·plan 통일, 'venueTable' 아님).

## 게이트

- Task 2 로컬 마이그는 로컬 Docker 스택만. **prod 적용은 Task 9에서 사용자 확인 후 MCP
  `mcp__supabase__apply_migration` 전용**(구현 서브에이전트는 `mcp__supabase__*` 호출 금지).
- Task 9 리뷰 3종 병렬(fable): code-reviewer(배지·재계산·2쓰기 순서) ·
  security-reviewer(RPC 인가·REVOKE·search_path) · database-reviewer(jsonb·FOR UPDATE·pgTAP).
- push/PR은 사용자 명시 요청 시만. 완료 주장은 실행 증거(테스트 출력) 필수.

## 별건(독립·미착수)

- 근무표 제거 잔여 출하 게이트: 웹재배포(guide.html)·OTA·워크트리 정리·실기기 QA —
  착수점 `docs/planning/2026-07-22-grid-removal-ship-gates-handoff.md`.
