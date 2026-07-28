---
area: decisions
updated: 2026-07-25
status: current
sources:
  - .github/workflows/e2e.yml
  - .github/workflows/ci.yml
  - uniqn-mobile/e2e/playwright.config.ts
  - PR#327
  - PR#328
  - PR#330
  - PR#331
tags: [ci, e2e, testing, gate, adr]
---

# 결정: E2E는 아직 required가 아니다 — 대신 "회귀 감지 케이스"로 구조를 지킨다

## 문제 (2026-07-25 실측)

**결정적 E2E 회귀가 3개 PR을 타고 전파됐다.**

`#328`이 마케팅·푸시 토글을 `app/(app)/settings/index.tsx`에서 `app/(app)/settings/notifications.tsx` 전용 화면으로 분리하면서, 그 요소를 "설정 메인"에서 찾던 `e2e/tests/p2-standard/settings.spec.ts:73`을 함께 옮기지 않았다. 결과는 flake가 아니라 **결정적 실패** — 화면에 없는 요소를 `scrollIntoViewIfNeeded` 하다 60초 타임아웃, retry에서도 동일.

그런데 이 red 상태로 `#327` → `#328` → `#330`이 전부 머지됐다. E2E가 required check가 아니기 때문이다. 더 근본적으로, `gh api repos/.../branches/master/protection` 실측 결과 **master에는 branch protection 자체가 없다**(404 Branch not protected). ci.yml의 `quality-gate`·`test`조차 required가 아니다.

전파 경로:

| PR | E2E 결과 | 내용 |
|---|---|---|
| #327 | 6 failed | `#325` 단계 재배치로 auth-signup 페이지 객체가 옛 순서 참조 |
| #328 | red 유지 + **새 회귀 유입** | 화면 분리 시 spec 미갱신 |
| #330 | 1 failed | auth-signup 4건 복구, settings 1건 잔존 |
| #331 | 해소 | settings 케이스 이동 + 진입 케이스 신설 |

## 결정

**E2E를 즉시 required로 올리지 않는다.** 먼저 두 가지를 순서대로 해결한다.

1. **branch protection 신설 + CI 먼저 required** — E2E보다 저비용·고효과다. `quality-gate`·`test`는 flake가 없고 3분 내 끝난다. 이것부터 올리면 전파 경로의 대부분이 막힌다.
2. **러너 경합 flake 해소 후 E2E 승격** — `playwright.config.ts`에 이미 완화 조치(workers 4→2, retries 2→1, expect timeout 10s→15s)가 들어가 있는데도 재발한다. `board.spec.ts:88`이 CI에서 60초 타임아웃 ×2, 로컬에서 3.4초 PASS. 이 상태로 required를 걸면 정상 PR이 막힌다.

## 그 사이의 방어 — 회귀 감지 케이스

게이트가 없는 동안은 **spec 자체가 구조를 지키게** 만든다. `#331`이 채택한 형태:

```
설정 메인 describe
  └ '알림 설정 클릭 시 해당 페이지로 이동한다'   ← 화면 분리를 지키는 진입 케이스
알림 설정 describe (NotificationSettingsPage)
  ├ '푸시 알림 마스터 토글이 표시된다'
  └ '마케팅 정보 수신 토글이 표시된다'
```

요소를 옮기면 "옮긴 곳"의 테스트만 고치면 되지만, **진입 경로 케이스는 화면 분리 자체가 깨질 때 red**가 된다. 이동한 요소를 따라가는 테스트와, 이동 구조를 고정하는 테스트를 분리하는 것이 핵심이다.

또한 사라진 요소를 가리키는 **죽은 로케이터는 반드시 페이지 객체에서 제거**한다. `SettingsPage`에 `marketingLabel`·`pushNotificationLabel`·권한 배너 게터 2종이 남아 있었고, 이런 로케이터는 "존재하지 않는 것을 기다리는" 타임아웃 폭탄으로 재활용된다.

## 규율

- **UI 요소를 다른 화면/파일로 옮기는 PR은 `e2e/**/*.spec.ts`에서 옛 위치 참조를 grep해 같은 PR에서 이동**시킨다. 화면 분리는 리팩토링이 아니라 계약 변경이다.
- E2E 로컬 검증은 **`dist/` 재export 후**에 한다. `uniqn-mobile/scripts/run-e2e.js`가 `fs.existsSync(dist)`만 보고 빌드를 건너뛰므로, 구 번들이 남아 있으면 거짓 통과/거짓 실패가 난다(2026-07-25 실측 — `#328` 이전 번들이 남아 있었다).
- CI E2E가 red일 때 **로컬 단일 spec을 돌려 결정적인지 flake인지 먼저 가른다**. 로컬 즉시 통과 + CI 반복 타임아웃 = 러너 경합(memory `pitfall_e2e_runner_contention_timeout` 계열), 로컬도 실패 = 진짜 회귀.

## 연계

- 러너 경합 진단 패턴: memory `pitfall_e2e_runner_contention_timeout`
- 화면 분리 시 spec stale: memory `pitfall_e2e_spec_stale_after_screen_split`
- 파리티 가드가 꺼져 있던 동종 문제: [[prod-parity-baseline]]
- 게이트가 없어 늦게 드러나는 회귀의 다른 형태: [[semantic-merge-conflicts]](텍스트 충돌 0 이 안전을 뜻하지 않는다 — 종료 조건은 재통합 **후** 전체 검증 green)
- 테스트가 green 인데 아무것도 보증하지 못하는 경우: [[test-seed-contract-drift]](red 보다 **vacuous green** 이 위험하다)
