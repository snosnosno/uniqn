# ADR: PR3-E client write helper 통일 — no-op (work_logs / event_qr_codes 가드 부재)

**상태**: Accepted (no-op)
**날짜**: 2026-05-11
**작성자**: workspace 협업 Phase 3F 후속
**관련 audit ADR**: `docs/superpowers/plans/2026-05-10-task6-workspace-audit.md` §5.PR3-E

## 컨텍스트

audit ADR §5.PR3-E 가 다음을 제안:

> work_logs, event_qr_codes 도 mutation hook 에 owner-only 클라이언트 가드 있다면
> PR #73 패턴 (loadAndVerifyMutateAccess) 복제. 우선순위 낮음 — RLS 이미 풀려있어
> functional impact 없음, 정합성/가독성 cleanup.

진입 조건: **owner-only 클라이언트 가드 존재**.

## 조사 결과

### 1. WorkLogRepository mutation 메서드 — 가드 부재

`uniqn-mobile/src/repositories/supabase/WorkLogRepository.ts` 의 변경 메서드:

| 메서드 | 시그니처 | 클라이언트 가드 |
|--------|---------|----------------|
| `updatePayrollStatus` (L637) | `(workLogId, status)` | 없음 (RLS only) |
| `updateWorkTimeTransaction` (L661) | `(workLogId, updates)` | 없음 |
| `updatePayrollStatusTransaction` (L672) | `(workLogId, status, amount?)` | 없음 |
| `flagNegativeSettlement` (L680) | `(workLogId, amount)` | 없음 |
| `processQRCheckInOutTransaction` (L699) | `(workLogId, staffId, ...)` | 없음 |

`callerId` 파라미터 또는 `loadAndVerify*` 헬퍼 호출 부재. Supabase RLS `wl_update` 정책에 전적으로 의존.

### 2. EventQRRepository mutation 메서드 — 가드 부재

`uniqn-mobile/src/repositories/supabase/EventQRRepository.ts`:

| 메서드 | 시그니처 | 클라이언트 가드 |
|--------|---------|----------------|
| `deactivate` (L232) | `(qrId)` | 없음 |
| 만료 자동 비활성화 (L132) | (internal) | 없음 |
| 배치 비활성화 (L275) | `(jobPostingId, date, scope?)` | 없음 |

### 3. workLogService / eventQRService — 가드 부재

`uniqn-mobile/src/services/work/workLogService.ts` + `eventQRService.ts` 에 `loadAndVerify*` import 또는 `callerId` 검증 함수 부재 (grep 검증).

### 4. settlementQuery 는 이미 호환 (PR #76)

`uniqn-mobile/src/services/work/settlement/settlementQuery.ts:54, 148` 가 이미 `loadAndVerifyJobPostingAccess` (owner|member|admin) 호출. 이는 *read* 측이며 본 ADR 의 *write* 범위와 무관.

## 결정

**no-op (코드 변경 없음)**. PR3-E 는 audit ADR §5 의 진입 조건을 미충족하므로 close.

## 이유

1. **진입 조건 미충족** — audit ADR §5.PR3-E 는 "owner-only 클라이언트 가드 있다면" 조건부. WorkLogRepository / EventQRRepository / workLogService / eventQRService 모든 mutation 경로에 가드 부재.
2. **RLS 가 이미 권한 경계 담당** — PR #63 (Phase 3B work_logs RLS) + PR #64 (Phase 3C event_qr_codes RLS) 가 owner|member 분기 추가 + PR3-A.2 가 admin 누출 차단 예정. RLS 만으로 충분한 권한 경계.
3. **audit ADR 의 명시적 우선순위** — "우선순위 낮음 — functional impact 없음, 정합성/가독성 cleanup" 그러나 cleanup 대상 자체가 부재.
4. **JobPostingRepository 와의 차이 정당화** — `loadAndVerifyMutateAccess` (PR #73) 가 추가된 이유는 *기존 owner-only 가드를 owner|member|admin 으로 확장* 하기 위함. work_logs / event_qr_codes 는 그런 기존 가드가 부재했으므로 확장 대상 자체가 없음.

## 영향

- 코드 변경: 0건
- migration: 0건
- 테스트: 변경 없음
- audit ADR §5 의 모든 sub-PR 종결 (PR3-A ✅, PR3-B ✅, PR3-C ✅, PR3-D ✅, PR3-A.2 spec 작성 완료, PR3-E ❎ no-op)

## 향후 검토 트리거

다음 중 하나 충족 시 본 ADR 재검토:

1. **work_logs / event_qr_codes mutation 에 owner-only 클라이언트 가드 신규 도입** — 예: 본인 work_log 만 수정 가능하도록 service 레이어에서 `staffId` 검증 추가하는 PR. 이 시점에 owner|member|admin 호환 패턴 (`loadAndVerifyMutateAccess`) 으로 작성 강제.
2. **admin write UI 도입** — PR3-A.2 §2-C 의 RPC 가이드 적용 시. 이 경우 RPC 호출 helper 통일이 본 ADR 영역으로 들어올 수 있음.
3. **settlementQuery 외에 settlement WRITE 경로 추가** — 현재 settlement WRITE 는 work_logs UPDATE 직접 사용. settlement service-layer 에 별도 WRITE 가드 추가 시 패턴 통일 필요.

## 관련 문서

- audit ADR: `docs/superpowers/plans/2026-05-10-task6-workspace-audit.md` §5.PR3-E
- PR #73 (loadAndVerifyMutateAccess 도입): `feat(workspace): write-side mutation 권한 owner|member|admin 호환`
- PR #76 (service-layer hotfix): `fix(workspace): service-layer owner-only 가드 workspace member 호환`
- PR3-A.2 spec: `docs/superpowers/plans/2026-05-11-pr3a2-admin-rls-update-delete-split.md`
- 선례 ADR (no-op + 진입조건 미충족): `2026-05-09-workspace-settlements-rls-audit.md`, `2026-05-09-workspace-templates-owner-only.md`
