# 주문서 미설정 항목 연쇄 입력 — 설계 (2026-07-23)

## 목적

공고작성 주문서에서 미설정 항목을 채우고 `확인`을 누르면, 목록으로 되돌아가지 않고
**다음 미설정 항목 시트로 바로 이어진다.** 사용자가 행을 다시 찾아 탭할 필요 없이
끝까지 입력할 수 있게 한다.

## 배경 — 이미 있는 재료

`OrderSheetScreen`은 이미 다음을 갖고 있다:

- `firstUnsetRow(values)` — 첫 미설정 행 타깃 `{ key, groupIndex }` 계산 (`orderRowMeta.ts:524`)
- `handleRowPress(key, groupIndex)` — 행 키를 실제 시트 상태로 변환하는 단일 라우팅 지점
- 하단 CTA가 `firstUnsetRow`로 라벨을 만들고(`"제목부터 입력하기"`), 누르면 그 행 시트를 연다

빠진 것은 **시트 확인 후 다음 시트로 넘기는 연결**뿐이다.

`#246`에 있던 `switchSheet` 지연 전환 인프라가 `#285`(시간·역할 통합 시트)에서
"시트→시트 스왑이 사라졌다"는 이유로 제거됐다. 이번 요구가 그 스왑을 되살린다.

## 확정된 제품 결정

| 항목 | 결정 |
|---|---|
| 시작 | 화면 진입 시 자동 오픈 **없음**. 하단 CTA 또는 행 탭으로 시작 |
| 연쇄 범위 | **미설정 행에서 시작한 경우만**. 이미 채워진 행 수정은 확인 시 목록 복귀 |
| 종료 | 마지막 미설정 항목 확인 → 시트 닫고 목록 복귀. CTA는 자동으로 `이대로 등록`이 됨 |
| 진행 표시(`3/6`) | **제외** — 주문서는 마법사가 아니라 목록이라는 기존 컨셉 유지 |

## 아키텍처

### 채택: 접근법 A+ (OrderSheetScreen 라우팅 + SheetModal 전환 모드)

시트 컴포넌트 12개는 **무수정**. 연쇄는 순수하게 화면 상태 라우팅 + 모달 전환 연출 문제로
취급한다.

기각한 대안 — **접근법 C (단일 SheetModal 호스트 + 내용 교체)**:

- `ScheduleDatesSheet`는 `SheetModal`이 아니라 `DatePickerModal`(`ui/Modal`) 래핑이라
  단일 호스트가 흡수할 수 없다. 연쇄가 가장 조밀한 일정 섹션(날짜→시간·역할, 그룹 수만큼
  반복)에서 **여전히 지연 스왑이 필요** → 두 메커니즘 병존
- 1그룹 5스텝 기준 C가 줄이는 것은 1.5s 중 0.9s
- 비용: 시트 12개 리팩터 + 호스트 신규 + `jest.mock('@/components/ui/SheetModal')`로
  묶인 테스트 10개 재작성 + `overlay`(시간 휠 2곳)·`fullHeight`(1곳) 역주입 계약
- `DatePickerModal`까지 통일하면 레거시 job-form과 공유 중이라 폭발 반경이 order-sheet 밖

C가 정당해지는 조건은 "일정 섹션까지 전면 SheetModal 통일"이며, 이번 요구와 분리된
별도 리팩터링 과제다.

### 구성 요소

```
OrderSheetScreen
 └ <SheetChainProvider value={chainState}>
     └ <TitleSheet ... />        ← 무수정
         └ <SheetModal>          ← context 소비: fade 전환 · 백드롭 고정 · onShow
```

