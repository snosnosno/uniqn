---
name: pattern-coverage-as-mutation-proxy-readonly
description: 파일 수정이 금지된 리뷰에서 단일파일 --coverage 브랜치 리포트로 "이 테스트가 이 가드를 실제로 검증하는가"를 무수정 실증한다
metadata:
  type: feedback
---

리뷰어는 대개 "파일 수정 금지"라서 변이 테스트(가드 지우고 red 확인)를 못 돌린다.
대신 **단일 파일 커버리지의 Uncovered 브랜치 목록**이 무수정 변이 프록시가 된다.

```bash
npx jest <테스트파일> --coverage \
  --collectCoverageFrom="src/.../Impl.tsx" --coverageReporters=text
```

`% Lines 100` 인데 `Uncovered Line #s` 에 번호가 남으면 그 줄은 **브랜치 미커버** —
즉 그 분기를 지워도 스위트는 green 이다. 변이 테스트를 돌린 것과 동치.

**Why:** 2026-07-20 Task 2(RoleCountEditor '기타' 직접 입력) 리뷰에서 "이름이 비면 추가되지 않는다"
테스트가 green 이었지만 커버리지가 `addCustom` 내부 `if (!name) return;`(52줄)을 **미커버**로 찍었다.
이유는 RN `Pressable`의 `disabled` 가 press 자체를 삼켜서 핸들러가 아예 안 불린 것 —
테스트는 바깥 `disabled` 만 증명하고 안쪽 가드는 한 번도 실행되지 않았다.

## RN 특화 함정: `disabled` 가 내부 가드를 선점한다

`disabled={cond}` + 핸들러 내부 `if (cond) return` 이중 방어는 **테스트가 바깥만 증명**한다.
근거(둘 다 node_modules 실측):

- `react-native/Libraries/Pressability/Pressability.js` → `onStartShouldSetResponder: () => !disabled`
- `@testing-library/react-native/build/fire-event.js` → `isEventEnabled` 가 위 반환값 false 면
  핸들러를 못 찾고 부모로 재귀 → `fireEvent.press` 는 조용한 no-op(throw 없음)

따라서 "disabled 버튼을 눌러도 아무 일 없다" 테스트는 **내부 가드의 회귀를 못 잡는다**.
내부 가드까지 검증하려면 `disabled` 를 뗀 상태를 따로 렌더하거나, 가드를 하나로 줄여야 한다.

**How to apply:** 브리프가 "이중 차단"을 자랑하거나 구현자가 "테스트가 가드한다"고 보고하면
이 명령 한 방으로 확인. 부수 소득으로 다크모드 삼항(`isDarkMode ? A : B`)·삭제 분기 등
**jest 환경에서 구조적으로 못 타는 브랜치**가 같이 드러나 "⚠️ 확인 불가" 항목을 정확히 뽑을 수 있다.

관련: [[regression-guard-not-red-on-prefix]](green 만으로 가드 인정 금지 — 같은 원리의 다른 각도),
[[pattern-sdd-brief-verbatim-diff-check]](무수정 검증 기법 계열)
