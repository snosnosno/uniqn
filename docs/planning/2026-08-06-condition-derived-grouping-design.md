<!-- /autoplan restore point: ~/.gstack/projects/snosnosno-uniqn/fix-date-picker-guidance-merge-autoplan-restore-20260806-233240.md -->
# 조건 유도 그룹핑 — 주문서 일정 섹션 재설계 (2026-08-06)

> 상태: 초안 (autoplan 리뷰 전) | 대상: `uniqn-mobile/src/components/employer/order-sheet/`
> 선행 논의: 2026-08-06 세션 — 3지 세그먼트 문구 개선 커밋 3개(`cce9316ee`·`4688de8e0`·`b039b32e4`, 워크트리 T-HOLDEM-datepick)와 별개로 출하 가능

## 0. 한 줄 요약

날짜 선택 모달의 3지 세그먼트("모든 날짜 같은 조건 / 연속 날짜 묶음 지원 / 날짜마다 따로")를 제거하고, 사장은 **사실(날짜·시간·역할)만 입력**하며 그룹은 **조건 시그니처로 시스템이 자동 도출·표시**한다. 묶음지원은 "조건 동일 + 연속 2일 이상" 구간에만 붙는 토글로 전환한다.

## 1. 문제 (전제)

- **P1. 사장은 "그룹"이라는 편집 단위 개념을 이해할 필요가 없다.** 현행 3지 세그먼트는 저장 형식에 존재하지 않는 개념(그룹 선택)을 조건 입력 **전에** 묻는다. 실사용자(홀덤펍 사장)가 "이거 사실상 같은 거 아니야?"를 두 번 물은 것이 이 세션의 출발점.
- **P2. 저장 형식이 이미 조건 유도 그룹핑이다.** DB에는 그룹이 없다 — 날짜별 `requirements[i]` + `isGrouped` 플래그뿐이고, 그룹은 읽기 시 "연속 + 시그니처 동일"로 재계산된다(`utils/order-sheet/mappers.ts:349-360`, `utils/assignment/selectionUtils.ts:112-118`). UI가 저장 모델을 따라가면 개념 하나가 사라진다.
- **P3. ③("날짜마다 따로")은 결과가 아니라 편집 준비다.** 조건을 안 바꾸면 임시저장 복원 시 시그니처 병합으로 ①과 동일해진다(실측). 결과가 다른 선택지는 ②(묶음지원)뿐.
- **P4. 측정 계기판이 없다.** Sentry release 미태깅·애널리틱스 부재·prod users 27 — 어느 옵션이 쓰이는지 알 수 없으므로, 기능 삭제 없이 **표현만** 바꾼다.

## 2. 목표 / 비목표

### 목표
- 날짜 선택 모달에서 구조 질문 0개 (세그먼트 제거)
- 최빈 케이스(전 날짜 동일 조건): 조건 입력 1회로 완결 — 현행과 동일하되 선택지 강요 없음
- 예외 케이스(일부 날짜만 다름): 예외 날짜만 추가 편집 — 현행 ③(전량 분할 후 N회 입력)보다 입력 횟수 감소
- 묶음지원(②)은 결과가 눈에 보이는 위치(조건 확정 후 카드)에서 토글
- 재진입 병합(현행 함정)을 **버그가 아니라 일관 동작**으로 전환 — UI 규칙 = 저장 규칙
- 저장 형식·왕복 매퍼·지원자 화면(AssignmentSelector) **무변경**

### 확장 채택 (2026-08-06 전제 게이트 — 사용자 승인)
- **선택 로깅**: 묶음지원 토글·예외 추출·자동 병합 발생을 `logger.observability`(관측 계층 전용 — Sentry 재귀 가드 준수)로 기록. P4(측정 부재)를 실제로 고치는 항목 — 카드 UI가 실사용에서 어떻게 쓰이는지 최초의 계기판.
- **암묵 동작 고지 2종**: ① 자동 병합 토스트("같은 조건이라 하나로 합쳐졌어요") ② 새 날짜 조건 승계 고지(카드 2개 이상일 때 어느 카드 조건을 받는지 명시 또는 선택).

### 범위 결정 기록 (전제 게이트)
- 독립 리뷰어(fable)의 "단계 출하 강등" 권고는 **사용자가 기각** — 근거: 정식 출시 전이라 전면 재설계의 기회비용이 낮고, 출시 후 재작업이 더 비싸다. 전면 재설계(A)로 확정.
- 기간 템플릿 프리셋·공고 복제 버튼: **TODOS.md 이연** (이 화면 밖 범위).

### 비목표 (명시적 포기)
- **비연속 날짜 묶음지원** ("8/10과 8/15 둘 다 나올 사람만") — 저장 형식 한계(그룹 id 없음). 현행도 불가. 스키마 변경(3계층 파급)은 별도 과제.
- fixed(고정 공고) 플로우 — 이 섹션을 쓰지 않음(`dateCapReached`에서 이미 제외).
- 공고 발행 후 편집 시맨틱 변경 — 기존 edit 모드 규칙 유지.

## 3. 핵심 설계

### 3.1 단일 정규화 함수 (DRY 핵심)

`mappers.ts:324-370`의 복원 그룹핑 로직을 공유 유틸로 추출한다:

```
// src/utils/order-sheet/normalizeScheduleGroups.ts
normalizeScheduleGroups(groups: FormGroup[]): FormGroup[]
```

계약 (Eng 리뷰 F-1 개정 — ⚠️ 기존 복원 로직과 **동일하지 않다**, 규칙 2의 강등이 신설 정규형):
0. **dates가 빈 그룹은 평탄화에서 제외하고 원형 그대로 결과 뒤에 보존** — 템플릿 프리셋
   (`templateToValues`)이 조건만 있는 빈 그룹 N개를 만들므로, 이 규칙이 없으면 첫 뮤테이션에서
   템플릿의 2번째 이후 조건이 침묵 유실된다 (Eng F-2).
