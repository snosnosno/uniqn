# 수익 모델 적용 — 기능·워크플로우 갭 분석 (2026-05-29)

> 기준 모델: [2026-05-29-monetization-model-recommendation.md](./2026-05-29-monetization-model-recommendation.md) (Approach A 확정)
> 조사 방식: 3개 Explore 에이전트 병렬 코드 검증 (file:line 근거). 스펙 아닌 **실제 코드 상태** 기준.
> 관련 메모: [[project_monetization_phase3_planning]] · [[pitfall_posting_role_filled_dead_counter]] · [[project_schedule_counter_unification_sp2_sp3]]

---

## 0. 한 줄 결론

막힌 건 전부 **클라이언트 통합**이다. DB 테이블·RPC·환불·웹훅은 이미 다 있고, 앱에서 호출하는 코드가 0건. 모델 적용 = ① 이미 있는 RPC를 앱에 연결 + ② featured/연장 신규 2건. **결제 RPC 스키마 드리프트는 §4 diff + round-trip 실측 결과 해소**(RPC가 `jsonb_populate_record` 방식이라 드리프트에 강함, 본문 갱신 불필요, 실측 2/2 게이트 통과 — 배선 차단 요인 없음).

---

## 1. 현재 상태 매트릭스 (검증 결과)

| 영역 | 백엔드(DB/RPC/Edge) | 클라이언트(앱) | 근거 |
|------|:---:|:---:|------|
| wallet 테이블·원장·캐시 트리거 | ✅ | — | 마이그 `20260427000000~000200` |
| `consume_diamonds_atomically` (하트→다이아 순 소비) | ✅ | ❌ 호출 0건 | `20260427000300` |
| `credit_diamonds_atomically` (충전/환불) | ✅ | ❌ (웹훅만 호출) | `20260427000400` |
| `grant_heart_atomically` + `claim_daily_attendance` | ✅ | ❌ 호출 0건 | `20260427000500` |
| `create_job_posting_with_payment_atomically` | ✅ | ❌ 미연결 | `20260427000600` + M5패치 `20260514020000` |
| `refund_job_cancellation_atomically` (24h 100%/이후 50%) | ✅ | ❌ 미연결 | `20260427000700` |
| RevenueCat 웹훅 Edge Function | ✅ (223줄, 멱등성+첫충전보너스) | — | `functions/revenuecat-webhook/index.ts` |
| `diamond_products` 6종 시드 | ✅ | (읽기만) `WalletRepository.listProducts` | `20260427000800` |
| Feature Flag `app_config.monetization` | ✅ 시드(전부 무료) | ❌ 읽는 코드 0건 | `20260427000900` |
| RevenueCat SDK (`react-native-purchases`) | — | ❌ **미설치** | `package.json` 0건 |
| 지갑 UI (`BalanceBadge`/`PurchaseSheet`/`PaywallModal`) | — | ❌ 0건 | `components/wallet/` 부재 |
| 지갑 훅 (`useWalletBalance` 등) | — | ❌ 0건 | `hooks/` 부재 |
| `WalletRepository` (읽기 전용) | — | ✅ `get_wallet_summary`/`listProducts`만 | `WalletRepository.ts` |
| featured/boost 우선노출 | ❌ (`is_featured` 컬럼 제거됨) | ❌ 정렬은 `work_date` 역순만 | `JobPostingRepository.ts:113` |
| 공고 연장(extend) | △ 만료 트리거만 | ❌ extend RPC·UI 0건 | `consume_job_extend` enum만 존재 |

**핵심 단절 지점:** `jobManagementService.createJobPosting` → `JobPostingRepository.createWithTransaction`이 **순수 INSERT만** 수행(`JobPostingRepository.ts:366`). 결제 RPC를 우회. 취소도 `deleteWithTransaction`이 status 업데이트만(환불 RPC 미호출, `:423-441`).

---

## 2. 모델 적용에 필요한 작업 (의존성 순서)

