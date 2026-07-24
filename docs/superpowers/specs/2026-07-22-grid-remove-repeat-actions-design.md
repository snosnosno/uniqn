# 근무표 정리 — 반복 배치 액션 제거 + 진입 라벨 교정

> 설계 문서 (브레인스토밍 산출물)
> 작성일: 2026-07-22
> 브랜치: `refactor/grid-remove-repeat-actions`
> 워크트리: `C:\Users\user\Desktop\T-HOLDEM-grid` (병렬 auth 세션과 격리)

## 1. 한 줄 요약

근무표(주간 배치 그리드) 화면에서 **일정이 규칙적이라고 가정한 도구 3종**을 제거하고, 진입 라벨의 시점 표현을 뺀다. 남는 것은 사용자가 정의한 3역할 — **달력 조회 · 인원 조정 · 공고 생성 진입점**.

## 2. 배경 — 왜 지우는가

사장의 실제 워크플로우: **"매번 필요한 인원이 다르다."** 이 한 문장이 아래 3개 도구가 깔고 있던 공통 가정을 부정한다.

| 제거 대상 | 깔고 있던 가정 | 부정되는 이유 |
|---|---|---|
| 지난주 복사 | 지난주와 이번 주에 같은 사람이 나온다 | 매번 인원이 다름 |
| 이번 달 같은 요일 전체 적용 | 매주 같은 요일에 같은 인원이 필요하다 | 매번 인원이 다름 |
| "이번 주 근무표" 라벨 | 일정이 주 단위로 반복된다 | 화면은 월 달력인데 "주"라 불림 |

세 도구 모두 **반복을 전제로 한 벌크 수단**이었고, 사장의 실제 패턴(그날그날 다름)과 어긋난다. 게다가 상단 액션 행(지난주 복사 · 출근 확인 요청)은 스크린샷에서 **월 달력의 요일 헤더를 시각적으로 가리는 겹침 버그**를 유발하고 있었다.

## 3. 목표 / 비목표

### 목표
- 근무표 화면을 3역할(조회 · 조정 · 공고 진입)로 정렬
- 상단 액션 행 제거 → 겹침 증상 동시 해소
- 사용자 눈에 보이는 "이번 주 / 지난주 / 주간" 표현 0곳
- 죽은 코드(복사·알림·벌크 경로) 연쇄 정리 + knip 래칫 갱신

### 비목표 (이번 작업에서 건드리지 않음)
- **`weeklyGrid/` 디렉토리명 · `weekly_grid_enabled` 플래그 · `/employer/weekly-grid` 라우트 — 전부 보존.** 내부 식별자이며 사용자에게 안 보임. 리네이밍은 비용만 있고 값 0. (플래그는 현재 prod ON 상태 — 이름 변경 시 원격 조회 어긋나 화면 꺼질 위험)
- **딥링크 파서(`deepLinkRouteParser.ts:182`)의 `weekly-grid` 케이스 — 보존.** 사용자 기기에 이미 도착한 "이번 주 출근 확인" 알림이 눌렸을 때 착지할 라우트. 알림 *생성기*만 제거하고 *수신 경로*는 남긴다.
- **지점 급여 상속 결함 — 별건 분리.** 실사용자 0명이라 급하지 않고, 개인별 급여 정책 미결. (아래 §8 기록)
- **하루 단위 "필요 인원" 입력 — 보존.** 매번 다르면 그날그날 입력이 유일한 수단이므로 오히려 더 중요.
- **작업 C(공고=자리 재정의) — 보류.** 유일한 강한 근거였던 정산 결함이 더 싼 경로로 해결됨.

## 4. 실측 근거 (이번 세션 grep/read)

### 4.1 상단 액션 행
- `app/(employer)/weekly-grid.tsx:317-352` — 대상 주 라벨 + 지난주 복사 버튼 + 출근 확인 요청 버튼
- 관련 핸들러: `:142-204` (`handleCopyLastWeek`, `handleNotifyConfirm`, `weekRange`)
- 관련 import: `:34-36` (`CopyIcon`, `BellIcon`), `:48-52` (훅들)