1. 그룹들을 (date, slotsSignature, grouped) 레코드로 평탄화. slotsSignature = **정준(키 정렬)**
   직렬화(stripSlotIds 후) — 단일 소스 함수로 mappers와 공유.
2. `grouped=true` 레코드: 연속 + 동일 시그니처 run → 하나의 grouped 그룹. **run 길이 1이면
   `grouped=false` 강등 — 신설 정규형**(구 복원 로직은 grouped 싱글턴을 보존했다,
   `mappers.ts:334-346`). 채택 근거: 지원자 화면 의미론상 중립 — `selectionUtils.ts`에서 길이 1
   run은 어차피 단독 그룹으로 렌더되어 묶음이 성립하지 않으므로 **바이트는 변해도 행동은 동일**.
   UI(토글이 run≥2에만 렌더)와 정합 — 강등 없이는 해제 불가능한 좀비 grouped 카드가 생긴다.
   ⚠️ 파급: `mappers.test.ts:296`·`:317` 단언은 신 정규형으로 **갱신 대상**(그린 유지 아님),
   기존 발행 공고를 edit로 열어 저장하면 grouped 싱글턴 날짜의 `isGrouped`가 드롭될 수 있음
   (행동 중립이나 데이터 영향으로 §8.8에 등재).
3. `grouped=false` 레코드: 시그니처별 병합 → 시그니처당 그룹 1개 (비연속 dates 허용). 그룹 간
   중복 날짜는 dedupe(승자 결정성 테스트 필수 — Undo 재삽입 경로에서 발생 가능, Eng F-4).
4. 그룹을 최소 날짜 기준 정렬 (결정적 순서).

**폼 상태는 `scheduleGroups` 유지**(스키마 무변경). 모든 뮤테이션(날짜 확정·조건 확정·예외 추출·토글) 후 `normalizeScheduleGroups`를 통과시킨다. `fromDraftValues` 복원부도 이 함수를 소비하도록 교체 — 폼과 복원이 한 구현을 공유해 재진입 병합 서프라이즈가 정의상 소멸한다.

**RHF 상호작용 규칙 (Eng Q1 확정)**: normalize는 confirm 핸들러에서만 호출(watch 기반
useEffect 호출 금지 — 무한 재검증 루프). **confirm 핸들러는 watch/렌더 클로저의
scheduleGroups 금지, `form.getValues()` 필수**(정규화 재정렬 후 stale 클로저가 엉뚱한 카드에
덮어쓰는 사고 방지 — 현행 `OrderSheetScreen.tsx:1104`가 이미 이 함정 위에 있음). run/요약
파생값은 useMemo.

**run 토글 구현 노트 (Eng F-6)**: 폼의 `grouped`는 그룹 단위 플래그이므로, run 부분 토글은
normalize 호출 전 선분할 헬퍼 `setRunGrouped(groups, cardIdx, run, on)`가 그룹을
`{run, grouped:on}` + 나머지로 쪼갠 뒤 normalize에 넘긴다 — 신설 코드패스로 테스트 대상.

### 3.2 화면 구조 (일정 섹션)

```
┌ 일정 ──────────────────────────────────┐
│ [날짜 요약 행]  8/10 8/11 8/12 8/13  4일 │ ← 탭=날짜 모달(추가/해제만)
├────────────────────────────────────────┤
│ [조건 카드 × 시그니처 클래스]             │
│  카드A: 8/10~8/11 · 8/13                │
│   18:00 · 딜러2                          │ ← 탭=시간·역할 시트(이 카드 스코프)
│   ⊞ 8/10~8/11 통째로 지원받기      ◯    │ ← 연속 run(≥2)마다 토글
│   [이 카드에서 일부 날짜만 다르게]        │ ← 예외 추출 진입
│  카드B: 8/12                             │
│   20:00 · 딜러2 서빙1                    │
└────────────────────────────────────────┘
```

- 카드 = 정규화 결과의 그룹. 카드 수·경계는 사장이 고르는 게 아니라 조건이 결정.
- 카드가 1개면(최빈) 현행 단일 그룹 UI와 동일한 밀도 — 회귀 없음.

### 3.3 날짜 선택 모달

- 세그먼트 완전 제거. `ScheduleDatesSheet`의 `showSegment`/`initialSegment`/`segment` 반환 삭제 → `DatePickerModal` 직접 사용 수준으로 얇아짐.
- 새 날짜는 **기본 카드(첫 그룹)에 편입** — 조건 승계. 해제된 날짜는 소속 그룹에서 제거.
- `renderAboveCalendar` 슬롯은 유지하되 이 화면에서는 미사용 (다른 소비처 없음 확인됨 — 제거 여부는 구현 시 결정).

### 3.4 예외 추출 플로우 (설계 난제 ① 해법)

"이 카드에서 일부 날짜만 다르게" 탭 →

```
┌ 시간·역할 (예외 편집) ────────────────┐
│ 적용할 날짜  [8/10] [8/11] [8/13]     │ ← 다중 선택 칩(카드의 날짜들), 최소 1개
├──────────────────────────────────────┤
│ (기존 ScheduleSlotsSheet 본문 그대로)  │
└──────────────────────────────────────┘
```

- confirm 시: 선택 날짜들을 새 그룹으로 추출(조건=시트 결과) → `normalizeScheduleGroups` → 저장.
- **다중 예외를 1회 입력으로 처리** — 현행 ③ 대비 대회사 케이스 후퇴 없음(8/12·8/13이 같은 예외면 입력 1회).
- 전 날짜를 선택하면 추출이 아니라 카드 전체 편집과 동일 → 그대로 허용(정규화가 처리).
- 진입점이 카드 내부이므로 발견성 리스크는 상시 노출 버튼으로 완화. 문구는 카드 날짜가 2개 이상일 때만 노출.