### ⓪ [전제·필수] 무료 하트 적립 루프 가동
**왜 먼저인가:** regular=하트1 결정의 **전제**. 적립 루프가 없으면 신규 유저는 하트 0 → 즉시 다이아 폴백 or 게시 불가. signup +10이 최소 필수.
- 변경: 가입 플로우 → `grant_heart_atomically('grant_signup', +10)` 호출. 출석 UI → `claim_daily_attendance`. (리뷰/추천/연속은 후순위 가능)
- 상태: RPC 완성, **클라이언트 호출만 추가**. 난이도 S~M.

### ① 공고 생성 차감 연결
- 변경: `JobPostingRepository.createWithTransaction`의 순수 INSERT → `create_job_posting_with_payment_atomically(p_cost_diamonds, p_reason)` 경유로 전환.
- **priceMap 정의 신규** (코드에 0건): `{ regular: 1, urgent: 10, fixed: 5, tournament: 0 }`. regular=1은 consume RPC의 하트-우선 소비로 자동 "하트1, 다이아폴백" 동작.
- §4 diff 완료 — RPC 본문 갱신 불필요, 배선 전 round-trip 실측 게이트만.
- 상태: RPC 존재, 미연결. 난이도 M (리스크 M).

### ② Feature Flag 게이트
- 변경: `app_config.monetization` 읽는 `useAppConfig` + `isMonetizationEnabledFor(type, userId)` + `user_bucket` 해시 롤아웃 구현. flag off(현재)면 `cost=0` 강제 → 차감 skip(전부 무료 동작 유지).
- 상태: DB 시드만, 클라이언트 0건. 난이도 M.

### ③ 잔액 표시 + Paywall (Phase 3 plan 미구현분)
- 변경: `useWalletBalance` 훅(WalletRepository 래핑) + `BalanceBadge`(헤더/프로필) + `PaywallModal`(INSUFFICIENT_BALANCE 시). create.tsx에 비용/잔액 표시.
- 상태: 0건. 난이도 M. (Phase 3 plan D1~D8 결정 그대로 활용 가능)

### ④ RevenueCat SDK 설치 + 다이아 충전
- **왜 필요:** regular=하트1이어도 하트 소진 시 다이아 폴백 + urgent/fixed는 다이아 → 충전 경로 필수.
- 변경: `react-native-purchases` 설치 → `purchasesService.ts`(`Purchases.configure`) → `PurchaseSheet` → `app/_layout.tsx` 초기화(`useRevenueCatSession`).
- 외부작업: RC 계정/IAP 6종/webhook secret([[project_monetization_phase3_planning]] §의존성).
- 상태: 0건. 난이도 L (외부 설정 + 샌드박스 검증 별도 세션).

### ⑤ 공고 취소 환불 연결
- 변경: `deleteWithTransaction`(또는 취소 RPC)에 `refund_job_cancellation_atomically` 호출 추가.
- 상태: RPC 존재, 미연결. 난이도 S~M.

### ⑥ [신규] featured/부스트 (모델 부가, 핵심 아님)
- 변경: `is_featured` 또는 `priority` 컬럼 재도입(ISSUE-003에서 제거됨) + `orderBy: priority DESC, work_date DESC` + 부스트 과금(per-boost). urgent 우선노출도 여기서 같이.
- 상태: 부재. 난이도 M. **별도 트랙 — 유료화 스위치 ON 이후.**

### ⑦ [신규] 공고 연장(extend)
- 변경: `extend_job_posting` RPC 신규(consume_job_extend enum은 존재) + "연장하기" UI + 만료 D-1 노출.
- 상태: 만료 트리거만 동작. 난이도 M. **별도 트랙.**

---

## 3. 워크플로우 변경 지점 요약 (파일 단위)

