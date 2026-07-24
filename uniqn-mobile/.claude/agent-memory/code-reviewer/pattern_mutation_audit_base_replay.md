---
name: pattern-mutation-audit-base-replay
description: 갱신된 테스트가 "원래 지키던 회귀를 여전히 잡는가"는 변이를 base 커밋에서 재생해 커버리지 갭의 귀속(기존 vs 신규)을 가른다 + git checkout <commit> -- 의 인덱스 오염 함정
metadata:
  type: feedback
---

리팩터가 테스트의 **조작 시퀀스**를 바꿨을 때 "단언을 약화시켰나"만 보면 절반이다.
진짜 질문은 **"이 테스트가 원래 무엇을 잡았고, 지금도 그걸 잡는가"** — 답은 변이 테스트로만 나온다.

## 프로토콜

1. baseline green 실측 → 2. 브리프가 "이 테스트가 지킨다"고 주장한 계약마다 **구현을 1개씩 변이** →
2. red 나오는지 확인 → 4. **green이 나오면 그 계약은 애초에 미커버** → 5. 같은 변이를 **base 커밋의
   구/테스트 조합에 재생**해 갭이 기존인지 이번 태스크가 만든 건지 귀속을 가른다.

5번이 핵심이다. green 변이를 발견해도 그것만으로는 "이번 diff가 커버리지를 깎았다"는 결론이 안 나온다.

**Why (2026-07-20 Task 4, RolesSheet→RoleCountEditor 껍데기화):** 브리프가 `OrderSheetScreen.fixed.test.tsx`를
"**고정 타입 역할 반영**을 지키는 테스트"로 규정했다. 실제로 `form.setValue('fixedSchedule', { ...fs, roles: next })`
에서 `roles: next`를 **떼도 5/5 green** — 이 테스트는 역할 반영을 한 번도 검증한 적이 없다.
토스트가 `applySyncedRoleSalaries(prev, syncRoleSalariesForRoles(next, ...))`에서 `next`를 **직접** 받으므로
폼 반영 여부와 무관하게 뜬다. 반면 dated 경로(`slotRoles`)는 `roles: next`가 `nextGroups` 조립에 들어가
sync 입력이 되므로 **같은 변이가 red** — 같은 계약인데 두 경로의 커버리지가 비대칭이다.
base 커밋(구 RolesSheet + 구 chip+add 시퀀스)에 같은 변이를 재생하니 **거기서도 green** →
갭은 선재, 이번 태스크가 깎은 게 아님으로 확정. 이 재생이 없었으면 Important 오탐을 낼 뻔했다.

**How to apply:**

- 브리프·보고서의 "이 테스트는 X를 지킨다"는 **주장이지 사실이 아니다**. X를 직접 변이해 확인하라.
- 값이 폼/스토어를 **경유하지 않고** 부작용 함수로 직행하면(여기선 `next`), 부작용 단언은 저장 경로를 증명하지 못한다.
  "토스트가 떴다 ≠ 폼에 반영됐다".
- 껍데기 컴포넌트의 축소된 테스트도 계약별 변이로 load-bearing 판정(시드/비활성/onClose 각 1건씩 죽으면 합격).

## ⚠️ `git checkout <commit> -- <paths>` 는 인덱스까지 오염시킨다

base 재생을 하려고 `git checkout 28aa2b99b -- a.tsx b.tsx` 한 뒤 `git checkout -- a.tsx b.tsx`로 되돌리면
**복원되지 않는다** — 후자는 _인덱스에서_ 워킹트리를 복원하는데 인덱스에 이미 base 버전이 올라가 있다.
`git status --porcelain`에 `M ` (앞칸 M = staged)로 뜨는데, 이걸 "워킹트리 클린"으로 오독하기 쉽다.

```bash
git checkout HEAD -- <paths>   # 인덱스+워킹트리 동시 복원 (이걸 써라)
git diff HEAD --stat -- src/   # 0줄이어야 진짜 복원
```

리뷰 종료 전 검증은 `git status --porcelain` 만으로 부족하고 **`git diff HEAD --stat`가 0줄**임을 같이 봐야 한다.
백업 사본(`cp`) + `diff`는 변이한 파일에만 유효하니, `git checkout <commit>`으로 만진 파일은 별도 확인.

관련: [[pattern-coverage-as-mutation-proxy-readonly]](파일 수정 금지일 때의 무수정 대체 기법),
[[pattern-sdd-brief-verbatim-diff-check]]
