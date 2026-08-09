---
area: decisions
updated: 2026-08-10
status: current
sources:
  - uniqn-mobile/app/_layout.tsx
  - uniqn-mobile/src/domains/version/resolveVersionGate.ts
  - uniqn-mobile/src/hooks/useAppInitialize.ts
  - PR#441
  - PR#444
  - PR#461
tags: [deploy, ota, migration, version-gate, skew, release]
---

# 결정: 배포 채널 3개의 속도가 다르다 — 클라가 서버보다 먼저 나가면 앱이 깨진다

**한 줄:** 서버·웹·네이티브는 도달 속도가 각각 즉시/즉시/스토어빌드까지 불가라 **서버를 항상 먼저**
내보내야 하고, 이 규율을 어겼을 때의 유일한 방어선인 버전 게이트가 지금 **3계층 모두 죽어 있다.**

## 채널 3속도 (2026-08-09 실측)

| 채널 | 도달 속도 | 비고 |
|---|---|---|
| **서버** (DB/RPC/RLS/EF) | **즉시** — 1.0.5 구형 기기 포함 전원 | EF 는 master push 자동배포([[notification-offline-contract-2026-08]]) |
| **웹** (CF Pages) | **즉시** — 클라 코드 수정도 웹 사용자에겐 바로 | 공개 모니터/플레이어뷰의 주 소비 경로 |
| **네이티브** | **스토어 빌드 전까지 도달 불가** | `runtimeVersion=appVersion` 이라 OTA 가 버전에 잠긴다 |

`runtimeVersion` 이 `appVersion` 을 따르므로 `eas update` 는 **같은 버전 기기에만** 닿는다.
1.0.6 을 bump 하는 순간 1.0.5 기기는 OTA 사거리 밖으로 나가고, **스토어 업데이트 외에는
그 기기에 코드를 보낼 방법이 영구히 없다.**

## 실사고 — PR#441 (2026-08-08)

#441 머지분을 배포했는데 **그 ops 마이그가 prod 에 없었다.** `archived_at` 컬럼 참조가
**42703(undefined_column)** 으로 떨어져 ops 조회가 전부 깨졌다.

> 🔑 **`ops_hub_enabled=false` 는 안 막아준다.** (ops) 라우트는 결함⑥ 결정으로 **의도적으로
> 열려 있다** — 기능 플래그가 라우트 게이트가 아니다. 플래그를 믿고 순서를 건너뛰면 안 된다.

> 🚨 **머지 ≠ 서버 반영.** PR 이 초록이어도 마이그는 별도 경로로 들어간다. 배포 직전
> `list_migrations` **실측**이 유일한 증거다([[prod-parity-baseline]] 증거 계층 규율).

### 파생 함정 — 긴 명령 도중에도 메인 체크아웃이 바뀐다

같은 T1 배포에서 2회 관측했다. `eas update` 번들링 중 트리가 교체돼 metro 가 모듈 해석에
실패했고(코드 결함 아님 — `--clear-cache` 재시도로 해소), 다음 시도는 성공했으나 **Commit 라벨이
발행 시점 HEAD** 로 찍혔다. 긴 명령 **전후로 `git rev-parse HEAD` 를 찍어 대조**하고, 다르면
그 구간이 앱 코드인지 확인할 것.

## 그 사고의 유일한 서버측 방어선이 죽어 있었다 (2026-08-09 실측 → 08-10 부분 해소)

클라 선행 배포로 구 클라가 깨졌을 때 서버가 할 수 있는 유일한 일은 **강제 업데이트**다.
그런데 3계층이 전부 끊겨 있었다 — 구현이 없는 게 아니라 **배선 한 줄과 서버 값이 빠진 것**이었다.

