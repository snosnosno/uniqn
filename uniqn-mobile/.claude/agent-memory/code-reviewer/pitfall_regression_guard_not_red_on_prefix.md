---
name: regression-guard-not-red-on-prefix
description: PR에 동봉된 회귀 가드는 pre-fix 코드에 돌려 red를 확인하기 전엔 신뢰 금지 — 실측 2종 메커니즘(삼항 전체 includes, jest 전역 insets 0 목)
metadata:
  type: feedback
---

PR이 "회귀 가드 테스트 추가"를 동봉하면, 그 가드를 **수정 전 커밋의 파일 내용에 실제로 돌려서 red 가 나오는지** 먼저 확인한다. green 만 보고 가드가 있다고 판정하지 말 것.

**Why:** 2026-07-19 `fix/ui-foundation-6roots` 리뷰에서 다크모드 가드가 수정 전 코드에서도 offenders=0 이었다. 가드가 방어한다고 주장한 5개 파일 전부 통과 — 즉 가드가 있어도 같은 결함이 다시 들어온다. 스위트 5571 green 은 이 사실을 전혀 드러내지 못했다.

**How to apply:** `git show <base>:<path>` 로 원본을 뽑아 가드의 판정 함수를 그대로 돌리는 20줄짜리 node 스크립트가 가장 빠른 반증이다. 이번에 확인된 false-green 메커니즘 2종:

1. **판정 단위가 결함 단위보다 크다.** `block.includes('text-content-primary') && !block.includes('dark:text-')` — 결함은 삼항의 *한 분기*에 있는데 판정은 className 블록 *전체*를 본다. 다른 분기의 `dark:text-error-400` 이 짝 검사를 만족시켜 버린다. 정규식/문자열 기반 래칫은 판정 단위와 결함 단위가 일치하는지부터 볼 것.
2. **전역 목이 변경된 값을 상수로 못박는다.** `jest.setup.js` 가 `useSafeAreaInsets` 를 `{top:0,right:0,bottom:0,left:0}` 으로 전역 오버라이드한다 → **인셋 관련 변경은 기본적으로 테스트 불가**. insets 를 건드리는 PR 의 green 스위트는 증거가 아니다. 검증하려면 그 테스트 파일에서 목을 non-zero 로 재오버라이드해야 한다.

같은 계열: [[pitfall_store_contract_field_without_renderer]](스토어 mock 테스트 false-green).
