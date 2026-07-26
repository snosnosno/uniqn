# 핸드오프 — 인원카운트(모집/확정) 전체 설계 분석 (다음 세션 메인 프롬프트)

> 작성 2026-07-23 · 작업 디렉토리 `uniqn-mobile/` · 브랜치 무관(분석 세션, 코드 변경 없음)
> 목적: **인원카운트가 표면마다 다르게 해석되는 구조를 전면 분석**하고, "그룹 날짜묶음 = 통좌석" 모델을
> 채택할지 판정한 뒤, PR-A(지원 화면 확정수 복구) + PR-B(카드 표기 통일)의 **단일 설계**를 확정한다.

---

## 0. 이 세션에서 할 일 (한 줄)

인원카운트 전체 설계를 **좌석 기준 SSOT 위에서 재검증**하고, 그룹 공고 표시 모델을 결정한 뒤
`/autoplan` 으로 PR-A·PR-B 통합 구현 계획을 산출한다. **코드 변경 없음 — 분석·설계·계획까지.**

---

## 1. 발단 (사용자 관찰)

공고카드에는 "8/22~8/23 딜러 10명 (0/10)", 공고상세에는 같은 날짜에 "딜러 5명 (0/5)".
→ 카드가 **그룹 내 날짜 수만큼 합산**해서 표기(하루 5명 × 2일 = 10). 상세는 하루치.
사용자 제안: **"묶인 날짜는 지원을 한 번에 받으니 0/5로 표시하고, 한 명이 그룹을 확정하면 그 자리는 다 채워진 것으로 본다."**

---

## 2. 이번 세션(2026-07-23)에서 이미 확인한 사실 — 재조사 불필요, 검증만

### 2.1 카드 합산은 의도된 계약 (버그 아님)
- `src/components/jobs/shared/postingSurfaceModel.ts:319-335` — 그룹 요약 슬롯: `count = perDayCount × dayCount`, `filled = 일별 hydrate 합`.
- 곱셈을 없애면 `filled`(일별 합)와 분모 차원이 어긋남 → 과거 `6/3` 버그 재발. 테스트가 계약 고정: `src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts:87-94`.
- 카드/상세 분기: `src/components/jobs/shared/PostingScheduleContent.tsx:104` (`display==='detail'` → `section.days` 전개, 아니면 `section.timeSlots` 요약).

### 2.2 DB는 처음부터 끝까지 "날짜별 좌석" 단일 모델 (일관됨)
| 대상 | 산출 | 위치 |
|---|---|---|
| `work_logs` 1행 | 좌석 1개 = (공고,날짜,슬롯,역할,스태프) | 유일 진실원 |
| `total_positions` | Σ(날짜×슬롯×역할 count) | `_total_positions_from_schedule` — `supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql:22` |
| `filled_positions` | work_logs 델타 | `fn_sync_filled_positions_seat` (같은 파일 :73) |
| `capacity_full` 전이 | filled≥total | `fn_recalc_total_and_capacity` BEFORE 트리거 (:38) |
| `MAX_CAPACITY_REACHED` | **날짜×슬롯×역할** 단위 | confirm/add 동일 (:277, `..._followup.sql:114`, `..._grid_..._hardening.sql:117`) |
| 확정 hydrate | (date, slot_key, role_key) | `count_posting_confirmed_by_slot` — `20260710000002_baseline_schema_from_prod.sql:1400`, cancelled·no_show 제외 |
| `schedule.roles[].count` | **하루치** 모집 인원 | 주문서 저장값 |
| `schedule.roles[].filled` | **dead counter, 0 고정** | SP3 폐기 |
| 클라 총원 | 좌석 총합 | `calculateTotalPositionsFromSchedule` — `src/domains/job-posting/stats.ts:37` |
| 마감판정 | `filled_positions` 컬럼 권위 | `getClosingStatus` — `src/utils/job-posting/dateUtils.ts:208` |

