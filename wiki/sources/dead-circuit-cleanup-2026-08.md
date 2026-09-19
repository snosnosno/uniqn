---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/app/(admin)/reports/[id].tsx
  - uniqn-mobile/src/__tests__/hooks/useNotifications.test.ts
  - docs/analysis/2026-08-02-dead-circuit-triage.md
  - PR#406
  - PR#408
tags: [cleanup, dead-code, undo, triage]
---

# 소스: 죽은 회로 30건 정리 — 제거 14 · 완성 9 (PR#406·#408)

## 핵심 — "죽은 코드"는 두 종류이고 처방이 다르다

죽은 회로 30건을 훑은 결과 **제거 14건 · 완성 9건**으로 갈렸다. 나머지는 보류.

> 🔑 호출되지 않는 코드를 만나면 먼저 **원래 의도**를 추적한다.
> "쓰이지 않는다"에는 *애초에 필요 없었다*(제거)와 *배선이 덜 끝났다*(완성) 두 원인이 있고,
> 전자로 단정하면 **미완성 기능을 영구히 지워버린다.**
> 판정 근거는 `docs/analysis/2026-08-02-dead-circuit-triage.md` 에 항목별로 남아 있다.

## 대표 사례 — 거짓 Undo

Undo 버튼이 **복원하지 않는데 성공한 척**하고 있었다. 사용자에게는 되돌린 것처럼 보이지만
실제 데이터는 그대로다. 죽은 회로가 UI 로 노출돼 있으면 단순한 잉여가 아니라 **거짓말**이 된다.

이는 [[error-vs-empty-state]] 의 `useJobDetail` 사례("다시 시도"가 아무 일도 안 하던 것)와 같은
계열이다 — **버튼이 약속한 것을 코드가 지키지 않는** 형태.

## 함께 닫은 것 (PR#408)

무한스크롤 붕괴 · Undo 소실 · **평문 이메일 잔존** (MEDIUM 3 + LOW 7).
증빙/신원 서버 가드도 함께 얹었다(PR#406). prod 기록명 `20260803013055`.

**잔여**: Rate Limits 관련 항목이 남아 있다.

## 연결

- 미사용 export 를 다룬 별도 프로토콜(미사용≠죽음): [[knip-signal-hygiene]]
- 삭제 판정의 오라클로 tsc 를 쓰는 이유: [[knip-signal-hygiene]]
- 버튼이 거짓말하는 같은 계열: [[error-vs-empty-state]]
- 전체 정리 웨이브의 선행편: [[codebase-cleanup-2026-07]]
