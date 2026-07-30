# 근무표·내 스케줄 재설계 — 다음 세션 설계 프롬프트

> 작성: 2026-07-28 · 선행 세션에서 **코드 실측 완료**, 사용자 결정 3건 확정
> 산출물: 아티팩트 <https://claude.ai/code/artifact/ce09c9c1-eb1a-4de1-8a67-52e812f11298>
> 이 문서는 **설계 세션 착수용**이다. 아래 "이미 확인된 사실"은 재조사하지 말 것.

---

## 다음 세션에 붙여넣을 프롬프트

```
UNIQN 근무표·내 스케줄 재설계 작업이다.
docs/planning/2026-07-28-venue-schedule-redesign-handoff.md 를 먼저 읽어라.

이전 세션에서 코드 실측과 사용자 의사결정이 끝났다. 재조사 금지 —
그 문서의 "이미 확인된 사실"은 file:line 까지 검증된 것이다.

이번 세션 범위: **1-B** (§작업 묶음 3기 분해 참조).
- ✅ 1-A 는 **이미 완료**됐다 — 마이그 `venue_role_salaries_exclude_cancelled` prod 적용(prod version `20260728102907`),
  master 머지 `c5180cab8`(PR#363), 브랜치 `fix/venue-salary-rpc-status-filter` 삭제됨. (2026-07-31 실측)
- 1-B = 지점 프로필 DB — RPC 2개 신설 (⚠️ '내 팀' rename 마이그는 **3-D 로 분리됨**, 여기서 하지 말 것)

※ 다른 묶음을 진행하려면 위 "이번 세션 범위" 줄만 해당 ID 로 바꿔 쓴다.
   순차 진행이 기본이다 — 병렬은 '별도' 항목(별-1·별-2)만, 그때도 워크트리 격리.

/autoplan 으로 묶음 1 구현 계획을 세우되, 설계 판정은 model:"fable" 서브에이전트에
위임하라. 계획 승인 전 코드 작성 금지(HARD-GATE).

⚠️ 착수 전 필수:
1. git status — 내가 만들지 않은 미커밋 변경 있으면 워크트리 격리
2. ✅ 미적용 마이그 없음 (2026-07-31 `list_migrations` 실측 — prod 최신 = `20260728102907`).
   그래도 착수 시점에 다시 확인할 것. 대기 마이그가 있으면 재정의 베이스 사고가 난다.
3. 마이그 재정의 시 베이스는 "가장 최근 정의"여야 한다:
   grep -l "CREATE OR REPLACE FUNCTION <name>" supabase/migrations/*.sql | sort | tail -1
```

---

## 이미 확인된 사실 (재조사 금지 — file:line 검증됨)

### A. 뿌리 원인 — 지점 정보가 스태프에게 전달되지 않는다

| 사실 | 근거 |
|---|---|
| `createScheduleContainerContext(roleSalaries, title?)` 의 `title` 인자를 **호출부 2곳 모두 생략** → `'이벤트'` 폴백 | `services/work/scheduleService.ts:160`, `:647` / 선언 `domains/schedule/ScheduleConverter.ts:64` |
| 같은 함수가 `location: ''` 하드코딩 → 상세 모달 "장소 : -" | `ScheduleConverter.ts:70` · 소비 `components/schedule/tabs/InfoTab.tsx:241` |
| 스태프는 RLS 상 `status='container'` 공고를 직접 못 읽음 → SECDEF RPC 가 유일 경로 | `scheduleService.ts:150-154` 주석 |
| **`job_postings` 에 `location`(Json)·`contact_phone`·`description` 컬럼이 이미 존재** | `types/supabase.ts` job_postings 블록 |
| `get_or_create_venue_container` 가 INSERT 시 위 3컬럼을 **안 채움** | baseline `20260710000002_baseline_schema_from_prod.sql` |

→ **신규 테이블·컬럼 추가 불필요.** 기존 컬럼을 채우고 전달 경로만 뚫으면 된다.

### B. 지점 이름 변경 수단이 없다

- rename RPC 부재. `VenueSettingsSheet.tsx:6` 주석: *"v1 범위: 단가표만(지점 이름 변경 등 기타 설정 제외)"*
- 🔴 **unique 인덱스 존재**: `ON CONFLICT (workspace_id, lower(title), (schedule->>'kind')) WHERE status='container'`
  → rename 시 23505 가능. 명시적 에러 처리 필수.