→ **흔들리는 건 전부 클라 표시 계층. DB·서버 가드는 손댈 필요 없음.**

### 2.3 dead counter 전제가 지원 경로에서만 붕괴 (= PR-A 뿌리)
- SP3: `roles[].filled`를 0으로 누르고 "표시 시점 hydrate가 덮어쓴다"고 못박음
  (`src/utils/normalizers/scheduleNormalizer.ts:30-31`, `src/utils/normalizers/roleNormalizer.ts:34-35`).
- hydrate 주입 소비처는 **4곳뿐**: `JobCard` · `JobDetail.tsx:85` · employer `JobPostingCard` · `useShare`.
- **지원 화면(`AssignmentSelector.tsx:50` → `useJobSchedule`)만 hydrate 미주입** → `filledCount` 항상 0.
  - `RoleCheckbox.tsx:15-16,47` — `isRoleFilled` = `0>=5` = 항상 false → "마감" 배지·비활성 절대 안 뜸, 표시 항상 `(0/N)`.
  - `ApplicationValidator.ts:35` — `filledByRole` 미주입 → `isAvailable` 항상 true → 클라 가드도 무력.
- **단, 서버 가드가 초과 확정은 막음** → 데이터 무결성은 안전. 이건 **UX 결함**(지원자가 이유 없이 확정 안 됨).

### 2.4 불균등을 만드는 경로 3개 실재 (min 규칙이 필수인 이유)
1. **그리드 직접배치** — `add_direct_staff`는 "단일 배정만 생성"(`src/components/weeklyGrid/addSlotPayload.ts:82`). 특정 날짜 한 칸에만 work_logs 1행.
2. **사업주 부분 확정** — `confirm_application(p_assignments)`은 보낸 배정만 확정. UI(`GroupedAssignmentSelector.tsx:144,290`)는 날짜별 개별 체크박스.
3. **취소/노쇼** — `work_logs.status` 날짜별 변동.
→ "그룹 = 한 자리"를 단순 적용하면 8/22=1명·8/23=0명 같은 불균등에서 거짓 표시. **그룹 좌석 잔여 = min(날짜별 잔여)** 로 정의하면 정상 상황은 제안대로(0/5→1/5), 불균등은 "지원 차단" 쪽으로 안전하게 붕괴.

### 2.5 ops는 무관
`ops_import_staff_from_posting`은 work_logs를 **읽어** 스냅샷만 만듦(`OpsStaffRepository.ts:56`). 공고 카운트 변경 경로 없음.

### 2.6 DB에 "그룹 좌석" 개념 없음 (중요)
`work_logs.assignment_group_id`는 그룹 식별자가 **아니라** 그 날짜의 timeSlot id
(`AssignmentSelector.tsx:39` — `schedule.timeSlots.find(...)?.id`). 날짜마다 값 다름.
→ **"이 사람이 그룹을 통째로 잡았다"를 DB에서 식별 불가.** 제안 모델은 **표시 레이어 파생으로만** 구현 가능.
→ **그래서 DB 변경 불필요**하다는 근거이기도 함.

### 2.7 그룹 경계 알고리즘이 두 화면에서 다름 (별개 결함 ③)
- 카드/상세: `src/utils/date/grouping.ts:209` — `role`+`headcount`까지 비교해 묶음.
- 지원 화면: `src/utils/assignment/selectionUtils.ts:22-24` (`getRoleStructureKey`) — **역할 종류만** 비교, headcount 무시.
→ "8/22 딜러5 + 8/23 딜러3"이 지원 화면엔 한 그룹(대표=첫날5), 카드엔 별개 그룹. **같은 공고 그룹 경계가 화면마다 다름.**