### 4.2 요일 반복 체크박스 + 벌크 경로 (소비처 = VenueDayPanel 단독)
- `src/components/weeklyGrid/VenueDayPanel.tsx:308-316` — "이번 달 같은 요일 전체 적용" Checkbox
- `:131-207` — `repeatWeekday` state + 벌크 분기 로직
- 벌크 심볼 소비처 grep 결과 **외부 소비처 없음** (VenueDayPanel + 자기 테스트뿐):
  - `useSetVenueSoftTargetBulk` — `src/hooks/weeklyGrid/useSetVenueSoftTargetBulk.ts`
  - `getSameWeekdayDatesInMonth` — `src/domains/weeklyGrid/weekdayDates.ts`
  - `setVenueSoftTargetBulk` — `src/services/weeklyGrid/gridWriteService.ts:29-37` (하는 일 = `setVenueSoftTarget` for 루프)
- **레포 계층 무변경**: 벌크는 단일 저장(`weeklyGridRepository.setVenueSoftTarget`)을 반복할 뿐. 단일 저장 경로는 그대로 산다.

### 4.3 진입 라벨
- `app/(app)/(tabs)/employer.tsx:362` — `"이번 주 근무표"` → `"근무표"`
- 화면 헤더 `weekly-grid.tsx:223` — 이미 `"근무표"` (변경 불필요; 스크린샷은 구 빌드)

### 4.4 연쇄 삭제 후보 (전수 grep 후 확정)
- `src/hooks/weeklyGrid/useCopyLastWeek.ts` + 테스트
- `src/services/weeklyGrid/copyLastWeekService.ts` + 테스트
- `src/domains/weeklyGrid/copyLastWeek.ts` + 테스트
- `src/hooks/weeklyGrid/useNotifyWeeklyBatchConfirm.ts` + 테스트
- `src/domains/weeklyGrid/weeklyBatchNotification.ts` + 테스트
- `src/domains/weeklyGrid/weekRange.ts` + 테스트
- `src/hooks/weeklyGrid/useSetVenueSoftTargetBulk.ts` + 테스트
- `src/services/weeklyGrid/gridWriteService.ts` — `setVenueSoftTargetBulk` export 제거 (파일은 유지)
- `src/domains/weeklyGrid/weekdayDates.ts` (`getSameWeekdayDatesInMonth`) + 테스트 — **`getSameWeekdayDatesInMonth` 외 다른 export가 있으면 그것만 제거**
- 각 barrel export (`hooks/weeklyGrid/index.ts`, `domains/weeklyGrid/index.ts`, `services/weeklyGrid/`)
- 미사용 import 정리 (`CopyIcon`, `BellIcon`, `Checkbox`, `parseDateString`, `getTodayString`, `format` — VenueDayPanel에서 벌크 분기 전용인 것만)

## 5. 구현 슬라이스

### Slice 1 — 상단 액션 행 제거
`weekly-grid.tsx`에서 `:317-352` 블록 + 관련 핸들러/import 제거. ScrollView 구조는 유지(월 네비 → 그리드 → 범례 → 날짜 패널).

### Slice 2 — 요일 반복 체크박스 + 벌크 제거
`VenueDayPanel.tsx`에서 `repeatWeekday` 분기 전체 제거. `handleSaveTarget`은 단일 저장(`setSoftTarget.mutate`) 경로만 남긴다. 벌크 훅/서비스/도메인 심볼 연쇄 삭제.

### Slice 3 — 진입 라벨 교정
`employer.tsx:362` 문자열 `"이번 주 근무표"` → `"근무표"`.

