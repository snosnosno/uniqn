---
area: decisions
updated: 2026-08-08
status: current
sources:
  - .github/workflows/prod-migrate.yml
  - uniqn-mobile/supabase/migrations/20260802180000_update_work_log_slot_rpc.sql
  - PR#437
  - PR#407
tags: [rollout, ota, observability, migration, revoke]
---

# 결정: "롤아웃 확인 후에 한다"고 못박은 작업이 계기판 부재로 영구 대기 중이다

## 문제

PR#407(슬롯편집 RPC 화)의 마이그 주석(`:50-53`)은 구 경로 `REVOKE` 를
**"롤아웃 확인(사용자 게이트) 다음"** 으로 못박았다. 순서를 뒤집으면 아직 전환하지 않은
구 빌드가 즉사하기 때문이다. 합리적인 판단이었다.

문제는 **그 조건을 만족했는지 판정할 수단이 없다**는 것이다(2026-08-06 실측):

- `expo-insights` 미설치
- Sentry 에 `release`/`dist` 미태깅 → 어떤 번들이 도는지 구분 불가
- 앱 버전을 서버에 기록하는 경로 0건

> 🚨 결정적으로, **기다려서 로그가 쌓이는 방식이 성립하지 않는다.** prod 트래픽은
> `users 27` 규모다. 통계적으로 "구 빌드가 사라졌다"를 말할 표본이 애초에 모이지 않는다.

## 교훈 — 게이트를 걸 때 그 게이트를 열 열쇠도 같이 만들어라

"롤아웃 확인 후"는 조건절처럼 보이지만, **측정 수단이 없으면 그건 조건이 아니라 무기한 보류**다.
같은 문장이 여러 마이그 주석에 복제되면서 여러 작업이 동시에 대기 상태에 들어갔다.

대안은 셋 중 하나다:
1. **측정을 만든다** — 앱 버전을 서버에 기록하거나 Sentry 에 `release`/`dist` 를 태깅한다.
2. **시간 기반으로 바꾼다** — "OTA 발행 후 N일"처럼 관측 없이 판정 가능한 기준으로 대체.
3. **UNMEASURED 를 1급 결과로 취급한다** — R3 게이트 설계
   (`docs/analysis/2026-08-07-r3-gate-measurement-design.md`)가 택한 방향.
   "측정 불가"를 통과도 실패도 아닌 **명시적 상태**로 두면, 대기가 침묵 속에 잊히지 않는다.

## 함께: prod 마이그를 파일 바이트 그대로 싣는 워크플로우 (PR#437)

`.github/workflows/prod-migrate.yml`(수동 실행). MCP 로 마이그를 옮길 때
**주석이 축약되면 레포↔prod 정본이 갈라진다**([[prod-parity-baseline]]).
750줄짜리 함수를 손으로 옮기는 것은 그 자체가 위험이므로, 파일을 **바이트 그대로** 싣는 경로를
만들어 사람 손을 뺐다.

검증은 `md5(replace(pg_get_functiondef(oid), chr(13), ''))` 대조다 —
🔑 `chr(13)` 제거를 빼면 개행 차이 때문에 **전부 가짜 불일치**로 나온다.

### 첫 실사용 결과 (2026-08-08 실측, 코드로 검증됨)

`20260807180000`(PR#433) · `20260808120000`(PR#439)이 이 경로로 prod 에 들어갔고,
`list_migrations` 에 **레포 파일명 그대로** 기록됐다.

이건 부수효과가 아니라 이득이다. MCP `apply_migration` 경로는 version 을 **적용 시각**으로
부여해서 레포 파일명과 항상 달랐고([[migration-timestamp-collision]] 참조), 그 때문에
"어느 마이그가 이미 적용됐나"를 사람이 대조표로 관리해야 했다.
**파일 경로로 넣으면 그 대조표 자체가 필요 없어진다.**

## 연결

- 정본 분열 방지 규율: [[prod-parity-baseline]]
- 이 게이트에 막혀 있는 작업: [[settlement-rpc-wave-2026-08]]
- 배포 채널 비대칭(EF vs OTA): [[notification-offline-contract-2026-08]]
- 서버 검증을 prod 에 싣는 대상: [[server-validation-completeness]]