| 파일 | 역할 |
|---|---|
| `src/components/ui/SheetChainContext.tsx` (신규, ~20줄) | 연쇄 단계 상태 컨텍스트 (SheetModal 이 직접 소비하므로 ui/ 에 둔다) |
| `src/components/employer/order-sheet/OrderSheetScreen.tsx` | 연쇄 판정·실행, 딤 레이어, Provider |
| `src/components/ui/SheetModal.tsx` | context 소비 — 전환 연출 분기 |
| `src/constants/animation.ts` | `SHEET_CHAIN_SWAP_MS` 추가 |
| 시트 12개 | **변경 없음** |

컨텍스트 기본값이 `null`이므로 앱 전역의 다른 `SheetModal` 사용처는 동작이 바뀌지 않는다.

## 동작 설계

### 1. 무장(arm) 판정 — "미설정 행에서만 연쇄"

시트를 여는 시점에 그 행이 `unset`이었는지를 ref에 기록하고, 확인 시 그 값이 참일 때만
연쇄한다.

```
handleRowPress(key, gi)  → chainArmedRef.current = getRowState(values, key, gi).unset
시트 onConfirm(...)       → if (chainArmedRef.current) chainToNextUnset(key, gi)
시트 onClose (X·백드롭)   → chainArmedRef.current = false   // 중도 이탈은 연쇄 종료
```

`handleRowPress`는 CTA 경로(`handleSubmitPress`의 에러 핸들러)와 행 탭이 공유하는 단일
진입점이므로, 무장 판정을 여기 한 곳에 두면 두 경로 모두 자동으로 커버된다.

연쇄가 다음 행을 열 때도 `handleRowPress`를 경유하므로 무장이 자연히 갱신된다 —
다음 타깃은 정의상 `unset`이라 연쇄가 이어진다.

**호출 순서 주의**: 모든 시트는 확인 버튼에서 `onConfirm(...)` 직후 `onClose()`를 부른다
(예: `TitleSheet.tsx:41-44`). 따라서 `onClose`의 무장 해제는 `onConfirm`이 이미 연쇄를
예약한 **뒤에** 실행된다. 예약 타이머가 `handleRowPress`로 다시 무장하므로 정상 동작하지만,
무장 해제를 `onConfirm`보다 먼저 일으키는 구현(예: `onClose`를 확인 경로에서 선행 호출)은
연쇄를 침묵으로 죽인다. 구현 시 이 순서를 테스트로 고정한다.

### 2. 연쇄 실행

```
chainToNextUnset(confirmedKey, confirmedGroupIndex):
  next = firstUnsetRow(form.getValues())      // setValue 직후라 최신값
  if (next === null)                    → 닫기 (목록 복귀)
  if (next === {confirmedKey, confirmedGroupIndex}) → 닫기 (루프 가드)
  else                                  → 지연 스왑으로 handleRowPress(next)
```

`form.getValues()`를 쓰는 이유: 시트 `onConfirm`은 `form.setValue`를 호출한 직후에
연쇄를 판정해야 하는데, `values = form.watch()`는 다음 렌더에서야 갱신된다.

**루프 가드가 필수인 이유**: 급여 시트에서 금액 0으로 확인하면 `getRowState`가 여전히
`unset`을 반환해 같은 시트가 무한히 다시 열린다. 확인한 타깃과 다음 타깃이 같으면
연쇄를 중단하고 목록으로 돌아간다.

### 3. 지연 스왑 (`#244` 패턴 승계)

```
setActiveSheet(null)
pendingRef = setTimeout(() => {
  pendingRef = null
  setActiveSheet(cur => cur === null ? next : cur)   // 사용자가 그 사이 연 시트 존중
}, SHEET_CHAIN_SWAP_MS)
```

- **사용자 우선**: 대기 창 동안 사용자가 행을 직접 탭하면 **예약을 취소하고 그 행을 연다.**
  `#244`의 가드는 시트가 떠 있는 상태의 오탭 방지였지만, 여기는 시트가 없는 대기 창이라
  탭을 무시하면 사용자가 `SHEET_CHAIN_SWAP_MS` 동안 아무것도 못 누르는 죽은 구간이 된다.
