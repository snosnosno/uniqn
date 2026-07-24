---
name: readonly-mutation-sandbox-dist-e2e
description: 파일 수정 금지 리뷰에서 변이 실행하는 법 — gitignored dist-e2e/ 안에 변이본을 두면 레포 무오염으로 jest가 돈다 (스크래치패드·junction은 실패)
metadata:
  type: feedback
---

"읽기와 판정만, 파일 수정 금지" 제약에서도 변이 실행은 포기하지 마라. `uniqn-mobile/dist-e2e/` 에 변이본을 두면 **git status 무오염 + 모듈 해석 정상**으로 jest가 돈다.

**Why:** 변이 없는 vacuous 판정은 추측이다([[pitfall_mutation_green_misattribution]] · [[pattern_mutation_audit_base_replay]]). 그런데 리뷰 태스크는 대개 파일 수정을 금지하므로 원본을 못 건드린다. 세 경로를 실제로 시도해 하나만 작동했다:

- ❌ 스크래치패드(`AppData/Local/Temp/.../scratchpad`)에 두고 `jest --roots <경로>`: 테스트는 수집되지만 `Cannot find module '@babel/runtime/helpers/interopRequireDefault'` — rootDir 밖이라 node_modules 상향 탐색이 끊긴다.
- ❌ 스크래치패드에 `mklink /J node_modules` 정션: "디렉터리 이름이 잘못되었습니다"로 생성 실패.
- ✅ `uniqn-mobile/dist-e2e/mut/` : `.gitignore:8` 에 `dist-e2e/` 가 있어 git status에 안 뜨고, jest `testPathIgnorePatterns` 의 `/dist/` 는 `dist-e2e` 를 **안 잡는다**(정규식 리터럴 불일치). rootDir 안이라 `@/` moduleNameMapper·`@babel/runtime` 모두 정상.

**How to apply:**

1. 원본을 node로 읽어 상대 import(`./SlotCard`)를 `@/` 절대경로로 치환 + 변이 1개 적용 → `dist-e2e/mut/X.mutN.tsx`.
2. 원본 테스트를 복사해 import만 변이본으로 돌린 뒤 `dist-e2e/mut/__tests__/` 에 배치. describe 이름에 변이 표식을 붙여 결과를 구분.
3. `npx jest dist-e2e/mut --coverage=false` → red/green 확인. 변이 여러 개는 파일을 나눠 한 번에 돌린다(스위트당 ~11초).
4. **끝나면 `rm -rf dist-e2e`** 후 `git status --porcelain -- src/` 로 리뷰 대상 무변경 확인.
5. 사전 확인: `git check-ignore -v dist-e2e/...` 로 무시 대상임을 증명하고 시작.

주의: 이 레포는 병렬 세션이 흔하다. 리뷰 후 `git status` 에 뜬 `package.json` 버전 범프 같은 변경은 내 소행이 아닐 수 있으니 diff로 귀속을 확인하고 보고에 섞지 마라.
