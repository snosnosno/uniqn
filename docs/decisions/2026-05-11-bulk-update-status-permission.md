# ADR — useBulkUpdateStatus Permission Model

> **Status:** Proposed (2026-05-11)
> **Predecessors:** PR #71 (read-side workspace), PR #72 (helper rename), PR #73 (write-side mutate vs delete split), PR #74 (audit roadmap), migration `20260514050000_enforce_jp_status_transition` (status 전이 trigger)
> **Successors:** TBD — see "Follow-up tasks" below

## Context

PR #73 (commit `4383e8ee9`) 가 4 mutation hook 중 단일 row 변형 (`update`/`close`/`reopen`/`settlement settings` via `loadAndVerifyMutateAccess`; `delete` via `loadAndVerifyDeleteAccess`) 의 workspace 호환을 닫았으나 `bulkUpdateStatus` 는 명시적으로 deferred:

> bulkUpdateStatus 는 여전히 owner_id 필터 — bulk 의 cross-owner 영향 범위가 넓어 별도 검토 필요.

현재 구현 (`uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:717-738`):
- 단일 multi-row UPDATE 에 `.in('id', jobPostingIds)` + `.eq('owner_id', ownerId)` 로 raw 컬럼 필터
- `loadAndVerify*Access` helper 호출 0건
- `successCount` 는 `RETURNING id` 카운트, 미일치 row 는 silent 드롭

PR #74 audit (commit `2e4019db9`) 의 PR3-A~E 로드맵에는 `bulkUpdateStatus` 가 들어 있지 않음 — 가장 가까운 placeholder 는 "client write helper 통일" (low priority). 이 ADR 은 audit 로드맵과 충돌하지 않는 보완 결정.

**UI 상태**: `useBulkUpdateStatus` 와 `useJobManagement` orchestrator 모두 TSX consumer **0건** (`employer.tsx` 는 개별 hook 만 import). bulk 경로는 UX 관점에서 dead code → semantic 변경을 UX 회귀 위험 없이 land 가능, UI 디자인은 결정된 model 위에 후속.

## Decision

**Option C — 대상 status 별 분기:**

- **bulk close / reopen / active** — `loadAndVerifyMutateAccess` (owner | workspace_member | admin). 단일 row PR #73 와 동등.
- **bulk cancel (`status='cancelled'`)** — service-layer 에서 reject. status 전이 trigger (migration `20260514050000`) 가 DB-level 에서 한 번 더 차단. trigger land 후 Phase 2 에서 `loadAndVerifyDeleteAccess` (owner | admin) 로 재오픈.

**정당화:**
1. **PR #73 단일 row 변형과 UX 일관성** — editor 가 한 건씩 close 할 수 있으면서 bulk close 만 owner-only 로 막힐 이유 없음.
2. **bulk-cancel 루프홀 차단** — service guard 가 cancel 을 우선 거절하므로 trigger 의존성 없이 안전 land. trigger land 후 defense-in-depth 유지.
3. **UI 무종속** — TSX consumer 0건 → semantic PR 단독 land. UI 는 결정된 model 위에 디자인.
4. **cross-workspace 는 RLS row-by-row 평가** — partial commit 은 의도된 동작. 기존 `successCount` 토스트 (`${successCount}개 변경됨`) 가 자연스럽게 표현.
5. **helper 비대칭 보존** — mutate 경로는 `loadAndVerifyMutateAccess`, delete 경로는 `loadAndVerifyDeleteAccess` 로 단일 row 와 동일 분리. RLS 는 이중 방어, trust boundary 가 아님.

## Consequences

**긍정:**
- bulk close/reopen/active 가 editor 에게 노출, 단일 row PR #73 와 parity.
- soft-delete 루프홀 service-layer 에서 차단 (trigger 비의존 land 가능).
- partial-commit 의 cross-workspace 시멘틱이 `successCount` 로 자연 표현.

**부담/위험:**
- 호출자 owner 가 아닌 경우 per-id `loadAndVerifyMutateAccess` 가 N RPC 까지 발생. 완화: `Promise.all` 병렬 + workspace_id 별 `is_workspace_member` 캐싱 (distinct workspace 1회).
- bulk cancel 이 본 hook 으로는 일시 불가 (모든 role). 단일 row delete 는 기존대로 가능 → UI 영향 없음.

**Blocking on:** Land 차원 없음. status 전이 trigger 는 별도 dispatch 로 이미 작성/검증 완료 (production apply 별건 승인).

## Alternatives Considered

**Option A — owner-only 유지 (현 상태).** 거부: 단일 row PR #73 와 UX 비일관, editor 가 bulk 차단됨, `jp_update_workspace_member` 의도와 어긋남.

**Option B — 모든 status 멤버 호환 (cancel 포함).** 거부: trigger 가 land 안 되면 member→cancelled UPDATE 경로가 `jp_delete_workspace_owner` 의도를 우회. 본 PR 을 trigger 작업과 강결합. trigger land 후 Phase 2 로 재고려.

## Follow-up Tasks (별도 PR)

1. **Service refactor (PR-A)** — `bulkUpdateJobPostingStatus` 에 `status === 'cancelled'` reject guard 추가. repository `bulkUpdateStatus` 를 `.eq('owner_id', ...)` 에서 per-id `loadAndVerifyMutateAccess` (parallel) + `owner_id` 필터 제거 multi-row UPDATE 로 전환. workspace_id 그룹화로 멤버십 캐시 보존.
2. **Unit tests** — owner | member | admin | outsider × close | reopen | active | cancelled = 16 케이스 + cross-workspace partial-commit + atomicity (USING fail row 1 + pass row 1 → `successCount=1`).
3. **Bulk UI 통합 (PR-B)** — `app/(employer)/my-postings/index.tsx` 멀티셀렉트 + 액션바 (마감/재오픈/활성화). cancel 버튼은 Phase 2 까지 미포함.
4. **Dogfooding** — WS-1 owner + invited editor 로 editor 의 bulk close 3건 통과 확인. cancel 버튼 부재/disabled 확인.
5. **Phase 2 (post-trigger)** — trigger land 후 bulk cancel 을 `loadAndVerifyDeleteAccess` 로 재오픈, owner|admin cancel 테스트 추가, service-layer status-cancelled guard 제거 또는 defense-in-depth 유지 여부 재결정.

## Cross-references

- PR #73 (commit `4383e8ee9`) — 단일 row helper 분리
- PR #74 (commit `2e4019db9`) — audit 로드맵 (PR3-E placeholder)
- `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:139-203` — `loadAndVerifyMutateAccess` / `loadAndVerifyDeleteAccess`
- `uniqn-mobile/supabase/migrations/20260514010000_workspace_m3_consolidate_jp_rls.sql` — 현재 `jp_*` RLS
- `uniqn-mobile/supabase/migrations/20260514050000_enforce_jp_status_transition.sql` — status 전이 trigger (Phase 2 의 DB defense)
