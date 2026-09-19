---
name: pattern-condition-grouping-gate-retrofit-and-zombie-reentry
description: 조건 유도 그룹핑 리뷰(2026-08-07) 2대 발견 — ① 시간축 재해석 안전게이트(resolveGroupIndexByDates)를 연쇄 공통 경로에 소급하면 좌표 축이 없는 모드(fixed, scheduleGroups=[])가 전면 null→연쇄 사망+딤 잔존 ② 정규화 강등이 죽인 좀비 클래스가 정규화의 '원형 보존' 예외(빈 그룹 rule 0)로 들어오는 생산자(templateToValues)에서 부활
metadata:
  type: project
---

주문서 "조건 유도 그룹핑" 브랜치(ed94a3c85..HEAD, T-HOLDEM-grouping 워크트리) 리뷰 실증 2건.

## ① 안전 게이트 소급 → 축 없는 모드 전면 차단 (HIGH, 프로브 red 2회 실증)

`confirmRow` 의 180ms 예약 발화가 **무조건** `resolveGroupIndexByDates(getValues(), next.dates, next.groupIndex)` 를
거치는데, fixed 는 `scheduleGroups=[]` 계약이라 fallback 범위검사(`0 < 0`)가 항상 null →
`if (resolved === null) return;` 이 ⑴ 연쇄를 죽이고 ⑵ 직전에 켠 `updateChainSwapping(true)` 딤을
**해제하지 않아** 다음 탭까지 화면 전체 딤 잔존. fixed 의 모든 armed confirm 에서 재현.
기존 543 테스트 전부 green — fixed 연쇄 자체를 지키는 테스트가 없었다(chain 테스트의 fixed
픽스처는 "대기 중 타입 전환 → 예약 취소" 만 커버).

**How to apply (재사용 절차):**

1. 시간을 넘는 좌표 재해석 게이트(앵커→인덱스)를 공통 경로에 새로 깔면, **게이트의 전제
   (좌표 축 존재)가 성립하지 않는 모드를 전수 열거**하라 — 여기선 fixed(그룹 축 없음)와
   비일정 행(dates=undefined)이 같은 fallback 경로를 탄다. `dates===undefined` 는 "재해석
   불필요"지 "재해석 실패"가 아니다 — 호출부에서 생략 분기가 정답.
2. **침묵 종료 경로는 임시 UI 상태(딤·로딩) 해제 책임까지 진다** — "조용히 끝낸다" 주석이
   있으면 그 return 직전에 clearX/updateY(false) 가 있는지 본다. guardScheduleLock 딤 고착
   (pattern_chain_timer_race)과 같은 클래스의 3번째 실례.
3. 실증은 형제 테스트의 목 헤더를 복사한 프로브 파일(정상 동작 단언 → red = 결함 확정) —
   scrim 단언을 **먼저** 두면 한 프로브로 두 증상을 순차 실증할 수 있다. 실행 후 삭제.

## ② 정규형이 죽인 좀비의 재진입로 = 정규화의 '원형 보존' 예외 (MEDIUM)

normalize 규칙 2(싱글턴 강등)는 "해제 불가 좀비 grouped 카드"를 죽였지만, `templateToValues` 가
`{...g, dates: []}` 로 **dates 만 비우고 grouped:true 를 남긴다** → 규칙 0(빈 그룹 원형 보존)이
그대로 통과 → ScheduleConditionCard `runs = grouped ? [dates] : ...` = `[[]]` → 빈 라벨
" 통째로 지원받기" 행 + `key={run[0]}`=undefined + Switch ON. 토글 OFF 는
`setRunGrouped(..., [], false)` 의 `inRun.length===0` 조기 반환으로 무효 → **해제 불가**.
경로: 묶음 카드 있는 공고 → 템플릿 저장(valuesToDraft 가 isGrouped 보존) → cloneDatedSchedule
스프레드 보존 → 프리셋 적용. 날짜를 그 카드에 배정하기 전까지 잔존.

**How to apply:** 정규화가 불변식을 강제해도, 정규화에 **의도적 통과 예외**(원형 보존·시드 금지
등)가 있으면 그 예외로 들어오는 **생산자를 전수 grep** 하라(여기선 빈 그룹 생산자 =
templateToValues·화면 시드·타입 전환 시드 — 시드 2종은 grouped:false 라 무해, 템플릿만 유해).
수정은 생산자 쪽(`grouped: false` 동시 리셋)이 정본.

## 곁다리(같은 리뷰에서 검증 완료 — 재도출 생략)

- normalizeScheduleGroups 멱등성: grouped run+강등+병합 조합 수기 탐색 반례 없음. dedupe(뒤 승리)·
  병합 승자(최소날짜 레코드 slots)·최종 정렬(그룹 dates 서로소라 min 유일) 전부 결정적.
- applyDateSelection `vanishedFlags[i+1]` ↔ `groups.slice(1)` 정렬 정확(off-by-one 아님).
- slotsSignature ↔ toPostingTimeSlots 정합(TBA 잔존 startTime·비-other customRole 양쪽 드롭) 대조 완료.
- e2e 는 `order-sheet-row-dates` 만 소비 — 빈/채움 양쪽 유지돼 무사.
- inherited 토스트 "다른 조건으로" 가 cardIndex(시간 넘는 인덱스)를 드는 것은 F9 원칙의 자기 위반
  (MEDIUM) — 날짜 앵커+프레스 시점 재해석으로 고칠 것. edit→exception 전환은 key 리마운트로
  시트 내 미확정 편집 침묵 유실(MEDIUM).