### Slice 4 — 죽은 코드 연쇄 정리 + knip 래칫
§4.4 각 심볼을 **전수 grep으로 호출 0 확인 후** 삭제 (wiki `sources/codebase-cleanup-2026-07`의 "호출0" 프로토콜). knip 재실행 후 래칫(현행 2214) 갱신.

## 6. 테스트 계획 (Red-Green)

| 대상 | 검증 |
|---|---|
| `weekly-grid` 화면 | 액션 행(지난주 복사/출근 확인 요청) DOM 미존재 |
| `VenueDayPanel` | 요일 반복 Checkbox 미존재, 단일 저장 경로 정상 동작 |
| 진입 버튼 | 라벨 텍스트 = "근무표" |
| 기존 그리드 회귀 | 월 네비·날짜 선택·인원 추가·공고 진입 정상 (기존 테스트 통과 유지) |

삭제된 심볼의 테스트 파일은 함께 제거. **남는 테스트가 삭제 심볼을 참조하지 않는지** 확인.

## 7. 검증 게이트 (완료 증거)

- `npx tsc --noEmit` — 0 errors (삭제 후 dangling import 없음 증명)
- `npx eslint .` — 0 errors
- `npm test -- weeklyGrid` (관련 스위트) — 통과
- `npx knip` — 삭제 심볼이 unused 목록에서 사라지고 래칫 갱신
- 화면 회귀: 근무표 진입 → 지점 → 월 달력 → 날짜 탭 → 배치 패널 정상

## 8. 별건 기록 (이번 작업 범위 밖, 후속 결정 필요)

### 8.1 UI 겹침 근본 원인 — 조사 미완
액션 행 제거로 **증상**은 사라지나, 정적으로 겹칠 수 없는 구조가 겹친 **메커니즘**은 미규명. 유사 레이아웃(월 네비 행 등)에 재발 여지. → 별도 조사 필요 (재현 → 경쟁 가설 → 인과사슬).

### 8.2 지점 급여 상속 결함
- `addSlotPayload.ts:113` — 근무표 배치는 `jobPostingId = containerId`(지점 자신)
- `JobPostingRepository.ts:184` — 공고 배치 조회가 컨테이너를 fail-closed 제외
- `settlementVenueQuery.ts:121` → `FALLBACK_SETTLEMENT_CONTEXT`
- `constants.ts:8` — 폴백 기본값 = **시급 ₩15,000** → 근무표로 꽂은 단골 전원 이 값으로 조용히 계산
- **완화 존재**: `useStaffSettlementsHandlers.ts:267` 정산 화면 건별 급여 수정 경로가 이미 배선됨. 계산기는 `helpers.ts:254`에서 `customSalaryInfo` 최우선.
- **미결 정책**: 개인별 급여(경력별 차등)를 지점 기본값이 커버 못 함 → 지점 급여만 넣으면 ₩15,000 오답이 ₩18,000 오답이 될 뿐. 정책 결정 후 착수.

### 8.3 필요 인원 하향 불가
`buildGridCells.ts:37` — `effectiveTarget = Math.max(manual, requiredCount)`. 공고에서 파생된 값보다 낮은 수동값은 무시됨. "매번 다르다"면 하향도 필요할 수 있으나 현재 상향만 가능. → 후속 결정.

## 9. 리스크

| 리스크 | 완화 |
|---|---|
| 삭제 심볼의 숨은 소비처 | 각 심볼 전수 grep 후 삭제 (§4.4) |
| 딥링크/플래그/라우트 오삭제로 화면 꺼짐 | 명시적 비목표로 고정 (§3) — 보존 |
| 남은 테스트가 삭제 심볼 참조 | tsc + test 게이트로 포착 |
| `confirmAction` 오삭제 (3회 사용 — 다른 곳도 씀) | VenueDayPanel 내 벌크 분기 전용인지 확인 후만 제거 |
| 병렬 auth 세션과 커밋 혼입 | 격리 워크트리에서 작업 (완료) |
