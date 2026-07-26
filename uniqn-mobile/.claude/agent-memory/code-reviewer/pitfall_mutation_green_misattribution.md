---
name: mutation-green-misattribution
description: 구현을 변이해도 테스트가 green일 때 원인은 셋(테스트 갭·도달불가 죽은분기·관측불가 계약)이며 등급과 조치가 각각 다르다 — 프로브로 갈라라
metadata:
  type: feedback
---

변이본이 green이라고 곧바로 "테스트 갭" 또는 "과잉 코드"로 신고하지 마라. green 생존의 원인은 최소 셋이고 **조치가 서로 다르다**.

**Why:** ScheduleSlotsSheet(주문서 Task 6) 리뷰에서 커버리지 0 분기 3개가 나왔는데, 셋의 정체가 전부 달랐다. 하나로 뭉뚱그렸으면 정확한 분기를 "테스트 부실"로 오신고하고, 진짜 갭은 같은 등급에 묻혔을 것이다. 이전 학습 [[pattern_mutation_audit_base_replay]](green이면 base 재생으로 귀속)의 분류축 확장판.

**How to apply:** 변이 green을 보면 아래 셋 중 무엇인지 프로브로 확정한 뒤 등급을 매긴다.

1. **도달불가 죽은 분기** — 트리거의 *렌더 조건*부터 확인.
   실측: 부모의 `expanded` 클램프 `cur > i ? cur - 1 : ...` 가 커버리지 0 & 분기 제거해도 10/10 green. 원인은 테스트 부실이 아니라 자식(SlotCard)이 **삭제 버튼을 펼친 카드에만 렌더**해서 `removeSlot(i)` 가 항상 `i === expanded` 인 것. 프로브: 3슬롯에서 index 1 펼침 → `remove-1`만 존재, `remove-0`/`remove-2`는 null.
   → 결함 아님(LOW/정보성). 테스트를 추가하려 해도 UI로 도달 못 한다. 방어적 잔여로 유지하거나 주석.

   ⚠️ **한 statement 안에서 도달성이 갈린다 — sub-expression 단위로 쪼개 변이하라.** 위 삼항의 형제 항인 `Math.min(cur, Math.max(0, next.length - 1))` 클램프는 **도달 가능한데 무가드**였다(같은 줄, 정반대 판정). 실측 3변이: `cur > i ? cur` = green·도달불가 / `Math.min(...)` → `cur` = green·**도달가능** / `setExpanded` 줄 통째 삭제 = green. 도달 프로브(2슬롯 → 마지막 카드 펼침 → 삭제)를 새로 써서 base PASS·변이 FAIL 로 갈랐다 — 증상은 "삭제 후 남은 카드가 접힌 채라 펼친 카드가 0개". statement 단위로 "이 줄은 도달불가"라고 판정했으면 진짜 갭을 죽은 코드로 오분류했을 것.

2. **관측불가 계약** — 소비자 전원이 불변이면 깊은복사는 값 단언으로 절대 안 잡힌다.
   실측: `roles: (slots[0]?.roles ?? []).map(r => ({...r}))` → `roles: slots[0]?.roles ?? []` (얕은 참조 공유)로 변이해도 10/10 green. 쓰기 경로 전원(map/filter/spread)이 불변이라 참조 공유가 결과에 안 나타남. `toHaveBeenCalledWith`는 구조 비교라 원리적으로 red 불가.
   → **코드는 유지**(defense-in-depth, 과잉 아님) + 테스트를 참조 단언으로 교체: `expect(arg[0].roles).not.toBe(arg[1].roles)`. 원본 green/변이본 참조 동일까지 양방향 실측할 것.

3. **진짜 테스트 갭** — 도달 가능하고 사용자에게 보이는 결함이 변이로 살아남는 경우.
   실측: `updateStart` 의 `idx === i ?` 가드를 떼어 **모든 슬롯 시간을 덮어쓰게** 해도 10/10 green. 시간 편집 테스트가 슬롯 1개 상태에서만 돌아서 그렇다.
   → MEDIUM. 케이스 1개(슬롯 2개에서 두 번째 시간 변경) 추가로 닫힌다.

부수 규칙 A: **브리프가 계약을 나열하면 조항 단위로 쪼개 각각 변이하라.** Task 6 "아코디언 활성 관리"는 3조항(진입 시 첫 미완성 펼침 / 추가 시 새 카드 펼침·직전 접힘 / 삭제 시 인덱스 보정)인데 앞의 둘만 가드되고 셋째가 무가드였다. "계약 이름"으로 뭉쳐서 한 번 변이하면 부분 커버를 통과시킨다.

부수 규칙 B: **vacuous 판정에는 무죄 증명도 하라.** 변이 배치가 끝나면 *어느 변이에도 안 죽은 테스트*를 추려 그 테스트를 겨냥한 변이를 2차로 만든다. Task 6에서 1차 13변이에 안 죽은 3건(기본 시드 19:00 / 통합 핵심 / 전부완성 fallback)이 남았는데, 2차 변이(DEFAULT_START 변경·`onConfirm(value)`·`onPressTime` noop·`onClose` 제거·fallback→last)로 전부 kill 되어 **vacuous 0건** 확정. 2차를 안 돌렸으면 멀쩡한 테스트를 vacuous로 오신고했을 것.

부수 규칙 C: 커버리지 JSON의 `branchMap`+`b` 를 파싱해 **미실행 path의 소스 좌표**까지 뽑아라(`% Branch 70`만 보면 어느 분기인지 모른다). Lines 100%여도 분기는 반쪽만 실행될 수 있다([[pattern_coverage_as_mutation_proxy_readonly]]).
