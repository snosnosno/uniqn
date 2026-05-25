# 스케줄 스키마 통일 (SP1) — 설계 문서

- **날짜**: 2026-05-25
- **브랜치**: `refactor/schedule-schema-unify` (베이스: master `2f39a3c90`)
- **범위**: 3-subproject 로드맵 중 **SP1만**. SP2(confirm 경로 통합) / SP3(단일 canonical 카운터)는 후속.

---

## 1. 배경 / 문제

`job_postings.schedule` (JSONB) 가 공고 형태에 따라 **역할/정원을 두 가지 다른 모양**으로 담는다:

- **fixed 공고**: `schedule.roleRequirements[]` = `{ role, customRole?, count, filled? }` — 플랫, 날짜/슬롯 개념 없음.
- **dated/grouped 공고**: `schedule.requirements[].timeSlots[].roles[]` + `dateGroups[]` + `dateRequirements[]` — 날짜·시간슬롯·역할 중첩.

이 **이중 스키마**가 근본 분열의 정체다. 역할/정원을 읽고 쓰는 거의 모든 코드가 fixed/dated 분기로 갈라진다: 직렬화, 생성 폼, 표시 모델, stats, 확정 정원 가드.

### 이 분열이 낳은 실제 결함 (PR #139 이후 잔존)

| 형태             | 역할별 (filled/count) 표시            | 역할별 정원 가드                   | 공고 총합 |
| ---------------- | ------------------------------------- | ---------------------------------- | --------- |
| dated / TBA      | ✅ 정상 (work_logs 집계 RPC)          | ✅ 정상                            | ✅ 정상   |
| grouped 날짜범위 | ❌ 항상 0/N (범위→단일날짜 매칭 불가) | ⚠️ 부분                            | ✅ 정상   |
| **fixed**        | ❌ 항상 0/N (dead counter)            | ❌ **무력 — 역할별 overfill 가능** | ✅ 정상   |

- `schedule.roleRequirements[].filled` 는 **쓰는 곳이 코드·마이그레이션 전수에 없는 dead counter**다(2026-05-25 확인).
- 클라 정원 가드(`ApplicationRepositoryTransactions.ts:338`)가 이 dead `filled`(항상 0)를 읽어 `0 >= count` → 거짓 → **fixed 역할별 정원 초과 확정이 통과**한다. 서버 RPC H1 가드는 fixed를 명시적으로 스킵(`confirm_application:131 IF NOT p_is_fixed_posting`).
- 공고 레벨 `filled_positions >= total_positions` auto-close 가 **총원**은 막지만 **역할 간 배분 위반**(딜러 자리에 플로어)은 못 막는다.

### 왜 지금 하는가

현재 prod 공고는 1건(dated, 정상)이고 fixed/grouped 는 0건이다. **지금은 깨지는 게 없지만**, fixed 공고가 등장하는 순간 역할별 overfill 이 표시 버그보다 먼저 터진다. 데이터가 비어 있는 지금이 스키마 마이그레이션의 **무위험 시점**이다.

---

## 2. 목표 / 비목표

### 목표 (SP1)

- 역할/정원이 사는 substructure 를 **단일 경로**(`requirements[].timeSlots[].roles[]`)로 통일한다.
- `roleRequirements[]` 와 그에 매달린 모든 fixed 분기(직렬화/생성/표시/stats/정원검증)를 제거한다.
- 기존 공고 JSONB 를 멱등 마이그레이션으로 변환한다.
- **동작 동치**: SP1 전후로 사용자 가시 동작(표시·생성·확정)이 동일해야 한다. SP1 은 순수 내부 형태 통일이다.

### 비목표 (후속 SP)

- **SP2**: fixed 별도 confirm 경로 + dated RPC 를 단일 confirm RPC 로 통합.
- **SP3**: confirmed applications 트리거 기반 단일 canonical 카운터 도입, dead counter 2종 + read-time RPC 제거, 표시·H1·filled_positions 단일 소스 파생. **역할별 overfill 결함의 최종 해소는 SP3** (또는 SP2 에서 통합 가드로 선해소 가능 — SP2 설계 시 결정).
- SP1 은 dead counter(`filled` 필드)를 **제거하지 않는다**. 통일된 구조 안에서 무해하게 유지하고, 제거는 SP3 가 카운터를 대체할 때 수행한다.

---

## 3. 핵심 설계 결정: `kind` 유지 + 역할 substructure만 통일

빈 문자열/`date: ''` sentinel 로 fixed 를 dated 에 완전 흡수하는 안은 **채택하지 않는다**(stringly-typed 함정 + fixed 메타가 갈 곳 모호). 대신:

- `kind: 'fixed' | 'dated'` **판별자 유지** — 반복근무 vs 날짜지정이라는 진짜 다른 스케줄 의미. `daysPerWeek`/`startTime`/`isStartTimeNegotiable` 등 fixed 메타는 fixed variant 에 그대로.
- **통일하는 것은 역할이 사는 구조 하나뿐**: fixed 도 `requirements[].timeSlots[].roles[]` 에 역할을 담는다. fixed = `requirements` 1개, `date: null`(빈 문자열 아님), `timeSlots` 1개(합성 슬롯).

```ts
// fixed (통일 후)
{
  kind: 'fixed',
  daysPerWeek: 5,
  startTime: '19:00',
  isStartTimeNegotiable: false,
  requirements: [{
    date: null,                 // null = 반복근무(날짜 없음). '' sentinel 금지
    timeSlots: [{
      startTime: '19:00',
      isTimeToBeAnnounced: false,
      roles: [
        { role: 'dealer', count: 3, filled: 1 },
        { role: 'other', customRole: 'VIP Host', count: 2, filled: 0 }
      ]
    }]
  }]
}
```

이렇게 하면 역할을 읽는 모든 코드가 `requirements[].timeSlots[].roles[]` **단일 경로**만 보면 된다 → fixed 분기 전면 제거. `date: null` 은 타입상 명시적이라 sentinel 함정이 없다.

---

## 4. 영역별 상세 설계

### 4.1 타입 / zod (`src/types/jobPosting.ts`, `src/schemas/jobPosting.schema.ts`)

- `PostingDateRequirement.date`: `string` → `string | null` (fixed = null). zod: `z.string().nullable()`.
- `PostingFixedSchedule`: `roleRequirements?` 제거, `requirements: PostingDateRequirement[]` 추가. `daysPerWeek`/`startTime`/`isStartTimeNegotiable` 유지.
- `postingFixedRoleRequirementSchema` 제거(역할 스키마는 `postingSlotRoleRequirementSchema` 로 단일화).
- `PostingDatedSchedule` 은 변경 없음(`date` nullable 확장만 공유).
- **불변식**: fixed → `requirements.length === 1 && requirements[0].date === null && requirements[0].timeSlots.length === 1`. zod `.refine()` 로 강제.

### 4.2 직렬화 (`src/domains/job-posting/serialization.ts`)

- `normalizeSchedule()` fixed 분기(150–166): `roleRequirements` 를 합성 `requirements` 로 정규화.
- `deserializeJobPostingDocument()` fixed 분기(323–340): 동일 변환.
- **역호환 읽기**: DB 에 아직 `roleRequirements` 형태로 남은 row 가 들어오면 deserialize 시 합성 슬롯으로 변환(마이그레이션 누락분 방어). 단 쓰기는 항상 새 형태.

### 4.3 생성/수정 (`src/utils/job-posting/draftAdapter.ts`)

- `buildFixedDraft`(275–295) / `draftToCreateJobPostingInput` fixed 분기(477–491): form `roles[]` → 합성 슬롯의 `roles[]`.
- `buildFixedDraft`/`buildDatedDraft` 의 공통 역할 매핑 추출(중복 제거). 폼 입력 UX 는 변경 없음(내부 변환만).

### 4.4 표시 (`postingSurfaceModel.ts`, `core.ts`, `selectors.ts`)

- `buildPostingScheduleModel` fixed 분기(156–175): 제거하지 않고 **유지하되**, `fixed.roles` 대신 `requirements[0].timeSlots[0].roles` 에서 역할을 읽도록 소스 변경. fixed 카드 표시(주N일/시간 라벨)는 그대로.
- `getPostingRoleStats`(core.ts 112–150): fixed 분기 제거, 단일 순회로 통합.
- `selectPostingWorkflow`(selectors.ts 31–49): `isFixed = kind === 'fixed'` 판별 유지. `usesGroupedDateRanges` 계산은 `date !== null` 인 requirements 에만 적용(fixed 의 null-date 는 grouping 대상 아님).
- `date === null` 표시 처리: 날짜 라벨 대신 fixed 의 `daysLabel`(주N일) 사용 — 기존 fixed 표시 경로 재사용.

### 4.5 stats (`src/domains/job-posting/stats.ts`)

- `calculateFilledPositionsFromSchedule`(13–26) / `calculateTotalPositionsFromSchedule`(47–75): fixed 분기 제거. 단일 `requirements[].timeSlots[].roles[]` 순회. fixed 는 슬롯 1개라 peak 계산이 자동으로 올바름(role count 합).

