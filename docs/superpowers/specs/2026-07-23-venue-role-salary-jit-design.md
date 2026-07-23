# 지점 역할별 급여 — JIT 설계 spec (2026-07-23)

> 채택 결정: JIT안(배치 시 미설정 역할만 그 자리서 물어 지점 단가표에 저장) + v1 범위 = 접점 1+2+3 전부.
> 입력 문서: `docs/planning/2026-07-23-venue-role-salary-design-handoff.md`(코드 실측 §2·§3) ·
> `docs/planning/2026-07-22-venue-role-salary-policy-decision.md`(정책).
> 한 문장: **"처음 쓰는 역할만 한 번 물어봐요. 다음부턴 자동이에요."**

## 0. 문제

근무표 직접 배치는 `jobPostingId = containerId`(지점 자신)라 급여 정보가 없고,
정산이 폴백 시급 ₩15,000(`DEFAULT_SALARY_INFO`)으로 **조용히** 계산된다.
폴백 서열(정책 확정): **슬롯 override(`customSalaryInfo`, 기배선) > 지점 역할별 단가 > 폴백 ₩15,000 + 가시화 배지**.
미결이던 2순위(지점 단가표)의 저장·해소·UI를 이 spec이 확정한다.

## A. 데이터·해소 (핸드오프 §3 확정 — 변경 없음)

- **저장 위치**: 컨테이너 `schedule.roleSalaries: PostingRoleCatalogEntry[]`
  (JSONB, softTargets 옆. 마이그레이션 0 · RLS 변경 0 · `/guard` 불요).
- **타입**: `PostingRoleCatalogEntry[]`(`types/jobPosting.ts:82` — `{role, customRole?, salary?}`).
  해소기 시그니처(배열)에 어댑터 0으로 직결.
- **키 규약**: `getPostingRoleKey`(`domains/job-posting/core.ts:21`) 재사용 — `other:<customRole>` 구분.
- **파싱**: 경량 `VenueContainer` 파서 확장(`domains/weeklyGrid/venueContainer.ts` —
  strict 스키마 null 증발 회피 패턴 유지). `VENUE_CONTAINER_COLUMNS`는 schedule을 이미 로드.
- **쓰기**: `domains/weeklyGrid/roleSalaries.ts` 신규 — 불변 merge(softTargets 등 schedule 타 필드 보존).
- **정산 해소 삽입**(`services/work/settlement/settlementVenueQuery.ts:121` 분기 payload 교체):
  ```ts
  const container = await getVenueContainerById(venueId); // 경량 경로(schedule 포함)
  const venueContext = { roles: container?.roleSalaries ?? [], defaultSalary: DEFAULT_SALARY_INFO,
    allowances: undefined, taxSettings: undefined };
  // found?.context ?? venueContext
  ```
  `getEffectiveSalaryInfoFromRoles`·`SettlementCalculator` 무수정 재사용. 쿼리당 read 1회 추가.
- **출처 헬퍼 신규**: `resolveRoleSalaryWithSource()` — 기존 `getRoleSalaryFromRoles`는 미매칭 시
  조용히 폴백(helpers.ts:94)이라 배지를 못 만듦. `'override' | 'venueTable' | 'fallback'`을
  반환하는 형제 헬퍼를 별도 작성("조용한 오답 금지" 요건).

## B. 접점 1 — AddSlotSheet JIT 인라인 필드 (주 진입점)

- **노출 조건**: 역할 칩 선택(커스텀은 이름 입력 확정) 시 지점 단가표에 해당 키가 **없을 때만**
  인라인 필드 등장. 설정된 역할이면 아무것도 안 보임.
- **UI**: 안내 문구 "○○ 시급 미설정 — 지금 입력하면 이후 자동" + 타입 세그먼트
  (**시급/일급/월급 3종 — '협의' 제외**) + 금액(시급이면 ±1,000 스테퍼, 기본값은
  `DEFAULT_SALARY_BY_TYPE`·`defaultAmountForRole` 재사용).
  공유 컴포넌트 **`RoleSalaryField`**로 추출 — 접점 2 배지 시트와 공용.
- **'협의' 제외 근거**: 단가표의 존재 이유가 자동 정산 계산인데 협의는 `amount:0`이라
  폴백과 같은 오답을 만듦.