| 파일 | 현재 | 변경 |
|------|------|------|
| `src/repositories/supabase/JobPostingRepository.ts:330-374` | 순수 INSERT | 결제 RPC 경유 |
| `src/repositories/supabase/JobPostingRepository.ts:423-441` | status 업데이트만 | 환불 RPC 호출 추가 |
| `src/services/jobs/jobManagementService.ts:94-113` | 차감 없음 | priceMap 계산 + flag 게이트 |
| `src/hooks/useJobManagement.ts:96-124` | 일반 에러만 | INSUFFICIENT_BALANCE → Paywall |
| `app/(employer)/my-postings/create.tsx` | 비용/잔액 UI 0건 | 비용·잔액 표시 |
| `app/_layout.tsx` | RC init 0건 | RevenueCat 초기화 |
| 가입 플로우 | 하트 적립 0건 | `grant_signup(+10)` |
| (신규) `src/services/wallet/`, `src/components/wallet/`, `src/hooks/use*` | 부재 | 신규 생성 |

---

## 4. 결제 RPC vs 현행 스키마 정합 — diff 완료 (리스크 HIGH→MEDIUM 하향)

> diff 수행 2026-05-29: RPC 최신 정의(M5 패치 `20260514020000`) vs `JobPostingRepository.createWithTransaction` (`:330-374`). 정의 마이그 3종 확인(`20260427000600`/`000601`/`20260514020000`, M5가 최신).

### 결론: 연결 가능. worst-case(하드코딩 INSERT 드리프트)는 이 RPC엔 미적용.

**RPC INSERT 메커니즘 (핵심):**
```sql
v_final_payload := v_defaults || p_posting_payload || {owner_id};  -- payload가 defaults를 덮어씀
INSERT INTO public.job_postings
SELECT * FROM jsonb_populate_record(NULL::public.job_postings, v_final_payload);
```
**클라이언트:** `toSnakeCase(removeUndefined(serializeJobPostingV3(...)))` → `supabase.from(TABLE).insert(snakeData)` (직접 INSERT, `:364-366`).

**왜 드리프트에 강한가:**
1. `jsonb_populate_record`는 **실행 시점 현재 테이블 컬럼**에 매핑 — SP1~SP3로 컬럼이 추가/삭제돼도 안 깨짐(페이로드에 있어도 컬럼 없으면 무시, 컬럼 있어도 페이로드에 없으면 NULL). 하드코딩 `INSERT(col...)`였다면 깨졌을 부분. → 메모리 경고의 "blurhash 누락" 회귀 클래스가 구조적으로 발생 안 함.
2. **payload-wins 병합**: 클라가 지금 직접 INSERT하는 `snakeData`(정상 동작 검증된 완전 페이로드)를 `p_posting_payload`로 그대로 넘기면 RPC stale defaults는 전부 덮어써짐 → 결과 row ≈ 현행 INSERT.
3. **stale defaults 무해**: `is_featured:false`(제거 컬럼)→무시 / `filled_positions:0`(생성 시점 0이 정답, 이후 SP3 트리거 관리, [[project_schedule_counter_unification_sp2_sp3]])→충돌 없음 / `stats`(camelCase)→클라가 항상 stats 전달해 덮어씀.
4. 키 정합: RPC defaults·클라 둘 다 snake_case(`schema_version`/`posting_type`/`total_positions`/`role_catalog`...). `schema_version:3` = 현 V3 직렬화와 일치.

### 배선 전 게이트 2건 — ✅ 실측 통과 (2026-05-29, Supabase read-only SELECT)

- **① round-trip 실측 — ✅ PASS**
  - 실제 행 2건 모두 `to_jsonb(jsonb_populate_record(NULL::job_postings, to_jsonb(jp))) = to_jsonb(jp)` → `round_trip_equal: true`. populate_record가 현행 SP1~SP3 전 컬럼(jsonb 중첩·timestamptz·배열) 손실 없이 재구성.
  - RPC 동작 시뮬레이션(defaults 병합 + 클라 payload, JS `Date.toISOString()` "...Z" 타임스탬프): `iso_z_coerced_ok: true`(ISO-Z→timestamptz 코어션 정상), `schedule_jsonb_preserved: true`(중첩 jsonb 동일), `has_id_from_default: true`(payload 생략 시 default 채움), payload-wins 확인(payload status='active'가 default 'draft' 덮어씀).
