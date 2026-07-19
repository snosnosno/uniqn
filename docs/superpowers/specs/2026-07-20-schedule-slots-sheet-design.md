# 시간·역할 통합 시트 (ScheduleSlotsSheet) — 설계

- 작성일: 2026-07-20
- 범위: 공고작성 주문서 "일정 · 모집" 섹션의 시간/역할 편집 UI
- DB·서버·폼 스키마 변경: **없음** (클라이언트 UI 전용)

## 1. 배경

공고작성 주문서에서 시간과 역할은 지금 **별개의 바텀시트 2개**로 분리돼 있다.

- 시간대가 1개일 때(가장 흔한 경우): "시간" 행 → `TimeSlotsSheet`, "역할" 행 → `RolesSheet`가 **각각** 열린다 (`OrderSheetScreen.tsx:304-309`). 저녁 7시 딜러 2명이라는 한 줄짜리 설정에 시트 왕복 2회가 든다.
- 시간대가 2개 이상이면: "역할" 행 → `TimeSlotsSheet` → 슬롯의 "역할 설정" → `RolesSheet`. 이 전환은 iOS 중첩 Modal 터치 먹통(#186/#243/#244) 때문에 **시트를 닫고 300ms 뒤 다시 여는 지연 스왑**을 쓴다 (`OrderSheetScreen.tsx:892-899`). 화면이 한 번 비었다가 다시 뜬다.
- 역할 하나를 추가하는 데 3단계가 든다: 칩 선택 → 사전 스테퍼로 인원 조정 → "이 역할 추가" (`RolesSheet.tsx:47-59`). 인원이 12명이면 + 를 11번 눌러야 한다.

세 가지 모두 같은 뿌리 — 시간과 역할이 한 화면에 없다는 것 — 에서 나온다.

## 2. 목표

1. 시간과 역할을 **하나의 시트**에서 편집한다.
2. 역할 추가를 3단계에서 **1탭**으로 줄이고, 인원은 **숫자 직접 입력**을 지원한다.
3. #244 지연 스왑을 **구조적으로 제거**한다(회피가 아니라 원인 소멸).

### 비목표 (YAGNI)

- 날짜 선택 3모드(`same`/`grouped`/`separate`)와 그룹 분할 로직은 건드리지 않는다.
- 주문서 본화면의 행 구성(날짜/시간/역할 3행)은 유지한다.
- 고정(fixed) 타입의 시트 구조(근무조건 + 역할)는 병합하지 않는다. 역할 편집기만 공유한다.
- `endTime`은 여전히 도입하지 않는다(현행 스키마에 출근 시간만 존재).

## 3. 파일 구성

```
src/components/employer/order-sheet/sheets/
  ScheduleSlotsSheet.tsx   신규 — 시트 껍데기 + 아코디언 + TimeWheelPicker overlay
  SlotCard.tsx             신규 — 카드 1장 (시간 트리거 + 역할 편집기)
  RoleCountEditor.tsx      신규 — 칩 토글 + 기타 직접입력 + 인원 행  ← 공용
  RolesSheet.tsx           축소 — RoleCountEditor를 감싸는 껍데기 (fixed 전용)
  TimeSlotsSheet.tsx       삭제
```

`RoleCountEditor`를 날짜형(dated)과 고정(fixed)이 공유하므로 두 경로의 역할 입력 방식이 자동으로 일치한다. 각 파일은 200줄 이하를 목표로 한다.

### 컴포넌트 경계

| 컴포넌트 | 하는 일 | 의존 |
|---|---|---|
| `ScheduleSlotsSheet` | 슬롯 배열 소유, 아코디언 활성 인덱스 관리, 시간 휠 overlay 호스팅, confirm 시 부모로 배출 | `SheetModal`, `TimeWheelPicker`, `SlotCard` |
| `SlotCard` | 슬롯 1개의 표시(펼침/접힘) — 시간 트리거·삭제·역할 편집기 배치 | `RoleCountEditor` |
| `RoleCountEditor` | 역할 배열 하나를 편집(칩 토글·기타 추가·인원 조정). 시간 개념 없음 | `STAFF_ROLES` |

`RoleCountEditor`는 `roles: SlotRoles`와 `onChange`만 받는 순수 편집기다. 시트·슬롯·고정 여부를 모른다.

## 4. 역할 입력 설계

### 4.1 칩 토글 — 단, '기타'는 예외

일반 역할 5종(dealer/floor/serving/manager/staff)은 칩 탭 = 즉시 1명 추가, 재탭 = 해제로 바꾼다. 사전 스테퍼와 "이 역할 추가" 버튼은 제거한다.

`accessibilityRole`은 `radio` → `checkbox`로 바꾼다. 단일 선택이 아니라 다중 선택이 되기 때문이다.

**'기타'는 토글하지 않는다.** 현행 `addCurrent`(`RolesSheet.tsx:52-56`)는 `role`과 `customRole`이 **둘 다** 같을 때만 교체하므로, 이름이 다른 커스텀 역할을 여러 개 담을 수 있다("칩카운터 2명" + "안내 1명"). '기타'를 단순 토글로 바꾸면 커스텀 역할이 1개로 제한되어 **기능이 축소된다**. 따라서 '기타'는 **"＋ 직접 입력" 액션**으로 유지한다:

1. 탭 → 인라인 `TextInput` 노출 (`maxLength={20}`)
2. 이름 입력 후 확정 → 목록에 새 행 추가 (인원 1로 시작)
3. 이름이 비어 있으면 추가 비활성 (현행 `addDisabled`와 동일)
4. 같은 이름이 이미 있으면 기존 행으로 병합(교체) — 현행 중복 방지 시맨틱 승계

### 4.2 해제 시 인원 기억

칩을 껐다 켜면 "딜러 12명"이 1명으로 리셋되는 건 오조작 복구 비용이 크다. 시트 로컬 state(`lastCountByRole`)에 마지막 인원을 보관했다가 재선택 시 복원한다. 이 state는 시트를 닫으면 사라진다(폼에 저장하지 않는다).

### 4.3 인원 — 스테퍼 + 숫자 직접 입력

```
 딜러       −   [ 12 ]   +     🗑
                  ↑ 탭하면 숫자 키패드
```

- `keyboardType="number-pad"`, `maxLength={2}`
- 편집 중에는 문자열 raw를 로컬 state로 유지(중간 상태 "1"을 즉시 clamp하지 않기 위해)
- blur/확정 시 정수 파싱 후 **1~99로 clamp** — `orderSheetRoleSchema`의 `count: z.number().int().min(1).max(99)`(`orderSheet.schema.ts:36`)와 동일 범위
- 빈 문자열로 blur하면 직전 값 복구 (0명 저장 방지)
- `autoFocus` 미사용 — 사용자가 숫자를 탭했을 때만 포커스 (impeccable §20)
- `SheetModal`은 이미 `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`를 갖고 있어(`SheetModal.tsx:318,388`) 키보드 대응 인프라는 존재한다. 실기기에서 가림 여부는 QA 항목.

- 삭제 경로는 둘 다 유지: 칩 재탭(일반 역할) / 행의 🗑(모든 역할, 커스텀은 이쪽만 가능)

## 5. 아코디언

- **시간대 1개면 아코디언 없이 항상 펼침** — 가장 흔한 경우에 추가 탭이 0회여야 한다.
- 진입 시 활성 카드: **첫 미완성 슬롯**(`startTime`이 비었거나 `roles.length === 0`) → 없으면 첫 카드
- "＋ 시간대 추가" → 새 카드가 펼쳐지고 직전 카드는 접힘
- 접힌 카드 라벨: `22:00 · 딜러 1명` (역할 요약은 기존 `roleName` 사용 — raw key 노출 금지)
- 펼침 300ms / 접힘 225ms(75% 규칙, impeccable §8). `AccessibilityInfo.isReduceMotionEnabled()`면 애니메이션 없이 즉시 전환
- `accessibilityRole="button"` + `accessibilityState={{ expanded }}`

## 6. 진입 경로 (OrderSheetScreen)

주문서 본화면의 3행(날짜/시간/역할)은 그대로 두고, '시간'과 '역할' 행이 **같은 시트**를 연다.

```ts
// handleRowPress — 현행 304-309의 슬롯 개수 분기를 제거
if (key === 'time' || key === 'roles') {
  if (form.getValues().postingType === 'fixed') { /* 기존 fixedRoles 분기 유지 */ }
  setActiveSheet({ key: 'slots', groupIndex });
  return;
}
```

행을 2개로 유지하는 이유: 요약·에러 표시가 행별로 분리돼 있고(`rowError('time', gi)` / `rowError('roles', gi)`), 확정 지원자 잠금(`LOCKED_ROW_KEYS`, `OrderSheetScreen.tsx:264-266`)이 행 키 기준이라 **그대로 동작**한다. 변경 반경이 최소가 된다.

## 7. 제거되는 것

통합의 핵심 실익. 다음이 불필요해진다.

| 제거 대상 | 위치 |
|---|---|
| `switchSheet` 300ms 지연 전환의 slotRoles↔time 경로 | `OrderSheetScreen.tsx:892-899` |
| `slotRolesTarget.fromTimeSheet` 플래그와 `onClose` 분기 | `OrderSheetScreen.tsx:926-930` |
| `handleRowPress`의 슬롯 개수 분기 | `OrderSheetScreen.tsx:304-309` |
| `applyRoleSalarySync` 이중 호출 → confirm 1회로 수렴 | `OrderSheetScreen.tsx:889`, `924` |
| `ActiveSheet` 유니언의 `slotRoles` (`fixedRoles`는 유지) | `OrderSheetScreen.tsx:62-78` |

`switchSheet`/`pendingSheetRef` 자체는 다른 경로에서 쓰일 수 있으므로 구현 시 사용처를 실측한 뒤 판단한다 — 남은 사용처가 없을 때만 삭제한다.

**시간 휠은 계속 `SheetModal`의 `overlay` 슬롯에 embedded로 얹는다.** 중첩 Modal 금지는 유효하다(#186/#243).

## 8. 건드리지 않는 것

- 날짜 3모드(`same`/`grouped`/`separate`)와 `handleDatesConfirm` 그룹 분할 (`OrderSheetScreen.tsx:374-412`)
- 주문서 본화면 행 구성·요약·에러 표시
- 확정 지원자 잠금 로직
- 폼/DB 스키마 — `timeSlots[].roles[]` 구조 그대로. 마이그레이션 없음, Edge Function 변경 없음

## 9. 검증 계획

| 대상 | 방법 |
|---|---|
| `sheets/__tests__/TimeSlotsSheet.test.tsx` | `ScheduleSlotsSheet.test.tsx`로 이관·재작성 |
| `sheets/__tests__/RolesSheet.test.tsx` | `RoleCountEditor.test.tsx` 신규 + fixed 껍데기 테스트 축소 |
| `__tests__/OrderSheetScreen.timeSlots.test.tsx` | 행 진입 경로 변경 반영 |
| `__tests__/OrderSheetScreen.salarySync.test.tsx` | confirm 1회 수렴 후에도 역할별 급여 동기화 유지 |
| `__tests__/OrderSheetScreen.fixed.test.tsx` | 고정 타입 역할 입력 방식 변경 반영 |
| 전체 | `npm run quality` + `npm test` |

### testID 변경

| 현행 | 신규 | 비고 |
|---|---|---|
| `order-role-count-minus` / `-plus` | `order-role-count-minus-{i}` / `-plus-{i}` | 행별로 이동 |
| (신규) | `order-role-count-input-{i}` | 숫자 직접 입력 |
| `order-role-add` | 유지하되 의미 축소 | '기타 직접 입력' 전용 |
| `order-time-roles-{i}` | 유지하되 의미 변경 | 시트 전환 → 아코디언 펼침 |
| `order-time-start-{i}` / `-remove-{i}` / `order-time-add-slot` | 유지 | |

### 실기기 QA (iOS 우선)

1. 숫자 키패드가 시트 콘텐츠를 가리지 않는가
2. 아코디언 펼침 중 터치 먹통이 없는가 (#186/#243 재발 확인)
3. 시간 휠 overlay가 정상 동작하는가
4. 동작 줄이기(Reduce Motion) 켠 상태에서 펼침이 즉시 전환되는가

## 10. 리스크

| 리스크 | 완화 |
|---|---|
| 칩 토글 전환으로 커스텀 역할 다중 등록 기능 소실 | '기타'를 토글이 아닌 "＋ 직접 입력" 액션으로 유지 (§4.1) |
| 칩 해제로 인원 유실 | `lastCountByRole` 로컬 복원 (§4.2) |
| 숫자 입력 중간 상태가 스키마 위반 | 로컬 raw 문자열 유지 + blur 시 clamp (§4.3) |
| 아코디언 도입이 새 터치 먹통을 부름 | 중첩 Modal 미사용 유지 + 실기기 QA 필수 |
| `applyRoleSalarySync` 호출 수렴으로 급여 동기화 누락 | `OrderSheetScreen.salarySync.test.tsx`로 회귀 방어 |
