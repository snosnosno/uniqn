---
name: rntl-display-none-defeats-not-mounted-assertion
description: RNTL 13에서 queryByTestId(...).toBeNull()은 "미마운트"가 아니라 "미노출"을 검증 — display:none 위반본이 통과한다(실측). 마운트 계약은 state 생존으로 단언하라
metadata:
  type: feedback
---

`expect(queryByTestId(X)).toBeNull()` 은 **"X가 마운트되지 않았다"를 증명하지 못한다.**
RNTL 13(`includeHiddenElements` 기본 false)은 `display:none` 하위를 쿼리에서 제외하므로,
편집기를 **마운트한 채 숨기기만 한** 위반본도 이 단언을 통과한다.

**Why:** SlotCard(Task5) 리뷰에서 실측. 프로브 3종 결과가 갈렸다 —
| 위장 방법 | queryByTestId | 계약 위반 탐지 |
|---|---|---|
| `style={{ display:'none' }}` | **null** | ❌ 통과(위장 성공) |
| `className="hidden"` | FOUND | ✅ red (jest 환경에서 NativeWind className이 style로 컴파일되지 않음) |
| `style={{ opacity:0 }}` | FOUND | ✅ red (RNTL 12+ 는 opacity를 숨김으로 안 봄) |

즉 탐지 여부가 **구현자가 고른 숨김 방식에 우연히 좌우된다**. 하필 `display:none` 이
아코디언/애니메이션 래핑에서 가장 흔한 선택이라, 정확히 위험한 방향만 뚫린다.

**How to apply:** "접힘/비활성 시 아예 마운트하지 않는다" 류 동작 계약을 리뷰할 때

- 존재 단언(`toBeNull`)만 있으면 **vacuous로 간주**하고 등급을 매긴다. 이름이 "…렌더되지 않는다"여도 마찬가지.
- 강한 대안 2종을 제시: ①`{ includeHiddenElements: true }` 옵션 명시 ②**state 생존 단언**
  (펼침→편집기 내부 state 변경(예: 직접입력 패널 열기)→접기→재펼침→그 state가 초기화됐는지).
  ②가 우월하다 — display:none·height:0·opacity:0 **모든** 숨김 전략을 한 번에 잡고,
  계약의 진짜 목적(내부 state 리셋)을 직접 검증한다.
- 판정은 추론하지 말고 **프로브로 실측**: 위반본을 임시 테스트 파일에 인라인으로 재현해 돌린다.
  리뷰 대상 파일은 건드리지 않고 별도 `Zz*.test.tsx` 생성→실행→삭제→`git status` 로 잔재 0 확인.

## ⚠️ 변이본의 **트리 모양**이 무엇을 잡을 수 있는지 결정한다 (2026-07-20 Task5 재리뷰 실측)

"미마운트" 계약을 프로브할 때 변이본을 아무렇게나 만들면 **state 생존 단언이 vacuous 라고 오판**한다.
루트 엘리먼트 타입이 분기마다 다르면(`Pressable` ↔ `View`) React 가 서브트리를 통째로 언마운트하므로
**숨겨서 마운트해도 state 가 어차피 초기화된다** — 리마운트 테스트가 green 이 나오지만 이건
테스트가 약해서가 아니라 변이본이 계약을 실제로 위반하지 못한 것이다.

| 변이본                                              | 접힘 시 편집기 | 14건 결과 | 리마운트 테스트                               |
| --------------------------------------------------- | -------------- | --------- | --------------------------------------------- |
| A: 2분기 유지 + 접힘 브랜치에 `display:none` 마운트 | 마운트됨       | 1 red     | **green**(루트 타입 바뀌어 React 가 언마운트) |
| B: **단일 트리** + 본문 `display` 토글              | 마운트 유지    | 3 red     | **red** ✅                                    |

즉 **B(단일 트리)로 프로브하지 않으면 리마운트 단언의 실효를 증명할 수 없다.**
그리고 B 가 바로 아코디언 애니메이션(`Animated.View` 래핑)이 만드는 현실적 위반 형태다.

**How to apply:** "접힘 시 언마운트" 계약 감사는 변이본 2종을 **모두** 돌려라.
A만 돌리고 green 을 보면 "리마운트 테스트가 vacuous" 라는 오탐을 낸다.
`includeHiddenElements` 교정은 A를 잡고, state 생존 단언은 B를 잡는다 — **둘 다 필요하며 중복이 아니다**.

## 승계 결함: 삭제로 인한 인덱스 승계는 언마운트를 우회한다 (실측 red)

"접힐 때 언마운트"는 **접힘 경로만** 보장한다. `slots=[A,B]`에서 A를 펼친 채 삭제하고
부모가 `expandedIndex=0`을 유지하면 B가 같은 인덱스·같은 타입으로 재조정돼 편집기가
**리마운트되지 않고** A의 `customOpen`/`customName`/`lastCount`가 B로 넘어간다.
index 를 key 로 쓰는 순진한 부모로 프로브해 실제 red 재현 확인(패널 TextInput 생존).
→ 부모 소비 태스크 리뷰 시 **안정 식별자 key 또는 삭제 시 expandedIndex 리셋**을 필수 확인.

관련: [[pattern_mutation_audit_base_replay]], [[pitfall_extracted_component_testid_namespace_collision]]