### 3.5 묶음지원 토글 (② 대체)

- 카드 내 연속 run(길이≥2)마다 한 줄: `"8/10~8/11 통째로 지원받기 (하루만 지원 불가)"` + Switch.
- ON: 해당 run의 날짜들에 `grouped=true` → 정규화가 run별 그룹으로 분리(`grouped` run 규칙).
- OFF: `grouped=false` → 정규화가 시그니처 병합으로 원위치.
- **자동 해제 고지 (난제 ⑤)**: 예외 추출·날짜 해제로 grouped run이 깨져 토글이 사라지거나 해제될 때 토스트 1회 — `"연속 일정이 바뀌어 묶음지원이 해제됐어요"`. 판정 = 뮤테이션 전후 grouped run 집합 비교.
- 무효 조합(③+묶음)은 구조적으로 표현 불가 — 토글이 "조건 동일+연속" run에만 렌더되므로.

### 3.6 검증 에러 매핑 (난제 ②)

- zod 스키마(`orderSheet.schema.ts`)는 그룹 기반 유지 — 무변경.
- 화면 매핑: 정규화가 결정적 정렬을 보장하므로 `rowError('dates'|'time'|'roles', gi)`는 **카드 인덱스**로 계속 성립. 날짜 요약 행 에러 = 전 그룹 dates 에러 합산. 카드 에러 = 해당 그룹 에러.
- 즉 "groupIndex→날짜 재매핑"은 불필요해짐 — 카드가 곧 그룹이므로 기존 매핑 재사용. 바뀌는 건 에러의 **표시 위치**(요약 행/카드)뿐.

### 3.7 시트 타깃 안정성 (난제 ④)

- 정규화는 그룹 순서를 바꿀 수 있다 → **모든 뮤테이션 직후 `clearPendingSwap()`** (기존 그룹 삭제 시 패턴 `OrderSheetScreen.tsx:423-427`과 동일). 연쇄 예약(180ms pendingSwap)은 뮤테이션이 없는 행 이동에만 살아남는다.
- 시트 confirm 은 groupIndex 를 스냅샷이 아니라 **confirm 시점 재해석**: 카드 시트는 열 때 카드의 날짜 집합을 기억하고, confirm 시 그 날짜들이 속한 현재 그룹에 적용(stale index 방지). 날짜 집합이 더 이상 존재하지 않으면 조용히 버리는 대신 토스트 고지.

### 3.8 30일 칩 레이아웃 (난제 ③)

- 날짜 요약 행: `flex-wrap`, 최대 2줄 + `"외 N일"` 확장 토글. tournament(30일)에서 세로 폭 폭주 방지.
- 카드 헤더의 날짜 표기: 연속 run은 `8/10~8/13`으로 압축, 비연속은 `·` 나열, 5개 초과 시 `외 N일`. 기존 `summarizeGroupDates` 확장.

## 3.9 화면 명세 보강 (Phase 2 디자인 리뷰 반영, 2026-08-06)

독립 디자인 리뷰(fable) 13건 발견 → 12건 자동 반영, 1건(승계 UX 변형) 최종 게이트.

**[F1] 단일 카드 축약 규칙** — 카드 1개일 때: 카드 헤더의 날짜 재표기 생략(요약 행이 대신),
run 토글은 연속 run 존재 시에만, 예외 버튼은 날짜 2+일 때만. 최빈 케이스는 현행 3행 밀도 유지:
```
┌ 일정(카드 1개) ──────────────┐   ┌ 일정(카드 2개+) ────────────────┐
│ 8/10 8/11 8/12 8/13     4일 ›│   │ 8/10 8/11 8/12 8/13   4일 · 총6명›│
│ 18:00 · 딜러 2              ›│   │ ── 8/10~8/11 · 8/13 ──────── ✕ │
│ ⊞ 8/10~8/11 통째로 받기   ◯ │   │   18:00 · 딜러 2              ›│
│ (버튼: 일부 날짜만 다르게)     │   │   ⊞ 8/10~8/11 통째로 받기  ◯ │
└─────────────────────────────┘   │   [⑂ 일부 날짜만 다르게]        │
                                  │ ── 8/12 ──────────────────── ✕ │
   빈 상태(날짜 0):               │   20:00 · 딜러 3              ›│
│ 날짜를 골라 시작하세요        ›│   └────────────────────────────────┘
   (카드·토글·예외 버튼 미노출)
```
**[F2] 날짜 칩 탭 = 소속 카드로 스크롤+하이라이트** (예외 추출 제2 진입로). 칩은 인터랙티브 —
DESIGN.md pill 규칙 준수(비인터랙티브면 pill 금지였음). **[F3]** 카드 2+일 때 총원 캡션(`summarizeTotalRoles`) 유지.
**[F4]** 빈 상태 = 위 다이어그램(단일 CTA 행). **[F5]** 미완성 카드: "18:00 · 역할을 정해주세요"
muted 표기(zod 에러의 빨강과 구분 — 미설정≠에러). **[F6] 토스트 정책**: 한 뮤테이션당 최대 1개,
우선순위 **카드 소멸(조건 유실+되돌리기) > 묶음해제 > 병합 > 승계**(정보 손실 큰 순 —
Eng F-3: 날짜 해제로 카드의 유일한 날짜가 사라지면 그 카드의 조건 전체가 유실되므로
"8/12 조건이 함께 삭제됐어요 + 되돌리기" Undo 토스트 필수, silentLoss 클래스 신설 방지).
dedupe 발생(Undo 재삽입 중복 등)도 무고지 금지 — 병합 토스트로 승격(Eng F-4).
**[F7] 예외 추출 3중 진입로**: ① 카드 내 버튼 — ghost 아님, ⑂ 분기 아이콘+보더 명시(muted 텍스트 금지)
② F2 칩 탭 경로 ③ 시간·역할 시트 하단 "일부 날짜만 다르게 할까요?" 링크(조건 고치러 들어간 자리가
예외를 깨닫는 자리). **[F8] 병합·분리·재정렬 모션**: Reanimated Layout 200ms(`MOTION_DURATION` 토큰,
`@/constants/motion`) + 병합 결과 카드 스크롤 앵커 유지 + `useReduceMotion` 분기.
**[F9] 체이닝 보존 (CRITICAL)**: §3.7 "뮤테이션 시 clearPendingSwap"의 **예외 조항** — 시간 미설정
신규 카드를 만드는 날짜 confirm은 체이닝을 보존한다. 재예약 타깃은 groupIndex가 아니라 **날짜집합**으로
기술하고 confirm 시점에 재해석(신규 작성의 날짜→시간 유도가 이 화면 최다 트래픽 전환점).
**[F10] 승계 휴리스틱**: 추가 날짜와 연속 인접한 카드 > 없으면 첫 카드. 토스트 문구:
"8/14을 8/10~8/11 조건으로 추가했어요 — [다른 조건으로]" → 액션 = 카드 선택 액션시트.
**[F11] 예외 시트 초기 상태**: 적용할 날짜 0개 선택으로 열고 confirm 비활성 + 헬퍼
"다르게 할 날짜를 골라주세요" · 본문 = 현재 카드 조건 깊은복사 시드 · 타이틀 "시간·역할 — 일부 날짜만".
**[F12] 삭제 = 현행 X 버튼 유지**(카드 헤더 우측, hitSlop 14 — 검증된 패턴. 컨텍스트 메뉴 도입 철회),
라벨 "이 날짜들 삭제". **[F13] 토글 행**: min-h 44px + 세로 hitSlop 0 + Switch 탭 영역은 행 우측
절반(라벨 탭도 동일 토글 — switch 관례), impeccable §5.
**[F-minor]**: 다크 토큰 명시(칩 `bg-surface-page dark:bg-surface`, 디바이더 `bg-secondary-100
dark:bg-surface-overlay` — 기존 그룹 UI와 동일) · a11y 대체물(토글 `accessibilityRole="switch"`+결과
설명 라벨, "외 N일" `accessibilityState={{expanded}}`, 카드 헤더 통합 라벨) · **E2E 토글 상태 판정은
가시 텍스트로**(웹에서 accessibilityState 무효 — 프로젝트 실측 규칙) · 카드 10+(대회사 30일 교차)는
월 구분 서브헤더로 구획.