- 기본명 3중 불일치:
  | 위치 | 값 |
  |---|---|
  | `hooks/workspace/useEnsureDefaultWorkspace.ts:20` | `'내 팀'` |
  | `services/workspace/workspaceService.ts:91` | `'내 팀'` |
  | `app/(employer)/workspace/index.tsx:125` | `` `${displayName} 팀` `` |
- 지점은 `useEnsureDefaultVenue` 가 **워크스페이스명을 그대로 복사** → 팀·지점이 둘 다 "내 팀"

### C. `get_my_venue_role_salaries` 를 확장하면 안 되는 이유

```sql
CROSS JOIN LATERAL jsonb_array_elements(... roleSalaries ...)
```
`roleSalaries` 가 빈 배열이면 **행 0개**. 즉 단가 미설정 신규 지점은 title/location 도 못 받는다.
`LEFT JOIN LATERAL` 로 바꾸면 salary NULL 행이 생겨 기존 파서(`JobPostingRepositoryVenue.ts:88`)가 깨진다.
→ **`get_my_venue_contexts(uuid[])` 신규 RPC** 가 정답.

### D. 시간 축 — 두 편집기는 중복이 아니다

| | `EditSlotSheet` (카드 본문 탭) | `WorkTimeEditor` ("시간 수정" 버튼) |
|---|---|---|
| 대상 | `time_slot` (**예정**) | `check_in_time`/`check_out_time` (**실제**) |
| 부가 | 역할·색상·메모 | 사유 필수 + `modification_history` |
| 정산 | 무관 | 금액 직결 |
| 잠금 | 없음 | 정산완료 시 차단 (`VenueDayPanel.tsx:139`) |
| **스태프 알림** | ❌ **안 감** | ✅ 감 |

- 🔴 **`time_slot` 쓰기 경로는 `updateSlot` 단 하나** (`WorkLogRepositoryVenue.ts:112`).
  공고 경로에는 예정시간 수정 수단이 **아예 없다**.
- 🔴 **알림이 거꾸로다**: 트리거 `notify_on_work_log_update` Case 2 는 `modification_history`
  배열 길이 증가로만 발화(baseline `.sql:5545`). `updateSlot` 은 이력을 안 써서 무음.
- `WorkTimeEditor` 사용처 3곳: `StaffManagementTab.tsx:347`, `VenueDayPanel.tsx:350`,
  `SettlementModals.tsx:147`

### E. 자동 출퇴근은 제거 불가

`resolveWorkTimeStatus`(`repositories/supabase/workLogTimeStatus.ts:64`)가 시각→status 파생.
근거: CHECK 제약 `work_logs_status_timestamp_consistency` — 시각을 넣고 status 를 안 바꾸면
UPDATE 전체가 23514 로 거부(`:59` 주석). **입구 경고로만 완화**한다.

QR 경로가 `time_slot` 시작시각으로 대상 work_log 를 고른다(`services/work/selectWorkLogForQR.ts`)
— 예정 시간은 QR 동작의 입력이라 제거 불가.

### F. 정산

- 지점 정산은 **읽기 전용이 의도된 상태**: `app/(employer)/venue-settlements.tsx:66-67`
  *"컨테이너 정산 mutation 미배선이라 노출하지 않는다 — half-wired 파괴 액션 회피"*
- `useSettleWorkLog` 존재, `my-postings/[id]/settlements.tsx:79` 에만 배선 → **재사용 가능**
- `payrollStatus` 참조 = **소스 36파일 110곳** (테스트 제외). 전면 제거 위험 → UI 어휘만 2단 축소
- 죽은 상태 2종:
  - `'processing'` = **DB enum 에 없는 UI 전용값**(`schemas/schedule.schema.ts:44`).
    파생처 `GroupedSettlementCard.tsx:251` 1곳
  - `'failed'` 참조 `scheduleService.ts:326` 1곳(예정액 집계 제외)

### G. 이미 있는데 몰랐던 기능

- **공고 템플릿**: `useTemplateManager` / `TemplateModal` / `job_posting_templates`
  → `create.tsx:81`, `[id]/edit.tsx:52`, `create-success.tsx:39` 에 배선 완료
- 지점 프로필과 **다른 축**이므로 공존. 순서 = 지점 프리필 → 템플릿 덮어쓰기

### H. 색상

