---
name: full-scope-sheet-seed-union-and-cap-composition
description: 그룹별 시트→전 일정(full-scope) 시트 전환 리뷰 — 시드 합집합 배선과 상한 종단이 스텁에 가려 무검증이 되는 2대 구멍 + toMatchObject 완화 판정법
metadata:
  type: feedback
---

전 일정 스코프 시트 전환(2026-08-07, 조건 유도 그룹핑 브랜치 ed94a3c85..a2a0c0b63) 리뷰에서 실증한 감사 축.

**규칙**: per-group 시트가 full-scope 시트로 바뀌면 **시드(전 카드 날짜 합집합)가 하중 배선**이 된다. 화면 테스트의 CalendarPicker 스텁이 선택을 통째로 덮어쓰면(PICKS 버튼) 시드는 어떤 테스트에도 관측되지 않는다 — 시드가 group0 만 담아도 전부 green, 실결함은 "날짜 하나 추가했는데 다른 카드 날짜가 해제 취급 → 카드+조건 소멸".
**Why**: 시드 오배선의 증상이 '해제'와 구별 불가라 applyDateSelection 유닛도 못 잡는다. 스텁이 onMultiSelectChange 로 밀어넣는 순간 시드는 죽은 입력이다.
**How to apply**: ① 스텁이 받은 `selectedDates`/`initialSelectedDates` prop 을 텍스트로 렌더시켜 합집합과 대조하는 프로브 요구. ② "확인만 눌러도 무손실" 무변경-confirm 프로브는 시드가 비면 confirm 비활성이라 **빈 통과** — prop 캡처만이 유효.

**상한(cap) 종단 합성 판정**: 진입 게이트 삭제(구 ORDER-8) 후 상한이 화면(existingDates=[]) + 모달(remainingSlots) + CalendarPicker(maxSelections, 해제-at-cap 포함) **유닛 합성**으로만 성립하면, 합성 지점(existingDates=[] 전달)과 경계(7/7 시드로 시트 열기)는 어느 테스트도 안 연다. `existingDates={allSelectedDates}` 로 되감기면 remainingSlots=0→confirm 영구 비활성 = 막다른 길 부활인데 전부 green.

**toMatchObject 완화 판정법(실증)**: `toEqual`→`toMatchObject` 는 ① 새 optional 필드(dates 앵커)가 원인이고 ② 전용 테스트(dateAnchor)가 그 필드의 정확성을 그룹별로 고정하며 ③ 반환 객체가 감사된 배열(orderedRowTargets)의 **요소 그대로**라 구성상 전파되면 수용. toMatchObject 는 배열 길이를 검사하므로 배열 케이스 완화도 안전.

**부재 단언(queryBy...toBeNull) 진공 판정**: 구 컴포넌트가 opt-in prop(showSegment) 뒤에 있었으면 prop 미전달 부재 단언은 구 코드에도 green = 묘비. 실보증은 payload 형식 변화 단언(배열 vs {dates,segment})이 진다 — 그 짝이 있는지로 판정.

관련: [[order-sheet-grid-nested-modal-discipline]] · 관측 이벤트 N종 선언 시 이벤트명 전수 단언 대조(inherit_notice 0건 실증), 목 팩토리 inline jest.fn 은 참조 불가라 "그 채널로만" 단언이 반쪽이 된다(mock 접두 변수로 노출 요구).