## 4. 무엇이 사라지고 무엇이 남나

| 요소 | 처분 |
|---|---|
| `ScheduleSplitMode`·3지 세그먼트·`buildSegments` | 삭제 (문구 개선 커밋 3개는 이 삭제 전까지의 브리지) |
| `handleDatesConfirm`의 separate/grouped 분기 | `normalizeScheduleGroups` + grouped 플래그 세팅으로 대체 |
| `+ 일정 추가` 버튼 | 삭제 — 날짜 추가는 날짜 요약 행, 조건 분화는 예외 추출로 흡수 |
| 그룹 삭제 + Undo 토스트 | 유지 (카드 컨텍스트 메뉴로 이동) — 단, "그룹 삭제"가 아니라 "이 날짜들 삭제" 라벨 |
| `grouped` 폼 필드·`isGrouped` 저장 | 무변경 |
| `mappers.ts` 쓰기 방향(`toDraftValues`) | 무변경 |
| `mappers.ts` 읽기 방향 그룹핑 | `normalizeScheduleGroups` 소비로 교체(동작 동일, 구현 공유) |

## 5. 변경 파일 (예상)

| 파일 | 변경 |
|---|---|
| `utils/order-sheet/normalizeScheduleGroups.ts` | 신설 — mappers 복원 로직 추출 |
| `utils/order-sheet/mappers.ts` | 복원부를 신설 유틸 소비로 교체 |
| `components/employer/order-sheet/OrderSheetScreen.tsx` | 일정 섹션 렌더·핸들러 재작업 |
| `components/employer/order-sheet/sheets/ScheduleDatesSheet.tsx` | 세그먼트 제거(대폭 축소) |
| `components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx` | "적용할 날짜" 다중 선택 행 추가(예외 모드) |
| `components/employer/order-sheet/orderRowMeta.ts` | **체이닝 좌표계 개편 — 과소 견적 주의**(Eng F-5): `OrderRowTarget{key,groupIndex}`·`nextUnsetRowAfter`·`getRowState`·submit 에러 라우팅·CTA 라벨이 전부 인덱스 좌표계. F9 날짜집합 재해석은 발화 시점(180ms 콜백) 해석 계층 필요 + 날짜 압축 표기 |
| 테스트 | scheduleGroups·chain·silentLoss·edit 스위트 갱신 + normalize 유닛 신설 |

지원자 화면·스키마·서버·마이그레이션: **0건**.

## 6. 예외 상황 커버리지 (설계 검증표)

| 시나리오 | 동작 |
|---|---|
| 묶음 ON 중 가운데 날짜 조건 변경 | run 재계산 → 남은 run≥2면 유지, 아니면 자동 해제+토스트 |
| 예외 조건을 원복 | 정규화가 즉시 재병합 — 화면에서 바로 보임(재진입 서프라이즈 소멸) |
| 날짜 0~1개 | 카드 1개·토글 미노출·예외 버튼 미노출로 자연 퇴화 |
| 급구 7일 제한·타입별 상한 | `DatePickerModal` 계층 그대로 |
| 임시저장/프리셋 왕복 | 동일 정규화 함수 공유 — 정의상 일치 |
| 역할별 급여 동기화 | `applyRoleSalarySync(nextGroups)` 전 그룹 대상 호출 유지 |
| E2E 참조 | 세그먼트 testID·문구 e2e 참조 0건 실측(2026-08-06). 구현 시 재Grep 필수(eslint 사각지대 규칙) |
| 발행 후 편집(edit 모드) | 카드 UI 동일. 발행 공고의 근무 로그 동기화는 기존 update 경로 무변경 |

