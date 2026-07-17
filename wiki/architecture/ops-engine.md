---
area: architecture
updated: 2026-07-17
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260625120000_ops_1a_enums_and_tables.sql
  - uniqn-mobile/supabase/migrations/20260625120100_ops_1a_rls_and_membership.sql
  - uniqn-mobile/supabase/migrations/20260628110000_ops_1c4_player_view_rpcs.sql
  - uniqn-mobile/supabase/migrations/20260717090100_ops_s1_monitor_config_snapshot_break.sql
  - uniqn-mobile/supabase/migrations/20260717090400_ops_s1_public_reports.sql
  - uniqn-mobile/supabase/migrations/20260717090500_ops_s1_funnel_events.sql
  - uniqn-mobile/supabase/migrations/20260717090600_ops_s1_hub_flag.sql
  - uniqn-mobile/src/domains/ops/opsHubFlag.ts
  - uniqn-mobile/src/components/ops/OpsHubIntroCard.tsx
  - uniqn-mobile/src/services/ops/opsReportService.ts
  - uniqn-mobile/src/repositories/supabase/OpsEventRepository.ts
  - uniqn-mobile/src/types/ops.ts
  - memory/project_tholdem_ops_revival_20260623.md
  - memory/project_ops_open_access_monetization_20260716.md
  - PR#207
  - PR#230
  - PR#265
tags: [ops, tournament, architecture, event-sourcing, security]
---

# 대회 운영 엔진 (T-HOLDEM ops)