`domains/workSchedule/slotEdit.ts:55` `SLOT_COLOR_CHIPS` 15종이나 실구성 = 골드4 + 그레이/뉴트럴7 + 시맨틱4.
**구분되는 색은 사실상 4개.** 변경 지점은 이 파일 하나(`SLOT_COLOR_TOKENS` + `CHIPS` + `assertSlotColor` 파생).
⚠️ 토큰 제거 시 기존 저장값이 `slotColorSwatchClassName` 에서 null → **색이 조용히 사라진다.** 하위호환 필수.
⚠️ 시맨틱색을 배치색으로 쓰면 상태 배지와 충돌 (impeccable §3 60-30-10, §31 양테마 대비).

### I. 내 스케줄 필터 삭제 시 연쇄

`statusFilter` 소비 3곳: `schedule.tsx:390`(리스트) `:466`(캘린더 dot) `:470`(선택일 카드).
**`unpaid` 축이 미지급 근무를 찾는 유일한 경로** → 단순 삭제 금지, 접힌 대시보드 안으로 이동.
⚠️ `e2e/` 는 `npm run quality` 범위 밖 — 필터 관련 셀렉터 별도 Grep 필수.

---

## 사용자 확정 결정 3건 (2026-07-28)

| # | 질문 | 결정 | 따라오는 필수 조건 |
|---|---|---|---|
| 1 | 공고 근무도 예정시간 수정 허용? | **예** | 변경 시 **즉시 알림 + 이력**(이전값 병기). 구직자가 **취소 요청**할 수 있는 경로 필수. 공고 계약 시간이므로 무음 변경 절대 금지 |
| 2 | 지급완료 체크 시 스태프 알림? | **예** | 일괄 체크는 **묶어서 1통**. **체크 취소 시 알림 없음**("받았다→안받았다" 통보 금지) |
| 3 | 기존 '내 팀' 일괄 rename? | **예** | **미변경 기본값만** 대상(사용자가 지은 이름 불가침). unique 충돌 **사전 카운트**. 대상자에게 **1회 인앱 안내** |
| 4 | 지점 설정에 기본 근무시간 넣나? | **아니오** | 지점 프로필에서 **제외**. 시간은 **인원 추가·공고 작성 때마다 명시 입력**. 아래 §J 참조 |

> ⚠️ 1번과 3번은 선행 세션 추천과 **반대 방향**이다. 사용자가 재확인했으므로 그대로 진행하되,
> 위 조건을 빼먹으면 결정의 전제가 무너진다.

### K. 시간 모델 정본 확정 — "출근=약속(사전), 퇴근=실적(사후)" (2026-07-31)

> 🔴 **§J 의 "AddSlotSheet 에 시작+종료 둘 다 입력" 지침은 폐기됐다.** 아래가 정본이다.

**`time_slot` 한 컬럼에 5가지 의미가 공존한다 (실측):**

| 생성 경로 | 저장 형식 | 근거 |
|---|---|---|
| 공고 지원·확정 | **출근 시각 단일값** `'19:00'` | `types/assignment.ts:66,75` |
| 근무표 인원 추가 | **출근 시각 단일값** | `addSlotPayload.ts:8` 주석 |
| 근무표 근무 수정 | **범위** `'18:00 - 02:00'` | `slotEdit.ts:187` `composeTimeSlot` |
| 고정공고 | `'NEGOTIABLE'` | `types/assignment.ts:22` |
| 미정 | `'미정'` 또는 미기록 | `types/assignment.ts:25` |

→ **다수가 이미 단일값이고 `EditSlotSheet` 하나만 범위다.** 정본은 단일값.

**확정 규약**

| 컬럼 | 의미 | 형식 |
|---|---|---|
| `time_slot` | **출근 예정 시각만** | `'HH:mm'` 단일값 또는 미기록(=미정) |
| `check_in_ts` | 실제 출근 | timestamptz (QR 또는 수동) |
| `check_out_ts` | 실제 퇴근 | timestamptz (QR 또는 수동) |

- **범위 저장 폐지.** `composeTimeSlot` 의 슬롯 쓰기 소비를 끊는다.
  `parseTimeSlotParts` 는 **기존 데이터 읽기 하위호환으로 유지**(이미 저장된 범위가 있다).