## 7. 롤아웃

- 순수 클라이언트 변경 — 마이그레이션 0건, 파리티 무관, OTA 배포 가능.
- 피처 플래그 없음(화면 계층 git revert 가능). 단, 출하 순서: 문구 개선 커밋 3개 먼저 머지 → 본 재설계는 별도 PR.
- 실기기 QA 항목: 예외 추출 발견성 / 30일 요약 행 / 375pt 캘린더 가시성.

## 8. CEO 리뷰 산출물 (autoplan Phase 1, 2026-08-06)

### 8.1 아키텍처 다이어그램 (신규 컴포넌트 ↔ 기존)

```
                    ┌─ OrderSheetScreen ──────────────────────────┐
                    │  ScheduleSection (신설 — 화면에서 분리 추출)   │
                    │   ├ DateSummaryRow (칩 wrap + 외N일 확장)     │
                    │   ├ ConditionBlock ×N (디바이더 분리 — 중첩   │
                    │   │   카드 금지, impeccable §6)               │
                    │   │   ├ run 토글 (연속≥2 & 동일조건에만)      │
                    │   │   └ [일부 날짜만 다르게] 진입             │
                    │   └ 고지 토스트 2종 (병합·승계)               │
                    └───────┬──────────────────┬──────────────────┘
                            │ mutation 후 항상  │ 열기/confirm
                            ▼                  ▼
              normalizeScheduleGroups   ScheduleSlotsSheet(+적용날짜 다중선택)
              (신설 util — 단일 정규화)         │ confirm={dates, slots}
                            ▲                  │ (날짜집합 기반 — index 아님)
                            │ 소비             ▼
              mappers.fromDraftValues    form.setValue → zod → 재렌더
              (복원부를 신설 util로 교체)
   무변경: DatePickerModal(세그먼트만 제거) · AssignmentSelector · 스키마 · 서버
```

### 8.2 데이터 플로우 + 그림자 경로

```
입력(시트 confirm) ─▶ 검증(zod 그룹 스키마) ─▶ normalize ─▶ setValue ─▶ 렌더
   │                     │                      │              │
   ▼                     ▼                      ▼              ▼
[stale 날짜집합?]    [빈 dates?]          [빈 결과?]      [카드 순서 변경?]
 → 토스트 고지        → 시드 빈 그룹        → 시드 빈 그룹    → pendingSwap 취소
[중복 날짜?]         [grouped 단일날짜?]   [key 순서 다른     (기존 삭제 패턴)
 → normalize 가       → false 강등          동일 슬롯?]
   dedupe(방어)                             → 정준 직렬화로 동일 시그니처
```

### 8.3 카드 상태 머신

```
 [기본 카드] ──일부 날짜만 다르게(조건 변경)──▶ [분리 카드들]
     ▲                                             │
     └────조건 원복(시그니처 일치)──자동 병합+토스트──┘
 [run 토글 OFF] ──ON(grouped=true)──▶ [run별 분리·묶음지원]
     ▲                                    │
     └──OFF 또는 run<2로 붕괴(자동해제+토스트)┘
 불가능 전이: 비연속 날짜 묶음(토글이 렌더되지 않음) ·
              조건 상이 카드 간 묶음(토글은 카드 내부 run에만)
```

### 8.4 Error & Rescue Registry

| 코드패스 | 실패 모드 | 처리 | 사용자에게 |
|---|---|---|---|
| normalizeScheduleGroups | timeSlots undefined/필드 결손 | `?? []` 방어 + 정준 직렬화 | 없음(투명) |
| 〃 | 중복 날짜(그룹 간) | dedupe(마지막 승리) — 스키마 E1이 1차 차단, 방어 유지 | 없음 |
| 〃 | grouped=true 단일 날짜 | false 강등(기존 run 규칙) | run 소멸 시 토스트 |
| slotSignature | 키 순서 다른 동등 슬롯 | **정준(키 정렬) 직렬화** — 미처리 시 유령 카드 분리 | 없음 |
| 예외추출 confirm | 대상 날짜집합이 이미 소멸(stale) | 적용 포기 + 토스트("일정이 바뀌어 반영하지 못했어요") | 토스트 |
| Undo 복원 | normalize 재정렬로 인덱스 무효 | 복원 후 normalize 재통과(동일 시그니처면 재흡수 — 올바른 동작) | 카드 복귀 |
| logger.observability | 전송 실패 | fire-and-forget(기존 재귀 가드) | 없음 |
| 빈 그룹 결과 | 전 날짜 삭제 | **시드 빈 그룹 1개 유지 계약**(mappers.ts:45 초기 상태와 동형) | 빈 상태 CTA |

### 8.5 Failure Modes Registry

| 코드패스 | 실패 모드 | 처리? | 테스트? | 사용자? | 로그? |
|---|---|---|---|---|---|
| normalize 병합 | 사장 모르게 카드 소멸 | Y(토스트) | Y | 토스트 | Y(auto_merge) |
| normalize 강등 | 묶음지원 침묵 해제 | Y(토스트) | Y | 토스트 | Y(bundle_demote) |
| 새 날짜 승계 | 잘못된 조건으로 발행 | Y(토스트+변경 액션) | Y | 토스트 | Y(inherit_notice) |
| 시그니처 드리프트 | 스키마 진화로 유령 분리 | 부분(정준화) | Y(안정성 테스트) | 잠재 | N ← **잔존 리스크, §10 주석 의무** |
| stale confirm | 입력 유실 | Y(토스트) | Y | 토스트 | Y |

CRITICAL GAP: 0건 (시그니처 드리프트는 완화+문서화로 수용 — 저장 형식 무변경 결정의 알려진 비용).