### 4.6 확정 정원 (`src/repositories/supabase/ApplicationRepositoryTransactions.ts`)

- `validateConfirmCapacity`(310–353): fixed 분기(315–343) 제거 → 전 경로 `validateAssignmentSlotCapacity`.
- **주의**: 이건 클라 가드일 뿐, dead `filled` 의존을 끊는 효과. 진짜 정원 enforcement(서버 원자적)는 SP2/SP3 소관. SP1 은 클라 가드가 통일 구조의 slotCapacity 를 읽도록만 정렬(동작 동치 + dead counter 의존 제거).
- `createWorkLogsForConfirmation`: `assignment.dates` 가 fixed 에서 어떻게 채워지는지 SP1 변환과 정합 확인(회귀 방지). work_logs 스키마는 SP1 에서 미변경.

### 4.7 DB 마이그레이션 (멱등)

- `schedule->'roleRequirements'` 가 array 인 row 를 `schedule.requirements = [{date:null, timeSlots:[{startTime, isTimeToBeAnnounced:false, roles: <roleRequirements>}]}]` 로 UPDATE, `roleRequirements` 키 제거.
- 멱등: `roleRequirements` 키가 이미 없으면 no-op (`WHERE schedule ? 'roleRequirements'`).
- prod 영향: fixed 공고 0건 → 0 rows affected (무위험). fresh/staging 스택 및 미래 시드 대비.
- MCP `apply_migration` 으로 적용(프로젝트 규칙). `supabase db push` 금지.
- 롤백: 역변환 마이그레이션 동봉(또는 down 스크립트 문서화).

---

## 5. 테스트 전략

- **단위(Jest)**: serialization round-trip(fixed→통일→fixed 의미보존), draftAdapter fixed 빌드, stats fixed total/filled, postingSurfaceModel fixed 표시, validateConfirmCapacity fixed 경로. 기존 fixed 관련 테스트(`jobPosting.schema.test.ts`, `workflow.test.ts`, `totalPositions.test.ts`, `draftAdapter.test.ts`, `submission.test.ts`, `dateUtils.test.ts`)를 새 형태로 갱신.
- **마이그레이션**: pgTAP 또는 execute_sql 롤백 트랜잭션으로 RED/GREEN — `roleRequirements` row 가 변환되는지 + 멱등성(두 번 적용 동일).
- **동작 동치 검증**: 변환 전/후 같은 입력에 대해 `calculateTotal/FilledPositions`, 표시 모델, 역할 통계가 동일한 결과를 내는지 스냅샷.
- `npm run quality` (tsc + eslint + prettier) 0 errors.

## 6. 리스크 / 완화

- **R1 — 생성/표시 전 경로 회귀**: fixed 공고의 생성·수정·카드·상세 표시가 깨질 수 있음. → 동작 동치 테스트 + 수동 QA(fixed 공고 생성→표시→확정 1회). 구현은 새 세션에서 충분한 검증과 함께.
- **R2 — 역호환**: 미마이그레이션 row. → deserialize 의 역호환 읽기(4.2)로 방어.
- **R3 — `date: null` 누락 분기**: 날짜를 non-null 가정하는 다른 코드. → 탐색 6개 섹션 외 `requirement.date` 사용처 grep 으로 사전 점검(플랜 단계 첫 작업).
- **R4 — 스코프 크립**: SP1 에서 카운터/confirm 까지 손대고 싶은 유혹. → dead counter·confirm 경로는 명시적으로 SP1 밖. PR 리뷰에서 게이트.

## 7. 3-Subproject 로드맵

1. **SP1 (본 문서)** — 스케줄 스키마 substructure 통일. 독립 배포 가능.
2. **SP2** — fixed 별도 confirm 경로 + dated RPC → 단일 confirm RPC(통일 구조 위). 의존: SP1.
3. **SP3** — confirmed applications 트리거 단일 카운터. dead counter 2종 + read-time RPC 제거. 표시·H1·filled_positions 단일 소스. 의존: SP1, SP2. **역할별 overfill 최종 해소**.

각 SP 는 spec → plan → 구현 사이클을 독립적으로 돈다.

## 8. 관련 메모리

- `pitfall_posting_role_filled_dead_counter` — PR #139 배경 + 잔여 분석.
- `pitfall_denormalized_counter_drift` — trigger+delta 표준(SP3 토대).
- `feedback_temp_defense_then_root_cause` — 임시방어→근본→방어제거 3단계.
- `feedback_supabase_migration_workflow` — MCP apply_migration 전용.
