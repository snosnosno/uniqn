# 좌석 기준 인원카운트 통일 — 설계 (2026-07-17)

## 1. 배경 / 문제

공고 인원카운트가 서로 다른 두 "기준(basis)"으로 계산돼 멀티데이 공고에서 어긋난다.

| 수치                    | 현재 기준                                          | 근거                                                                                |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 정원 `total_positions`  | **사람(peak)** — 역할별 "날짜/슬롯 간 최대치의 합" | `src/domains/job-posting/stats.ts:36-68`                                            |
| 확정 `filled_positions` | **사람** — 확정 1명당 +1                           | baseline `fn_update_job_posting_stats` `:2722-2795` / `add_direct_staff` `:766-775` |
| 역할별 확정 배지        | **좌석** — `work_logs` 행 COUNT                    | `count_posting_confirmed_by_slot` `:1400-1416`                                      |
| 슬롯 정원가드           | **좌석** — 슬롯별 초과 차단                        | `confirm_application` `:1323-1354`                                                  |

`total_positions`가 "peak(회전 가정)"이라, **날짜마다 다른 사람을 쓰는 대회 이벤트**에서 다음이 깨진다.

- **조기 정원마감**: "14~15일 딜러3"(총원 peak=3)에서 14일 3명 확정 → `filled(3) ≥ total(3)` → `capacity_full` 자동전이 → 15일은 0명인데 신규 지원 차단.
- **그룹 표시 오도**: 그룹 섹션 count=3(하루치)인데 filled=범위합산(최대 6) → "딜러 3명 (6/3)" 또는 14일만 확정 시 "3/3 취소선"인데 15일 공석.
- **이중 총원**: `facts.roleAvailability.totalCount`(좌석합=8)와 `total_positions`(peak=5)가 같은 객체에 공존(`facts.ts:80`, `stats.ts`).

## 2. 결정 (제품)

**좌석(seat) 기준으로 단일화한다.** (사용자 결정: 대회 이벤트 우선, "같은 사람이 여러 날짜 확정해도 모두 카운트")

- 확정 표시는 **좌석만**(사람 수를 헤더에 별도 노출하지 않음).
- 사람 단위 지표(`stats.confirmedApplicants` 등)는 **분석용으로 보존**하되 "확정" 라벨로는 쓰지 않는다.

### 새 계약(단일 정의)

| 개념                        | 정의                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **정원** `total_positions`  | 모든 `날짜 × 슬롯 × 역할` 인원의 **총합**(좌석). fixed 공고는 단일 requirement/slot의 역할 count 합. 컨테이너=0.                                                              |
| **확정** `filled_positions` | 활성 `work_logs` **행 수**(`status NOT IN ('cancelled','no_show')`). 컨테이너=0.                                                                                              |
| **정원마감**                | `total > 0 AND filled ≥ total` → `capacity_full`. `filled < total` → `active` 복귀. (슬롯 가드가 슬롯별 초과를 막으므로 등호는 **모든 슬롯이 찰 때만** 성립 → 조기마감 불가.) |

## 3. 변경 범위 (레이어별)

### 3.1 클라이언트

- **`stats.ts:calculateTotalPositionsFromSchedule`**: 역할별 **peak → 전체 합산**으로 변경. (같은 슬롯 내 동일 역할 합산 로직은 유지, 날짜/슬롯 간 `peak` 대신 `sum`.)
  - 이후 `facts.roleAvailability.totalCount`(이미 `getPostingRoleStats` 합산)와 `total_positions`가 일치 → 이중 총원 해소.
- **`serialization.ts`**(`:284-295,309,342`): 위 함수 결과를 그대로 저장 — 함수 외 변경 없음.
- **`postingSurfaceModel.ts:buildDatedScheduleModel` 그룹 분기**: 그룹 범위를 **날짜별 섹션으로 전개**한다.
  - 날짜 범위는 **헤더 라벨로만** 유지(`14~15일 (2일)`), 카운트는 **날짜별·역할별**(비그룹 다날짜 공고와 동일 렌더).
  - 각 날짜 섹션은 그 날짜의 `date__slot__role` 하이드레이트 키로 조회(현재 `sumHydrateForRange` 범위합산 제거).
  - **긴 범위(N일) 대비**: 기본 접힘 + "펼치기"로 날짜별 상세. 접힌 요약 줄은 역할별 좌석합(연인원) 표기. (요약 줄 세부 문구는 구현 시 확정.)
- 헤더/역할배지는 위 변경으로 자동 정합(별도 수정 없음).

### 3.2 DB (핵심 이전)

**목표: `filled_positions` 유지 주체를 applications 상태 트리거 → work_logs 트리거로 이전.**

1. **신규(또는 개편) work_logs 트리거** `AFTER INSERT OR DELETE OR UPDATE OF status ON work_logs`
   - 좌석 델타로 `job_postings.filled_positions` 갱신(`status NOT IN ('cancelled','no_show')` 진입/이탈 기준 ±1). `stats.filledPositions` 미러도 동일 갱신.
   - **컨테이너 SKIP**(`job_postings.status = 'container'`) — 기존 CHECK `chk_container_no_filled` 유지.
   - 갱신 후 `capacity_full ↔ active` 자동전이(현재 3곳 중복을 이 한 곳으로 통합).
