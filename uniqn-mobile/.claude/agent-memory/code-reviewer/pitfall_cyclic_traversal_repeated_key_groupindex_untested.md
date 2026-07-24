---
name: cyclic-traversal-repeated-key-groupindex-untested
description: 순환 순회 함수(nextXAfter류)에서 같은 key가 groupIndex별로 반복될 때, current identity 매칭은 groupIndex=0 대표 케이스만으론 검증 안 됨 — findIndex가 첫 occurrence로 오귀속돼도 green
metadata:
  type: feedback
---

`orderedRowTargets`처럼 그룹 수만큼 `{key, groupIndex}`가 반복되는 평탄 배열에서 "current 다음부터 순환" 함수를 만들 때, `targets.findIndex(t => t.key === current.key && t.groupIndex === current.groupIndex)`의 **groupIndex 조건절**은 `current.groupIndex >= 1`인 호출 케이스가 최소 1개는 있어야 실질적으로 검증된다.

**Why:** UNIQN order-sheet Task1(`nextUnsetRowAfter`) 리뷰에서 실측. 8개 테스트 전부 `current`의 groupIndex가 0(또는 목록에 없는 값)이었다 — "그룹0 역할 다음은 그룹1 날짜다" 테스트조차 `current`는 그룹0 쪽이었다. `t.groupIndex === current.groupIndex` 조건을 변이로 제거해도 기존 11건 전부 green(같은 key의 groupIndex=0 occurrence가 배열에서 항상 먼저 나오므로 `findIndex`가 우연히 맞는 인덱스를 돌려줌). 별도 프로브 테스트로 실제 위반을 재현: 그룹1의 `dates`만 unset인 상태에서 `nextUnsetRowAfter(values, {key:'dates', groupIndex:1})`를 호출 — groupIndex 매칭이 없으면 `findIndex`가 그룹0의 `dates`(먼저 나오는 occurrence, 이미 set 상태)를 currentIndex로 오인해 시작점이 어긋나고, 결과적으로 **current 자기 자신을 "다음 미설정 행"으로 반환**한다. 이는 이 함수가 존재하는 이유(한 바퀴 돌아 제자리면 null — 무한 재오픈 차단) 그 자체를 깨뜨리는 실사용 시나리오다.

**How to apply:** 브리프/PR에 "current 다음부터 순환"류 계약이 있고 대상 목록에 **key가 groupIndex별로 반복되는 구조**(일정·모집처럼)가 있으면, 리뷰 체크리스트에 "current 인자 자체가 groupIndex>=1인 호출 케이스가 있는가"를 추가하라. 없으면:

1. 코드가 groupIndex 조건절을 실제로 갖고 있는지 먼저 확인(이번 케이스는 갖고 있었음 — 코드는 정확, 테스트만 미검증).
2. 그 조건절만 골라 변이 → 기존 스위트가 안 죽으면 별도 프로브(직접 구성한 values + console.log로 `orderedRowTargets` 중간 출력 확인)로 실제 오동작을 재현해 Important/Critical 여부를 가른다. 코드가 맞고 테스트만 빠졌으면 **Important(비블로킹, 후속 테스트 추가 권고)**로 낮춰라 — [[pitfall_mutation_green_misattribution]]의 3분류 중 "3. 진짜 테스트 갭"에 해당하되, 현재 프로덕션 코드엔 결함이 없다는 점이 다르다(코드 결함 vs 커버리지 결함 구분).

부수 관찰: 같은 리뷰에서 `getRowState`가 `optional: true`인 모든 case에 `unset: false`를 하드코딩해 `isUnsetTarget`의 `!state.optional` 가드가 원천적으로 도달 불가였다(변이 제거해도 51/51 green) — 이건 [[pitfall_mutation_green_misattribution]] 분류1(도달불가 죽은분기)의 사례이며, 이번 태스크 이전부터 있던 코드라 회귀 아님. "브리프가 핵심 계약으로 명시한 조항 = 실제로 그 가드가 도달 가능한 조항"이 아닐 수 있다는 걸 재확인 — 조항별 변이 시 "이 가드가 살아있는 입력이 하나라도 존재하는가"까지 확인할 것.
