---
area: decisions
updated: 2026-08-25
status: current
sources:
  - uniqn-mobile/src/components/applications/__tests__/CancellationRequestForm.test.tsx
  - uniqn-mobile/src/hooks/useTrackShareOpen.ts
  - uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql
  - uniqn-mobile/package.json
  - memory/MEMORY.md
  - PR#474
  - PR#478
  - PR#481
tags: [testing, verification, rls, e2e, observability, false-green]
---

# 결정: 초록불을 신뢰하기 전에 "이 검증이 실패할 수 있었나"를 먼저 묻는다

2026-08 웨이브에서 반복 관측된 함정들은 표면상 서로 무관해 보였다 — 테스트 목, CHECK
제약, pgTAP, 계측, docker 파이프. 정제해 보니 **뼈대가 하나**다.

> **초록불이 "통과했다"가 아니라 "아무것도 검사하지 않았다"를 뜻할 수 있다.**
> 실패할 수 없도록 구성된 검증은 검증이 아니라 장식이다.

일반 버그와 결정적으로 다른 점: **오탐이 아니라 무음(無音)이다.** 에러도 WARNING 도
뜨지 않으므로, 신호를 기다리는 전략이 원리적으로 통하지 않는다. 반드시 **"이 검증을
고의로 깨뜨리면 빨간불이 되는가"를 능동적으로 확인**해야만 발견된다.

## 유형 1 — 단언이 대상에 도달조차 못 한다

**테스트 목이 계약의 일부를 버리면 그 경로는 테스트가 있어도 미검증이다.**

`SheetModal` 목이 `footer` prop 을 렌더하지 않아 **제출 버튼이 한 번도 렌더되지
않았다**. 버튼을 누르는 단언은 "못 찾음"이 아니라 조용히 무의미해졌다. 2026-08-11 에
같은 원인으로 3건이 한꺼번에 드러났다. 현재는 목이 `footer` 를 받는다
(`CancellationRequestForm.test.tsx:16-20` — 수정 후 형태).

- 🔑 **새 단언이 예상 밖으로 실패하면 구현보다 목을 먼저 의심하라.** 목은 계약의
  부분집합이고, 빠뜨린 부분은 침묵한다.
- 같은 계열: `jest.mock` 의 모듈 경로 문자열은 **tsc 가 검사하지 않는다**. PR#474 의
  배럴 삭제 때 tsc 0 에러인데 jest 14 red 가 났다 → [[semantic-merge-conflicts]]

## 유형 2 — 관측 대상이 구조적으로 항상 0

세는 행위 자체는 정상 동작하는데, **셀 것이 원리적으로 존재하지 않는** 경우다.
카운터가 0을 반환하고 게이트는 통과한다.

| 사례 | 왜 항상 0인가 |
|---|---|
| 신버전에만 실린 계측으로 **구버전 잔존**을 셈 | 구버전은 그 계측을 싣고 있지 않다 |
| RLS 테이블에서 pgTAP 이 "0건" 관측 | "행이 없다"가 아니라 **"그 역할에 안 보인다"** |
| anon 대상 계측(`job_share_opened`) | anon RLS + `props.tk` 가드에 이중 차단 |

- 🔑 **RLS 하에서 0건 단언은 "행이 보이는 역할"에서 해야 한다.** 그렇지 않으면 에러도
  WARNING 도 없이 거짓 통과한다 → [[test-db-grants]]
- 🔑 **대상이 anon 인 계측(공유·QR)은 anon 경로로 실제 INSERT 해 보고** 넣어라.
  `fire-and-forget` 계측은 `__DEV__` 에서만 로깅하므로 프로덕션에서 완전 무음이다
  (`useTrackShareOpen.ts:26` 이 `props.tk` 필수 가드를 문서화한다).
- 🔑 **권위 소스를 게이트 밖에 두라.** 구버전 잔존의 진실원은 앱 계측이 아니라 **스토어
  콘솔 설치 분포**다 → [[rollout-instrumentation-gap]](같은 병의 다른 발현: 게이트는
  걸었는데 열쇠를 안 만든 사례)

## 유형 3 — 명령이 실행되지 않았는데 성공처럼 끝난다

