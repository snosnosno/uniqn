---
name: pitfall-store-contract-field-without-renderer
description: 스토어 타입에만 존재하고 UI 렌더러가 소비 안 하는 계약 필드(toast.action) — 스토어 mock 테스트는 false-green. 계약 필드 리뷰 시 렌더러까지 grep 필수
metadata:
  type: feedback
---

스토어/계약 타입에 필드가 있어도 **최종 렌더러가 소비하는지 별도 실측**해야 한다.

**Why:** 2026-07-15 S1 리뷰(dae66bb3e)에서 그룹 삭제 Undo가 `useToastStore.addToast({ action: { label:'되돌리기' } })`로 배선됐고 `Toast` 타입에 `action?` 필드도 존재했지만, 유일 렌더러 `src/components/ui/Toast.tsx`는 icon+message+X만 그려 **'되돌리기' 버튼이 런타임에 존재하지 않았다**. 컴포넌트 테스트는 toastStore를 jest.mock해 payload만 단언 → GREEN(false-green). 파괴적 액션의 구제 경로가 통째로 죽은 HIGH.

**How to apply:** 리뷰에서 "타입에 필드가 있으니 동작한다"고 추론 금지. 계약 필드(특히 action/onPress/render류 콜백)를 넣는 diff를 보면 ①그 필드를 소비하는 렌더러/컨슈머를 grep(`\.action`, 필드명) ②소비처 0건이면 죽은 기능으로 판정 ③스토어 mock 테스트는 배선 증거로 인정하지 않음(실렌더 경유 테스트 요구). [[pattern-optional-field-wiring-six-points]]와 같은 계열 — 배선 사슬의 마지막 고리(표시 UI)가 최다 결손 지점.
