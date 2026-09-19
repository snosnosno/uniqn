---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/src/utils/logger.ts
  - PR#413
  - memory/pitfall_logger_sentry_web_infinite_recursion.md
tags: [logging, sentry, web, e2e, flake, jest]
---

# 소스: 웹 Sentry 폴백 로깅 무한 재귀 — E2E 만성 flake 의 진짜 원인 (PR#413)

## 무슨 일이 있었나

웹에서 Sentry 전송이 실패하면 폴백 로깅이 돌고, 그 폴백 로깅이 다시 실패 경로를 타면서
**자기 자신을 재귀 호출**했다. 결과는 콘솔 **370만 건**.

중요한 건 증상이 "로그가 많다"가 아니라 **다른 데서 나타났다**는 점이다. 이 폭주가
E2E 의 **만성 flake 로 오래 오해받고 있었다** — 러너가 느려서 타임아웃 나는 것처럼 보였다.

> 🔑 원인이 로깅 계층에 있으면 증상은 **아무 데서나** 뜬다.
> "왜 이 테스트만 가끔 느리지"의 답이 테스트에 없을 수 있다.

## 이 레포에서만 성립하는 함정 (재사용 가치 높음)

> 🚨 **이 레포의 Jest 환경에서는 동적 `import()` 가 항상 reject 된다.**

그래서 "Sentry 가 호출되지 않았다"를 확인하는 단언 — `expect(spy).toHaveBeenCalledTimes(0)` —
이 **빈 통과(vacuous green)** 가 된다. import 가 실패해 애초에 아무것도 실행되지 않았을 뿐인데,
테스트는 "호출 안 됨"을 확인했다고 보고한다.

호출-0회 단언은 원래도 약하지만(아무것도 안 해도 통과한다), 이 환경에서는
**동적 import 를 쓰는 코드 전체에 대해** 무력하다. 대조군(호출되어야 하는 케이스가 실제로
호출되는지)을 같은 스위트에 두지 않으면 검증이 성립하지 않는다.

## 연결

- vacuous green 계열의 원형: [[test-seed-contract-drift]]
- E2E flake 를 게이트 관점에서 다룬 결정: [[e2e-gate-absence]]
- 관측/로깅 레이어 위치: [[layers]]