- **언마운트 정리**: `useEffect(() => clearPending, [])`

두 네이티브 Modal을 겹쳐 present 하면 iOS 터치 라우팅이 깨지므로, 이전 시트를 먼저
언마운트한 뒤 다음 시트를 마운트해야 한다. 지연은 이 제약에서 온다.

### 4. 전환 연출 — 번쩍임 제거

현재 구조에서 전환 창에는 어떤 모달도 없어 **밝은 주문서 목록이 노출된다.**
원인은 시간이 아니라 백드롭의 불연속이다.

**① 백드롭 인수인계 (이음매 제거)**

연쇄 exit일 때 `SheetModal`은 백드롭 opacity를 1에 고정한 채 콘텐츠만 사라지게 한다.
동시에 `OrderSheetScreen`이 동일한 `bg-black/50` 딤을 깔아둔다. 색이 같으므로
모달 백드롭 → 화면 딤 교대에 시각적 이음매가 없다.

진입 방향은 이중 어두워짐(50% + 50% = 75%)을 피해야 하므로, `RNModal`의 `onShow`
콜백에서 화면 딤을 해제해 프레임 단위로 교대시킨다.

**② 제자리 cross-fade (이동 제거)**

연쇄 전환일 때만 `translateY` 애니메이션을 끄고 opacity만 쓴다. 시트 틀이 자리를 지킨 채
내용만 갈리는 것으로 보인다. 시트별 높이 차(`TaxSheet` 53줄 ↔ `SalarySheet` 441줄)도
페이드가 덮는다.

일반(비연쇄) 열기/닫기는 기존 slide 그대로 유지한다.

**타이밍**

| | 기존 | 연쇄 |
|---|---|---|
| exit | slide↓ 250ms | fade-out 150ms |
| 공백 | 밝은 목록 ~100ms | 딤 유지 (이음매 없음) |
| enter | slide↑ 300ms | fade-in 160ms |
| 대기 상수 | `SHEET_DISMISS_ANIMATION_MS` 300ms | `SHEET_CHAIN_SWAP_MS` 180ms |

180ms 근거: `SHEET_DISMISS_ANIMATION_MS = 300`의 주석은 "iOS pageSheet dismiss
애니메이션 ~250ms"를 전제하지만, `SheetModal`은 pageSheet가 아니라
`animationType="none"` + transparent `RNModal`이다. 네이티브 dismiss는 애니메이션 없이
커밋되고 300ms는 reanimated 시각 애니메이션 대기값이다. 그 애니메이션을 150ms fade로
바꾸면 대기도 따라 줄어든다.

**이는 코드 근거이며 실기기 검증이 아니다.** 상수를 별도로 분리해 두어, iOS 실기기에서
터치 라우팅 문제가 나오면 300으로 되돌릴 수 있게 한다 (아래 QA 항목).

## 승계되는 기존 동작

- **`scheduleLocked` 잠금**: 연쇄가 `handleRowPress`를 경유하므로 `guardScheduleLock`이
  자동 적용된다. 잠긴 행이 다음 타깃이면 경고 토스트 후 연쇄가 멈춘다.
- **급여 자동 프리필**: 역할 확정 시 `applyRoleSalarySync`가 기본 급여를 채우면 급여 행이
  `unset`이 아니게 되어 연쇄가 급여 시트를 건너뛴다. 의도된 동작 — 연쇄 대상은
  "미설정 항목"이며, `기본값` 배지가 사용자에게 확인을 유도한다.
- **일정 그룹 분할**: 날짜 시트 whole 모드에서 `separate`/`grouped`를 고르면 그룹이 N개로
  갈라지고, `firstUnsetRow`가 그룹 순회(그룹0 dates→time→roles → 그룹1 …)하므로 연쇄가
  그룹별로 이어진다.
