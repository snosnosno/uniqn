# 스케줄 단일 카운터 + dead counter 제거 (SP3) — 설계 문서

- **날짜**: 2026-05-25
- **브랜치**: `refactor/schedule-counter-unify` (베이스: SP1 HEAD `0f4a65d86`, SP2 위에 누적)
- **범위**: 3-subproject 로드맵의 **SP3**. SP1(스키마 통일)·SP2(확정 경로 통일) 완료 전제.
- **사용자 결정 (2026-05-25)**: **A안** — work_logs 를 역할 단위 권위 소스로 유지하고 `get_posting_filled_counts` hydrate RPC 를 **유지**한다. dead counter(`schedule...roles[].filled`)는 **제거**한다.

---

## 1. 배경 / 문제

원래 사용자 재현 버그(2026-05-24)의 **진짜 끝**: 역할별 `(filled/count)` 가 항상 `(0/N)` 으로 나오는 표시 결함과 역할별 overfill. SP2 가 fixed overfill 을 서버 H1 로 차단하고 fixed work_logs 를 만들었다. SP3 는 **표시를 단일 권위 소스로 정합**하고 **drift 원천(dead counter + 수동 카운터)을 제거**한다.

### 1.1 현행 카운터 지형 (실측 검증, 2026-05-25)

| 카운터                                               | 유지 방식                                                                        | 단위 / 의미                           | 상태                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| `schedule...timeSlots[].roles[].filled`              | **아무도 안 씀(dead)** + 클라 in-memory(`DateRequirementUpdater`)만 증감(미영속) | 역할별 확정 수(의도)                  | **dead — 항상 0, drift 원천**  |
| `stats.confirmedApplicants`                          | `fn_update_job_posting_stats` 트리거(applications status)                        | 현재 confirmed 인원                   | drift 없음                     |
| `filled_positions` / `stats.filledPositions`         | confirm/cancel RPC **수동 ±1**                                                   | 슬롯 점유 인원(completed 후에도 유지) | **drift 위험(수동)**           |
| `work_logs`(active 행) + `get_posting_filled_counts` | confirm INSERT / cancel DELETE                                                   | 역할 단위 확정 수(권위)               | **정상 — 역할 단위 권위 소스** |

핵심: **work_logs 가 역할 단위 권위 소스**다. hydrate RPC 가 이미 dated 에 대해 올바르게 집계한다. dead counter 는 일부 표시 경로가 잘못 읽는 탓에 0/N 을 낳는다.

### 1.2 표시 결함 잔존 (PR #139 이후)

| 형태             | 역할별 (filled/count) | 원인                                                                                             |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| dated / TBA      | ✅ 정상               | hydrate 사용                                                                                     |
| grouped 날짜범위 | ❌ 0/N                | hydrate 키가 단일 `wl.date` 인데 섹션은 범위 → `matchDate: undefined` → hydrate 스킵             |
| fixed            | ❌ 0/N (SP2 전)       | work_logs 부재. **SP2 로 work_logs 생김** → SP3 에서 표시 분기가 hydrate 를 안 받는 게 잔여 문제 |

### 1.3 왜 지금

prod 공고 2건(둘 다 dated), fixed 0, **schedule 에 잔류 `filled` 키 존재 가능**(생성 시 박힘) → 스키마에서 `filled` 제거 시 기존 doc 읽기 호환 처리 필요. 데이터 2건이라 마이그레이션 무위험.

---

## 2. 목표 / 비목표

### 목표 (SP3)

1. **dead counter `filled` 완전 제거**: 타입/zod/serialization/draftAdapter/stats/core/normalizers/`DateRequirementUpdater` 에서 `filled` 필드 삭제. schedule 은 정원(`count`)만 보유. 기존 doc 의 잔류 `filled` 는 마이그레이션 strip + deserialize 무시(읽기 호환).
2. **표시 단일 소스 = hydrate**: 모든 역할별 표시가 `get_posting_filled_counts`(work_logs 집계)에서 카운트를 읽는다. fixed 분기도 `filledCounts` 전달(SP2 work_logs 전제). **grouped 날짜범위** 키 매칭 수정.
3. **`filled_positions` 트리거化**: confirm/cancel RPC 의 수동 ±1 제거 → `applications` status 전이 트리거가 유지. drift 제거(`pitfall_denormalized_counter_drift` 표준). 의미 보존: "슬롯 점유 인원"(completed 후 유지).
4. **역할별 overfill + 0/N 최종 해소를 테스트로 고정**(fixed/grouped/dated 전부).

### 비목표