- **스킵 허용**: 입력 없이 배치 가능(배치 마찰 방지) → 그 건은 접점 2 배지 구제로 회수.
- **저장 순서**: 단가표 먼저 → 슬롯 추가. 단가 저장 실패해도 슬롯 추가는 진행
  (다음 배치 때 다시 물음 — 무해).
- **커스텀 역할**: '칩 러너' 등 `role:'other'` + customRole은 JIT가 그 이름 단가를 물어
  `{role:'other', customRole:'칩 러너', salary}` 자동 생성 — 단가표 시트에 자유입력 UI 불요
  (원안 A/B 분기 소멸).

## C. 접점 3 — 지점 단가표 시트 (관리·보조)

- **진입점**: `VenueSelector` **선택된 지점 칩에 ⚙ 아이콘** → `VenueSettingsSheet` 오픈.
  롱프레스는 발견성 낮아 기각(숨은 설정 문제의 재발 — JIT 철학과 모순).
- **시트 내용**: "역할별 단가" 리스트 — 등록된 역할 행 `[라벨 | 시급 20,000 | 수정]`
  (주문서 `SalarySheet`의 행 패턴 재사용) + "역할 추가"(RoleChips + 커스텀 이름) + 행 삭제
  (삭제 시 그 역할은 다시 JIT/폴백 경로).
- **범위 컷**: 지점 이름 변경 등 기타 설정은 v1 제외 — 단가표만.
- **EditSlotSheet override는 v1 컷**: 개인별 예외는 정산 건별 수정(`customSalaryInfo`,
  `useStaffSettlementsHandlers.ts:267`)이 기배선. EditSlotSheet는 이미 5필드군+삭제로 밀도 높음.

## D. 접점 2 — 지점 정산 화면 + 배지 (구제·가시화)

- **신규 화면**: `app/(employer)/venue-settlements.tsx` — 완성돼 있으나 소비처 0이던
  `getVenueSettlementWorkLogs`(`settlementVenueQuery.ts:85`)의 첫 UI 소비.
- **진입점**: weekly-grid `StackHeader` 우측 "정산" 액션. 월 파라미터는 그리드 현재 월과 동기.
- **UI 재사용**: 기존 `SettlementCard` + `SettlementDetailModal` 그대로(공고 정산과 동일 룩) —
  신규는 목록 껍데기와 월 네비뿐.
- **배지**: 출처 헬퍼가 `fallback` 반환한 카드에 "기본 단가 적용" warning 배지.
  **배지 탭 → `RoleSalaryField` 미니 시트**(접점 1과 동일 컴포넌트) → 저장 →
  쿼리 invalidate로 재계산(정산은 read-time 계산 — refetch로 충분, 서버 재계산 불요).
- `override`(건별 수정)는 기존 `customSalaryInfo` 배선 그대로.

## E. 에러 처리·엣지

- 단가표 쓰기 실패: 토스트 + 슬롯 추가는 계속(접점 1) / 시트 내 재시도(접점 3).
- 커스텀 역할 이름은 기존 `assertSafeText`(XSS) 경유(`addSlotPayload.ts:107` 패턴).
- 금액 상한 `MAX_SALARY_AMOUNT` 클램프(SalarySheet와 동일).
- 컨테이너 schedule에 roleSalaries 부재/이형 데이터 → 빈 배열로 파싱(증발 회피, zod 경량 파서).

## F. 테스트·리뷰 게이트

- TDD 대상: ① 파싱/merge 유틸(빈 schedule·null 증발) ② 출처 헬퍼 3서열
  (override > venueTable > fallback) ③ settlementVenueQuery payload 교체
  ④ AddSlotSheet 조건 노출·스킵·2쓰기 순서 ⑤ 배지 렌더·탭 재계산.
- code-reviewer 필수(배지·재계산 경로). DB 마이그 없음 → `/guard` 불요.
- 예상 파일: 신규 ~5(RoleSalaryField · VenueSettingsSheet · venue-settlements 라우트 ·
  roleSalaries 유틸 · 출처 헬퍼) + 수정 ~4(AddSlotSheet · VenueSelector ·
  settlementVenueQuery · venueContainer 파서).
