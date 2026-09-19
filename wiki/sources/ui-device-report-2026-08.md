---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx
  - uniqn-mobile/src/components/employer/job-form/modals/DatePickerModal.tsx
  - uniqn-mobile/app/(admin)/announcements/index.tsx
  - PR#422
  - PR#423
  - PR#425
  - PR#426
tags: [ui, refresh-control, safearea, sticky-header, order-sheet, ios]
---

# 소스: 실기기 UI 리포트 + 주문서 후속 (PR#422·#423·#425·#426)

## 유령 스피너 — `RefreshControl` 을 쿼리 상태에 묶지 마라 (PR#423)

`refreshing={isRefetching}` 로 묶으면 **사용자가 당기지 않았는데도** 스피너가 돈다.
백그라운드 refetch·포커스 refetch가 전부 스피너를 띄우기 때문이다.

해법은 수동 새로고침 상태를 분리하는 `useManualRefresh`(26화면 적용).
🔑 넘기는 함수는 **Promise 를 반환해야** 한다 — 아니면 스피너가 즉시 사라진다.

## `stickyHeaderIndices` + Fragment = 스크롤 잠김 (PR#423)

`React.Children.toArray` 는 **Fragment 를 자식 1개로 센다.** 인덱스를 손으로 세어
`stickyHeaderIndices` 에 넣었는데 중간에 Fragment 가 있으면 실제 인덱스와 어긋나
엉뚱한 요소가 고정되고 스크롤이 잠긴다. 🔑 형제 블록을 전수 확인할 것.

## SafeArea 가드가 있었는데도 뚫렸다 (PR#423)

가드 자체는 존재했다. 그런데 **하위 폴더를 스캔하지 않았고 내용도 검사하지 않아**
vacuous(공허)했다 — 통과하지만 아무것도 보증하지 않는 상태.

> 🔑 "가드가 있다"는 "가드가 동작한다"가 아니다. 가드를 신뢰하기 전에
> **일부러 위반 케이스를 넣어 red 가 나는지** 확인하라([[test-seed-contract-drift]] 와 동형).

## iOS `canOpenURL` 은 미선언 스킴에 대해 항상 false (PR#422)

앱이 설치돼 있어도 `Info.plist` 의 `LSApplicationQueriesSchemes` 에 없으면 false 다.
그래서 지도 앱 선택은 **경로안내 → 위치표시**로 전환해 불확실성을 없앴다.

🚨 이 결함은 **빌더 테스트가 빈 통과**했다 — URL 을 *만드는* 함수와 *여는* 함수가 분리돼
있어서, 테스트가 만드는 쪽만 검증하고 여는 쪽(게이트)을 타지 않았다.

## "개수 비교"로 시스템 동작을 판정하지 마라 (PR#425)

조건 유도 그룹핑에서, 그룹 수를 **개수로 비교**해 사용자 조작 여부를 판정하니
같은 개수의 다른 구성이 "변경 없음"으로 오고지됐다.
🔑 판정은 **집합 또는 의도값** 기준으로.

## 그 밖 (PR#426)

중첩 Modal · 프리셋 묶음 유출 · 퇴근 날짜 소실 · 조건 시트 막다른 길.
🔑 `form.reset()` 은 정규화를 우회하므로 **생산자 시점**에서 막아야 한다.
🔑 `dark:` 짝 누락 경고는 **대부분 오탐** — 진실원은 `darkModePairRatchet.test.ts` 머리말.

## 연결

- NativeWind/RN UI 함정 종합: [[nativewind-rn-pitfalls]]
- vacuous green 의 원형: [[test-seed-contract-drift]]
- 주문서 폼 계약: [[order-sheet-form-contract]]
- 지도/좌표 축: [[address-geocoding-2026-08]]