- `get_posting_filled_counts` 제거 — **하지 않는다**(A안: 권위 읽기). 원 로드맵의 "read-time RPC 제거"는 A안 결정으로 폐기.
- `kind` 판별자 제거(SP1 비목표 유지).
- fixed 생성 UI 정책 변경(가시성 게이트는 별도).

---

## 3. 핵심 설계

### 3.1 dead counter 제거 + 읽기 호환 (마이그레이션 안전성)

`filled` 를 타입/스키마에서 제거하면, **기존 prod doc 의 `roles[].filled` 잔류 키가 zod `.strict()` 를 위반**해 safeParse 탈락 → 공고 증발 위험(SP1 의 parseJobPostingDocument 게이트 함정과 동류).

**방어 3중**:

1. **마이그레이션(멱등)**: `job_postings.schedule` JSONB 의 모든 `requirements[].timeSlots[].roles[].filled` 키 strip(`#-` 또는 jsonb 재구성). 멱등(없으면 no-op). prod 2건.
2. **deserialize 선청소**: `deserializeJobPostingDocument` 가 zod 검증 전 단계 또는 역호환 흡수 코드에서 `filled` 를 드롭(잔류 doc 방어). 역할 zod 스키마는 `filled` 미포함 — 단 `.strict()` 가 역할 레벨에서 잔류 `filled` 를 거부하지 않도록, **deserialize 가 zod 게이트 앞에서 정규화**하거나 역할 스키마를 `filled` 무시로 설계.
3. **SP1 back-compat 갭 연계**: `parseJobPostingDocument`(repo 읽기 경로)가 레거시 `roleRequirements` doc 을 안전 흡수하도록 폴백 정리(SP1 미해결 갭). prod 0건이라 즉시 위험 0이나, SP3 스키마 재변경과 함께 read 폴백을 명시 처리한다.

> **결정 필요(플랜 단계)**: zod 역할 스키마를 `.strict()` 유지 + deserialize 가 사전 strip 하는 방식 vs 역할 스키마만 비-strict. **권장: deserialize 사전 strip**(스키마 엄격성 유지, 한 곳에서 호환 흡수). serialization.ts 의 기존 역호환 헬퍼(`buildFixedSyntheticRequirement` 등)에 strip 통합.

### 3.2 표시 단일 소스 = hydrate

- **`postingSurfaceModel.buildPostingScheduleModel`**:
  - **fixed 분기**(현재 `toRoleModels(fixed?.roles, undefined)` — ctx 없이 호출 → dead counter fallback): `filledCounts` 컨텍스트를 전달하도록 변경. fixed 키 = `'FIXED_SCHEDULE'__'NEGOTIABLE'(또는 '미정')__roleKey` (SP2 work_logs 와 정합). hydrate 서브맵에서 해당 키 조회.
  - **dated 분기**: 현행 유지(이미 hydrate).
  - **grouped 날짜범위 분기**(현재 `matchDate: undefined` → hydrate 스킵): 섹션의 날짜 범위(startDate~endDate)에 속하는 hydrate 엔트리들을 **slot+role 별로 합산**. RPC 변경 불필요(클라 only) — `extractPostingFilledSubmap` 결과를 범위 필터+합산하는 헬퍼 추가.
- **`toRoleModels`**: `role.filled ?? 0` fallback 제거. `filled` 가 타입에서 사라지므로 **hydrate 값만 사용**(hydrate 미스 시 0 — work_logs 부재 = 실제 0).
- **`getPostingRoleStats`(core.ts)** / **`stats.ts`**: `role.filled` 읽기 제거. 역할별 filled 합계가 필요한 표시는 hydrate 합으로 대체하거나, 해당 함수가 "정원만" 반환하도록 축소(소비자 점검).
- **`facts.ts` / `selectors.ts`**: `posting.filledPositions`(공고 총합, 트리거 유지) 기반 "공고 full" 판정은 유지. 역할별은 hydrate.

> **N+1 방어**: 리스트(home-jobs→JobList→JobCard) 는 SP2 이전부터 배치 1회 hydrate(`usePostingFilledCounts(ids)`) + `extractPostingFilledSubmap` 사용. SP3 도 동일 — fixed/grouped 도 같은 배치 맵에서 읽는다.

### 3.3 `filled_positions` 트리거化