### 8.6 관측 이벤트 명세 (확장 채택분)

`logger.observability` 전용(웹 Sentry 재귀 가드 준수 — 가드 2종이 다른 경로를 막음):
- `order_sheet.bundle_toggle` {on, runLength}
- `order_sheet.exception_extract` {dateCount, totalDates}
- `order_sheet.auto_merge` {cardsBefore, cardsAfter}
- `order_sheet.inherit_notice` {cardCount}
싱크는 Sentry 로그 — 대시보드 없음(수용: 최초 계기판으로 충분, prod 트래픽 27명 수준).

### 8.7 인터랙션 에지 케이스

| 인터랙션 | 에지 | 처리 |
|---|---|---|
| 예외추출 confirm | 더블탭 | activeSheet null 가드(기존 패턴) |
| run 토글 | 연타 | normalize 멱등 — 무해 |
| 날짜 삭제 | grouped run 가운데 날짜 제거 | run 2분할, 각 run≥2면 유지·아니면 강등+토스트 |
| 30일 확장 행 | normalize 후 접힘 상태 | 접힘 유지(로컬 state) |
| 삭제 Undo | 만료 직전 예외추출 | clearPendingSwap(기존) |
| 전 날짜 선택 예외추출 | = 카드 전체 편집 | 그대로 허용, normalize가 처리 |

### 8.8 Deployment / Rollback
- 마이그레이션 0 · 플래그 0 · 드래프트 형식 무변경 → **구/신 양방향 호환**(구 앱이 신 드래프트 읽기 OK, 역방향 OK).
- **예외(Eng F-7①)**: 기존 발행 공고를 edit로 열어 저장하면 grouped 싱글턴 날짜의 `isGrouped`가
  강등 정규형에 따라 드롭될 수 있음 — 지원자 화면 행동은 중립(§3.1 근거)이나 데이터 바이트 변화로 기록.
  회귀 게이트: **edit 로드→무편집 저장 시 requirements 의미 동등** 테스트(§9.2).
- 롤백 = git revert → 웹 재배포 + OTA 재발행. 사전 재fetch 규칙(feedback_ota_refetch) 준수.
- 스모크: 공고 작성 E2E 스펙 그린 + `e2e/` 별도 Grep(상수·문구 변경분).

## 9. 테스트 계획

```
NEW UX FLOWS: 날짜요약행 편집 · 예외추출(다중날짜) · run 토글 ON/OFF ·
  자동병합 토스트 · 승계 토스트+변경액션 · 30일 확장 · stale 토스트 · 카드삭제 Undo
NEW CODEPATHS: normalize(run분리·병합·강등·정렬·dedupe·빈시드) ·
  slotSignature 정준화 · extractDatesToGroup · run 계산
NEW DATA FLOWS: mutation→normalize→setValue · fromDraftValues→normalize
```

1. **normalize 유닛** (새벽 2시 테스트): 멱등성 property(`normalize∘normalize=normalize`) ·
   병합 · run 분리 · grouped 강등 · 정렬 결정성 · 중복 날짜 dedupe · 빈 시드 그룹 계약 ·
   **키 순서 다른 동등 슬롯 → 동일 시그니처**(적대적 QA 케이스).
2. **매퍼 왕복**: draft→values→draft에서 requirements 집합·isGrouped·시그니처 보존
   (기존 왕복 테스트 그린 + normalize 경유 후 재확인). fromDraftValues와 normalize가
   **한 구현**임을 import 수준에서 단언(중복 구현 회귀 방지).
3. **컴포넌트**: 세그먼트 부재 / 예외추출 1회 입력→다중 날짜 분리 / 토글 ON→run 분리·
   OFF→병합 / 강등·병합·승계 토스트 각 1회 / stale confirm 무유실(silentLoss 패턴 승계) /
   빈 상태 CTA / 30일(15카드 교차 조건) 렌더.
4. **회귀**: `OrderSheetScreen.scheduleGroups`·`chain`·`silentLoss`·`edit`·`timeSlots`·
   `presets`·`salarySync`·`tournament` 스위트 갱신(Eng F-8 — 세그먼트·`+ 일정 추가` testID 삭제로
   대량 단언 갱신). `ScheduleDatesSheet.test` 재작성. ⚠️ **`mappers.test.ts:296`·`:317`은
   그린 유지가 아니라 신 정규형(강등)으로 단언 교체 대상**(F-1).
4b. **신설 회귀(Eng)**: 템플릿 다중 그룹 생존(F-2) · 카드 소멸 토스트+Undo(F-3) · dedupe
   결정성·Undo 중복(F-4) · confirm↔스왑 발화 사이 자동 병합 경쟁 — 올바른 카드 시트 열림(F-5) ·
   **edit 로드→무편집 저장 requirements 의미 동등**(F-1 회귀 게이트, 가장 값싼 안전망) ·
   normalize no-op 시 isDirty 미오염 · F8 모션의 웹(react-native-web) 렌더 확인은 실기기 QA 항목.
