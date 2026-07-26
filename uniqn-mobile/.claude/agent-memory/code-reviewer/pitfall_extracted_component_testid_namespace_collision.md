---
name: pitfall-extracted-component-testid-namespace-collision
description: 공용 컴포넌트를 추출하며 기존 컴포넌트와 동일한 testID 네임스페이스를 쓰면 채택 시점에 getByTestId 다중매치로 터진다
metadata:
  type: project
---

공용 컴포넌트 추출 리팩터에서 신규 컴포넌트가 **기존 컴포넌트와 같은 testID 접두사**를 쓰면,
추출 태스크(신규 파일만)는 green이지만 **채택 태스크**(기존이 신규를 임베드)에서 `getByTestId`가
"Found multiple elements"로 터진다. 추출 시점 리뷰에서는 diff에 안 보이므로 놓치기 쉽다.

**Why:** 주문서 `RoleCountEditor` 추출(Task 1)이 `order-role-chip-{key}` / `order-role-item-{i}`를
기존 `RolesSheet.tsx`와 **동일하게** 잡았다. 두 파일이 공존하는 동안은 무해하지만, RolesSheet가
자기 칩·행을 남긴 채 RoleCountEditor를 임베드하면 즉시 충돌한다. 추가로 칩 시맨틱이
radio(선택→추가 버튼) → checkbox(1탭=추가)로 바뀌어, 기존 통합 테스트
(`OrderSheetScreen.fixed.test.tsx`, `OrderSheetScreen.salarySync.test.tsx`)의 press 시퀀스가 의미를 잃는다.

**2회차(2026-07-20, Task 2 '기타' 직접 입력):** 같은 컴포넌트가 `order-sheet-role-custom`(TextInput)과
`order-role-add`(추가 버튼) **2건을 더** RolesSheet와 동일하게 잡았다. 브리프가 그 testID를 명시했으므로
구현자 과실이 아니라 **설계(브리프) 결함** — 리뷰 귀속을 그렇게 하라.

## 충돌은 "시끄러운 것"과 "조용한 것"을 구분해 등급을 매겨라

| 유형                                                                       | 채택 시 증상                                                               | 등급       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| 렌더 조건이 배타적/양쪽 존재 (`order-role-add`, `order-sheet-role-custom`) | "Found multiple elements" 또는 "Unable to find"(패널 접힘) = **즉시 실패** | Important  |
| 시맨틱만 바뀌고 ID·존재는 동일 (`order-role-chip-*` radio→checkbox)        | 기존 테스트가 **조용히 다른 걸 검증**                                      | Critical급 |

시끄러운 충돌은 채택 PR이 스스로 잡아주므로 Critical 아님. **조용한 쪽만 Critical로 올린다.**
`order-role-add` 는 의미도 다르다 — RolesSheet=선택된 아무 역할+스테퍼 인원 추가,
RoleCountEditor=입력한 커스텀 이름만 count 1 추가. 소비처
(`OrderSheetScreen.fixed.test.tsx`·`salarySync.test.tsx`·`RolesSheet.test.tsx` 총 10곳)의
press 시퀀스가 채택 시 의미를 잃는다.

**How to apply:**

- 공용 컴포넌트 추출 diff를 리뷰할 때 신규 testID를 **전 레포 grep**해 선점자가 있는지 확인하고,
  있으면 "채택 태스크에서 기존 렌더 제거 필수"를 후속 위험으로 명시한다(추출 태스크의 결함은 아님).
- 시맨틱이 바뀐 testID(radio→checkbox)는 testID가 같아도 **기존 테스트가 조용히 다른 걸 검증**하게 되므로,
  채택 PR에서 해당 테스트 갱신 여부를 반드시 확인한다.
- 권고 문구는 항상 "지금 네임스페이스 분리(`order-role-custom-add` 등)가 채택 후보다 싸다" — 2회 반복된 패턴이라
  브리프 단계에서 testID grep을 요구하는 게 근본 해법.
