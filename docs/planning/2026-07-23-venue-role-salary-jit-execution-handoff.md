# 핸드오프 — 지점 역할별 급여(JIT) 구현 실행 (다음 세션 메인 프롬프트)

> 작성: 2026-07-23. 이전 세션 = 설계 spec + 9태스크 구현 계획 완성·커밋. **이번 세션 = 실행만.**

## 첫 액션 (순서 고정)

1. `git status` 확인 → **새 워크트리 + 새 브랜치 격리 필수**(메인 체크아웃은 타 세션 점유 중 —
   브랜치가 `feat/order-sheet-chain-polish`로 바뀌어 있고 타 세션 커밋·미커밋 변경 존재).
   node_modules 는 `mklink /J` junction(메모리 `feedback_worktree_node_modules_junction`),
   Expo 실행 시 `EXPO_ROUTER_APP_ROOT` 함정 참고(`pitfall_worktree_junction_expo_router_empty_routes`).
2. `superpowers:subagent-driven-development` 스킬로 계획 실행(사용자 선택: 서브에이전트 아님 —
   **"다음 세션 핸드오프"만 선택됨. 실행 방식은 이 세션에서 다시 subagent-driven 권장**).
3. 계획 문서가 유일한 진실원: `docs/superpowers/plans/2026-07-23-venue-role-salary-jit.md`
   (Task 1~9, TDD 스텝·전체 코드 포함). spec: `docs/superpowers/specs/2026-07-23-venue-role-salary-jit-design.md`.

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
