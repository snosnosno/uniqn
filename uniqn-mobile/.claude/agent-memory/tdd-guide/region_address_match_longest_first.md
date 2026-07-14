---
name: region-address-match-longest-first
description: findRegionByAddress 가 구 레벨로 하강하면 keyword 부분문자열 충돌(강서구⊃서구, 남양주시⊃양주시) 발생 — 긴 keyword 우선 정렬 필수
metadata:
  type: reference
---

## Learnings

- [2026-07-15] [region-filter-p1] Discovery: `findRegionByAddress` 를 3단계 택소노미(도>시>구)로 확장해 구 레벨까지 매칭하면 `text.includes(keyword)` 가 **부분문자열 충돌**을 일으킨다. 예: "부산 강서구" 에서 `text.includes('서구')` 가 `true`(강**서구**), 그래서 iteration 순서상 `부산 서구` 가 `부산 강서구` 보다 먼저 잡힘. 동일 패턴: `남양주시`⊃`양주시`, `충청북도`는 `충북` includes 로 못 잡음(도명 branch 는 약칭+전체명 둘 다 체크).
- [2026-07-15] [region-filter-p1] Improvement: 매칭 후보를 **keyword 길이 내림차순 정렬 후 find**(`findByKeywordLongestFirst`). 긴 이름이 항상 먼저 매칭 → `강서구`(3) > `서구`(2). 구 우선→시·군 2단계도 `parentSlug` 유무로 분리해 각각 longest-first. 회귀 테스트에 부분문자열 충돌 케이스("부산 강서구 명지동"→`부산 강서구`) 명시.
- [2026-07-15] [region-filter-p1] Discovery: 광역시 branch 는 도명 branch 보다 **먼저** 배치해야 "전남광주통합특별시 광산구"(2026-07 광주+전남 통합)가 `광주` keyword 로 광주 구에 매칭된다. 도명이 먼저면 '전남' 한정→광산구 미매칭→undefined. 순서=경기①→광역시②→제주③→도명④→서울⑤→폴백⑥.
- [2026-07-15] [region-filter-p1] Discovery: 데이터 상수 파일 테스트는 **slug 스냅샷 가드**가 최강 계약 방어 — prod DB 저장값(67 slug)을 하드코딩 배열로 나열하고 `isRegionSlug === true` 전수 단언. 리팩터·빌더 도입으로 slug 가 한 글자라도 바뀌면 즉시 적발.
