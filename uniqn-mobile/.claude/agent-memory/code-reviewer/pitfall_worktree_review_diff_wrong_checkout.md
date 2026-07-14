---
name: pitfall-worktree-review-diff-wrong-checkout
description: 워크트리 대상 리뷰에서 git diff를 메인 체크아웃에서 실행하면 타 세션 워킹트리와 비교돼 유령 diff(대량 삭제 오탐)가 나온다
metadata:
  type: feedback
---

워크트리 브랜치 리뷰 시 `git diff <base>`는 반드시 **그 워크트리 디렉토리에서** 실행한다. 메인 레포 체크아웃에서 실행하면 base 커밋 객체는 같아도 워킹트리가 다른 세션 상태라, 방금 머지된 기능(FilterBar 등)이 통째로 "삭제"되는 유령 diff가 보인다.

**Why:** 2026-07-15 region-taxonomy 리뷰에서 실제 발생 — 메인 체크아웃(detached, 타 세션 작업 중)에서 diff를 떠서 P2P3 역할·급여 필터가 revert되는 것처럼 보였다. `git merge-base --is-ancestor`와 `git log HEAD`로 워크트리에서 재확인해 오탐 판별.

**How to apply:** 리뷰 시작 시 ①워크트리 경로에서 `git status`+`git log --oneline -3 HEAD`로 HEAD가 base와 어떤 관계인지 먼저 고정 ②대량 삭제 diff가 보이면 실행 디렉토리부터 의심 ③`git show <sha>:<path>`(객체 읽기)는 어느 체크아웃에서든 안전하지만 `git diff`(워킹트리 비교)는 아니다.
