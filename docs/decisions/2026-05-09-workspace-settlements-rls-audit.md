# ADR: 정산 (settlements) RLS 점검 — 별도 테이블 없음, work_logs 통합 모델 유지

**상태**: Accepted (no-op)
**날짜**: 2026-05-09
**작성자**: workspace 협업 Phase 3F
**관련 plan**: `docs/superpowers/plans/2026-05-08-workspace-collaboration-completion.md`

## 컨텍스트

워크스페이스 협업 plan 의 Phase 3F 에서 `public.settlements` 테이블 RLS 정책에
워크스페이스 멤버 분기 추가 필요 여부를 점검함. plan 의 가정:

> Phase 3F — settlements RLS 점검. owner_id 만 체크하면 workspace 분기 추가
> migration, application 기반이면 no-op + ADR.

## 조사 결과

### 1. `public.settlements` 테이블 부재

```sql
SELECT polname FROM pg_policy WHERE polrelid = 'public.settlements'::regclass;
-- ERROR: 42P01: relation "public.settlements" does not exist

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND (table_name ILIKE '%settle%' OR table_name ILIKE '%payroll%');
-- 결과: 0건
```

별도 settlements 또는 payroll 테이블이 존재하지 않음.

### 2. 정산 데이터는 `work_logs` 컬럼 통합

`work_logs` 테이블에 정산 관련 컬럼 직접 포함:

| 컬럼 | 용도 |
|------|------|
| `payroll_status` | 정산 상태 (pending / completed 등) |
| `payroll_amount` | 정산 금액 |
| `payroll_date` | 정산 일자 |
| `payroll_notes` | 정산 메모 |
| `settlement_modification_history` | 정산 변경 이력 jsonb |
| `custom_salary_info` | 사용자 지정 급여 |
| `custom_allowances` | 수당 |
| `custom_tax_settings` | 세금 설정 |

즉 **정산 = work_log row 의 일부 컬럼** 모델.

### 3. Service 레이어도 work_logs 기반

```ts
// src/services/work/settlement/settlementQuery.ts:305-306
// Phase 2A: getByOwnerId → getManagedJobPostings 로 전환
const jobPostings = (await jobPostingRepository.getManagedJobPostings()).filter(...);
```

settlement query 는 work_logs 직접 조회. 별도 settlements collection 없음.

### 4. 코드에서 "settlements" 테이블 참조 없음

```bash
# uniqn-mobile 전체 코드 grep
$ grep -rn "from('settlements')\|FROM settlements" --include="*.ts" --include="*.tsx" .
# 결과: 0건
```

## 결정

**no-op (코드/migration 변경 없음)**. Phase 3B (`work_logs` RLS workspace 분기)
가 이미 정산 흐름 editor 권한을 커버.

## 이유

1. Phase 3B (PR #63) 가 `wl_select` / `wl_update` 정책에 `is_workspace_member`
   분기를 추가했음. 정산 컬럼은 work_logs 의 일부이므로 동일 정책으로 보호됨.
2. 별도 settlements 테이블이 없으므로 새 정책 작성 대상 자체가 부재.
3. plan 의 "옵션 B (이미 분기 포함하거나 application 기반이면 no-op + ADR)"
   조건 정확히 충족.

## 영향

- migration: 0건
- pg_policy: 변경 없음
- 코드 변경: 0건
- 테스트: 변경 없음
- editor 정산 흐름: Phase 3B 머지 시 자동으로 활성화 (work_logs.payroll_* 컬럼
  SELECT/UPDATE 가 wl_select/wl_update 정책 분기로 통과)

## 향후 검토 트리거

다음 중 하나 충족 시 본 ADR 재검토:

1. **별도 settlements 테이블 도입**: 정산이 별도 테이블로 분리되어 행 단위
   권한 모델이 필요해지는 경우 (예: 다중 통화, 정산 단위 분할, 외부 정산
   시스템 연동)
2. **정산 권한 차등화 요구**: editor 와 owner 의 정산 권한을 다르게
   설정해야 한다는 요구사항 (예: editor 는 SELECT 만, UPDATE 는 owner 한정)
3. **정산 audit trail 강화**: settlement_modification_history 외에 별도 audit
   테이블이 필요해지는 경우

## 관련 문서

- plan: `docs/superpowers/plans/2026-05-08-workspace-collaboration-completion.md` — Phase 3F
- 선행 결정: PR #63 (Phase 3B work_logs RLS workspace 분기) — 정산 흐름 editor 권한 활성화
- 관련 ADR: `2026-05-09-workspace-templates-owner-only.md` (Phase 3E)
- 관련 PR: 본 ADR 단독 (코드 변경 없음)