- **② stale defaults / NOT NULL 감사 — ✅ PASS**
  - `job_postings` NOT NULL & DB default 없는 컬럼 = `title`, `workspace_id` **2개뿐**.
  - `title`: 클라가 항상 전송(필수 입력). `workspace_id`: RPC 전용 자동 주입(M5 라인 36-47).
  - 나머지 NOT NULL(`id`/`status`/`location`/`schedule`)은 DB default 보유 → 생략돼도 안전. `is_featured` 등 stale default 키는 컬럼 미존재 시 populate_record가 무시(round_trip=true가 증명).

**결정(확정):** RPC 본문 갱신/재마이그레이션 **불필요**, 결제+INSERT 분리 **불필요**. 클라이언트가 현행 `snakeData`를 `p_posting_payload`로 그대로 넘겨 `create_job_posting_with_payment_atomically`를 호출하면 됨. consume는 INSERT 후 호출, INSUFFICIENT_BALANCE 시 전체 롤백(원자성 OK). **§4 리스크 해소 — 배선 차단 요인 없음.**

---

## 5. 권장 실행 순서 (모델 활성화 최소 경로)

1. **지금(무료 운영 유지)**: ⓪ 하트 적립 루프(signup+10 최소) + ③ 잔액 표시 — 무과금 상태에서 적립·UI만 먼저. 리스크 0.
2. **차감 배선**: ② Feature flag 게이트 → ① 공고 생성 차감(§4 RPC 검증 선행) → ⑤ 환불.
3. **충전**: ④ RevenueCat(외부 설정 + 샌드박스, 별도 세션).
4. **스위치 ON**: 반복 고용주 코호트 관측 후 urgent부터 10% 롤아웃.
5. **부가(별도 트랙)**: ⑥ featured ⑦ extend.

스태프 직접 과금·구독제는 모델 결정대로 **보류** — 이번 작업 범위 밖.

---

## 6. The Assignment (다음 한 가지)

§4 diff + round-trip 실측 모두 완료. 후속 `/plan-eng-review`(아래 §7)에서 5대 결정 + outside voice 구멍 4건이 추가됨. **무과금 우선 착수 원칙은 유지**하되, 차감 배선(①②⑤)은 §7 P0/P1 task 완료 전 진입 금지.

---

## 7. 엔지니어링 리뷰 결과 (2026-05-30, 전체 멀티페이즈 스코프)

### 7.1 확정 결정 (interactive 리뷰)

| # | 결정 | 내용 |
|---|------|------|
| 스코프 | 전체 멀티페이즈 | 사용자가 ①~⑦ 전부 한 번에 리뷰/계획 선택 (Step0 최소안 거부) |
| 1A | **서버 권위 비용** | RPC가 posting_type + app_config flag + user_bucket(**owner_id**)로 비용 계산. 클라 `p_cost_diamonds` 제거. |
| 2A | **서버 트리거 적립** | 가입 +10은 `handle_new_user` 확장(EXCEPTION 격리). 출석만 클라 RPC. |
| 3A | **단일소스 비용 표시** | `get_posting_cost(type, owner_id)` read-only RPC를 표시·과금이 공유. 클라 priceMap 0. |
| 4A | **환불 연결 + 사전 고지** | 취소 경로에 `refund_job_cancellation_atomically` + 확인 다이얼로그에 환불액 표시. |
| 5A | **완전 테스트** | RPC pgTAP + 클라 단위 + 3 E2E + R1·R2 회귀. |
| 6A | **잔액 갱신** | 차감=RPC 반환값 동기 캐시, 충전=1s×10 폴링, BalanceBadge 5화면 단일 queryKey dedup. |
| T1A | **1A↔§4 정합** | 1A 유지 + RPC에 cost-calc 블록 추가(검증된 INSERT 본문 보존) + cost 블록 새 round-trip/pgTAP. §4는 "INSERT 본문 한정 불변"으로 정정. |

### 7.2 Outside voice 추가 구멍 (필수 반영 채택)