| 계층 | 08-09 상태 | 현재 |
|---|---|---|
| 게이트 화면·분기 | `useAppInitialize` 가 `requiresUpdate`/`isMaintenanceMode` 를 **계산해서 반환하는데 아무도 안 읽었다** — `app/_layout.tsx:216` 이 `{isInitialized, isLoading, error, retry}` 만 구조분해 | ✅ **PR#461 `4a57e7d73`** 배선 완료 |
| 훅 | `useVersionCheck` 프로덕션 호출부 0건(`useVersionCheck.ts:94`) | ⚠️ **일부러 안 썼다** — 그 훅의 `goToStore` 가 `Linking.canOpenURL` 을 쓰는데 PR#422 가 그 경로를 없앴고 되살리면 iOS `LSApplicationQueriesSchemes` 로 **version bump 유발**. `resolveInstallStoreUrl()` + `Linking.openURL` 로 대체 |
| prod `app_config` 값 | `force_update_version`=**1.0.0**(전원 통과) · `latest_version`=**1.0.3**(배포판 1.0.5보다 낮아 항상 false) | 🔴 **여전히 정지** — 갱신은 1.0.6 출시 런북 항목 |

> 📌 이 실측은 "인앱 업데이트 안내 경로가 0개"라는 이전 판정을 **정정한다.** 경로는 다 있었다.
> 고치는 비용은 신규 개발이 아니라 **배선**이었고, 실제로 배선으로 끝났다.

### PR#461 이 남긴 설계 교훈

- **결함의 실체는 "화면이 없다"가 아니라 "분기가 없다"였다.** 그래서 고친 것도 화면이 아니라
  **우선순위**다 — `resolveVersionGate.ts`(신설)가 `loading → maintenance → forceUpdate → error → app`
  순서를 **순수 함수 하나**로 고정하고 테스트 9/9 이 역전을 단언한다. if 문으로 흩으면 그 순서가
  다시 암묵지가 된다.
- **강제 업데이트에는 재시도 버튼을 두지 않는다** — 재시도해도 서버 판정은 그대로다. 나가는 문은
  스토어 하나뿐이다. 반대로 **점검 모드는 재시도를 둔다**(끝나면 통과되므로). 이 둘을 가르는
  유일한 축이 "error 동반 여부"다.
- 🔑 **점검 모드에서 `versionCheckResult` 는 `null` 이다** — `bootstrapCore` 가 `MaintenanceError`
  를 throw 하고 catch 분기가 null 로 세팅한다. 서버 안내 문구는 **그 에러의 `message`** 에만 실려
  있어 거기서 읽어야 한다(정찰이 초안의 버그로 잡아낸 지점).

⚠️ **이 OTA 가 도달하기 전에 `force_update_version` 을 올리면 안 된다** — 아래 규율 3① 참조.
그리고 이 배선은 **네이티브 바이너리에만 실린다.**

## 규율

1. **서버 먼저, 클라 나중.** 마이그가 있는 PR 은 배포 전 `list_migrations` 로 prod 반영을 실측한다.
2. **기능 플래그를 순서 보증으로 쓰지 않는다.** 라우트가 열려 있으면 플래그는 방어선이 아니다.
3. **순서 강제 2건**(2026-08-09 원장):
   - `force_update_version` 갱신은 **게이트 UI 배선이 기기에 도달한 뒤**에 한다. 먼저 올리면
     1.0.5 기기가 화면 없이 "알 수 없는 오류"에 갇힌다.
   - 구 클라 직접쓰기 차단 트리거는 **계측 이후**에 넣는다 — 계측 없이는 구 클라 파손을 감지
     못 한다([[rollout-instrumentation-gap]]).
4. **`app_config` 버전값 갱신을 릴리즈 체크리스트에 편입**한다. 값이 정지해 있으면 UI 를 고쳐도
   죽은 안전장치다.
5. 웹 배포(CF)는 OTA 금지와 **무관한 허용 경로**다 — 클라 수정을 웹 사용자에게는 즉시 낼 수 있다.
   단 워크트리 웹배포 함정(빈 번들 · `--branch=master` 명시)을 지킬 것.

## 연결

- 증거 계층·마이그 정본: [[prod-parity-baseline]] · [[migration-timestamp-collision]]
- 게이트를 걸 때 열 열쇠도 같이: [[rollout-instrumentation-gap]]
- 채널 비대칭이 만든 롤아웃 비대칭: [[notification-offline-contract-2026-08]]
- OTA 를 건너 살아남는 것(캐시): [[persisted-cache-shape-drift]]
- 이 사고를 낸 웨이브: [[ops-defect7-wave-2026-08]] · [[full-app-audit-2026-08-09]]
- 대회 운영 도메인(라우트가 열려 있는 이유): [[ops-engine]]
