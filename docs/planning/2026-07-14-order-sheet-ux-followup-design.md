# 주문서 후속 UX 개선 설계 — 일정 그룹 복원 · 역할별 급여 기본값 · 카드 조건 표시 (2026-07-14)

> 상태: **SHIP-READY**(2026-07-14 최종 게이트 승인 → 지연 도착 1차 보이스 2차 반영 → fresh-context 최종 검증 FIX 3건+NIT 3건 반영 완료). 기반: `bf7d7cc9b`(PR #249) 작성 → `9ec830acc`(#250·#251 머지)로 재검증 — 접점 파일 8종 충돌 0건·인용 전수 정확·급여필터 상호작용(§S2.6) 실측 정합. 구현은 최신 master에서 착수.
> 신규 문서(복원점 불필요). 참조: [[order-sheet-form-contract]] · [[whitelist-silent-drop]] · `2026-07-14-job-posting-kiosk-test-fixes-handoff.md`

## 0. 요구사항 (사용자 실기기 테스트 피드백 5건)

| # | 요구 | 심각도 |
|---|------|--------|
| R1 | 날짜선택의 **그룹/개별 선택** 복원 (키오스크 개편 때 소실) | 기능 회귀 |
| R2 | **날짜별로 역할 설정** 가능해야 함 | 기능 회귀 |
| R3 | 시간·역할을 **날짜별/그룹별로 직관적이고 편하게** 추가 | UX |
| R4 | 급여: **"모든 역할 동일 급여" 기본 체크해제**. 체크 시에만 단일 스테퍼. 해제 시 역할별 기본값(딜러 20,000/플로어 30,000/기타 20,000) + 역할별 스테퍼 + 금액 탭 시 직접입력 | UX+정책 |
| R5 | 공고 카드에 **조건(conditions) 표시** — 복지 다음 줄 | 표시 갭 |

## 1. 현재 상태 실측 (전부 이 세션에서 파일 직접 확인)

### 1a. 일정 — 왜 그룹/개별이 사라졌나
- 폼 계약이 `dates: string[]` + `timeSlots: TimeSlot[]`(전 날짜 공통)로 평탄화 — `orderSheet.schema.ts:82-83`. 날짜별 구조 자체가 없음.
- 매퍼가 모든 날짜에 같은 슬롯을 복제: `mappers.ts:103` `requirements: values.dates.map((date) => ({ date, timeSlots: toPostingTimeSlots(values) }))` — `isGrouped` 미설정.
- **역방향은 throw**: 날짜별 시간대가 다르면 `draftToValues`가 예외(`mappers.ts:135-140`, 리뷰 M8) → 날짜별 공고는 프리셋(마지막 공고)으로도 복원 불가.
- 구형 UX(편집 화면 `job-form`에 현존): `DateRequirementsSection.tsx:103-118` — 달력 다중선택 후 연속쌍 있으면 `GroupingConfirmModal`로 "그룹으로 묶기 vs 개별 등록" 선택. 그룹=연속 구간별 동일 timeSlots(`isGrouped:true`, :66-87), 개별=날짜별 독립(:89-101).
- 캐노니컬 도메인은 이미 전부 지원: `DateSpecificRequirement{date, timeSlots[], isGrouped?}` + `TimeSlot{startTime, roles: RoleRequirement[]}` (`types/jobPosting/dateRequirement.ts:5-26`). 읽기 표시도 현존(`GroupedDateRequirementDisplay.tsx` 등). **DB 변경 불필요.**
- 상한: `DATE_CONSTRAINTS.regular.maxDates = 7`(`constants/jobPosting.ts:23-26`) — 최악 7그룹으로 유계.
- 현재 시트 배선(`OrderSheetScreen.tsx`): 날짜 행→`DatePickerModal`(:318-330), 시간 행→`TimeSlotsSheet`(슬롯 목록+슬롯별 역할 진입, :331-343), 역할 행→슬롯 1개면 `RolesSheet` 직접/복수면 `TimeSlotsSheet`(:130-143). TimeSlots↔Roles 전환은 #244 지연 전환(`switchSheet`, :94-103).

### 1b. 급여
- `useSameSalary` 기본값 **true**: `orderSheet.schema.ts:85` + `initialOrderSheetValues()`(`mappers.ts:36`).
- `SalarySheet.tsx`: 동일급여 OFF여도 상단 단일 금액 영역이 계속 표시(:149-197). 역할별 행은 TextInput만(스테퍼·기본값 없음, placeholder "금액", :272-280). 시급 스테퍼 ±1,000(`HOURLY_STEP`, :92-93) + '직접 입력' 토글(:200-210).
- 타입은 공통 세그먼트, **금액만 역할별**(2026-07-14 기존 결정 — 유지).
- 기본값 상수: `DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 }`(`mappers.ts:22`). **역할별 기본단가 상수는 부재.**
- 커버 게이트: 스키마 superRefine(`orderSheet.schema.ts:111-138`)이 timeSlots의 고유 역할 전수를 roleSalaries가 커버해야 통과. `orderRowMeta.ts:168-203` unset 판정과 대칭.
- by_role 왕복: `toRoleCatalog`(`mappers.ts:62-87`)가 roleCatalog[].salary 전사, `draftToValues:145-156`이 by_role일 때만 roleSalaries 복원.

### 1c. 카드 조건
- 복지 줄: `PostingCardSurface.tsx:133-139` — `allowanceLabels`+`taxLabel`을 ' · ' 조인해 스케줄/급여 2열 블록 아래 렌더. **조건 줄은 여기 바로 다음.**
- 카드 2종(구직자 `JobCard.tsx` + employer `posting/JobPostingCard.tsx`) 모두 `PostingCardSurface` 공유 — 한 곳 수정으로 양쪽 반영.
- 데이터는 이미 도달: 목록 select `TABLE_COLUMNS`에 `conditions` 포함(`JobPostingRepositoryHelpers.ts:17-18`), `deserializeJobPostingDocument`가 hydrate(serialization.ts, PR #246). 뷰모델 파이프만 갭: `facts.ts`→`projections.ts projectCard`(:14-52)에 conditions 부재.
- conditions 구조: `{ dressCode?: string, experience?: string }`(`orderSheet.schema.ts:60-63`), 프리셋 칩+직접입력(`ConditionsSheet.tsx:18-19`).
- 상세 화면(JobDetail '모집 조건' 섹션)은 PR #247로 완결 — 카드만 갭. **"읽기 배선 ≠ 표시 UI" 교훈의 재발 사례** (wiki `sources/job-posting-kiosk-order-sheet` §재발방지 2).

## 2. 설계

### S1. 일정 그룹 모델 (R1+R2+R3) — 폼 계약 확장

**핵심**: `dates`+`timeSlots` 평탄 구조를 **일정 그룹 배열**로 대체한다. 그룹 = "같은 시간·역할을 공유하는 날짜 묶음". 개별 설정 = 날짜 1개짜리 그룹.

```ts
// orderSheet.schema.ts
export const orderSheetScheduleGroupSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, '날짜를 선택해주세요'),
  timeSlots: z.array(orderSheetTimeSlotSchema).min(1, '시간대를 추가해주세요'),
  // 묶음지원(구형 isGrouped) — 세그먼트 ②에서만 true. "같은 조건"(시간·역할 공유)과 별개 축.
  grouped: z.boolean().default(false),
});
// values: scheduleGroups: z.array(orderSheetScheduleGroupSchema).min(1, '날짜를 선택해주세요')
// superRefine 2건: ①그룹 간 날짜 중복 금지 ②합산 고유 날짜 ≤ DATE_CONSTRAINTS[postingType].maxDates
//   (2차 리뷰 Eng-M4/CEO-3: 평탄 dates.max 소실로 7그룹×N일 우회 차단 — 상한은 타입별 상수 경유)
```

- **⚠️ isGrouped = 묶음지원 축(2차 리뷰 Eng-C1, CRITICAL 교정)**: `isGrouped===true`는 `usesGroupedDateRanges`(selectors.ts:35-38)를 켜서 지원자 화면을 **묶음지원**(AssignmentSelector.tsx:195-204 — 연속 범위 일괄 지원, 날짜 부분선택 불가)으로 분기시킨다. 현행 주문서는 isGrouped 미설정 → 다중날짜도 날짜별 지원. 따라서 초안의 `isGrouped: 그룹크기>1`은 폐기 — **세그먼트 ②("연속 날짜 묶음 지원")를 명시 선택한 그룹만 `grouped=true`**, ①/③은 false 유지. 이래야 "단일 그룹=현행 완전 동등(무회귀)"이 참이 된다. 구형 GroupingConfirmModal의 "그룹으로 묶기"가 정확히 이 축이었으므로 사용자 요구(그룹/개별 복원)와도 정합.
- **매퍼 쓰기**(`valuesToDraft`): `requirements = groups.flatMap(g => g.dates.map(date => ({ date, timeSlots: clone(g.timeSlots), ...(g.grouped ? { isGrouped: true } : {}) })))` 후 **날짜 전역 정렬**(2차 Eng-H1). `allDates` = 전 그룹 날짜 정렬 합집합, `primaryDate` = 최소 날짜, `templateTimeSlots` = 첫 그룹 슬롯.
- **매퍼 읽기**(`draftToValues`): M8 throw **제거** — 그룹핑 규칙(2차 Eng-H1로 확정): `isGrouped===true` requirements는 **연속 run + 동일 시그니처(stripSlotIds JSON) 경계 보존**으로 grouped 그룹 복원(`groupRequirementsToDateRanges` 시맨틱, grouping.ts:299-336 재사용) · falsy requirements는 시그니처 병합으로 shared 그룹 복원(동일 조건 개별 날짜들의 병합은 지원자 화면 산출이 동일해 정규형으로 수용). **왕복 불변식 = 정규형 동등**(draft→values→draft에서 isGrouped·시그니처·날짜 집합 보존). 프리셋/템플릿에서 날짜별 공고도 복원 가능해짐(기존엔 스킵되던 프리셋이 살아남).
- 급여 파생(`uniqueRoles`·superRefine 커버 게이트·`summarizeRoles`): 전 그룹 순회로 확장.
- `gridParamsToValues`·`initialOrderSheetValues`·`formValuesToDraft`·`templateToValues`: 단일 그룹 형태로 이행. `formValuesToDraft`(z.input 경로)는 그룹별 **`grouped ?? false` 채움** 포함(최종 검증 NIT-2 — z.output은 필수 boolean이라 TS가 강제). 템플릿 적용은 그룹 구조·timeSlots 보존 + 각 그룹 dates만 비움(F4).
- **DB/직렬화 변경 없음** — scheduleGroups는 폼 내부 개념. 왕복 9지점 규칙 대상 아님(신규 컬럼 없음). 단, 매퍼 신구 등가성 테스트는 갱신 필수.

**UI (택1 — 프리미스 게이트에서 확정)**

옵션 A(채택 — D1 확정) — **그룹 반복 + 점진 공개** (리뷰 반영 상세화):
- 그룹 1개: 현행과 동일한 3행(날짜/시간/역할).
- 날짜 시트(DatePickerModal 래핑 시트)에서 2일 이상 선택 시 하단 세그먼트 노출 — **3지 선택**(리뷰 Design-H1: "날짜별 vs 연속구간별" 모호 해소): ①**"모든 날짜 같은 조건"**(기본, =단일 그룹, `grouped=false` — 지원자는 날짜별 지원, 현행 동등) ②**"연속 날짜 묶음 지원"**(`groupConsecutiveDates` 산출 + `grouped=true` — 구형 '그룹으로 묶기' 시맨틱: 지원자가 연속 범위를 통째로 지원. 연속쌍 있을 때만 노출=`hasGroupableDates`, 라벨에 묶음지원 의미 정직 표기 — 2차 Eng-C1) ③**"날짜마다 따로"**(날짜별 N그룹, `grouped=false`). 구형 GroupingConfirmModal 시맨틱을 시트 인라인으로 복원(중첩 모달 금지 원칙). **세그먼트는 고정 슬롯**(2일 미만 시 비활성 — 노출/숨김 전환의 모달 내부 점프 방지, 2차 Design-low). **세그먼트 수명주기**(최종 검증 FIX-2): ⓐ초기 선택값은 폼 상태 역산 — 단일 grouped=false 다중날짜 그룹=① · grouped=true 그룹=② · 다그룹=③ (grouped=true 단일 그룹 재진입 시 ①이 기본으로 보여 무변경 confirm만으로 묶음지원이 침묵 해제되는 역방향 오설정 차단) ⓑE6 병합 확인은 **날짜 시트 세션 내 세그먼트 토글에만 적용** ⓒ**확정 후 다그룹→① 재병합은 v1 제외** — 그룹 삭제 후 재구성으로 갈음(명시적 범위 제한) ⓓ**그룹 편집 모드(기존 그룹의 날짜 재선택)에서는 세그먼트 숨김**(재귀 분할 방지). 혼합 케이스(금~일+다음 금~일 등)의 캐노니컬 경로 = "첫 구간 선택 → + 일정 추가 → 둘째 구간" — 빈/추가 문구로 안내.
- **날짜 시트 배선**(2차 Design-critical + Eng-M4): 그룹 스코프 오픈 시 `initialSelectedDates`=해당 그룹 dates, `existingDates`=**타 그룹 dates 합집합**(DatePickerModal.tsx:42-49 기존 prop — 중복 날짜 선택불가 + 전역 7일 상한 remainingSlots 자동 유지). **그룹 헤더의 날짜 요약 탭 = 그룹 스코프 날짜 시트 재진입**(재편집 경로 — 삭제 후 재생성으로 시간·역할 잃는 경로 차단).
- 그룹 2개 이상: '일정 · 모집' 섹션 안에서 그룹당 **서브그룹**(헤더 + 시간/역할 2행)을 `h-px` 디바이더로 구분 — **중첩 카드 금지**(impeccable §6, 리뷰 Design-M5). 헤더=날짜 요약(탭=재편집) + 삭제 버튼(**muted 위계 강등** + hitSlop 44px — 2차 Design-medium). 날짜 요약 표기: 연속=`7/20~21`, 비연속=`7/20 외 2일`(a11y label은 전체 나열). 섹션 헤더 우측에 **총원 캡션**("총 딜러 8 · 플로어 2") 1줄(리뷰 Design-L1). 하단 "+ 일정 추가"(새 그룹: 날짜 시트부터, **시간/역할은 직전 그룹 깊은복사 시드** — 리뷰 Design-L2). 2→1 그룹 전환(삭제)의 레이아웃 붕괴는 Undo 토스트가 시각 앵커로 완충.
- **그룹 삭제 = 즉시 삭제 + 토스트 "7/20~21 일정을 삭제했어요 · 되돌리기(5초)"**(스냅샷 ref 보관, impeccable §12 — 리뷰 Design-M2). 날짜 시트에서 그룹의 날짜를 전부 해제하면 그룹 삭제와 동일 처리(확인 후).
- **제출 유도·에러 배지의 그룹 식별**(리뷰 Design-M3): `firstUnsetRow`가 `{key, groupIndex}` 반환, 제출 라벨은 그룹 2개+일 때 날짜 요약 접두("7/22 일정의 시간부터 선택하기"), 배지는 해당 서브그룹의 해당 행에만.
- 기존 TimeSlotsSheet/RolesSheet **그대로 재사용** — activeSheet 타깃에 `groupIndex` 추가만.

**RHF 중첩 배열 에러 → 행 매핑 설계**(리뷰 Eng-H1 — 이것 없이는 orderRowMeta 슬라이스 착수 불가):
- 그룹 간 날짜 중복 superRefine의 issue path는 최상위가 아니라 `['scheduleGroups', i, 'dates']`(뒤에 온 중복 그룹)로 명시 — E1 배지가 해당 그룹 날짜 행에 선다.
- `rowKeyForErrorField`(문자열 맵)를 **경로 워커**로 대체: `errors.scheduleGroups`(배열) 순회 → `{groupIndex, field}` → `{key, groupIndex}` 산출. 배열 루트 에러(min(1))가 `errors.scheduleGroups.message`인지 `.root`인지 zodResolver 실측 단위 테스트 필수(§3c).
- onInvalid 폴백 사슬(firstUnsetRow → 에러 행 → 토스트)은 유지하되 전 단계가 `{key, groupIndex}`를 흘린다 — H5 죽은 버튼 재발 차단.

옵션 B — 통합 일정 시트: 행 1개("일정·모집"), 탭하면 달력+그룹별 시간·역할 트리를 한 시트에서 편집. 시트가 비대해지고 #244 제약(중첩 전환) 하에서 단계 관리 복잡.

옵션 C — 현행 유지 + 시간대별 적용 날짜 칩: 슬롯마다 "적용 날짜" 지정. 표현력은 같지만 멘탈모델 도치(날짜→조건이 아니라 조건→날짜) — 구형 사용자 기대와 어긋남.

### S2. 급여 개편 (R4)

1. **기본값 반전**: `useSameSalary` 기본 **false** — 살아있는 기본값 **전수 통일**(리뷰 Eng-H2/CEO-3: 3중화+런타임 폴백): `orderSheet.schema.ts:85` `.default(false)` · `initialOrderSheetValues()`(`mappers.ts:36`) · `formValuesToDraft`의 `?? true`(`mappers.ts:204`) · `orderRowMeta.ts:169`의 `?? true` · `OrderSheetScreen.tsx:367`의 `?? true` — `useSameSalary ?? ` 전수 grep 후 `?? false`(또는 단일 상수)로 통일. 하나라도 남으면 zod 게이트(by_role 커버 요구)와 UI 판정(shared 간주)이 어긋나 "이대로 등록인데 제출 침묵 실패"(H5 재발). 프리셋/템플릿/마지막공고 로드는 draft의 `compensation.mode`를 따르므로 무영향.
2. **역할별 기본단가 상수** (constants/jobPosting.ts):
   ```ts
   export const DEFAULT_ROLE_HOURLY: Record<string, number> = { dealer: 20_000, floor: 30_000 };
   export const DEFAULT_ROLE_HOURLY_FALLBACK = 20_000; // serving·manager·staff·other(커스텀 포함)
   ```
   시급만 역할 차등. 일급/월급은 `DEFAULT_SALARY_BY_TYPE[type]` 균일(사용자 지정 없음 — 보수적).
3. **자동 프리필** `syncRoleSalaries(timeSlots, roleSalaries, type): RoleSalaries` (mappers 또는 utils/order-sheet 신설, 순수 함수):
   - timeSlots의 고유 역할 중 roleSalaries 미커버 → 기본값 엔트리 추가.
   - timeSlots에서 사라진 역할 엔트리 → **제거하지 않고 폼 상태에 잔류**(리뷰 CEO-2/Eng-M3: 고아 제거는 "직접 수정→역할 잠깐 제거→재추가" 시 사용자 금액을 침묵 리셋. 잔류 엔트리는 `toRoleCatalog`가 timeSlots 기준으로만 전사하므로 쓰기 경로 무해 — `mappers.ts:68-86` 실측. 커버 게이트·요약도 uniqueRoles 기준이라 무해).
   - 기존(사용자 수정) 엔트리 금액은 보존. 'other' customRole 리네임은 RolesSheet confirm이 인덱스 추적 가능하면 `renames:[{from,to}]`로 금액 승계, 불가하면 구 엔트리 잔류+신 키 기본값(소실 아님).
   - 호출 지점(리뷰 Eng-H3로 2개 추가): OrderSheetScreen의 timeSlots/slotRoles confirm 핸들러 · **`gridParamsToValues` 반환 직전**(주간그리드 프리필 — 미적용 시 기존 출하 플로우가 "급여 시트 강제 방문"으로 회귀) · **`handleApplyPreset`의 form.reset 직전**(부분 커버 by_role 템플릿). (그룹 삭제는 고아 잔류 결정으로 no-op — 호출 불필요, 최종 검증 NIT-1.) 전부 이벤트 경로 — F3(effect 금지)과 충돌 없음. `useSameSalary=false`일 때만.
   - 효과: 역할 확정 즉시 급여 행이 "딜러 20,000 · 플로어 30,000"로 **자동 set** — 시트 안 열어도 등록 가능(키오스크 속도), 제출 전 행 요약으로 확인 가능.
   - **'기본값' 배지(제안 상태)**(리뷰 CEO-2+Design-H2 합의 — 프리필이 기존 "급여를 한 번은 반드시 본다" 게이트를 제거하는 부작용 완화): roleSalaries가 전부 역할별 기본값과 일치하고 사용자가 급여 시트를 confirm한 적 없으면 급여 행에 `기본값` 배지 표시(파생 상태 — 스키마 필드 아님). 시트 confirm 또는 금액 수정 시 해제. **제출은 배지 상태에서도 허용**(R4 사용자 요구 존중) — 배지는 시각 게이트.
4. **SalarySheet UI**:
   - `same=true`: 현행 유지(시급 스테퍼 ±1,000 / 직접입력 토글 / 일·월급 TextInput / 협의 안내).
   - `same=false`: **상단 단일 금액 영역 숨김**(현재는 계속 노출 — R4 위반 지점). 역할별 행을 `[라벨 | − 20,000원 +]`로 재구성 — 시급이면 스테퍼(±1,000, 하한 1,000), **금액 텍스트 탭 → 해당 행 인라인 TextInput 전환**. 일급/월급 행은 TextInput만(현행 동등). 협의는 현행 "협의" 라벨.
   - **인라인 입력의 복귀 경로**(리뷰 Design-H3 — iOS number-pad에는 리턴 키가 없음): 편집 중인 행 우측에 44px "완료" 체크 버튼(편집 중 스테퍼 자리 대체), backdrop 탭은 **blur만 수행·시트 유지**. 행 높이 고정 `min-h-[52px]`(스테퍼↔입력 전환 시 레이아웃 점프 방지), 금액 탭 타깃 `min-h-[44px] min-w-[44px]`, 스테퍼와 8px 이상 간격, 금액 텍스트에 탭 어포던스(연한 밑줄 또는 연필 아이콘 14px) + `accessibilityHint="탭하여 직접 입력"`. **빈 입력 blur = 이전 값 복원**(0/미정 퇴행 금지 — 2차 Design-H3). `returnKeyType="done"`(지원 플랫폼). 역할 4~5종+키보드 대비 SheetModal 콘텐츠 키보드 회피(KeyboardAwareScrollView 기설치 — 또는 편집 행 scrollIntoView).
   - **그룹 2개+ 안내 캡션**(2차 Design-medium): 시트 상단 "역할별 급여는 모든 날짜에 동일하게 적용돼요" 1줄(역할 행=전 그룹 합집합임을 인지시킴 — 날짜별 단가 차등은 범위 밖 확정).
   - **급여 행 요약 truncation**(2차 Design-medium): 금액 truncation 금지(impeccable §26) — 역할 3개+면 "딜러 20,000 외 2개 역할" 축약 규칙(또는 급여 행만 2줄 허용).
   - **후속 역할 추가 시 1회성 토스트**(2차 CEO-2 — "급여 다 봤다"는 멘탈 상태에서 새 역할 기본값 무음 주입 완화): syncRoleSalaries가 **새 엔트리를 추가하는 순간** "기본 급여 적용: 플로어 30,000원 · 급여 행에서 수정 가능" 토스트. 확인 다이얼로그는 키오스크 속도 철학과 충돌 — 비채택.
   - 시트 오픈 시 로컬 state 초기화에도 `syncRoleSalaries` 적용(프리필 안전망).
   - 타입 세그먼트 공통 유지(금액만 역할별 — 기존 결정 불변). **타입 전환 시 사용자 수정 금액 보존**(리뷰 3보이스 합의 CEO-4/Design-M4/Eng-M6 — 초안의 "기본값 재시드"는 현행 `SalarySheet.tsx:76-81`보다 후퇴라 철회): 해당 타입 기본값과 동일한(=미수정) 행만 새 타입 기본값으로 갱신, 수정 행은 타입만 정렬하고 금액 유지. **비교 기준 = 전환 전 타입의 역할별 기본값**(시급=DEFAULT_ROLE_HOURLY, 일·월급=DEFAULT_SALARY_BY_TYPE 균일 — 최종 검증 FIX-3). 협의는 금액 축이 없어 보존 대상 제외 — 협의 경유 왕복은 0 유지가 확정 동작(§3c 스테퍼 0원 표기 회귀 행과 정렬).
   - **금액 상한**(리뷰 Eng-M4): `orderSheetSalarySchema.amount`에 `.max(100_000_000, '금액이 너무 큽니다')` + 스테퍼/직접입력 클램프 — 역할별 입력 지점이 N개로 늘어나는 시점에 조인다(프리셋 경유 이상치도 재검증).
5. **superRefine·orderRowMeta**: 커버 게이트는 전 그룹 순회로 확장하되, **timeSlots 고유 역할 0개면 skip**(리뷰 Eng-M5 — 기본 false 반전 후 신규 폼 첫 onChange부터 급여 에러가 서는 소음 제거. 제출 차단은 그룹당 timeSlots/roles min(1)이 담당 — 게이트 약화 없음).
6. **by_role 표시 계약**(리뷰 CEO-1 HIGH — by_role이 기본 경로로 승격되는 데 따른 하류 계약): `valuesToDraft`는 by_role일 때 `defaultSalary`를 초기값(아무도 안 고른 20,000)이 아니라 **roleSalaries 최저값**으로 기록 — defaultSalary를 폴백으로 읽는 소비 지점이 있어도 "최저가부터" 의미라 과소·과대 공시가 아님. **유령 값 소비처 실측 3곳**(2차 CEO-1): ①정산 폴백 `SettlementCalculator.ts:320-323`(역할 매칭 실패 시 defaultSalary — 돈 경로) ②카드 a11y/헤드라인 `postingSurfaceModel.ts:304-311`(primaryText가 defaultSalary 우선 — 스크린리더 낭독) ③병렬 급여 필터 설계(defaultSalary 키잡으면 by_role 전체 오분류). 매퍼 테스트에 "by_role draft의 defaultSalary ≠ 유령 초기값" 케이스 추가. 구현 시 카드 급여 표시(`buildPostingCompensationModel`)·공유 메시지(`jobShareMessage.ts`)·급여 필터의 by_role 처리 스모크 추가. ✅**급여 필터 조율 실측 완료**(2026-07-14, #251 머지 후): `salary_*_max`는 **defaultSalary+role_catalog 전체의 GREATEST**(마이그 `20260714100100_job_postings_salary_bounds.sql:31-63` + 쓰기 시 `serialization.getSalaryBounds`) — by_role 기본화·defaultSalary=최저값 기록과 **정합**(필터 max는 role_catalog에서 얻음, 유령/최저 defaultSalary가 결과를 왜곡하지 않음). 구현 시 getSalaryBounds 경유 확인 스모크만 유지.

### S3. 카드 조건 표시 (R5)

- `facts.ts`: `conditionLabels: string[]` 파생 — `[dressCode && `복장 ${dressCode}`, experience && `경력 ${experience}`].filter(Boolean)`. XSS는 쓰기 시 zod refine 완료(표시는 RN Text — 마크업 해석 없음).
- `projections.ts projectCard`(+ `PostingCardViewModel` 타입): `conditionLabels` 전사. (detail은 이미 별도 섹션 존재 — 카드만.)
- `PostingCardSurface.tsx`: 복지 줄(:133-139) **바로 다음** 조건 줄:
  ```tsx
  {(card.conditionLabels?.length ?? 0) > 0 ? (
    <Text className="mt-0.5 text-sm text-secondary-500 dark:text-secondary-400 font-sans" numberOfLines={1}>
      {card.conditionLabels.join(' · ')}
    </Text>
  ) : null}
  ```
  다크모드 클래스 복지 줄과 동일 계열. 값 없으면 줄 자체 생략(카드 높이 무변).
- 구직자 JobCard·employer JobPostingCard 자동 반영(공용 서피스). a11y label(`buildAccessibilityLabel`)에 조건 미포함(카드 소음 억제 — 상세에서 읽힘).

## 3. 변경 파일 목록 (예상)

| 파일 | 변경 | 슬라이스 |
|------|------|----------|
| `src/schemas/orderSheet.schema.ts` | scheduleGroups 도입·dates/timeSlots 대체·useSameSalary default false·그룹 중복날짜 superRefine | S1+S2 |
| `src/utils/order-sheet/mappers.ts` | 그룹 flatMap 쓰기·시그니처 그룹핑 읽기(M8 제거)·syncRoleSalaries·초기값 | S1+S2 |
| `src/components/employer/order-sheet/orderRowMeta.ts` | 그룹 스코프 행 상태·에러 매핑 | S1 |
| `src/components/employer/order-sheet/OrderSheetScreen.tsx` | 그룹 반복 렌더·activeSheet groupIndex·syncRoleSalaries 배선 | S1+S2 |
| `src/components/employer/order-sheet/sheets/TimeSlotsSheet.tsx` | (그룹 스코프 — props 경유, 내부 거의 무변) | S1 |
| 날짜 시트(신규 래퍼 또는 DatePickerModal 확장) | "같은 조건/날짜마다 따로" 세그먼트 | S1 |
| `src/components/employer/order-sheet/sheets/SalarySheet.tsx` | 단일 영역 숨김·역할별 스테퍼+인라인 직접입력·기본값 시드 | S2 |
| `src/constants/jobPosting.ts` | DEFAULT_ROLE_HOURLY 상수 | S2 |
| `src/domains/job-posting/facts.ts` | conditionLabels 파생 | S3 |
| `src/domains/job-posting/projections.ts` + `src/types/jobPosting.ts` | 카드 뷰모델 전사 | S3 |
| `src/components/jobs/shared/PostingCardSurface.tsx` | 조건 줄 렌더 | S3 |
| `app/(employer)/my-postings/create.tsx` | 완료 화면 요약이 `values.dates[0]`·`values.timeSlots[0]` 직접 소비(리뷰 Eng-M2) — 다중 그룹 요약 규칙: primaryDate(전 그룹 최소 날짜)+그 그룹 첫 슬롯+"외 N일" 접미 | S1 |
| 테스트 다수 | §4 | 전부 |

## 3b. 아키텍처 의존 그래프 (Eng §1)

```
[DatePickerModal 래핑 날짜시트]  [TimeSlotsSheet]  [RolesSheet]  [SalarySheet]
        │(dates+분할세그먼트)          │(slots)         │(roles)       │(salary·roleSalaries)
        ▼                            ▼                ▼              ▼
   OrderSheetScreen ── activeSheet{key, groupIndex, slotIndex} ── syncRoleSalaries()
        │ form.setValue('scheduleGroups[i].…')                        (순수함수, confirm시)
        ▼
   RHF form (z.input) ◄── zodResolver ── orderSheet.schema.ts
        │                                 · scheduleGroups[] (min1, 그룹당 dates min1 + timeSlots min1)
        │                                 · 그룹간 날짜중복 reject · by_role 커버 게이트(전 그룹)
        ▼ z.output
   mappers.ts ── valuesToDraft: groups.flatMap → requirements(g.grouped===true→isGrouped:true, 아니면 미기록) [쓰기]
        │        draftToValues: 시그니처 그룹핑 복원(M8 throw 제거)             [읽기]
        ▼
   JobPostingDraft(캐노니컬, 무변경) → draftAdapter → CreateJobPostingInput → 기존 쓰기 경로
                                                                        (DB·직렬화 무변경)
   ── 별도 트랙 (S3) ──
   job_postings.conditions(기존 컬럼) → deserialize(기존) → facts.conditionLabels(신규 파생)
        → projections.projectCard(전사) → PostingCardSurface(복지 줄 다음 렌더)
        → JobCard(구직자)·JobPostingCard(employer) 동시 반영
```

- 결합 경계: 폼 계약(z.input/z.output 2형·RHF 3제네릭)은 유지 — 필드 구조만 교체. 캐노니컬 draft 아래(서비스·리포지토리·DB)는 접점 0.
- orderRowMeta는 순수 로직 유지 — `getRowState(values, key, groupIndex?)` 시그니처 확장.

## 3c. 테스트 다이어그램 — 신규 코드패스 → 커버 (Eng §3)

| 코드패스/분기 | 테스트 유형 | 위치 |
|---------------|------------|------|
| scheduleGroups 스키마(min1·그룹내 min1·중복날짜 reject) | 단위(zod) | schema 테스트 신설 |
| valuesToDraft 다중그룹 flatMap(grouped→isGrouped 조건 기록·false면 미기록·allDates 합집합·primaryDate·deepClone 무공유) | 단위 | mappers.test.ts |
| draftToValues 시그니처 그룹핑(동일→병합, 상이→분리, 구M8 케이스 복원) | 단위 | mappers.test.ts |
| 왕복 불변 values→draft→values (1그룹/다그룹/by_role) | 단위 | mappers.test.ts |
| 신구 등가성(기존 단일그룹 케이스 전부 GREEN 유지) | 회귀 | mappers.test.ts 기존 |
| syncRoleSalaries 추가/제거/보존 + 시급차등/일·월급균일 | 단위(순수) | 신설 |
| useSameSalary 기본 false + 커버 게이트 상호작용 | 단위(zod) | schema 테스트 |
| orderRowMeta 그룹 스코프 행 상태·firstUnsetRow 순서·에러 매핑 | 단위 | orderRowMeta.test.ts |
| "날짜마다 따로" 분할 시 시간/역할 깊은복사 승계 | 컴포넌트 | OrderSheetScreen 테스트 |
| 그룹 추가/삭제(마지막 그룹 삭제버튼 미노출) | 컴포넌트 | OrderSheetScreen 테스트 |
| SalarySheet same=false: 단일영역 숨김·역할별 스테퍼 ±1,000·금액 탭→인라인 입력 | 컴포넌트 | SalarySheet.test.tsx |
| 프리셋 적용(by_role·다중그룹·shared) 후 폼 상태 + reset 직전 syncRoleSalaries | 컴포넌트 | OrderSheetScreen.presets.test.tsx |
| draft→values→draft **멱등**(isGrouped·개별 선택 보존 — 리뷰 Eng-M1) | 단위 | mappers.test.ts |
| zodResolver 배열 에러 형상 실측(`errors.scheduleGroups.message` vs `.root`) + 경로 워커 매핑 | 단위 | orderRowMeta.test.ts |
| `useSameSalary` undefined에서 zod 게이트·getRowState·시트 prop 3자 일치(리뷰 Eng-H2) | 단위 | schema+orderRowMeta |
| gridParamsToValues 프리필 후 급여 자동 set(그리드 플로우 무회귀 — 리뷰 Eng-H3) | 단위 | mappers.test.ts |
| switchType 왕복(시급→일급→시급) 사용자 금액 보존 | 컴포넌트 | SalarySheet.test.tsx |
| syncRoleSalaries: customRole 리네임·고아 잔류·금액 상한 클램프 | 단위 | 신설 |
| 비연속 다중날짜 그룹(isGrouped)의 읽기 표시(GroupedDateRequirementDisplay) | 컴포넌트 | 기존 표시 테스트 확장 |
| create-success 프리셋 저장(draft 경유) 무회귀 스모크(리뷰 Eng-L1 — lastSubmitted는 draft 저장이라 스키마 마이그 무관) | 스모크 | 기존 |
| 신구 등가성: 기존 픽스처 `singleGroup()` 헬퍼 기계 포팅 + 단일 그룹 draft 산출 스냅샷 동결 비교(리뷰 Eng-L2) | 회귀 | mappers.test.ts |
| **AssignmentSelector 분기 스모크**: 주문서 산 공고(①/③=날짜별 지원 UI · ②=묶음지원 UI) — usesGroupedDateRanges 가드(2차 Eng-C1) | 컴포넌트 | 지원 플로우 테스트 |
| requirements 날짜 전역 정렬 + 합산 날짜 상한 superRefine(≤maxDates) | 단위 | schema+mappers |
| by_role draft의 defaultSalary=roleSalaries 최저값(유령 20,000 아님) | 단위 | mappers.test.ts |
| switchType 협의→시급 왕복 시 역할 금액 0 초기화 회귀 고정(스테퍼 0원 표기 신설 — 2차 Eng) | 컴포넌트 | SalarySheet.test.tsx |
| 테스트 날짜는 고정 리터럴(KST 00~09시 toISOString 플레이크 — 프로젝트 기지 함정) | 규율 | 전체 |
| facts.conditionLabels 파생(빈/1개/2개) | 단위 | facts 테스트 |
| PostingCardSurface 조건 줄 유/무·복지 줄 다음 위치 | 컴포넌트 | PostingCardSurface.test.tsx |

## 4. 테스트 계획

- **매퍼 왕복(최중요)**: `mappers.test.ts` — ①단일 그룹 신구 등가성(기존 케이스 전부 초록 유지) ②다중 그룹 flatMap 쓰기(grouped→isGrouped 조건 기록·allDates 합집합·primaryDate) ③읽기 그룹핑 복원(isGrouped=연속 run 경계 보존, falsy=시그니처 병합) ④M8 케이스가 이제 throw 없이 복원 ⑤왕복 불변(정규형 동등).
- **스키마**: 그룹 중복 날짜 reject·빈 그룹 reject·useSameSalary 기본 false에서 커버 게이트 동작.
- **syncRoleSalaries 순수 함수**: 추가/제거/보존 3경로 + 시급 차등/일·월급 균일.
- **orderRowMeta**: 그룹별 행 상태·firstUnsetRow 순서·에러 필드 매핑.
- **SalarySheet**: same 기본 해제 렌더·단일 영역 숨김·역할별 스테퍼 증감·인라인 직접입력 전환·confirm 페이로드.
- **OrderSheetScreen**: 그룹 추가/삭제 흐름·"날짜마다 따로" 분할·프리셋 적용(by_role/다중그룹) 스모크.
- **카드**: PostingCardSurface conditions 줄 유/무 렌더 + facts 파생 + projections 전사.
- 게이트: `npm run quality` exit 0 + 관련 jest fresh 실행(이 규율은 핸드오프 문서 승계).

## 5. NOT in scope (명시 제외)

- 구형 job-form(편집 화면) 개편 — 이미 날짜별 편집 지원, 주문서에서 만든 다중그룹 공고 편집 가능.
- fixed(고정)·tournament 경로 — 주문서 밖(레거시 폼 전환 유지).
- DB 마이그레이션·RLS — 불필요(캐노니컬 모델 기지원).
- 주간그리드 프리필 의미 변경 — 단일 그룹 생성으로 이행만.
- 알림/정산/지원 플로우 — 캐노니컬 draft 산출이 동일하므로 무영향(등가성 테스트가 가드).
- 역할별 급여의 **일급/월급 차등 기본값** — 사용자 미지정, 시급만 차등.

## 6. 기존 재사용 (What already exists)

- 그룹핑 유틸: `groupConsecutiveDates`·`hasGroupableDates`·`groupRequirementsToDateRanges`(`@/utils/date`) — 날짜 시트 세그먼트·표시 요약에 재사용.
- `GroupingConfirmModal`(구형) — 시맨틱만 승계(시트 인라인 세그먼트로 재구현, 중첩 모달 회피).
- `DateSpecificRequirement`/`isGrouped`/`GroupedDateRequirementDisplay` — 읽기 표시 무변.
- `TimeSlotsSheet`·`RolesSheet`·#244 지연 전환 인프라 — 그룹 스코프 파라미터만 추가.
- `DEFAULT_SALARY_BY_TYPE`·`HOURLY_STEP`·superRefine 커버 게이트·`roleName` — 그대로.
- 카드: `PostingCardSurface` 공용 구조·`allowanceLabels` 파이프 패턴을 conditions에 복제.

## 7. 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| 폼 계약 파괴적 변경(dates/timeSlots 제거)의 파급 — orderRowMeta·시트·테스트 광범위 | 슬라이스 분리(S1 단독 PR 가능)·신구 등가성 테스트 우선 작성(TDD RED) |
| 프리셋(templateToDraft 경유) 구버전 draft와의 호환 | draftToValues 시그니처 그룹핑은 requirements 어떤 형태든 수용(M8 제거로 오히려 관대해짐) |
| by_role 기본화로 지원자 표시·정산의 by_role 커버리지 노출 | 기존 기능(2026-07-14 by_role 왕복 결정)이라 신규 경로 아님 — RoleSalaryDisplay 스모크만 추가 |
| 자동 프리필 금액(2만/3만)을 못 보고 등록 | 급여 행 요약에 역할별 금액 상시 노출 + 제출 버튼 라벨 게이트는 기존과 동일 |
| 그룹 다수 + 날짜별 상이 시 카드/상세 표시 | 기존 GroupedDateRequirementDisplay·dated 표시 경로가 이미 처리(구형 공고와 동일 형태) |

## 7b. 에러 & 구제 레지스트리 (CEO §2)

| # | 상황 | 사용자에게 보이는 것 | 구제 경로 |
|---|------|----------------------|-----------|
| E1 | 그룹 간 날짜 중복 | superRefine 에러 "이미 다른 일정에 포함된 날짜예요" + 배지 위치: 날짜 행(그룹 1개)/해당 그룹 헤더(2개+) | 날짜 시트에서 타 그룹 점유 날짜 비활성 표시(사전 차단 우선) |
| E2 | 그룹 시간대 0개 | '시간대를 추가해주세요' 행 배지(기존 문구) | 제출 버튼이 해당 행으로 유도(기존 firstUnsetRow) |
| E3 | 역할별 급여 미커버 | '역할별 급여를 모두 입력해주세요' + 급여 행 배지 | 자동 프리필로 사실상 발생 억제, 잔존 시 급여 시트 유도 |
| E4 | 마지막 남은 그룹 삭제 시도 | 삭제 버튼 자체 미노출(그룹 1개일 때) | — (사전 차단) |
| E5 | 프리셋 복원 불가(fixed/tournament draft) | 프리셋 카드 스킵(기존 try/catch 유지) | M8 제거로 날짜별 상이 케이스는 이제 복원 성공 |
| E6 | "날짜마다 따로" 분할 직후 | 기존 공통 시간/역할을 각 그룹에 깊은복사 승계(빈 상태로 만들지 않음) | 분할 취소=다시 "같은 조건" 선택 시 첫 그룹 기준 병합 — **그룹 간 timeSlots 시그니처가 상이할 때만 확인 1회**("2·3번째 일정의 시간·역할이 첫 일정과 같게 바뀌어요 · [모두 같게 변경]/[계속 따로 두기]", 리뷰 CEO-5+Design-M1). 동일하면 무확인 병합 |

## 7c. 구조적 실패 모드 레지스트리

| # | 실패 모드 | 가드 |
|---|-----------|------|
| F1 | flatMap 시 timeSlots 참조 공유 → 한 그룹 수정이 타 날짜 오염 | 날짜별 deepClone(기존 `mappers.ts:45` 관례 승계) + 왕복 테스트 |
| F2 | allDates 중복 → filled counts 키스페이스 충돌([[pitfall_filled_counts]]) | E1 superRefine이 원천 차단 + 매퍼 합집합 dedupe |
| F3 | syncRoleSalaries를 effect에서 호출 → setValue 무한 루프 | confirm 핸들러(이벤트)에서만 호출, effect 금지 |
| F4 | 템플릿 적용 시 dates 리셋(기존 `templateToValues` dates:[])과 그룹 구조 충돌 | 그룹 구조·timeSlots 유지 + 각 그룹 dates만 비움(z.input 단계 허용, 제출 시 검증) |
| F5 | RHF 배열 중첩 에러의 행 매핑 실패 → 죽은 제출 버튼(H5 재발) | top-level 'scheduleGroups' → firstUnsetRow 우선 + 그룹별 unset 판정 정렬 테스트 |
| F6 | isGrouped 오설정 → 지원자 묶음지원 UI 오분기(2차 Eng-C1로 교정) | 세그먼트 ② 명시 선택시만 `grouped=true` — ①/③은 미설정 유지(현행 동등), AssignmentSelector 스모크 가드 |

## 7d. 드림 스테이트 델타

- 이 설계 후: 주문서가 구형 폼의 일정 표현력(그룹/개별/날짜별 역할)을 100% 회복 + 급여 정책이 실장 관행(역할별 단가) 기본값화 + 카드 정보 완결.
- 12개월 이상향 대비 잔여 갭(이번 범위 밖): ①편집 화면도 주문서로 단일화 ②fixed(고정)·tournament 주문서 흡수 ③반복 공고 자동 재등록. → TODOS 후보.

## 8. 확정 결정 (프리미스 게이트 통과 — 2026-07-14 사용자 승인)

- **D1 = 옵션 A** (그룹 반복 + 점진 공개): 그룹 1개면 현행 3행 동일, 2개+면 서브그룹 반복 + "+ 일정 추가". 날짜 시트에 3지 세그먼트(같은 조건/연속끼리 묶기/날짜마다 따로 — 리뷰 반영).
- **D2 = 프리미스 4건 승인**: ①주문서(create)만 ②DB 무변경 ③시급만 역할 차등 기본값(딜러 20,000/플로어 30,000/기타 20,000) ④카드 조건은 PostingCardSurface 한 곳.

## 9. /autoplan 리뷰 기록 (2026-07-14)

### 9a. 보이스 구성
- Codex: **미가용**(이 계정 전 모델 400 거부 — 세션 내 프로브 실측). 전 단계 `[subagent-only]` 강등.
- Claude 독립 서브에이전트(fable) 3종: CEO/전략 · 시니어 프로덕트 디자이너 · 시니어 엔지니어 — 각자 사전 리뷰 없이 설계 문서+코드 실측. 1차 백그라운드 디스패치가 지연돼 동기식 재디스패치(2차) 성공 → 최종 게이트 승인 직후 **1차 보이스 3건이 뒤늦게 도착해 2차 반영**(총 6개 독립 리뷰). 1차분 신규 발견: **Eng-C1(CRITICAL — isGrouped=묶음지원 축 혼동)** · CEO-1 유령 defaultSalary 소비처 실측 3곳 · Design-critical(그룹 날짜 재편집 경로) · 합산 날짜 상한 등 — 전부 §S1/§S2에 교정 반영. C1 교정은 사용자 승인 방향(무회귀·그룹/개별 복원)을 지키기 위한 결함 수정으로 재게이트 불요 판단.
- 절차 일탈 기록: 원 스킬은 CEO→Design→Eng 순차이나 Codex 부재로 보이스 간 컨텍스트 주입이 없어져 보이스를 병렬 실행 — 독립성 속성은 보존.

### 9b. 컨센서스 (subagent-only — 각 보이스 평결 기준)

| 차원 | CEO | Design | Eng | 합의 |
|---|---|---|---|---|
| 전제 타당 | 부분 | (수용) | (수용) | 부분 — 급여 자동 set 메커니즘 보강 필요 → §S2.3 배지·고아 잔류로 해소 |
| 맞는 문제/위계 | YES | 6/10 | — | 그룹 식별 문구·총원 캡션 반영으로 해소 |
| 상태 완결성 | 부분 | 6/10 | 부분 | E6 확인·삭제 Undo·빈 그룹 처리 반영 |
| 아키텍처/구체성 | — | 6/10 | 부분 | RHF 에러 매핑 설계 신설·폴백 전수·create.tsx 추가로 해소 |
| 테스트 | — | — | 부분 | §3c 10행 증보 |
| 보안 | — | — | 부분 | 금액 max 반영 |
| 배포 리스크 | 부분 | 7/10 | YES | S3→S2→S1 슬라이스 출하 + 그리드 회귀 테스트 |

### 9c. 크로스 페이즈 테마 (2보이스 이상 독립 지적 — 고신뢰 신호)
- **T1 자동 프리필=확정값 리스크**(CEO-2+Design-H2): '기본값' 배지 + 고아 잔류로 반영.
- **T2 타입 전환 재시드=입력 파괴**(CEO-4+Design-M4+Eng-M6, 3보이스 만장일치): 초안 철회, 미수정 행만 갱신.
- **T3 "같은 조건" 복귀 무경고 병합**(CEO-5+Design-M1): 시그니처 상이 시 확인 1회.
- **T4 그룹핑 시맨틱(연속 vs 날짜별 vs 시그니처)**(Design-H1+Eng-M1+CEO-7): 3지 세그먼트 + isGrouped 포함 그룹핑 키 + 멱등 테스트.
- **T5 useSameSalary 기본값 산재**(CEO-3+Eng-H2): 전수 grep 통일.

### 9d. 결정 감사 추적 (자동 판정 — 6원칙)

| # | 발견 | 분류 | 판정 | 원칙 |
|---|------|------|------|------|
| 1 | Eng-H1 RHF 중첩 에러 매핑 미설계 | mechanical | 채택(경로 워커+issue path+실측 테스트) | P1 완결 |
| 2 | Eng-H2/CEO-3 기본값 폴백 3+2지점 | mechanical | 채택(전수 grep 통일) | P1 |
| 3 | Eng-H3 sync 호출 2경로 누락 | mechanical | 채택(gridParams+preset reset) | P1 |
| 4 | CEO-2/Design-H2 프리필 확정값 리스크 | taste→채택 | '기본값' 배지+고아 잔류, 제출은 허용(R4 존중) | P1+P6 |
| 5 | Design-H1 분할 단위 모호 | mechanical | 3지 세그먼트 확정 | P5 명시 |
| 6 | Design-H3 인라인 입력 키보드 탈출 | mechanical | 완료 버튼+blur만+44px 스펙 | P1 |
| 7 | 3보이스 타입 전환 재시드 | mechanical | 초안 철회 — 미수정 행만 갱신 | P5 |
| 8 | Eng-M1 시그니처 그룹핑 비멱등 | mechanical | isGrouped 포함 키+멱등 테스트 | P1 |
| 9 | CEO-1 by_role 표시 계약 | taste→채택 | defaultSalary=최저값+P3 필터 조율 노트 | P1 |
| 10 | Eng-M2 create.tsx 누락 | mechanical | 목록 추가+요약 규칙 | P1 |
| 11 | Eng-M4 금액 max 부재 | mechanical | .max(1억)+클램프 | P1 |
| 12 | Eng-M5 커버 게이트 빈 슬롯 소음 | mechanical | size 0 skip | P3 |
| 13 | Design-M2 삭제 Undo | mechanical | 토스트+되돌리기 5초 | P1 |
| 14 | Design-M5 중첩 카드 | mechanical | 서브그룹+디바이더 | P5 |
| 15 | Design-L1/L2/L3 (총원 캡션·시드·표기 3건) | mechanical | 전부 채택 | P1 |
| 16 | Eng-L1 lastSubmitted 전제 오류 | mechanical | 테스트 행 정정(draft 저장) | P3 |
| 17 | Eng-L2 등가성 스냅샷 동결 | mechanical | singleGroup 헬퍼+스냅샷 | P1 |
| 18 | CEO-6 maxDates 7 vs 대회사 8일 | 범위 밖 | TODOS 이관(§10) | P2 blast radius 밖 |
| 19 | CEO 프로세스 노트(S3→S2→S1 역순 출하) | 채택 | 구현 순서로 명시(§10) | P3 |
| 20 | **2차 Eng-C1 isGrouped=묶음지원 축 혼동(CRITICAL)** | mechanical(결함) | `grouped` 필드 신설 — 세그먼트 ②만 true, 쓰기 규칙 교체, AssignmentSelector 스모크 | P1 |
| 21 | 2차 Eng-H1 읽기 그룹핑=연속+isGrouped 경계 보존 | mechanical | grouping.ts 시맨틱 재사용·정규형 동등 불변식·전역 정렬 | P1+P4 |
| 22 | 2차 Eng-M4/CEO-3 합산 날짜 상한 미명세 | mechanical | superRefine ≤ maxDates(타입별 상수) + existingDates 배선 | P1 |
| 23 | 2차 Design-critical 그룹 날짜 재편집 경로 부재 | mechanical | 헤더 날짜 탭=그룹 스코프 날짜 시트(기존 prop 2종 배선) | P1 |
| 24 | 2차 CEO-1 유령 defaultSalary 소비처 3곳 실측 | 보강 | §S2.6에 실측 근거 편입 + 매퍼 테스트 | P1 |
| 25 | 2차 CEO-2 후속 역할 추가 무음 주입 | taste→채택 | 신규 엔트리 1회성 토스트(다이얼로그 비채택) | P3+P6 |
| 26 | 2차 Design-H3 보강(빈 blur 복원·행 높이 고정·어포던스·캡션·truncation) | mechanical | 전부 채택 | P1 |
| 27 | 2차 CEO-5 프리필 소스 진화(사장 최근 공고>상수) | 범위 밖 | TODOS 이관(§10) | P2 밖 |

### 10. 구현 순서 권고 + TODOS 이관

- **구현 순서**: S3(카드 조건 — 무위험 독립) → S2(급여 — 현행 평탄 모델 위에서도 가능) → S1(일정 그룹 — 최대 슬라이스). 슬라이스별 PR 분리 가능, 최소 S1은 단독 PR.
- **TODOS 이관**: ①`DATE_CONSTRAINTS.regular.maxDates=7` 상한 재점검(대회사 D-7~D-day=8일과 1일 갭 — 그룹 모델 도입 후 정확히 그 표현력이 필요한 고객이 상한에 먼저 닿음) ②편집 화면 주문서 단일화·tournament 흡수 트리거 조건 정의 ③급여 필터 P3와 by_role 기본화 상호작용 확인(머지 순서 무관 필수) ④syncRoleSalaries 프리필 소스 우선순위 진화: 사장 최근 by_role 공고 금액 > 상수(2차 CEO-5 — 콜드스타트 이후 개인화).
- **OTA 혼재기 노트**(2차 Eng-H2): 신 클라가 만든 다중그룹 템플릿을 구 클라가 열면 M8 throw → 프리셋 skip으로 안전 강등(수용).