- **P0-2 협업자 차감·환불 비대칭**: JPC 협업자 게시 → owner 지갑 차감, 그러나 refund는 owner_id 권한 체크라 협업자 취소 시 unauthorized. → 비용 주체=워크스페이스 owner 명시 + 협업자 취소 UX 분기.
- **P1-1 consume 멱등성 부재**: `consume_diamonds_atomically`에 ref_id 멱등성 없음 + posting_id 서버생성 → 클라 재시도 시 중복 공고+이중 과금. → 클라 생성 idempotency key(또는 p_posting_id) + RPC ON CONFLICT 반환. RPC 시그니처 변경.
- **P1-2 적립 가드+백필**: `grant_signup` 멱등 가드(WHERE NOT EXISTS) + 기존 사용자 하트 백필 마이그레이션 + 적립실패 관측성(WARNING/Sentry).

### 7.3 Implementation Tasks

> P1=차감ON 차단, P2=같은 페이즈 동봉, P3=후속. 무과금(⓪③)은 P0/P1 task와 독립적으로 먼저 착수 가능.

- [ ] **T1 (P1)** — DB/RPC — `get_posting_cost(type, owner_id)` read-only RPC + 내부 cost 계산 함수(1A·3A 공유)
  - Surfaced by: 1A, 3A
  - Files: `supabase/migrations/`
  - Verify: pgTAP type별·flag on/off·bucket 경계
- [ ] **T2 (P1)** — DB/RPC — `create_job_posting_with_payment_atomically`에 server cost-calc 블록 추가(INSERT 본문 보존) + `p_cost_diamonds` 제거
  - Surfaced by: 1A, T1A
  - Verify: **cost 블록 새 round-trip(`jsonb_populate_record`) + pgTAP**. INSERT 동등성 회귀(R1)
- [ ] **T3 (P1)** — DB/RPC — consume 멱등성: 클라 생성 idempotency key/p_posting_id + ON CONFLICT 반환
  - Surfaced by: P1-1
  - Verify: 같은 key 2회 호출 → 1회만 차감·1 공고
- [ ] **T4 (P1)** — DB/trigger — `handle_new_user` 확장: grant_signup +10 멱등 가드(WHERE NOT EXISTS) + EXCEPTION 격리 + WARNING. 기존 사용자 백필 마이그레이션
  - Surfaced by: 2A, P1-2
  - Verify: 신규 가입 1회 적립 / 트리거 재실행 무적립 / orphan self-heal 무적립 / 백필 1회성
- [ ] **T5 (P1)** — DB/RPC — refund 협업자 권한 분기(P0-2): 비용 주체=owner 명시, 협업자 취소 시 명확한 처리
  - Surfaced by: P0-2, 4A
  - Verify: owner 취소 환불 OK / 협업자 취소 경로 정의된 동작
- [ ] **T6 (P1)** — client/service — `WalletRepository` 쓰기 경로 + `services/wallet/` (consume/refund 호출은 Repository 계층 경유, CLAUDE.md 레이어)
  - Files: `src/repositories/supabase/`, `src/services/wallet/`
- [ ] **T7 (P1)** — client/hooks+UI — `useWalletBalance`(단일 queryKey) + `BalanceBadge` 5화면 + 만료 lot inline (⓪③ 무과금 우선)
  - Surfaced by: ③, 6A
- [ ] **T8 (P1)** — client/integration — `createWithTransaction` → 결제 RPC 전환 + INSUFFICIENT_BALANCE → PaywallModal + 비용 표시(get_posting_cost) + 6A 동기 캐시 갱신
  - Surfaced by: ①, 1A, 6A. **R1 회귀(flag off 무료 게시 동등) CRITICAL**
- [ ] **T9 (P1)** — client/integration — 취소 경로 refund 연결 + 확인 다이얼로그 환불액 사전 고지
  - Surfaced by: 4A
