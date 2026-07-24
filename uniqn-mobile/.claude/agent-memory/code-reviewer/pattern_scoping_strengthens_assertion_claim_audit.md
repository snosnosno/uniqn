---
name: scoping-strengthens-assertion-claim-audit
description: 구현자의 "스코프를 좁혀 단언이 강화됐다" 논증은 독립된 2주장(베이스라인 중복매치 / 변이시 vacuous)으로 쪼개 각각 실측 — 후자가 거짓이어도 조치는 옳을 수 있다
metadata:
  type: feedback
---

구현자가 브리프의 전역 `getByText/findByText`를 `within(...)` 스코프로 바꾸고 "이 스코핑은 단언을
**약화가 아니라 강화**한다 — 전역이었다면 변이 상태에서도 다른 행이 렌더해 vacuous가 됐을 것"이라
주장하면, 그 논증은 **독립된 2개 주장**이다. 한 번의 실행으로 둘 다 검증되지 않는다.

1. **베이스라인 중복매치** — 정상 구현 + 전역 단언 → `Found multiple elements`인가?
2. **변이시 vacuous** — 변이 구현 + 전역 단언 → **통과**하는가?

**Why:** Task 8(OrderSheetScreen 고정 역할 폼 반영) 실측에서 **1은 참, 2는 거짓**이었다.
변이(`{...fs, roles: next}` → `{...fs}`) 상태에서 전역 `findByText(/플로어/)`는 vacuous 통과가
아니라 `Unable to find an element`로 **red**였다. 급여 행은 `roleSalaries`에 floor가 들어가도
행 요약이 `uniqueRoles`(= `fixedSchedule.roles`) 파생이라 변이 상태에선 플로어를 렌더하지 않는다.
즉 "급여 행이 토스트 경로 덕에 여전히 플로어를 렌더한다"는 전제 자체가 사실이 아니었다.

**결론: 조치(스코핑)는 옳고 필요했다(주장 1이 참이므로). 정당화 논증만 거짓이다.**
[[pattern_mutation_audit_base_replay]]의 "근거가 틀려도 조치는 맞을 수 있다"와 같은 형태 —
코드 변경은 승인하되 보고서의 논증은 별도로 정정 지시해야 한다. 방치하면 거짓 명제가
"이 단언은 X 때문에 강하다"로 후속 태스크에 상속되어, 실제로 X가 사라져도 아무도 재검증하지 않는다.

**How to apply:** 리뷰 시 소스 변이와 테스트 단언 변이를 **2×2로 교차** 실행하라
(정상×스코프 / 정상×전역 / 변이×스코프 / 변이×전역). 테스트 파일 수정도 변이의 일부다 —
`git checkout HEAD -- <test>`로 원복. 4칸 중 "변이×전역"이 red면 vacuity 주장은 기각이다.

## 죽은 가드 삭제의 안전성 판정

재진입 가드(`if (pendingSheetRef.current) return;`)를 삭제할 때 "이 가드가 지키던 다른 동작"이
있었는지는 **가드 발화 조건의 유일한 생성자를 base 커밋에서 호출처 전수**해 판정한다.
Task 8 실측: `git show <base>:<path> | grep -n switchSheet` → 호출처가 스왑 2곳뿐 →
`pendingSheetRef.current`는 그 창 밖에서 영구 null → 가드 2곳은 **도달불가 죽은 코드**.
호출처 grep 없이 "가드니까 위험"으로 격상하면 오탐이다.
