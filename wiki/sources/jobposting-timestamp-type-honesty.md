---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/src/types/common.ts
  - uniqn-mobile/src/types/jobPosting.ts
  - uniqn-mobile/src/types/application.ts
  - uniqn-mobile/src/types/__tests__/jobPostingTimestampContract.test.ts
  - uniqn-mobile/src/schemas/common.ts
  - uniqn-mobile/src/domains/schedule/ScheduleConverter.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - uniqn-mobile/src/domains/job-posting/serialization.ts
  - PR#268
  - memory/project_jobposting_timestamp_type_honesty
tags: [types, timestamp, typescript, generics, crash, zod, job-posting, application]
---

# 소스: JobPosting·Application 시간필드 타입 정직화 (Date→string) — PR #268

## 무엇을 했나
공고 작성 화면 진입 크래시 `TypeError: p.createdAt?.getTime is not a function` 을 최소수정으로 막고, **그 근본 클래스(선언 타입이 런타임 진실과 다름)** 를 JobPosting·Application 도메인에서 근본교정했다. 서버·DB 무관한 **순수 프론트 타입** 작업(PR#268 본문). 커밋 3개(크래시 최소수정 `b25a6a722` + 타입정직화 `e8a3a621e` + 리뷰후속 `17876c834`)가 한 PR로 squash landing — master `a2ec53cbe`(2026-07-17 머지, `gh pr view 268` 실측). 22파일 변경.

## 거짓말의 뿌리 = 공용 베이스
- 런타임 진실원: `timestampSchema`(`uniqn-mobile/src/schemas/common.ts:40`)가 `normalizeToIsoString` 으로 **모든 입력을 ISO string 으로 통일**한다. 파일 헤더 주석이 이미 `createdAt: timestampSchema, // string (ISO 8601)` 로 명시(:14) — 스키마는 원래부터 옳았다. **검증됨**(코드 확인).
- 그런데 선언은 `BaseDocument.createdAt/updatedAt: Date` — 14개 도메인 인터페이스가 상속(`common.ts:38-44` 주석 기준). 하위에서 string 으로 좁히면 **TS2430**이라 3줄 flip이 불가능했다(PR#268 본문 주장).
- ⟹ 개별 인터페이스가 아니라 **베이스가 거짓말의 단일 발원지**. 크래시는 `?.` 가 non-null string 을 통과시키고 `.getTime()` 이 없어 던진 것.

## 해법 = 제네릭 베이스로 도메인별 졸업
```ts
export interface BaseDocument<T = Date> { id: string; createdAt?: T; updatedAt?: T }
export type FirebaseDocument<T = Date> = BaseDocument<T>;
```
`common.ts:33`·`:45` **검증됨**. 기본값 `Date` 유지 → 형제 도메인(Board·Notification·WorkLog 등, PR 본문 "13종")은 **무영향**. 런타임이 실제로 string 인 도메인만 `<string>` 으로 졸업:
- `JobPostingDocumentV3 extends FirebaseDocument<string>`(`types/jobPosting.ts:149`), `closedAt?: string`(`:184`) — **검증됨**.
- `Application extends FirebaseDocument<string>`(`types/application.ts:52`) — **검증됨**.

**제외 판정도 실측 기반**: Notification·Board·WorkLog 매퍼는 `new Date(row.x)` 로 **진짜 Date 를 생산** = 타입=런타임 정합이므로 거짓말이 아니다(PR 본문). 이 판정이 이 PR의 핵심 — 아래 [[type-honesty-runtime-vs-declared]] 참조.

## 소비처 교정 (런타임 무변경, 와이어 바이트 동일)
- **쓰기경로** `JobPostingRepository.ts`: `createdAt: now`(Date) → `nowIso = now.toISOString()`(create :479·:498-499), update 2지점 `new Date()` → `new Date().toISOString()`(:545·:739). ⚠️`submittedAt`(tournamentConfig)은 **Date 계약이라 `now` 유지** — 전량 flip이 아니다. **검증됨**(diff).
- 쓰기 옵션 타입 `SerializeJobPostingV3Options.createdAt/updatedAt` 도 동반 flip(`serialization.ts:27-28`). **검증됨**.
- **경계 변환** `ScheduleConverter.ts`: application 브랜치(:191)와 workLog 브랜치(:136) **양쪽** `toDate(x) ?? undefined` 로 ScheduleEvent(Date) 계약에 맞춤. **검증됨**.
- `ApplicationRepositoryTransactions`: `originalApplication.appliedAt` → `toDate()` 변환.
- 교정 도구는 확립된 `toDate`(`utils/date/core.ts:123`) — **신규 유틸 발명 금지**가 사전 가드레일이었다(핸드오프 §5).

## ★ 리뷰가 잡아낸 잠복 함정 — 반쪽 수정이 만든 소스별 런타임 분기
2번째 커밋은 application 브랜치만 `toDate()` 변환하고 workLog 브랜치를 남겨, `ScheduleEvent.createdAt` 의 **런타임 타입이 소스별로 갈렸다**(application=진짜 Date, workLog=string이 Date인 척). fable 2인 교차 리뷰가 확정해 3번째 커밋 `17876c834` 로 양 브랜치 통일. 소비처 0건이라 무회귀였으나, 미래에 `event.createdAt.getTime()` 을 쓰면 **workLog 소스에서만 간헐 크래시** — 원 크래시와 정확히 같은 클래스가 재생산될 뻔했다(PR 본문·커밋 메시지).

## 재발 방지 — 컴파일타임 계약 고정
`src/types/__tests__/jobPostingTimestampContract.test.ts` 신설. `@ts-expect-error` 로 "createdAt 에 Date 를 대입하면 에러" 를 고정 — 타입이 Date 로 되돌아가면 지시가 **unused directive** 가 되어 tsc 가 실패하고 `npm run quality` 게이트가 회귀를 차단한다(파일 :24-31 **검증됨**). Red-Green 검증 완료(PR 본문 주장).

## 검증 (PR 본문·memory 기준 — 이 세션에서 재실행 안 함)
`tsc --noEmit` 0 · jest 51스위트/**511 테스트** pass · `npm run quality` exit 0 · fable 2인(correctness + 적대적) 교차 리뷰 **APPROVE**, 프로덕션 회귀 0(`Date.toJSON() === toISOString()` 이라 쓰기 페이로드 바이트 동일).

## 교훈
- **단일 flip은 영향 반경을 과소평가하게 만든다**: 타입만 flip하면 30에러/13파일이나, 마스킹하던 **쓰기 옵션 타입**까지 동시 flip해야 진짜 반경이 나온다. base-wide(D안)는 **69에러/27파일**로 Board 실제 날짜연산 소비처를 동반 → 별도 PR로 분리(memory 실측 기록, 이 세션 미재현).
- **옵셔널 타입이 불일치를 마스킹한다** — `createdAt?:` 의 `?.` 가 string 을 통과시켜 크래시가 런타임까지 밀렸다. 기존 소비처들은 이미 `toDate()` 방어를 쓰고 있어(`types/board.ts:323`·`boardScheduleService.ts:18`) **`.getTime()` 을 직접 부른 한 곳만** 터졌다(핸드오프 §1) — 즉 증상 1건이 결함 1건을 뜻하지 않는다.
- **squash 저장소 = 머지 직전 master 재통합 필수**: PR#268 Test plan이 "최신 master 재통합 후 재검증" 을 명시. stale-base 위의 green 은 무효 — [[seat-basis-e2e-seed-drift]]·[[knip-signal-hygiene]] 이 같은 규율을 각각 다른 형태로 실증.
- 크래시 유발 지점은 [[order-sheet-unification]] #261 이 도입한 "마지막 공고" 프리셋 선별(`create.tsx:90`) — **신규 기능이 기존 타입 거짓말을 처음 밟는 방아쇠**였다.

## 잔여 (2026-07-19 기준, memory)
1. 실기기 QA — 공고 생성·수정·정산 쓰기경로(ISO string 페이로드), 대회 승인 흐름.
2. `Application.processedAt/confirmedAt/cancelledAt` — 런타임 string 이나 `applicationHistory` 체인(`ConfirmationHistoryEntry.confirmedAt` = 런타임 Date)과 얽혀 별도 스코프.
3. **D(base-wide 정직화)** — Board 등 잔여 도메인은 타입수리가 아니라 **런타임 마이그레이션**(매퍼가 Date 생산 → string) 이라 게시판 전면 QA 동반. "해당 도메인을 다른 이유로 건드릴 때 무임승차 졸업" 권고.

## 관련
- [[type-honesty-runtime-vs-declared]] — 이 PR이 확립한 재발 클래스 규칙(선언≠런타임)
- [[enum-divergence]] — 같은 zod 경계의 다른 실패 모드(파싱 실패 → 레코드 증발)
- [[whitelist-silent-drop]] — "조용히 틀린" 이웃 클래스(에러 없이 필드 증발)
- [[order-sheet-unification]] — 크래시 방아쇠(#261 프리셋 선별)를 도입한 작업
- [[layers]] — Repository 경계에서 타입 변환이 일어나야 하는 자리