- **`+ 일정 추가`**: 새 그룹은 무장되어 날짜 시트로 진입한다. 날짜 확인 후 이어질지는
  **시드 결과에 달렸다** — `handleAddSchedule`이 직전 그룹의 `timeSlots`를 깊은복사해
  시드하므로, 직전 그룹이 완성돼 있으면 새 그룹의 시간·역할도 즉시 `set` 판정되어
  연쇄가 거기서 끝난다(대부분의 반복 일정 등록이 이 경로). 직전 그룹이 미완이거나
  시드가 비어 있을 때만 시간·역할로 이어진다.
  <br>이 동작은 의도된 것이다 — 이미 채워진 값을 다시 묻지 않는다는 무장 규칙과 정합하며,
  사용자가 시드값을 바꾸고 싶으면 해당 행을 직접 탭해 단발 편집한다.
  (2026-07-23 전체 리뷰 H4: 초안은 "날짜 확인 후 시간·역할로 이어진다"고 단정했으나
  실동작과 달라 문서를 실동작에 맞춰 정정. 코드 변경 없음.)
- **선택 항목**: 설명·복지·세금·조건·사전질문은 `optional: true`라 `firstUnsetRow`가
  건너뛴다. 연쇄가 필수 항목만 훑고 끝난다.

## 테스트

신규 `src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx`
(jest fake timers).

1. **연쇄 진행** — 제목 확인 → `SHEET_CHAIN_SWAP_MS` 경과 → 장소 시트 노출
2. **대조군: 이미 채워진 행** — 값이 있는 제목 행을 탭해 확인 → 다음 시트가 열리지 않음
3. **루프 가드** — 미설정 상태 그대로 확인 → 같은 시트가 재오픈되지 않음
4. **중도 이탈** — X 또는 백드롭으로 닫으면 연쇄 중단
5. **종료** — 마지막 미설정 항목 확인 → 시트 없음 + CTA가 `이대로 등록`
6. **타이머 정리** — 대기 창 중 언마운트 시 예약 취소 (경고 없이 통과)
7. **일정 그룹 연쇄** — 날짜 확인 → 같은 그룹의 시간·역할 시트로 이동

기존 테스트 영향: `jest.mock('@/components/ui/SheetModal')`을 쓰는 시트 테스트 10종은
컨텍스트가 목킹된 컴포넌트에 닿지 않으므로 무영향. `OrderSheetScreen.*.test.tsx` 7종은
행 탭 → 확인 → 목록 복귀 경로를 검증하는데, 대상 행이 이미 채워진 경우에는 동작이
그대로다. 미설정 행을 확인하는 케이스가 있으면 연쇄가 발생하므로 **계획 단계에서 전수
확인이 필요하다** (해당 시 단언 보강).

## 사용자 게이트 (QA)

- [ ] **iOS 실기기**: 연쇄 전환 시 터치 라우팅 정상 (`SHEET_CHAIN_SWAP_MS = 180` 검증).
      문제 시 300으로 상향
- [ ] **iOS/Android 실기기**: 전환 중 밝은 목록 번쩍임 없음, 이중 어두워짐 없음
- [ ] **Android**: 키보드가 열린 시트(제목·연락처)에서 확인 시 전환 정상
      (`ModalKeyboardAvoider` 상호작용)
- [ ] **웹**: `WebSheetModal`은 CSS transition 경로 — 동일 연출 확인
- [ ] 동작 줄이기(Reduce Motion) 설정에서 fade만 남는지 확인

## 범위 밖

- 진행 표시(`3/6`) — 이번 범위에서 제외 (제품 결정)
- 화면 진입 시 자동 오픈 — 제외 (프리셋·타입 세그먼트 선택 경로 보존)
- `DatePickerModal`의 `SheetModal` 통일 — 별도 리팩터링 과제
- 시트 확인 버튼 라벨 변경(`확인` → `다음`) — 시트 12개 수정이 필요해 제외