2. **`fn_update_job_posting_stats`(applications 트리거)**: `v_filled_delta`/`filled_positions` UPDATE **제거**. 사람 지표(`totalApplicants/activeApplicants/confirmedApplicants/cancellationPendingApplicants`)만 유지. capacity_full 전이 블록 제거(work_logs 트리거로 이관).
3. **`add_direct_staff` / `remove_direct_staff`**: 인라인 `filled_positions +1/-1` 및 `v_already`/`v_remaining` 사람단위 게이트 **제거**(work_logs 트리거가 좌석으로 처리). 슬롯 정원가드·중복가드는 유지.
4. **`confirm_application`**: filled 관련 변경 없음(work_logs INSERT → 트리거가 +N 좌석). 슬롯 정원가드 유지. → 같은 사람 여러 날 확정 = 좌석 전부 카운트 ✅
5. **`cancel_application_atomically`**: filled 변경은 `DELETE work_logs`(scheduled) → 트리거가 감소. **`closed`(비-expired) → `active` 재개 로직은 이 RPC에 유지**(closed_reason 분기가 트리거 범위 밖). capacity_full 재개는 트리거와 중복되지 않도록 정리.

> ⚠️ **필수 사전작업**: `filled_positions`를 쓰는 **모든 경로 전수 grep** 후 사람단위 증감을 남김없이 제거(신규 트리거와 이중계상 방지). 최소 4곳: `fn_update_job_posting_stats`, `add_direct_staff`, `remove_direct_staff`, (cancel 경유 트리거).

**(선택) 하드닝**: `job_postings` BEFORE INSERT/UPDATE OF schedule 트리거로 `total_positions`를 schedule에서 서버 재계산 → 클라/DB 드리프트 원천 차단. 롤아웃 리스크를 크게 낮추므로 채택 권장.

### 3.3 백필 마이그레이션

1. `total_positions` = schedule JSONB에서 **좌석합 재계산**(requirements × timeSlots × roles의 count 합). fixed/dated 분기.
2. `filled_positions` = 공고별 활성 `work_logs` COUNT(컨테이너=0).
3. `status` 재평가(capacity_full/active).
4. pgTAP 레드-그린으로 백필 정확성 검증.

## 4. 롤아웃

- **클라(peak→합산)와 DB 마이그를 함께 출하**. 순서: **prod 마이그(백필+신 트리거) → OTA**.
- 순서 역전 시: 신클라가 편집한 공고 total이 잠시 구식이 될 수 있음 — 3.2의 (선택) 서버 재계산 트리거를 채택하면 이 리스크 소멸.
- ops/grid 미출시 + 라이브 확정 데이터 소량이라 백필 저위험. 마이그는 `mcp__supabase__apply_migration` 전용(`db push` 금지, 프로젝트 규약).

## 5. 테스트

- **jest**: `stats.ts`(합산), `postingSurfaceModel`(그룹 날짜별 전개 하이드레이트).
- **pgTAP(레드-그린)**: work_logs 트리거 좌석 델타(insert/직접추가/cancel/delete), capacity_full 좌석 전이, 컨테이너 SKIP, 백필 정확성. `person_basis_filled_positions.test.sql`은 **좌석 기준으로 재작성**(현재 DISABLED, S5 잔여와 통합).
- **E2E**: 멀티데이 서로 다른 스태프 확정 → 조기마감 미발생, 헤더/섹션/배지 정합.

## 6. 범위 밖 (후속)

- **확정 후 `postingFilledCounts` 30초 지연**: 확정 mutation에서 `POSTING_FILLED_COUNTS_QUERY_KEY` 무효화 1줄(별건 후속, `useConfirmedStaff.ts:139` 패턴 재사용).
- **사람 수 별도 표시**: 이번 범위 제외(좌석만). `stats.confirmedApplicants`는 데이터로만 보존.
- **부분확정 후 취소 시 `assignments` 원복 안 됨**(감사 이력 드리프트): 별도 사안.

## 7. 리스크

| 리스크                                      | 완화                                               |
| ------------------------------------------- | -------------------------------------------------- |
| 라이브 백필(두 컬럼 재계산)                 | pgTAP 검증 + 저트래픽 시간대 + 롤백 스냅샷         |
| filled 이중계상(구 사람단위 잔존)           | 전수 grep 체크리스트 + pgTAP 델타 테스트           |
| 클라/DB total 드리프트                      | 클라+마이그 동시 출하, (선택) 서버 재계산 트리거   |
| capacity_full 재개 로직 분산(closed_reason) | cancel RPC에 명시 유지 + 트리거와 책임 경계 문서화 |

## 8. 성공 기준

- "14일 딜러3 / 15일 딜러4·플로어1" → total=8, 각 날짜 섹션 좌석 정합, 8명 확정 전까지 마감 안 됨.
- "14~15일 딜러3"(그룹) → total=6, 14일 3명 확정 시 "14일 3/3, 15일 0/3"(오도 없음), 6명 전까지 마감 안 됨.
- 같은 사람을 14·15일 확정 → filled 2 증가.
- 구인자 직접추가 스태프 → 좌석 카운트 포함(컨테이너는 0 유지).