- **단위 의미 보존**: 현행 `filled_positions` = confirm 시 +1, cancel 시 -1, **completed/cancellation_pending 전이엔 불변** → "확정돼 슬롯을 점유 중이거나 이미 근무 완료한 인원". 즉 `status IN ('confirmed','cancellation_pending','completed')` 집계와 동치(검증 필요).
- **트리거 설계**(`pitfall_denormalized_counter_drift` 표준):
  - 기존 `fn_update_job_posting_stats`(applications status 트리거)에 `filled_positions` 갱신을 **통합**(별도 트리거 추가보다 단일 트리거가 정합 쉬움). delta 계산:
    - counted 집합 `v_filled_statuses := ARRAY['confirmed','cancellation_pending','completed']`.
    - INSERT: NEW.status ∈ filled → +1.
    - DELETE: OLD.status ∈ filled → -1.
    - UPDATE: `(NEW ∈ filled) - (OLD ∈ filled)` delta. status 무변 early return.
  - `filled_positions = GREATEST(0, filled_positions + delta)` + `stats.filledPositions` 동기.
  - auto-close/재open 상태 전이(`closed ↔ active`)는 **현행 RPC/트리거 위치 확인 후 보존**(confirm RPC 의 close, cancel RPC 의 reopen 로직을 트리거로 옮길지 RPC 유지할지 플랜 결정 — 권장: 상태 전이는 트리거에서 `filled_positions` 와 함께 처리하되 회귀 주의).
- **RPC 수정**: `confirm_application`/`cancel_application_atomically` 의 `filled_positions`/`stats.filledPositions` **수동 갱신 라인 제거**(트리거가 담당 → 이중 갱신 금지). **단 confirm 의 application status='confirmed' UPDATE, cancel 의 status UPDATE 가 트리거를 발화**시키므로 카운터는 자동 갱신됨.
  - ⚠️ **순서/원자성**: 트리거는 같은 트랜잭션 내 AFTER UPDATE 로 발화 → RPC 반환 전 반영. RPC 반환 JSON 의 `new_filled_positions`(cancel) 는 트리거 후 값 재조회 필요(현행은 수동 계산값 반환 → 트리거化 후 `SELECT filled_positions` 재조회로 교체).
- **백필 마이그레이션**: 트리거 부착 전, 모든 공고 `filled_positions = (SELECT COUNT(*) FROM applications WHERE job_posting_id=... AND status IN filled)` 로 청산(기존 drift 제거). prod 2건.

### 3.4 `DateRequirementUpdater` 제거

- `updateDateSpecificRequirementsFilled` / `updatePostingScheduleFilled` (클라 in-memory `filled` 증감) — **통째 제거**. 표시는 hydrate, 카운터는 트리거. 소비자(confirm/cancel 후 낙관적 schedule 갱신) 호출부 제거 + 대체(refetch/invalidate hydrate 쿼리).
- 호출부가 낙관적 UI 갱신에 의존하면 `usePostingFilledCounts` 쿼리 invalidate 로 대체(TanStack Query).

---

## 4. 영역별 파일 (플랜에서 Task 분해)

