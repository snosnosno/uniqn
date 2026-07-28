---
area: decisions
updated: 2026-07-28
status: current
sources:
  - uniqn-mobile/src/hooks/useSchedules.ts
  - uniqn-mobile/src/services/offline/criticalOfflineCache.ts
  - uniqn-mobile/src/__tests__/hooks/useSchedules.test.ts
  - uniqn-mobile/src/hooks/useApplications.ts
  - uniqn-mobile/src/hooks/useJobDetail.ts
  - PR#356
  - PR#362
tags: [offline, cache, ota, regression-class, schema-version, mmkv, schedule]
---

# 결정: 지속 캐시는 OTA 를 건너 살아남는다 — 형태 드리프트 규칙

## 클래스 정의

**OTA 는 코드만 바꾼다. 기기에 남은 지속 캐시는 이전 빌드가 쓴 payload 그대로다.** 캐시 읽기가 버전·유저·TTL 만 검사하고 **형태(shape)를 보지 않으면**, 구 payload 가 신 코드로 흘러 신규 필드가 `undefined` 인 채 화면까지 간다. 배포 단위(코드)와 데이터 수명(캐시)이 어긋나는 데서 오는 회귀라, 코드 리뷰로도 타입 체크로도 잡히지 않는다 — 양쪽 다 **한 버전의 코드만** 본다.

실증: PR#356 이 `ScheduleStats` 에 `completedWorkDays`·`settledEarnings`·`estimatedEarnings` 세 필드를 추가하면서 `SCHEDULE_CACHE_SCHEMA_VERSION` 은 3 그대로 뒀다(`uniqn-mobile/src/hooks/useSchedules.ts:70`, **검증됨**). `criticalOfflineCache` 의 통과 조건은 스키마 버전 일치(`:111-112`)와 TTL 미만(`:125-128`) 둘뿐이라 1.0.5 빌드가 써 둔 payload 가 그대로 통과했다:

```
{stats.completedWorkDays}일 근무      → "undefined일 근무"
formatCurrency(stats.settledEarnings) → 정산 완료/예정이 빈 값
```

노출 창은 TTL(24h)이고 첫 온라인 조회가 실값으로 덮지만, **오프라인 사용자는 그때까지 잘못된 화면을 본다**. 이 OTA 가 직접 유발한 회귀다(구 캐시 + 신 코드) — PR#362 로 수정.

## 규칙

### 1. `schemaVersion` 승격은 답이 아니다 — 안전망을 폐기한다
직관적 해법(버전 +1)은 **버전이 어긋난 잔여 캐시를 통째로 폐기**한다. 그러면 신규 필드의 `undefined` 는 사라지지만 오프라인 사용자는 화면 자체를 못 본다 — 오프라인 안전망이 존재 이유를 잃는다. 필드 **추가**는 하위호환 변경이므로 폐기할 이유가 없다. 버전 승격은 필드 의미가 **바뀌거나 제거**돼 옛 값이 적극적으로 틀릴 때만 정당하다.

### 2. 교정 지점은 정규화 경계 — 온·오프라인이 공유하는 한 곳
`normalizeScheduleQueryPayload`(`useSchedules.ts:108`) 하나에서 누락 필드를 `?? 0` 으로 메운다(`:90-106`, **검증됨**). 온라인 응답 경로와 오프라인 캐시 복원 경로가 **같은 정규화를 지나므로 한 곳만 고치면 양쪽이 닫힌다**. 소비처(화면)에서 방어하면 지점 수만큼 재발한다 — [[whitelist-silent-drop]] §1 과 같은 규율.

### 3. 기본값은 필드 **전량**에 건다, 신규 3개에만 걸지 말 것
PR#362 는 `totalSchedules`·`hoursWorked` 등 기존 필드까지 전부 `?? 0` 을 채웠다. 신규 3개만 방어하면 **다음 필드 추가 때 같은 회귀가 다시 난다** — 방어가 "이번 사건"이 아니라 "경계 계약"이 되어야 한다.

### 4. 오프라인 경로는 mock 기본값 때문에 **무테스트로 남기 쉽다**
기존 `useSchedules` 테스트는 `useNetworkStatus` mock 이 전부 온라인 기본값이라 오프라인 분기가 한 번도 실행되지 않았다. 검증하려면 mock 을 **가변 플래그**로 바꿔 실제로 오프라인 경로를 태워야 한다(기존 테스트는 온라인 기본값 유지). Red-Green 확인 필수 — 수정을 제거했을 때 신규 테스트가 실제로 fail 하는지(PR#362 에서 실행 확인).

### 5. ⚠️ 미해결 갭 — 같은 봉투를 쓰는 훅 4개
`criticalOfflineCache` 봉투(schemaVersion + TTL)를 쓰는 훅이 5개다. 이 중 **`useApplications.ts`·`useJobDetail.ts` 는 정규화 함수가 0개**(`grep -c normalize` = 0, **검증됨**)라 payload 형태가 커지는 순간 같은 회귀에 노출된다. `useJobPostings`·`useWorkLogs` 는 정규화가 일부 있으나 stats 류 누락 방어인지는 미확인. **해당 훅의 payload 타입에 필드를 추가할 때는 이 페이지를 먼저 볼 것.**

또한 별개 갭이 병존한다 — 오프라인 TTL 을 온라인 `staleTime` 으로 겸용하지 말 것(캐시 만료 = 삭제이므로 의미가 다르다). 같은 패턴이 훅 4개에 잔존한다([[post-1-0-5-merge-wave]]).

## 착수 체크리스트 (지속 캐시 payload 에 필드를 추가할 때)
1. 그 payload 가 `criticalOfflineCache` 로 지속되는가? → 아니면 무관
2. 추가인가 의미 변경인가 → 추가면 **버전 유지 + 정규화**, 의미 변경이면 버전 승격(규칙 1)
3. 정규화 경계가 온·오프라인 공통인지 확인, 없으면 신설(규칙 2)
4. 신규 필드가 아니라 **필드 전량**에 기본값(규칙 3)
5. 오프라인 분기를 실제로 태우는 테스트 + Red-Green(규칙 4)

관련: [[type-honesty-runtime-vs-declared]](선언과 런타임이 갈리는 이웃 클래스 — 이쪽은 타입이 거짓말, 저쪽은 **데이터가 구세대**) · [[enum-divergence]](zod 경계의 또 다른 조용한 유실) · [[whitelist-silent-drop]](에러 없이 조용히 틀리는 원형) · [[post-1-0-5-merge-wave]](이 회귀를 유발한 OTA 웨이브) · [[data-flow]](캐시가 끼어드는 읽기 경로)