- [ ] **T10 (P2)** — client/RC — `react-native-purchases` 설치 + `purchasesService`(configure/logOut 가드) + `PurchaseSheet` + `_layout` 초기화 + 폴링 timeout-after UX(이중결제 차단)
  - Surfaced by: ④, 6A
- [ ] **T11 (P2)** — Feature flag — `isPaidFor(type, ownerId) = paid_types[type] AND hash(ownerId) < rollout%` **서버 단일 함수**(T1에 통합), 클라는 표시만
  - Surfaced by: ②, P2-1
- [ ] **T12 (P2)** — featured/extend(⑥⑦) — priority 컬럼 재도입 + 정렬 + extend RPC/UI. 유료화 스위치 ON 이후 트랙

### 7.4 NOT in scope (의도적 제외)

- **P2-2 재활성화 후 환불 claw-back/금지** — 미선택. 현재 브랜치(`fix/cancel-rpc-expired-reopen-guard`)가 이미 만료-재오픈 가드 작업 중이라 그 계열로 별도 처리. 차감 ON 전 재검토.
- **스태프 직접 과금(부스트/뱃지)** — 모델 결정대로 출시 후 보류.
- **구독제(Track B)** — 고빈도 대회사 코호트 확인 후.

### 7.5 What already exists (재사용)

백엔드 100% 재사용: wallet 테이블·ledger·트리거·`consume/credit/grant_heart/claim_daily_attendance` RPC·`create_job_posting_with_payment`·`refund` RPC·RevenueCat 웹훅(223줄)·diamond_products 시드·app_config flag. 클라 `WalletRepository`(읽기)·`types/wallet.ts`. → 플랜은 백엔드 재사용 + 클라 배선 + RPC에 cost-calc/멱등성 **보강만**.

### 7.6 Failure modes (신규 코드패스별)

| 코드패스 | 실패 시나리오 | 테스트 | 에러처리 | 사용자 가시성 |
|----------|--------------|--------|----------|--------------|
| 결제 RPC | 클라 재시도 이중과금 | T3 | idempotency key | (해소) |
| 협업자 취소 | refund unauthorized | T5 | 권한 분기 | 명확 메시지 |
| 충전 폴링 | 웹훅>10s 지연 | T10 | timeout-after "처리중" | ⚠️ 미처리 시 이중결제 항의 → T10 필수 |
| signup 적립 | 트리거 실패 silent | T4 | EXCEPTION+WARNING | ⚠️ 격리만 하면 drift → 관측성 필수 |

### 7.7 Worktree 병렬화

- **Lane A (DB/RPC, 순차)**: T1→T2→T3→T4→T5 (shared `supabase/migrations/`)
- **Lane B (client wallet, 독립)**: T6→T7 (services/repositories/hooks/components)
- **Lane C (RC SDK, 독립·외부설정)**: T10 일부
- **통합(A+B 의존)**: T8(A+B), T9(A), T11(A에 통합)

실행: A·B·C 병렬 worktree → A+B 머지 후 T8·T9. Lane A와 통합이 같은 RPC 건드리니 통합은 A 머지 후.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_RESOLVED | 6 결정 + outside voice 4구멍(3 채택, 1 보류) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE VOICE:** Claude 서브에이전트(codex 비가용). P0-1(1A↔§4 모순)·P0-2(협업자 비대칭)·P1-1(consume 멱등성)·P1-2(적립 가드/백필)·P2-2(재활성화) 발견. T1A로 P0-1 해소, T2 multiselect로 P0-2·P1-1·P1-2 채택, P2-2 보류.
- **CROSS-MODEL:** 리뷰가 1A를 §4와 모순 없이 통과시킨 것을 outside voice가 포착 → T1A로 정합.
- **UNRESOLVED:** P2-2(재활성화 가드) — 보류 결정(별도 브랜치 계열).
- **VERDICT:** ENG REVIEW 완료 — 무과금(⓪③, T6·T7) 즉시 착수 가능. 차감 배선(T8·T9)은 T1~T5(P0/P1) 완료 후. R1 회귀 + cost 블록 round-trip 통과가 차감 ON 게이트.