> 홀덤 대회 **라이브 운영 엔진**. 등록데스크→테이블/좌석→블라인드 클럭→bust/상금까지 한 세션을 운영한다. 슬라이스 1a~1f + 배정 2종 전부 **prod 출하 완료**(PR#207~#230). uniqn 계정·**공유 Supabase**(`ygfxukhktpqymahfrvbz`) 위, 5탭+공개뷰 구조. 상세 진행 이력은 `memory/project_tholdem_ops_revival_20260623`.

## 데이터 모델 (코드 검증됨)
대회 1건 = 여러 도메인 테이블의 그래프(`tournament_id` FK + `ON DELETE CASCADE`):
- `ops_tournaments` — 대회 루트. `owner_id`·`job_posting_id`(공고 N:1 연결)·`monitor_token`·`next_entry_seq`(gap-free 엔트리 할당자, FOR UPDATE 직렬화). `20260625120000_ops_1a_enums_and_tables.sql:56-90`
- `ops_participants` — 엔트리. `entry_number`(대회 내 1부터 gap-free)·`claim_token`·`player_user_id`·status 라이프사이클(registered→checked_in→active→busted/no_show). `:111-138`
- `ops_events` — **append-only 이벤트 스파인**(아래). `:162-196`
- 이후 슬라이스: `ops_tables`/`ops_seats`(1b), `ops_blind_levels`/`ops_clock`/`ops_live_stats`(1c), `ops_prizes`(1d/1f), `ops_staff`(1e, [[ops-1e-staff-integration]]).
- 타입/레포: `src/types/ops.ts`, `OpsEventRepository.ts` 등 도메인별 Repository 11종.

## 이벤트 스파인 — ops_events (append-only)
모든 상태 변화는 `ops_events`에 append된다(`type` enum + `payload` jsonb + `actor_id`). **UPDATE/DELETE 이중 금지**: `BEFORE UPDATE OR DELETE` 트리거가 `OPS_EVENTS_APPEND_ONLY`(P0001) RAISE + 권한 REVOKE. Realtime publication 미등록(감사 로그, 실시간 구독 대상 아님). `20260625120000_...:160-196`

## 쓰기 경계 — SECDEF RPC 전용
D3 원칙: **테이블 DML은 전부 SECDEF RPC 경유**(Presentation/Hooks/Service에서 직접 쓰기 금지, [[layers]]). RPC 공통 규약:
- `SECURITY DEFINER` + `SET search_path = public,extensions,pg_temp`
- **actor 바인딩**: `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())` → 위조 차단(P0001)
- **락 순서**: `pg_advisory_xact_lock(대회)` → 대회행 `FOR UPDATE` (ABBA 데드락 회피, ops 1f에서 견고화)
- 모든 비즈니스 실패 = `ERRCODE 'P0001'` → `mapOpsRpcError`로 클라 매핑
- 근거: 1e RPC 5종 `20260708100100_ops_1e_staff_rpcs.sql`(대표), 1a `20260625120200_ops_1a_rpcs.sql`

## 멤버십 · RLS (SELECT-only)
읽기 정책은 `is_ops_member(tournament_id, uid)` 재사용 — **owner_id 매칭 OR 연결 공고 워크스페이스 멤버 OR is_admin**. 모든 ops 테이블 `ENABLE + FORCE RLS`, `is_admin()`은 `(SELECT …)` initplan 래핑(SEC-2). `20260625120100_ops_1a_rls_and_membership.sql`. 공고 연결(N:1)을 바꾸면 워크스페이스 분기가 바뀌므로 연결 변경은 **대회 소유자 전용**([[ops-1e-staff-integration]]).

## anon SECDEF 불변 계약 (=2)
공개뷰(비로그인)는 **anon-executable SECDEF RPC 정확히 2개**로만 노출: `ops_get_monitor_snapshot`(전광판, 비-PII 화이트리스트)·`ops_get_player_view`(플레이어뷰, view_token). `20260628110000_ops_1c4_player_view_rpcs.sql` + 1c3 monitor. 신규 변이 RPC는 PUBLIC/anon EXECUTE를 상속하므로 **매 슬라이스 anon 명시 REVOKE 필수**(pitfall `memory/pitfall_supabase_new_function_anon_default_grant`), 회귀 가드 = **카탈로그 카운트+집합 단언(=2)**. claim 토큰은 읽기(view_token/anon)·쓰기(8자 PIN/bcrypt) 분리(STEP A, PR#216).

## 클럭 · live_stats
블라인드 클럭은 **서버 앵커**(서버 시각 기준 동기, 클라 드리프트 무관)·`ops_live_stats`는 트리거 recompute로 STATUS 대시보드/Realtime 구동. 1f에서 live_stats AFTER ROW 트리거를 **DEFERRED CONSTRAINT TRIGGER**로 전환해 LS-매개 데드락 해소. `20260627100000_ops_1c_blind_clock_stats_tables.sql`·`20260704100100_ops_1f_live_stats_deferred.sql`·`memory/project_tholdem_ops_revival_20260623`.

## 슬라이스 지도 (전부 prod 머지)
| 슬라이스 | 범위 | PR |
|---|---|---|
| 1a | CRUD 스파인 + 이벤트로그 | #207 |
| 1b | 테이블/좌석·redraw | #210 |
| 1c | 블라인드·클럭·모니터·플레이어뷰 | #212~214 |
| STEP A | claim 토큰 읽기/쓰기 분리 | #216 |
| 1d | bust·재진입·ITM·상금 | #218 |
| 배정 2종 | 랜덤·칩드래프트 재배치 | #220(+#229 fast-follow) |
| 1f | 잔여 상금·%·바운티(bigint) | #225(+#226~228) |
| 1e | 스태프 연동·딜러 배정 | #230 |

**후속(미착수, 별도 spec)**: 플레이어 포털(가입·클레임 UI·이력)→랭킹/포인트→전국 포털.

## S1 전면 개방(회원 전원) + 대회사 레일 (PR#265, 2026-07-17 머지 — 코드 검증됨)
ops를 **employer 전용 발견 표면 → 회원 전원 개방**. 서버는 이미 전원 지원(`ops_create_tournament`=caller-binding만·역할 게이트 없음·`job_posting_id` 선택적) — S1은 **발견 표면을 여는 것**이지 권한 확장이 아니다.
- **진입 허브(진입 표면 조합)**: 프로필 메뉴 + 1회성 신기능 안내(`OpsHubIntroCard`) + 스케줄 빈상태 크로스링크. 게이트 = `app_config` 플래그 `ops_hub_enabled` **기본 OFF**(`weekly_grid_enabled` 패턴, `useOpsHubEnabled`). `(ops)` 라우트 자체는 플래그 무관하게 접근 가능 — 발견 표면만 게이트.
- **악용 방어**: 공개뷰 익명 신고 — **신규 anon RPC 없이**(=2 계약 보존) 전용 `ops_public_reports` 테이블 + `BEFORE INSERT` 가드 트리거(토큰 해석·8자 절단 저장·대회당 시간당 5건 rate limit). `opsReportService.ts`.
- **퍼널 계측**: `analytics_events` INSERT 전용(노출→진입→생성→열람→claim 전환, 조회 admin). 훅 `useOpsHubImpressionOnce`·`useOpsHubEnteredOnce`, `analyticsService.ts`. `ops_limit_reached`는 S2 한도 선배선.
- **TV 모니터 프리셋**: `ops_tournaments.monitor_config` jsonb(NULL=기본 full+5슬롯)·`ops_set_monitor_config`(owner 전용·서버 화이트리스트 재조립 저장→비-PII 보증)·모니터 스냅샷에 payouts 상위5+nextBreak 편승. `MonitorConfigCard`·`monitor/registry.ts`.
- **지급 마킹/복제**: `ops_participants.prize_paid_at`+`ops_set_prize_paid`(undo-first 왕복)·`ops_duplicate_tournament`(설정+블라인드+monitor_config 복사, 라이브 상태·토큰·상금은 제외).

**마이그 7개(`20260717090000`~`090600`) 전부 additive**(enum ADD VALUE·ADD COLUMN·신규 테이블·`CREATE OR REPLACE`). **배포 순서 BLOCKING**: prod 마이그 → OTA → 플래그 ON. 역순이면 신 클라의 `prize_paid_at`·`monitor_config` 참조가 **42703(undefined_column)으로 기존 ops 화면 즉사**. 진행/게이트 상세 = `memory/project_ops_open_access_monetization_20260716`.

**불변 계약 유지(코드 검증됨)**: anon-executable ops SECDEF **정확히 2개**(monitor/player) — S1 마이그 전부 신규 함수 PUBLIC/anon REVOKE, 공개뷰 스냅샷은 `CREATE OR REPLACE`로 기존 anon ACL 보존, 신고는 anon RPC 대신 테이블+트리거로 우회(위 "anon SECDEF 불변 계약(=2)" 섹션). claim 토큰 읽기(view_token/anon)·쓰기(8자 PIN/bcrypt) 분리도 불변. 하드닝 규율 = [[secdef-hardening]].

## 연결
- 5레이어 쓰기 경계: [[layers]]
- RLS 3계층·SECDEF 함정: [[rls-model]]
- 현장 직무(StaffRole dealer/floor/serving): [[roles]]
- 타깃(대회사 D-7 집중 인력): [[target-market]]
- 스태프 슬라이스 상세: [[ops-1e-staff-integration]]
- 출하 과정 마이그 함정: [[migration-timestamp-collision]]
