---
area: decisions
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/src/types/common.ts
  - uniqn-mobile/src/schemas/common.ts
  - uniqn-mobile/src/types/__tests__/jobPostingTimestampContract.test.ts
  - uniqn-mobile/src/utils/date/core.ts
  - uniqn-mobile/src/domains/schedule/ScheduleConverter.ts
  - PR#268
  - memory/project_jobposting_timestamp_type_honesty
tags: [types, typescript, generics, runtime-truth, regression-class, timestamp, zod]
---

# 결정: 선언 타입 ≠ 런타임 진실 — "타입 거짓말" 좁히는 규칙

## 클래스 정의
zod 경계(`timestampSchema` 등)가 값을 정규화하는데 **수기 인터페이스가 정규화 이전 형태를 그대로 선언**하고 있으면, 타입은 컴파일러를 통과시키지만 런타임 값은 다른 종류다. TS는 이 거짓말을 **영원히 잡아주지 못한다** — 오히려 소비처에서 `.getTime()`·날짜산술·포맷터 호출을 안전한 것처럼 승인해준다. 증상은 기능 추가 시점에 **엉뚱한 곳에서 처음** 터진다.

실증: `JobPosting.createdAt` 선언 `Date` vs 런타임 ISO string → `TypeError: p.createdAt?.getTime is not a function`([[jobposting-timestamp-type-honesty]], PR#268). 진실원 `uniqn-mobile/src/schemas/common.ts:40`(`timestampSchema` → `normalizeToIsoString`)은 **원래부터 옳았다**. 틀린 쪽은 타입 선언이었다.

## 규칙

### 1. 런타임 진실은 **도메인마다 다르다** — 전량 flip 금지
같은 필드명(`createdAt`)이라도 매퍼가 무엇을 생산하느냐가 도메인별로 갈린다. PR#268 실측: JobPosting·Application 은 `timestampSchema` 로 **string**, Board·Notification·WorkLog 는 매퍼가 `new Date(row.x)` 로 **진짜 Date**. 후자는 타입=런타임 정합이므로 **거짓말이 아니고 건드리면 안 된다**. 교정 착수 전 "이 도메인의 값을 **누가 생산하는가**" 를 매퍼 단위로 실측하라.

### 2. 공용 베이스는 제네릭화해 **도메인별로 졸업**시킨다
거짓말이 공용 베이스에 있으면 하위에서 좁힐 수 없다(**TS2430**). 해법은 베이스 교체가 아니라 파라미터화 — `BaseDocument<T = Date>`(`uniqn-mobile/src/types/common.ts:33`, **검증됨**). 기본값을 **현행 타입으로 유지**하면 형제 도메인은 무영향이고, 런타임이 이미 새 타입인 도메인만 `<string>` 으로 하나씩 졸업한다. 전 도메인이 졸업하면 기본값을 flip하고 파라미터를 제거(common.ts 주석에 종료 조건 명시).

### 3. 반경 측정의 진실원은 tsc — 단, **마스킹 타입까지 동시 flip**
"타입 하나만 뒤집고 `tsc --noEmit`" 은 반경을 **과소** 보고한다. 옵션/DTO 타입(`SerializeJobPostingV3Options.createdAt`)이 옛 타입으로 남아 에러를 흡수하기 때문. 실측 대비(memory): JobPosting 단독 flip = **30에러/13파일**, 마스킹 포함 base-wide = **69에러/27파일**. 후자에는 실제 날짜연산 프로덕션 소비처가 섞여 있어 **별도 PR로 분리**해야 한다.

### 4. 옵셔널이 크래시를 런타임까지 민다
`createdAt?: Date` 의 `?.` 는 **non-null string 을 통과시킨다** — 옵셔널 체이닝은 null 만 막지 타입 불일치를 막지 않는다. 그래서 증상 1건이 결함 1건을 뜻하지 않는다: 기존 소비처 다수는 이미 `toDate()` 로 방어 중이라(`uniqn-mobile/src/types/board.ts:323`·`services/board/boardScheduleService.ts:18`, **검증됨**) `.getTime()` 을 **직접** 호출한 한 곳만 터졌다. 나머지는 조용한 잠복이다.

### 5. 교정은 경계 변환 — 기존 `toDate()` 만, 신규 유틸 금지
변환 지점은 **경계**(Repository·Converter)여야 하고 도구는 확립된 `toDate`(`uniqn-mobile/src/utils/date/core.ts:123`, string·Date·number·null 전부 수용)다. 패턴: `toDate(x)?.getTime() ?? 0` / `toDate(x) ?? undefined`. 쓰기경로는 반대 방향(`new Date().toISOString()`) — `Date.toJSON() === toISOString()` 이라 **와이어 바이트 동일 = 무회귀**.

### 6. ⚠️ **분기 중 하나만 고치면 소스별 런타임 분기가 생긴다**
같은 필드를 채우는 분기가 여럿이면 **전부** 변환해야 한다. PR#268 2번째 커밋이 `ScheduleConverter` 의 application 브랜치만 변환하고 workLog 브랜치를 남겨, `ScheduleEvent.createdAt` 이 소스에 따라 Date/string 으로 갈렸다(교차 리뷰가 적발, 3번째 커밋 `17876c834` 로 양 브랜치 통일 — `ScheduleConverter.ts:136`·`:191` **검증됨**). 소비처 0건이라 무해했으나, 방치하면 **한쪽 소스에서만 간헐 크래시**하는 원래 클래스의 재생산이었다. [[whitelist-silent-drop]] §1(지점 전수 조사)과 같은 규율.

### 7. 재발 방지는 **컴파일타임 계약 테스트**로
런타임 단언으로는 타입 드리프트를 못 잡는다. `@ts-expect-error` 로 "옛 타입 대입은 에러" 를 고정하면, 타입이 되돌아갈 때 지시가 *unused directive* 가 되어 **tsc 가 실패**한다(`uniqn-mobile/src/types/__tests__/jobPostingTimestampContract.test.ts:24-31`, **검증됨**). `npm run quality` 게이트가 이를 차단. 도입 시 Red-Green 증명 필수(지시를 제거해 실제 실패를 확인).

## 착수 체크리스트
1. 매퍼 실측 → 도메인별 런타임 진실 표 작성(전량 flip 금지, 규칙 1)
2. 베이스 제네릭화 + 대상 도메인만 졸업(규칙 2)
3. 타입 + 마스킹 옵션 타입 **동시** flip 후 tsc 반경 확보(규칙 3)
4. 경계 변환 `toDate()` — 같은 필드의 **모든 분기** 전수(규칙 5·6)
5. `@ts-expect-error` 계약 테스트 + Red-Green(규칙 7)
6. squash 저장소이므로 **머지 직전 master 재통합 후 재검증** — stale-base 위 green 은 무효

관련: [[jobposting-timestamp-type-honesty]](실증 소스) · [[enum-divergence]](같은 zod 경계의 다른 실패 모드 — 파싱 실패로 레코드 증발) · [[whitelist-silent-drop]](에러 없이 조용히 틀리는 이웃 클래스) · [[persisted-cache-shape-drift]](**타입은 옳은데 데이터가 구세대**인 자매 클래스 — 지속 캐시가 OTA 를 건너 살아남는다) · [[layers]](변환이 일어나야 할 Repository 경계) · [[worktime-ssot]](표시 계층의 시간 SSOT 규율)