5. **E2E 사각지대**: 삭제되는 문구·testID(`order-sheet-dates-segment-*`)를 `e2e/` 전체
   Grep — page object 간접 참조 포함(PR#423 vacuous 교훈: 참조 0건도 명시 기록).
6. Red-Green: 신규 회귀 테스트는 수정 revert로 FAIL 확인 후 커밋(전역 verification 규칙).

## 10. NOT in scope / 기존 자산 / 드림 델타

**NOT in scope**: 비연속 묶음지원(스키마 한계) · fixed 플로우 · 발행 후 편집 시맨틱 ·
기간 템플릿 프리셋(TODOS) · 공고 복제 버튼(TODOS) · 그룹 id 스키마(12개월 이상향 —
§8.5 시그니처 드리프트가 실제 문제가 되는 시점에 착수, 이 카드 UI는 그때도 재사용).

**What already exists (재사용)**: mappers 복원 그룹핑(→추출) · handleDatesConfirm 분기
(→대체) · Undo 토스트 패턴 · hasGroupableDates/groupConsecutiveDates ·
ScheduleSlotsSheet 본문 · summarizeGroupDates(→확장) · silentLoss 테스트 패턴.

**드림 델타**: 이 PR 후 = "질문 0개 + 조건 유도 카드 + 최초 관측 계기판".
12개월 이상향까지 남는 것 = 그룹 id 스키마(비연속 묶음) — 이 UI가 그 위에 그대로 얹힘.

## 11. 결정 감사 추적 (autoplan)

| # | Phase | 결정 | 분류 | 원칙 | 근거 |
|---|---|---|---|---|---|
| 1 | CEO-0F | 모드=SELECTIVE EXPANSION | 기계적 | 오버라이드 | autoplan 강제 |
| 2 | CEO-게이트 | 범위=전면 재설계(A) | **사용자 결정** | — | 출시 전 — 리뷰어 강등 권고 기각 |
| 3 | CEO-게이트 | 확장: 선택 로깅 채택 | 사용자 결정 | P2 | blast radius 내 <1일 |
| 4 | CEO-게이트 | 확장: 고지 2종 채택 | 사용자 결정 | P1 | 암묵화 리스크 완화 |
| 5 | CEO-게이트 | 기간템플릿·공고복제 → TODOS | 사용자 결정 | P3 | 화면 밖 범위 |
| 6 | CEO-S1 | 빈 그룹=시드 1개 유지 계약 | 기계적 | P5 | 소비처(초기상태·스키마) 최소 교란 |
| 7 | CEO-S2 | slotSignature 정준(키 정렬) 직렬화 | 기계적 | P1 | 키 순서 유령 분리 차단 |
| 8 | CEO-S4 | 새 날짜 승계 = 토스트+변경 액션 (모달 선택지 아님) | **취향** | P3 | 최종 게이트로 승격 |
| 9 | CEO-S5 | ScheduleSection 컴포넌트 분리 | 기계적 | P5 | 1,201줄 파일 — 800줄 규칙 |
| 10 | CEO-S5 | 시그니처 함수 단일 소스(mappers와 공유) | 기계적 | P4 | 중복 구현 금지 |
| 11 | CEO-S11 | 조건 카드 = 디바이더 블록(중첩 카드 금지) | 기계적 | P5 | impeccable §6 |
| 12 | CEO-S6 | 멱등성 property + 키순서 적대 테스트 필수 | 기계적 | P1 | 완전성 |
| 13 | CEO-S9 | 피처 플래그 없음 유지 | 기계적 | P3 | 클라 전용·양방향 호환 확인됨 |
| 14 | DES-P1 | F1 단일 카드 축약 규칙 | 기계적 | P5 | 최빈 케이스 밀도 회귀 방지 |
| 15 | DES-P1 | F2 칩 탭=카드 스크롤·하이라이트 | 기계적 | P1 | 죽은 어포던스 제거+제2 진입로 |
| 16 | DES-P2 | F4 빈 상태·F5 미완성 표기·F3 캡션 유지 | 기계적 | P1 | 상태 커버리지 |
| 17 | DES-P2 | F6 토스트 1뮤테이션 1개·우선순위 | 기계적 | P5 | 새벽 사장 소음 억제 |
| 18 | DES-P3 | F7 예외 추출 3중 진입로 | 기계적 | P1 | 발견성 — 리스크 인정→설계로 전환 |
| 19 | DES-P3 | F8 병합 모션 200ms+앵커 | 기계적 | P5 | MOTION 토큰 소비, 오탭 방지 |
| 20 | DES-P3 | **F9 체이닝 보존 예외 조항 (CRITICAL)** | 기계적 | P1 | 신규 작성 최다 전환점 단절 방지 |
| 21 | DES-P3 | F10 승계=인접 카드 휴리스틱+액션시트 | **취향** | P1 | 최종 게이트로 (결정 8 대체) |
| 22 | DES-P4 | F11 예외 시트 0개 선택 시작 | 기계적 | P5 | 구현자 추측 4곳 제거 |
| 23 | DES-P4 | F12 삭제 X 버튼 유지(컨텍스트 메뉴 철회) | 기계적 | P4 | 검증된 패턴 재사용 |
| 24 | DES-P6 | F13 토글 hitSlop 규칙+a11y 대체물+E2E 가시텍스트 판정 | 기계적 | P5 | DESIGN.md·프로젝트 실측 규칙 |
| 25 | DES-P5 | 다크 토큰·pill 규칙·월 구분 서브헤더 | 기계적 | P5 | 디자인 시스템 정합 |
| 26 | DES-0.5 | 목업 생성 스킵 | 기계적 | P3 | 웹형 목업 생성기 — RN 인앱 섹션에 오도 리스크, ASCII 와이어프레임을 스펙으로 |
| 27 | ENG-F1 | 강등=신설 정규형 채택(a) — "복원 로직과 동일" 주장 정정 | 기계적* | P5 | 지원자 화면 행동 중립 검증 + 좀비 카드 회피. *근거가 명확해 자동 판정, 게이트 요약에 명시 |
| 28 | ENG-F2 | normalize 규칙 0 — 빈 dates 그룹 원형 보존 | 기계적 | P1 | 템플릿 프리셋 조건 침묵 유실 차단 |
| 29 | ENG-F3 | 카드 소멸 Undo 토스트 — 우선순위 최상단 | 기계적 | P1 | silentLoss 클래스 신설 방지 |
| 30 | ENG-F4 | dedupe 고지+승자 결정성 테스트 | 기계적 | P1 | Undo 재삽입 중복 무고지 삭제 방지 |
| 31 | ENG-F5 | orderRowMeta 좌표계 개편 독립 항목 승격 + getValues 필수 규칙 | 기계적 | P5 | 과소 견적 정정, stale 클로저 사고 방지 |
| 32 | ENG-F6 | setRunGrouped 선분할 헬퍼 명세 | 기계적 | P5 | run 토글 ↔ 그룹 플래그 불일치 해소 |
| 33 | ENG-F7 | edit 왕복 isGrouped 드리프트 §8.8 등재 + 의미 동등 회귀 게이트 | 기계적 | P1 | 데이터 영향 정직 기록 |
| 34 | ENG-F8 | 테스트 계획 확장 — 깨지는 테스트 실명·신설 회귀 7종 | 기계적 | P1 | "그린 유지" 오분류 정정 |

## 12. 구현 태스크 (3페이즈 집계 — 17건)

> JSONL 원본: `~/.gstack/projects/snosnosno-uniqn/tasks-{ceo,design,eng}-review-*.jsonl` ·
> 테스트 플랜 아티팩트: 동 디렉터리 `user-fix-date-picker-guidance-merge-test-plan-*.md`
> 착수 순서 제안: T1→E1→E3(정규화 코어) → T2→D3→D1/E2(화면+체이닝) → T3→D2→E4(예외·고지) → T4·T6·D4·D5·T5 → E5·T7(검증 게이트)

- [ ] **T1/E1/E3 (P1)** normalizeScheduleGroups — 규칙 0~4·정준 시그니처·강등 신 정규형·setRunGrouped·멱등 property (`mappers.test.ts:296·:317` 단언 교체 포함)
- [ ] **T2/D3 (P1)** ScheduleSection 신설 — 단일 카드 축약·빈 상태·미완성 muted·캡션·디바이더 블록 (§3.2·§3.9)
- [ ] **D1/E2 (P1)** 체이닝 보존 — orderRowMeta 날짜집합 좌표계 + getValues 규칙 (§3.9 F9, Eng F-5)
- [ ] **T3/D2 (P1)** 예외 추출 — 시트 0개 선택 시작·3중 진입로·stale 토스트 (§3.4·§3.9)
- [ ] **T4/E4 (P1)** 고지 4종+Undo — 소멸>해제>병합>승계, 1뮤테이션 1토스트, dedupe 고지
- [ ] **T6 (P1)** ScheduleDatesSheet 세그먼트 제거 · **T7 (P1)** e2e Grep 0건 명시 기록
- [ ] **D4/D5 (P2)** 병합 모션 200ms+앵커·a11y 대체물·hitSlop 규칙 · **T5 (P2)** 관측 이벤트 4종
- [ ] **E5 (P2)** edit 무편집 저장 의미 동등 회귀 게이트

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open→게이트 해소 | 5 proposals, 2 accepted, 2 deferred, 1 rejected(단계강등 — 사용자 기각) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | **unavailable** | 환경 실패(ChatGPT 계정 gpt-5.4 400) — 전 페이즈 subagent-only |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open→반영 완료 | 8 issues(사실오류 1 포함), 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open→반영 완료 | score 4/10 → 9/10, 13 findings(CRITICAL 1=체이닝) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | skipped | 개발자 대상 아님 |

- **CROSS-MODEL:** 불가(Codex 환경 실패) — 3페이즈 전부 Claude(fable) 서브에이전트 단일 보이스. 단일 모델 한계를 감안해 발견 전량을 코드 실측으로 검증시킴(mappers·selectionUtils·OrderSheetScreen 라인 인용 확인).
- **VERDICT:** CEO(전제 게이트 통과) + DESIGN(반영 완료) + ENG(반영 완료) — 최종 승인 게이트 답변 후 구현 착수 가능.

최종 게이트 판정(2026-08-07): 결정 21 = **A안 확정**(인접 휴리스틱+토스트+액션시트) ·
결정 27 = **승인**(강등 신 정규형, mappers.test 2개 단언 교체 + edit 의미동등 회귀 게이트 포함).

### 구현 이탈 승인 (2026-08-07 구현 세션 — 사용자 재가 완료)

| # | 이탈 | 판단 |
|---|---|---|
| 21' | "다른 조건으로" 액션 = 카드 선택 액션시트 → **예외 추출 시트 재사용** | 레포에 다중 선택 액션시트 자산이 없고, 그 액션의 결과가 결국 "그 날짜만 다른 조건" = 예외 추출이라 같은 목적지다. 인접 휴리스틱·토스트·발화 시점 날짜 앵커 재해석은 A안 그대로. **사용자 승인** |
| E2' | orderRowMeta 좌표계 **전면** 개편 → 지연 발화 경로만 날짜집합 앵커 | 같은 렌더 사이클 좌표(에러 라우팅·제출 유도·CTA 라벨)는 매 렌더 재계산이라 stale 이 불가능하다. 시간을 넘나드는 2경로(180ms 연쇄·시트 confirm)만 앵커. ⚠️ 앵커 **없는** 행까지 재해석을 강제하면 `scheduleGroups=[]` 가 계약인 fixed 의 연쇄가 통째로 죽는다(구현 중 실제로 발생 → 회귀 테스트 고정) |
| F4' | 빈 상태 = "날짜 0" → **"날짜 0 + 조건 0"** | 규칙 0 이 보존하는 템플릿 조건 카드를 숨기면 침묵 유실이 되고, 제출 시 `dates.min(1)` 에러가 표시할 카드 없이 뜬다 |
| ORDER-8' | "상한 도달 시 진입 차단 + 사유" → **"막다른 길이 아님"** | `＋ 일정 추가` 소멸로 결함 클래스 자체가 구조 소멸. 상한은 DatePickerModal 이 그대로 강제 |
| F7①' | ⑂ 분기 아이콘 → `CalendarDaysIcon` | 레포에 분기 아이콘 부재. ghost 금지는 보더+본문색으로 준수 |

NO UNRESOLVED DECISIONS