- **`docker exec ... psql < file`** 에서 `-i` 를 빠뜨리면 stdin 이 연결되지 않아
  **출력 0줄로 성공처럼** 끝난다. 2026-08-14 에 이것으로 red-green 사이클이 통째로
  거짓 green 이 났다. (`docker cp` 는 MSYS 경로변환으로 별도 실패 — `MSYS_NO_PATHCONV=1`)
- **CHECK 제약 교체 시 이름을 잘못 짚으면** 기존 제약이 남은 채 새 제약이 추가되어
  **AND 결합**된다. 새 값은 거부되는데 마이그레이션은 성공으로 보인다. 이름이 아니라
  `pg_get_constraintdef` **정의로 찾아** 지우고, 끝나면 **"정확히 1개"를 단언**하라.
- **개수 일치는 정합이 아니다.** 파리티 점검에서 `201 = 201` 이 실제로는 반대 방향
  드리프트의 상쇄였다. 기대값은 **마커·단언·문구 3곳에 동시에** 박아야 한다
  (`parity_baseline_guard.test.sql:174`) → [[prod-parity-baseline]]

## 유형 4 — 판정축이 애초에 틀렸다

통과/실패는 정상 작동하지만 **재는 축이 현실과 다른** 경우. 초록불이 거짓은 아니지만
질문이 틀렸다.

- **`accessibilityState` 는 웹에서 무효다**(react-native-web `^0.21.0` 실측). E2E 가
  `aria-*` 로 상태를 판별하면 그 단언은 웹에서 아무것도 재지 않는다. **판정 대상의
  가시성**으로 재라.
- **뺄셈으로 만든 축은 조용히 틀린다.** `total - checkedIn` 이 퇴근자를 미출근으로
  세어, 정상 퇴근한 저녁에 오차가 최대가 됐다. `scheduled` 를 **열거**로 바꾸자 tsc 가
  구성 3곳을 잡아냈고 그중 1곳은 프로덕션이었다. 🔑 **축은 타입에 이름으로 박아야
  컴파일러가 대신 센다** → [[type-honesty-runtime-vs-declared]]
- **가드는 앱의 판정축과 같은 축에** 걸어라. 앱은 `no_show_at` 을 보는데 트리거는
  `status` 만 막아 우회가 가능했다(PR#475 적대적 리뷰 confirmed 7건 중 하나).

## 유형 5 — 도구의 사각지대라 애초에 검사 대상이 아니다

- `eslint.config.js` 의 ignores 에 `e2e/`·`scripts/`·`functions/`·`supabase/functions/`
  가 있다 → **상수·enum·사용자 문구를 단일 소스로 바꿔도 `npm run quality` 가 `e2e/` 를
  못 잡는다**(PR#353 실사고: 제목 상한 25→40 상향 때 E2E 단언만 25 로 남아 CI red).
- PR#481 로 `type-check:e2e` 가 CI `quality` 매트릭스에 배선됐다. ✅타입은 이제 잡히지만
  ⚠️**문자열 단언은 여전히 못 잡는다** → 문구·상수 변경 시 `e2e/` **별도 Grep 필수**.
- `supabase` 클라이언트는 `Database` 제네릭 **없이** 생성된다(`src/lib/supabase.ts:19`)
  → `supabase.rpc('오타', { 틀린키: 1 })` 도 tsc 를 통과한다. 새 RPC 마다 **이름·인자 키
  고정 계약 테스트**를 둘 것 → [[supabase-write-pitfalls]]

## 실무 규칙

1. **Red-Green 을 생략하지 마라.** 통과만 확인한 테스트는 유형 1·2 를 걸러내지 못한다.
   고의로 깨뜨려 빨간불을 본 뒤에야 그 테스트가 존재한다고 말할 수 있다.
2. **0 을 보면 "없다"인지 "안 보인다"인지 되물어라.** RLS·anon·구버전 계측 셋 다 0 을
   같은 모양으로 반환한다.
3. **대조군을 같이 실행하라.** 있는 줄 아는 것을 같은 방법으로 찾아보고, 그것도 0 이면
   검증 장치가 고장난 것이다 → [[deploy-channel-skew]](배포 후 번들 grep 거짓음성)
4. **게이트를 걸 때 그 게이트를 열 열쇠도 같이 만들어라** → [[rollout-instrumentation-gap]]

## 원천

[[sources/memory-live-traps-2026-08]] — MEMORY.md 라이브 함정 25항목(2026-08-25 졸업분).