### 2.8 부수 발견
- `src/utils/job-posting/dateUtils.ts:215` 주석 "역할별 peak의 합" = **stale**(실제는 좌석 총합, `stats.ts:35`가 "구 peak 모델 대체" 명시). 정정 대상.
- **container 공고**는 카운트 예외 축: `status='container'` → `total_positions=0` + 좌석 트리거 SKIP + 정원가드 `v_capacity=0` 우회(그리드 자유슬롯). **그룹 좌석 로직이 container에 닿지 않도록 가드 필요.**

---

## 3. 이 세션이 답해야 할 설계 질문

1. **그룹 표시 모델 확정**: "그룹 = 통좌석(하루치 표기 + min 잔여)" vs "현행 합산(N×일수)" — 어느 쪽? 사용자는 통좌석 선호. 3렌즈(구직자·홀덤펍 사장·대회사 운영팀)로 판정.
2. **`count` 필드 차원 겸직 해소 방법**: `perDayCount`/`dayCount` 필드 분리 vs 통좌석 채택 시 곱셈 자체 제거(카드도 하루치). 통좌석이면 PR-B의 `5명/일` 문법 자체가 불필요해짐 — 이 상호작용을 반드시 반영.
3. **불균등 표기 규칙**: min 잔여일 때 "일부 날짜 마감" 보조 라벨을 낼지, 낸다면 카드/상세/지원 어디에.
4. **그룹 경계 통일(③)**: `getRoleStructureKey`에 headcount 반영 — 이 PR에 포함 vs 분리.
5. **container 가드** 배치 지점.
6. **PR 분할**: PR-A(지원 확정수 복구+가드) / PR-B(표기 통일) / ③ 경계통일 — 몇 개로, 어떤 순서로.

---

## 4. PR-A 우선순위 판정 (이번 세션 결론 — 재확인만)

**"언젠가 반드시, 지금은 아님."**
- 서버 가드가 초과 확정 차단 → 데이터 안전. 무결성 결함 아님, **UX 결함**.
- 실사용자 0 (메모리 `project_supply_launch_v1_20260718`) → 당장 헛지원할 사람 없음.
- 그룹 좌석 모델이 PR-A 핵심 로직인데 미확정 → 지금 하면 재작업.
- **런칭 전까지는 반드시** (지원자가 이유 없이 확정 안 되는 경험 차단).
- **권장 순서: 인원카운트 설계 확정 → PR-A + PR-B를 그 설계 위에서 통합 구현.**

---

## 5. 산출물

1. 인원카운트 전체 설계 문서 (`docs/planning/2026-07-2X-headcount-count-design.md`) — 표시 모델 결정 + 근거.
2. `/autoplan` 통합 구현 계획 (PR-A + PR-B + ③, 레이어별·순서·테스트 전략).
3. RED 테스트 후보 목록: (a) `AssignmentSelector`에 확정 5/5 주입 → `RoleCheckbox` 비활성+"마감" 단언(현행 반드시 실패), (b) 그룹 min 잔여, (c) 그룹 경계 headcount 반영.

---

## 6. 금지·주의
- **코드 변경 금지** (분석·설계·계획 세션). 구현은 계획 승인 후 별 세션.
- DB/서버 가드는 이미 좌석 기준으로 정합 — **마이그레이션 신규 작성 불필요** (2.2·2.6 근거). 손대려면 강한 근거 제시.
- `mcp__supabase__*` 직접 호출·기존 마이그레이션 수정·PROD 우회 금지 (전역 오케스트레이션 규칙).
- 판정·설계·계획 서브에이전트는 `model: fable` (모델 3계층 라우팅). 광역 탐색은 Explore(sonnet).
- 완료 주장 전 실행 증거 (전역 verification). 이 세션은 설계라 "계획 산출물 존재"가 증거.

---

## 7. 착수점
1. 이 문서 정독 → §2 사실을 코드에서 **스팟 검증**(라인 이동 가능성).
2. `/query order-sheet-unification` · `/query seat-basis` 로 기존 결정 회수.
3. §3 6개 질문에 3렌즈로 답 → 설계 문서 초안.
4. `/autoplan` 으로 통합 계획.
