# ops 1f 후속 — `knockout_pool` int→bigint (오버플로 근본 수선)

> 작성 2026-07-06. ops-1f 최종 whole-branch 리뷰(opus)가 적발한 **비차단 후속**. 소규모 단일 PR.
> 선행: **ops-1f #225 master 머지완료**(`f70222b0d`) + prod 마이그 4종 적용 완료. 이건 그 위 후속.

---

## 다음 세션 첫 프롬프트 (복붙용)

```
ops 1f 후속 PR — ops_live_stats.knockout_pool 을 int→bigint 로 올려 KO 풀 산술 오버플로를 근본 차단한다.

배경(근본원인):
- ops-1f 최종 리뷰가 적발: `ops_live_stats.knockout_pool` 컬럼이 1c에서 `int`로 정의됨. ops-1f
  recompute(`fn_ops_recompute_live_stats`)는 `v_knockout_pool int := (v_total_buyins * v_bounty_cost)::int`.
- 하드닝 H15는 `bounty_cost` CHECK 상한 1억(100000000)이 "오버플로를 입구에서 차단한다"고 적었으나 부정확:
  1억 × 22(total_buyins) = 2,200,000,000 > int max(2,147,483,647) → DEFERRED 트리거 커밋 시점에 22003
  numeric overflow 로 터지고 이후 전 참가자 변이가 막힌다. `prize_pool`은 이미 bigint 인데 knockout_pool만
  int 인 비대칭이 근원. 현실 바운티(≤수만원)·엔트리(수백)로는 미도달이라 비차단이었으나 정공법은 bigint 승격.

작업(신규 마이그 1종 + pgTAP):
1. 워크트리 격리: master(`f70222b0d` 이상) 기반 새 워크트리+브랜치 `fix/ops-knockout-pool-bigint`.
   node_modules 정션 연결(PowerShell New-Item -ItemType Junction, mklink는 MSYS 경로변환 실패).
2. 신규 마이그 `supabase/migrations/20260706NNNNNN_ops_knockout_pool_bigint.sql`(기존 마이그 수정 금지):
   a. `ALTER TABLE public.ops_live_stats ALTER COLUMN knockout_pool TYPE bigint;`
      (prod 0행이라 즉시·무락. 로컬 db:reset 으로 정합).
   b. `fn_ops_recompute_live_stats` CREATE OR REPLACE — **현재 prod/master live 정의를 베이스로**
      (T5 규율: `pg_get_functiondef('public.fn_ops_recompute_live_stats(uuid)'::regprocedure)` 덤프)
      단 두 곳만 변경: DECLARE `v_knockout_pool int` → `bigint`, 산식의 `(v_total_buyins * v_bounty_cost)::int`
      → `(v_total_buyins * v_bounty_cost)` (v_total_buyins가 bigint라 곱은 이미 bigint — `::int` 다운캐스트만 제거).
      INSERT/ON CONFLICT 컬럼 목록·다른 로직 전부 보존(회귀 금지 — 리뷰어 대조 지시).
   c. `bounty_cost` CHECK 상한 1억은 **그대로 유지**(bigint 승격으로 오버플로 명분은 사라지나 무해한 sanity
      bound. 상한 조정은 별도 논의 — 이 PR 범위 밖).
3. pgTAP `supabase/tests/ops_knockout_pool_bigint.test.sql`(RED-GREEN·무위 시드 금지):
   - knockout_pool 컬럼 타입 = bigint 단언(information_schema 또는 pg_typeof).
   - **대형값 회귀**: bounty_cost=100000000(1억) 대회에 total_buyins≥22 되도록 시드(참가자 22+ 또는
     재진입 가산) → recompute 후 `knockout_pool = total_buyins × 100000000`(bigint, >int max)이 **22003 없이**
     기록됨을 단언. 마이그 전(int)엔 이 단언이 22003으로 FAIL → RED 실증. `SET CONSTRAINTS ALL IMMEDIATE`로
     DEFERRED 트리거 즉발.
   - (기존 `ops_live_stats_deferred.test.sql`의 knockout_pool 단언은 소액이라 무회귀 — 확인만.)
4. supabase.ts: Supabase 타입 gen 은 int·bigint 모두 `number`로 매핑 → **클라 타입 변경 불요**(확인만.
   변경 필요 시 수술적으로. 전체 재생성 금지).
5. 검증: `npm run db:reset && npm run test:db:helpers && npx supabase test db` · `npx tsc --noEmit` ·
   `npx jest` · `npm run quality` 전부 GREEN.
6. prod 게이트(사용자 "go" 후): MCP apply_migration 1종 → get_advisors(ERROR0) →
   `SELECT data_type FROM information_schema.columns WHERE table_name='ops_live_stats' AND column_name='knockout_pool'`
   = bigint 실측 → push + PR → CI 9종 → squash. (마이그 1종이라 SDD 불요 — 직접 구현 + code-reviewer 1회.)

가드: 한글 · 작업디렉토리 uniqn-mobile/ · 기존 prod 마이그 수정 금지 · db push 금지(MCP apply_migration 전용) ·
  live 정의 베이스로 recompute 재정의(회귀 금지) · pgTAP RED-GREEN. 구현 모델은 사용자 지정(소규모라 sonnet 충분).
```

---

## ✅ ops-1f 잔여 후속 — 전건 완료 (2026-07-06~07)

- **✅ bountyAccrued int\*int 오버플로 (#227 머지·prod 적용, `f2b01b7fc`)**: `ops_get_player_view` 의 `v_p.knockouts * v_t.bounty_cost`(int*int) → `v_p.knockouts::bigint * v_t.bounty_cost` 승격. knockouts>21 + bounty 1억이면 22억 > int max → 22003(read 경로라 조용). RED(22003)→GREEN, 전체 pgTAP 525·advisor ERROR0·anon/authenticated EXECUTE 보존. #226 knockout_pool 과 동일 클래스.
- **✅ INVALID_PERCENTS 0값행 문구 (#228 머지, `6d960c4b5`)**: 0%(이하)인 순위가 있으면(합계 100이어도 `computeAmountsFromPercents` 는 INVALID_PERCENTS 반환) "합계 100 되어야(현재 100%)" 가 모순으로 읽히던 문제 → `payoutMessages.percentErrorMessage` 순수함수로 0 이하 순위 전용 문구 우선(+단위테스트 5). buildPayload·배너 중복 로직도 단일화.
- **✅ uuidLike/fmt 공용 유틸 통합 (#228 머지)**: `uuidLike` 2곳(opsSeat/opsPrize) → `schemas/common.ts`(UUID_LIKE_RE+uuidLikeSchema) 단일 소스. `fmt` 7곳(ops 컴포넌트 5 + live/monitor 화면 2) + `fmtKrw` → canonical `formatNumber`(@/utils/formatters/currency) 위임. TS-only·마이그 없음·quality EXIT0·jest 4793.

## 별도 게이트(코드 아님) — ops-1f 실사용 오픈 전

- 수동 QA: iOS 실기기 SelectBottomSheet 피커 스크롤/back 복귀 [BLOCKING] + 운영자 스모크.
- `app_config` 플래그 점진 ON(현재 ops 진입동선 부재·OTA 보류로 유저 무노출).