- 출근·퇴근 **둘 다 언제든 수정 가능** (정산 체크 전까지).
- ⚠️ **트레이드오프**: 예정 종료가 없으면 근무 전 예상액 계산 불가.
  → 직접 배치는 금액 대신 **"계산 전"** 표시, 공고는 공고 시간대로 예상액 유지. (미결정 1)

**QR — 이미 견고, 표시만 보강**
- `process_qr_checkin_atomically`(최신 `20260727160000_qr_checkin_status_whitelist.sql`)
  - `p_action='auto'` → `checked_in` 이면 퇴근, 아니면 출근
  - 클라 시각 ±5분 초과 편차 시 서버 `now()` 로 클램프
  - 화이트리스트 `('scheduled','no_show')` — `no_show` 는 **의도적 구제 경로**
- 보강: **QR 기록 vs 수동 수정 구분 표시**(`19:04 ✓QR`). 근거 추적용.

**자동 퇴근 — 만들지 않는다 (설계 결정)**
- 🔴 실측: 크론 11종에 **미퇴근 정리 잡 없음**(`20260710000003_baseline_platform_glue.sql:167-201`).
  퇴근 미기록 → `checked_in` 영구 잔류 → 정산 게이트(`status IN checked_out|completed`)에 영영 미도달.
- 자동으로 시각을 넣으면 **없던 근무시간·금액이 생긴다** → 금지.
- **대체 3단 안전망**:
  1. 출근 1시간 전 리마인드 (`services/work/shiftReminderScheduler.ts` **이미 존재** — 재사용)
  2. 출근 +12시간 미퇴근 → 스태프 푸시 (미결정 2: 시간값)
  3. 근무표에 **"퇴근 미기록 N건"** 배지 + 정산 화면에 "퇴근 시간을 입력해야 계산됩니다"

**공고 시간 수정 — 두 축 분리 (결정 1 구체화)**

| 축 | 영향 범위 | 알림 |
|---|---|---|
| 공고 전체 시간 변경 | 확정 **전원**의 work_log | 전원 |
| 개인 시간 변경 | 해당 1건 | 본인만 |

지금은 둘 다 불가. 근무표 직접배치만 개별 수정 가능.

⚠️ **규약 충돌 발견**: `AddStaffModal.tsx:69` 는 `timeSlot` 을 **자유 텍스트**로 받는다.
반면 `addSlotPayload.ts:9` 는 *"자유 텍스트 시간 입력은 부활 금지 — 피커의 0패딩 'HH:mm' 만 통과"*.
통합 시 `AddStaffModal` 을 피커로 전환할 것.