| 파일                                                           | 변경                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/types/jobPosting.ts`                                      | `PostingSlotRoleRequirement.filled` 제거                                                    |
| `src/schemas/jobPosting.schema.ts`                             | 역할 스키마 `filled` 제거 (+ deserialize 사전 strip 전략)                                   |
| `src/domains/job-posting/serialization.ts`                     | `filled` 직렬화 제거 + 잔류 키 strip(읽기 호환)                                             |
| `src/utils/job-posting/draftAdapter.ts`                        | `filled` 매핑 제거                                                                          |
| `src/domains/job-posting/stats.ts`                             | `calculateFilledPositionsFromSchedule` 제거/축소 (filled_positions 는 트리거·컬럼 권위)     |
| `src/domains/job-posting/core.ts`                              | `getPostingRoleStats` 등 `role.filled` 읽기 제거                                            |
| `src/utils/normalizers/{scheduleNormalizer,roleNormalizer}.ts` | `filled` 읽기 제거                                                                          |
| `src/domains/application/DateRequirementUpdater.ts`            | **파일 제거** + 호출부 정리                                                                 |
| `src/domains/application/slotCapacity.ts`                      | `filled` 읽기 제거(클라 capacity 는 정원만; 실 enforcement 는 서버 H1)                      |
| `src/components/jobs/shared/postingSurfaceModel.ts`            | fixed/grouped 분기 hydrate 전달 + 범위 합산                                                 |
| `src/repositories/supabase/JobPostingRepository.ts`            | hydrate 키/서브맵 — fixed/grouped 지원(필요 시)                                             |
| `src/hooks/usePostingFilledCounts.ts`                          | invalidate 헬퍼(낙관적 갱신 대체)                                                           |
| 마이그레이션 1                                                 | schedule `filled` strip (멱등)                                                              |
| 마이그레이션 2                                                 | `filled_positions` 백필 + `fn_update_job_posting_stats` 확장(트리거 통합)                   |
| 마이그레이션 3                                                 | `confirm_application`/`cancel_application_atomically` 수동 카운터 갱신 제거(현행 본문 diff) |

---

## 5. 테스트 전략 (증거 기반)

### 5.1 동적 정합 증명 (execute_sql BEGIN/ROLLBACK, MCP, 메인만)

1. **역할별 0/N 해소**: fixed/grouped/dated 각각 확정 후 `get_posting_filled_counts` 가 올바른 역할별 카운트 반환 + 표시 모델(`buildPostingScheduleModel`)이 그 값을 노출(단위테스트로 표시 측).
2. **filled_positions 트리거 drift 없음 (Red-Green)**:
   - applied→confirmed: +1 / confirmed→applied(취소): -1 / confirmed→cancellation_pending: 불변 / cancellation_pending→cancelled: -1 / confirmed→completed: 불변 / completed→(delete): -1.
   - 각 전이마다 트리거 후 `filled_positions == COUNT(filled-status apps)` 동치.
   - RPC 수동 갱신 제거 전(이중) → 제거 후(단일·정합) Red-Green.
3. **overfill 차단 유지**(SP2 회귀 없음): fixed/dated 정원 초과 확정 거부.
4. 멱등: 마이그레이션 재적용 동일. schedule `filled` strip 두 번 = 동일.

### 5.2 단위(Jest)

- `postingSurfaceModel`: fixed/grouped/dated 모두 hydrate 값으로 역할별 filled 표시(스냅샷). grouped 범위 합산.
- `serialization`/`draftAdapter`: `filled` 제거 후 round-trip + 잔류 `filled` doc 읽기 호환(드롭).
- `DateRequirementUpdater` 제거 후 호출부 컴파일 + 동작(invalidate).
- 기존 테스트 회귀 갱신.

### 5.3 게이트

- `npm run quality` exit 0, `npm test` 전체 PASS (직접 실행 출력으로 증명).

---

## 6. 리스크 / 완화

- **R1 — schedule `filled` 제거로 기존 doc 읽기 실패**(zod strict). → 마이그레이션 strip + deserialize 사전 정규화 + 읽기 호환 테스트. prod 2건 선 검증.
- **R2 — filled_positions 트리거化 회귀**(이중 갱신 / 상태 전이 누락 / completed 의미 변질). → 현행 RPC 본문 diff, 전 전이 enumerate, Red-Green 동적 검증, 백필.
- **R3 — RPC 반환값 변화**(cancel 의 `new_filled_positions`). → 트리거 후 재조회로 교체 + 클라 소비자 점검.
- **R4 — grouped 범위 합산 오류**(중복/누락 합산). → 범위 경계 테스트(시작일/종료일 포함, 범위 밖 제외).
- **R5 — DateRequirementUpdater 제거로 낙관적 UI 깨짐**. → invalidate 대체 + 호출부 전수 점검(grep).
- **R6 — 통합 리뷰가 부품검사 통과 버그 적발**(SP1 전례: slotCapacity negotiable 키 회귀). → 마지막 `/review` adversarial 통합 리뷰 필수, 시간 지정/협의 양쪽 fixture.

---

## 7. 배포 메모

- 마이그레이션 prod 적용(MCP). fixed/grouped 0건이라 데이터 무위험.
- 모바일 반영 = EAS OTA / 웹 = Cloudflare 재배포 (별도 요청 시).
- SP1 미해결 back-compat 갭(parseJobPostingDocument)을 SP3 read 폴백으로 함께 해소 → SP1+SP2+SP3 일괄 배포 시 전환기 위험 제거.

---

## 8. 관련 메모리

- `project_schedule_schema_unification_sp1` — SP1 결과 + 로드맵 + back-compat 갭.
- `pitfall_posting_role_filled_dead_counter` — 원증상 + 잔여(grouped/fixed fallback) 분석 + RPC 회귀 함정.
- `pitfall_denormalized_counter_drift` — 트리거+delta 표준(이 SP 의 토대).
- `feedback_temp_defense_then_root_cause` — 임시방어→근본→방어제거 3단계(hydrate 임시방어를 카운터 정합으로 근본화).
- `pitfall_toast_confirm_behind_native_modal` — FIXED/TBA 키 정합.
- `feedback_supabase_migration_workflow` / `feedback_subagent_dispatch_guards` — MCP 메인 전용.
