---
name: pattern-sdd-brief-verbatim-diff-check
description: 브리프가 코드 전문을 담은 SDD 태스크는 눈 대조 대신 브리프 코드블록 sed 추출 + diff로 "시키지 않은 것" 판정을 기계화한다
metadata:
  type: feedback
---

브리프에 구현 코드 전문이 `​```tsx` 블록으로 들어있는 SDD 태스크(.superpowers/sdd/task-N-brief.md)를 리뷰할 때는,
diff를 눈으로 읽어 스펙 준수를 판정하지 말고 **브리프 코드블록을 그대로 추출해 커밋본과 byte-diff** 하라.

```bash
sed -n '<블록시작>,<블록끝>p' task-N-brief.md > /scratchpad/brief-impl.tsx
diff /scratchpad/brief-impl.tsx src/.../Impl.tsx
```

**Why:** 눈 대조는 "빠뜨린 요구사항"은 잡아도 "한 글자 바꾼 클래스명·testID·문구"는 놓친다.
Task 1 리뷰에서 이 방식으로 전체 이탈이 **정확히 1곳(줄바꿈)** 뿐임을 1초에 확정했고, 구현자 자기신고가
사실인지도 동시에 검증됐다. 자기신고를 신뢰하는 대신 신고 누락까지 같이 잡히는 게 핵심 이득.

**How to apply:**

- 스펙 판정(Stage 1) 첫 단계로 실행. diff 출력이 비면 "시키지 않은 것 넣음" 항목은 그 자리에서 종결.
- 남은 diff 조각만 개별 판정(포맷 전용인가 / 동작 변경인가).
- 커밋 범위 이탈은 `git show --stat`으로 별도 확인(브리프 diff는 파일 내부만 본다).

## 포맷 이탈 주장 검증 — 파일 수정 없이

"브리프 원문대로면 prettier가 깨진다"는 주장은 리뷰어가 파일을 못 고치므로 stdin으로 검증한다.

```bash
npx prettier --check --stdin-filepath <실제경로> < 브리프원문버전   # 출력에 (stdin) = 포맷 위반 확정
npx prettier --stdin-filepath <실제경로> < 브리프원문버전 | diff - <커밋본>  # 0줄 = 커밋본이 prettier 정본
```

두 번째 명령이 0줄이면 "포맷 전용이고 동작 무영향"이 증명된다 — 의미 변경이 섞였다면 diff가 남는다.
관련: [[pitfall-worktree-review-diff-wrong-checkout]]