**고정공고는 시간 모델 대상 외**
`time_slot='NEGOTIABLE'`, 앱 지원 비대상이 확정 정책(PR#355, `public/guide.html:780` 공표).
QR·리마인드·자동처리 설계에서 제외하고 "시간 협의" 표시만 유지.

**결정 5·6 확정 (2026-07-31)**
- **직접 배치는 예상 금액 미표시** — 퇴근 전까지 "계산 전". 공고 근무는 예상액 유지(공고에 시간대가 있음)
- **퇴근 리마인드 없음** — 스태프에게 독촉 안 보냄. 안전망은 **구인자 근무표 "퇴근 미기록 N건" 배지 하나뿐**이므로 필수
- **출근 리마인드는 `day-before` 하나만** 유지, `hours-before` 제거
  - 🔑 실측: `services/work/shiftReminderPlan.ts:15,17` 에 이미 2종 —
    `DAY_BEFORE_HOUR=20`(전날 20시), `HOURS_BEFORE_START=2`(2시간 전)
  - ⚠️ **"정확히 24시간 전" 으로 바꾸지 말 것** — 새벽 2시 근무면 전날 새벽 2시에 발송된다.
    `DAY_BEFORE_HOUR=20` 고정이 결과적으로 "하루 전"이면서 취침 시간을 피한다. **현행 유지가 정답.**

---

### J. 결정 4 — 시간 기본값 전면 제거 (2026-07-28 추가, 일부 §K 로 대체)

**지점 프로필에서 `venueProfile.defaultTime` 을 빼고, 시간 입력 기본값 자체를 없앤다.**

이건 취향이 아니라 **문서화된 함정의 근본 해결**이다 — `EditSlotSheet.tsx:88-92` 주석:
> *"시간 미정 슬롯을 열면 startTime/endTime 은 화면을 그리기 위한 기본값(18:00~02:00)으로
> 채워질 뿐 실제 저장된 값이 아니다. 이걸 그대로 저장하면 색상·메모만 고치려던 사용자가
> 8시간 근무를 확정시켜 정산 금액까지 오염시킨다."*

현재 상태(실측):

| 위치 | 지금 | 바꿀 것 |
|---|---|---|
| `domains/workSchedule/slotEdit.ts:110` | `DEFAULT_SLOT_START_TIME = '18:00'` | 슬롯 경로 소비 제거 (상수 자체는 §아래 주의 참조) |
| `AddSlotSheet.tsx:64,136` | `useState(DEFAULT_START)` 프리필 | **빈 값 시작.** 출근시간 하나만 받는 현행 구조는 §K 정본이므로 **유지** |
| `EditSlotSheet.tsx:57-58` | `DEFAULT_START` / `DEFAULT_END='02:00'` | **종료 입력 자체를 제거**(§K). 출근 예정 단일 칸 + 실제 출퇴근 섹션으로 재구성 |
| 저장 게이트 | 없음 | **시간 선택 or '미정' 체크 전까지 저장 비활성** |

- ✅ `AddSlotSheet` 가 **출근시간 하나만** 받는 것은 결함이 아니라 **정본**이다(§K). 종료를 추가하지 말 것.
- ⚠️ `DEFAULT_SLOT_START_TIME` 은 `utils/order-sheet/mappers.ts:505`(주문서→공고 변환)도 소비한다.
  **그쪽은 다른 맥락**이므로 상수를 지우지 말고 슬롯 경로의 소비만 끊을 것.
- '미정'은 **명시 선택**으로만 도달한다 → 구직자 화면에 "출근 시간 미정 · 정해지면 알려드려요"(⑨⑩)로
  정직하게 표시되고, `WorkTimeDisplay` 의 `'미정'` 문자열이 비로소 진짜 의미를 갖는다.
- 공고 작성 경로도 동일 규칙 적용 — 시간 미입력 저장 금지.

---

## 작업 묶음 — 3기 분해 (2026-07-31 점검 후 수정본)

> ⚠️ **이전 "11개 트랙 + 병렬 3워크트리" 안은 폐기.** 점검에서 4개 결함이 나왔다:
> ① B1/C2 분리 시 예정액 조용히 0원 ② 최고 우선 문제(E1)가 맨 뒤 ③ B2 과대 ④ 되돌리기 어려운 것이 앞에.

원칙: **1 묶음 = 1 세션 = 1 브랜치 = 1 PR**. **순차 진행 기본**, 병렬은 '별도' 항목만.

### 1기 — 보이게 만들기 (완료 시 "이벤트·장소 —" 소멸)

| ID | 범위 | 주요 파일 | 규모 |
|---|---|---|---|
| ~~**1-A**~~ | ✅ **완료(PR#363 `c5180cab8`, prod 적용)** — 마이그 `20260728185802_venue_role_salaries_exclude_cancelled` | — | — |
| **1-B** | 지점 프로필 **DB** — `update_venue_container` · `get_my_venue_contexts` 신설. **rename 마이그 제외** | `supabase/migrations/`, pgTAP | 중 |
| **1-C** | 지점 설정 화면 **+ 구직자 표시** (구 A2+A3 병합) | `VenueSettingsSheet.tsx`, `venueContainer.ts`, `useEnsureDefaultVenue.ts`, `useEnsureDefaultWorkspace.ts:20`, `workspaceService.ts:91`, `workspace/index.tsx:125`, `scheduleService.ts:160,647`, `ScheduleConverter.ts:64`, `JobPostingRepositoryVenue.ts`, `InfoTab.tsx`, `NextShiftCard.tsx` | 중 |

> 🔑 **1-C 를 쪼개지 말 것** — 입력(A2)만 배포하면 넣어도 안 보이고, 표시(A3)만 배포하면 보일 게 없다.
> **1기 종료 = 배포 + 실기기 QA 게이트.**

### 2기 — 시간 바로잡기

| ID | 범위 | 주요 파일 | 규모 |
|---|---|---|---|
| **2-A** | 시간 저장 규약(§K) **+ "계산 전" 표시** | `EditSlotSheet.tsx`, `AddSlotSheet.tsx`, `slotEdit.ts`, `addSlotPayload.ts`, `AddStaffModal.tsx:69`, `SettlementCard.tsx`, `settlementVenueQuery.ts`, `ScheduleCard.tsx`, `scheduleService.ts:300-330` | 중 |
| **2-B** | 근무 수정 창 통합 — **근무표 경로만** | `EditSlotSheet.tsx`, `VenueDayPanel.tsx`, `ConfirmedStaffCard.tsx` | 중 |
| **2-C** | 출근 예정 변경 알림 배선 | `WorkLogRepositoryVenue.ts:112`(이력 기록), 알림 트리거 | 소 |
| **2-D** | 구직자 카드 출근시간 3상태 | `ScheduleCard.tsx`, `NextShiftCard.tsx`, `WorkTimeDisplay.ts`, `InfoTab.tsx` | 소 |

> 🔴 **2-A 는 반드시 한 PR** — 종료 제거(`time_slot` 단일화)만 배포하면 `calculateSettlementBreakdown`
> 이 duration 을 못 내 **"정산 예정(추정)" 이 조용히 0원**이 된다. 이 프로젝트에 동일 사고 이력 있음
> (`project_posting_domain_audit_w1_20260728` — "내 변경이 master 신규 테스트를 죽임(예정액 0원화)").
> **2기 종료 = 배포 + 실기기 QA 게이트.**

### 3기 — 나머지 (되돌리기 어려운 것 전부 여기로)

| ID | 범위 | 주요 파일 | 롤백 | 규모 |
|---|---|---|---|---|
| **3-A** | 정산 2단 축소 + 지점 정산 확정 배선 + 지급 알림 | `venue-settlements.tsx`, `statusConfig.ts:166`, `GroupedSettlementCard.tsx:251`, `scheduleService.ts:326`, `useSettlement.ts` | 알림 **회수 불가** | 중 |
| **3-B** | QR 표시 보강 + 퇴근 미기록 배지 + 리마인더 정리 | `ConfirmedStaffCard.tsx`, `work-schedule.tsx`, `venue-settlements.tsx`, `shiftReminderPlan.ts:17` | 쉬움 | 중 |
| **3-C** | 공고 시간 전체/개인 2축 | 신규 RPC + `StaffManagementTab.tsx` | **설계 미완** | 대 |
| **3-D** | '내 팀' 일괄 rename 마이그 | `supabase/migrations/` | **어려움** | 소 |
| **3-E** | 진입점 정리 (팀↔근무표) | `VenueSettingsSheet.tsx`, `employer.tsx:123` | 쉬움 | 소 |

> ⚠️ **3-D 는 1-C 이후여야 한다** — 이름이 바뀐 사용자가 즉시 고칠 수 있는 화면이 먼저 있어야 한다.
> ⚠️ **3-C 는 착수 전 별도 설계 세션 필요** — "확정 전원의 시간 일괄 변경"은 단순 UPDATE 가 아닐 수 있다.
> 이미 그 시간에 맞춰 다른 일정을 잡은 스태프가 있으면 **거절/재확인 흐름**이 필요하다.

### 별도 — 아무 때나 끼워넣기

| ID | 범위 | 주요 파일 | 규모 |
|---|---|---|---|
| **별-1** | ① 대시보드 접기 + 필터 이동 | `app/(app)/(tabs)/schedule.tsx` | 소 |
| **별-2** | ④ 색상 팔레트 | `slotEdit.ts:55`, `EditSlotSheet.tsx` | 소 |

> 별-2 는 **2-B 이후**가 안전(같은 `EditSlotSheet.tsx` 를 만진다).

### 충돌 주의 (파일 기준)

| 파일 | 건드리는 묶음 | 대응 |
|---|---|---|
| `ScheduleCard.tsx` | 2-A · 2-D · 별-1 | 순차 진행이면 자연 해소 |
| `EditSlotSheet.tsx` | 2-A · 2-B · 별-2 | 별-2 를 2-B 뒤로 |
| `scheduleService.ts` | 1-C(160,647) · 2-A(300-330) · 3-A(326) | 줄은 멀지만 **의미 접점 有** |
| `venue-settlements.tsx` | 3-A · 3-B | 같은 기 안이라 순차 |

### 각 기 종료 게이트 (계획에 빠져 있던 것)

1. `npm run quality` (type-check + lint + format)
2. `npm test`
3. **`e2e/` 별도 확인** — `npm run quality` 범위 밖이다. 상수·라벨을 바꿨으면 `e2e/` Grep 필수
4. DB 변경 시 pgTAP + **파리티 카운트 기록**(현재 183/111)
5. **실기기 QA** — 이 프로젝트는 실기기에서만 드러난 결함 이력이 반복된다
6. **구 빌드 하위호환** — `time_slot` 단일화가 미업데이트 앱에서 어떻게 렌더되는지 확인
   (`parseTimeSlotToDate` 가 end 없으면 duration `'-'`)

---

## 묶음 1 설계 범위 (이번 세션 목표)

### 신설 RPC 2개

**1. `update_venue_container(p_container_id, p_name, p_location, p_contact_phone, p_description, p_defaults)`**
- SECDEF + `is_workspace_member` 게이트 + anon REVOKE (기존 `get_or_create_venue_container` 패턴 복제)
- `p_name` 은 `xssValidation` 통과 1~50자 (생성 RPC 와 동일 검증)
- 🔴 unique 인덱스 충돌 시 23505 → `INVALID_INPUT: 같은 이름의 지점이 이미 있습니다` 로 변환
- `location` 은 job_postings.location 이 **Json 타입** — 기존 공고의 location 형태(`{name, detailedAddress}`)와 정합 확인 필수
- ⚠️ **기본 근무시간은 넣지 않는다**(결정 4 · §J). `p_defaults` 파라미터를 두더라도 시간 축은 제외.
  기본 역할 세트만 `schedule` JSONB 에 (`softTargets`/`roleSalaries` 옆 `venueProfile`)

**2. `get_my_venue_contexts(p_ids uuid[])`**
- 반환: 지점당 **1행** (id, title, location, contact_phone, description, owner_name?)
- 권한 술어는 `20260728185802` 와 **동일하게**:
  `EXISTS(work_logs WHERE job_posting_id=jp.id AND staff_id=auth.uid() AND status NOT IN ('cancelled','no_show'))`
  (근거: `.claude/rules/supabase-patterns.md` §11 소프트 취소 필터)
- SECDEF + `search_path` + anon REVOKE + authenticated GRANT

### 클라 배선

| 파일 | 변경 |
|---|---|
| `services/work/scheduleService.ts:160`,`:647` | `createScheduleContainerContext` 에 title/location/phone 전달 |
| `domains/schedule/ScheduleConverter.ts:64` | 시그니처를 `(roleSalaries, context)` 로 확장 |
| `domains/workSchedule/venueContainer.ts` | `VenueContainer` 에 location/contactPhone/venueProfile 추가 + `VENUE_CONTAINER_COLUMNS` 갱신 |
| `components/workSchedule/VenueSettingsSheet.tsx` | 단가표 전용 → 지점 설정 전체 (이름·장소·연락처 + 팀 관리 링크). **기본시간 없음** |
| `hooks/workSchedule/useEnsureDefaultVenue.ts` | 워크스페이스명 복사 중단 → `{닉네임}의 지점` |
| 기본명 SSOT 통합 | `useEnsureDefaultWorkspace.ts:20` + `workspaceService.ts:91` + `workspace/index.tsx:125` → 한 곳 |

### 소급 rename 마이그레이션 (결정 3)

```sql
-- 1) 사전 카운트 먼저 (적용 전 실측)
-- 2) name='내 팀' 이면서 사용자가 손대지 않은 것만
-- 3) 충돌 검사 후 UPDATE
```
⚠️ `workspaces` 와 `job_postings`(container) **양쪽** 대상. 지점은 unique 인덱스 때문에 더 위험.
⚠️ 인앱 안내 1회 노출 수단 필요(알림 or 배너) — 설계에 포함할 것.

---

## 프로젝트 규율 리마인더

- **마이그 = Supabase MCP `apply_migration` 전용** (`db push` 금지)
- **마이그 재정의 베이스는 가장 최근 정의**:
  `grep -l "CREATE OR REPLACE FUNCTION <name>" supabase/migrations/*.sql | sort | tail -1`
- **prod 파리티**: 현재 함수 **183** · 정책 **111**. RPC 2개 신설 시 185 예상 — 변동을 기록할 것
- **`functions/` 는 ESLint·tsc·prettier 가 전부 건너뛴다** (Jest 만 잡음)
- 트리거 추가·변경 시 `node scripts/graph-db-deps.mjs triggers` (레포 루트에서)
- 커밋 사전승인 O · **push/PR 은 명시 요청 시에만**
- 완료 주장 전 이 세션에서 실행한 증거 필수 (fablize 게이트)
