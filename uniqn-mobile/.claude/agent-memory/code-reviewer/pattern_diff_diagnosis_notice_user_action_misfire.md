---
name: pattern-diff-diagnosis-notice-user-action-misfire
description: before/after diff 진단 고지 함수 리뷰 — 사용자 명시 행동이 시스템 암묵 동작 고지로 오발화하는지 프로브 필수. 관측 이벤트가 고지 경로에 묶이면 계기판까지 오염
metadata:
  type: feedback
---

**규칙**: 뮤테이션 전후 스냅샷을 비교해 고지를 내는 진단 함수(`diagnoseScheduleChange` 류)는, 판정 조건이 "시스템 암묵 동작"만 잡는지 "사용자 명시 행동"까지 오포획하는지 **입력 경로별 프로브**로 확인한다.

**Why:** 2026-08-07 조건 유도 그룹핑 리뷰(feat/condition-derived-grouping). `dateCount(after) < dateCount(before)` 는 dedupe(암묵 삭제) 탐지 의도였지만 **사용자가 날짜를 해제해도 참** → 흔한 해제 조작마다 "같은 조건이라 하나로 합쳐졌어요" 오발화 + `auto_merge` 관측 이벤트(cardsBefore==cardsAfter)로 최초 계기판 오염. 설계 스스로 "자기가 한 일을 되읽어주지 않는다" 원칙을 bundleToggledByUser 로 코딩해 놓고 날짜 해제 축은 빠뜨렸다. 기존 테스트는 "소멸 고지 없음"만 단언(음성 단언이 좁음), 관측 테스트는 양성 발화만 단언 — 둘 다 못 잡았다.

**How to apply:**

1. 진단 함수의 각 판정 조건(길이·카운트 비교)마다 "사용자 행동만으로 참이 되는 경로"를 나열 — 특히 카운트 감소는 삭제 계열 사용자 조작과 거의 항상 겹친다.
2. 프로브는 화면이 아니라 **뮤테이션 순수함수→진단 직결**로: `applyX(before, userInput)` 결과를 diagnose 에 넣어 kind 를 단언. 레포 무수정 실행은 scratchpad 에 jest config(`{...require(프로젝트 config), rootDir:프로젝트, roots:[scratchpad], coverageThreshold:undefined}`) + `@/` 매퍼로 가능(실증 — jest-expo 에서 동작).
3. 음성 단언 리뷰: `not.toHaveBeenCalledWith(특정 문구)` 는 다른 오발화를 통과시킨다 — "호출 0회" 또는 kind 전수 단언 요구.
4. 관측 이벤트가 고지(notice) 분기 안에서만 발화하면: (a) 오발화 시 지표 오염 (b) 상위 우선순위 고지에 가려진 실제 사건은 미관측. 관측은 고지와 독립 발화가 원칙.

관련: [[pattern-regression-guard-not-red-on-prefix]] (판정단위>결함단위), [[pitfall-store-contract-field-without-renderer]] (mock 테스트 false-green 계열).
