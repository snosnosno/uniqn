# T-HOLDEM 라이브 대회 운영 엔진 부활 — 설계 v2

- **작성일**: 2026-06-23 (화) · **개정**: v2 (독립 리뷰 3건 반영)
- **상태**: DESIGN v2 — 사용자 리뷰 대기
- **브랜치**: `feat/tournament-ops-revival` (master 기반, `T-HOLDEM-ops` 워크트리)
- **선행**: git 히스토리 원본 T-HOLDEM 인벤토리 + 아키텍처/DB/제품 적대 리뷰 3건(실코드 검증)

> **v2 변경 요약**: ①"빌드 산출물 분리" 거짓 정정 ②좌석 `uuid[]`→정규화 `ops_seats` ③스태프 연동을 `work_logs`+`is_workspace_member` 기반 재설계(staff_role 6값) ④상금용 `finish_position`/`busted_at` 추가 ⑤리바이/애드온 정산 모델 ⑥RPC actor 바인딩 명시 ⑦`ops_*` 네임스페이스(기존 "tournament=대회공고"와 분리) ⑧슬라이스 5분해 ⑨"시너지 핵심→기반", "부활→참조 재구축" 재프레이밍.

---

## 1. 배경 & 목표

원본 **T-HOLDEM**은 Firestore 기반 라이브 토너먼트 운영툴이었으나, **uniqn**(홀덤 스태프 관리앱, Supabase)으로 피벗하며 운영 기능이 삭제됐다(코드는 git 히스토리에만 잔존). 현 uniqn의 "대회" 기능은 운영툴이 아니라 **대회공고(스태핑 채용)** 뿐이다.

**목표** — 와홀덤/kHold'em 같은 홀덤 대회 플랫폼을 지향하되, 첫 조각으로 **원본 운영 엔진을 Supabase 위에 재구축**하고 **uniqn 계정·공고 확정 스태프를 대회 딜러로 연동**한다.

### ⚠️ "부활"이 아니라 "참조 재구축" (정직한 작업량)
실제로 재사용되는 것은 **좌석 배정 알고리즘(순수 로직)·엔티티 관계 형태·블라인드 구조** 뿐. 데이터 접근(Firestore→PG)·실시간(onSnapshot→Realtime)·상태(Context→react-query)·**UI 100% 신규**(원본 app2는 react-router+Tailwind 웹, Expo Router+NativeWind 아님 → 컴포넌트 0% 재사용). git 히스토리는 **도메인 참조 자료**로 쓰고, 작업량을 "포팅이라 싸다"로 잡지 않는다.

### 비목표 (제외)
공개 플레이어 포털, 위치기반 일정 노출, 랭킹/포인트, 예약/참가권, 커뮤니티, 정산 플랫폼, 매장관리 확장, 히스토리 PDF/Excel export, 딜러 로테이션/브레이크, 멀티데이/플라이트. → 후속 슬라이스.

---

## 2. 명시적 결정 (사용자 승인)

| 결정 | 선택 |
|---|---|
| 데이터 공유 | uniqn과 **같은 Supabase 프로젝트** |
| 코드 구조 | uniqn-mobile 모노레포 + `(ops)` 라우트그룹 |
| 참가자 정체성 | 운영자 직접 입력(워크인, 계정 불필요) |
| 스태프 연동 | 수동 풀 + **1회성 스냅샷 가져오기**(동기화는 후속) |
| 상금/결과 | 상금 분배 **포함**, export **보류** |

---

## 3. 아키텍처 (v2 정정)

### 3.1 코드 구조 — `(ops)` 라우트그룹
- uniqn-mobile 단일 코드베이스에 `app/(ops)/` 신설. 웹 우선(운영자=노트북/태블릿).
- 같은 Supabase·같은 Auth → 클라이언트(`src/utils/supabase.ts`)·인증 hook 재사용. 재사용 자산: NativeWind 디자인·UI 컴포넌트·`logger`·`AppError(E1~E7)`·Zod·react-query.

### 3.2 ⚠️ 번들/배포 — 정정: 런타임 분기 (빌드 분리 아님)
**`EXPO_PUBLIC_APP_VARIANT`로는 빌드 산출물이 분리되지 않는다.** Expo Router는 `app/` 전부를 한 번들에 정적 수집 → `(ops)` 라우트는 **메인 uniqn 번들에 함께 실린다**(웹/네이티브 모두). 따라서:

- **슬라이스 1 채택안 (단순)**: 단일 번들을 **2개 Cloudflare Pages 프로젝트**에 배포하고, `EXPO_PUBLIC_APP_VARIANT=ops`로 **진입 라우팅만 런타임 분기**. ops 코드가 소비자 앱에도 포함됨을 **명시적으로 수용**.
  - 필요한 실제 변경: `scripts/deploy-cloudflare.js`의 `--project-name=uniqn-app`(132줄) 파라미터화, 2번째 `wrangler.toml`(현재 `name="uniqn-app"` + `OG_KV` 바인딩 하드코딩), variant별 빌드 1회씩.
- **진짜 격리(보류 후보)**: `EXPO_ROUTER_APP_ROOT` 2개 앱루트 + 빌드 파이프라인 2벌. 슬라이스 1 범위 초과 → 트래픽/요구 생기면 후속.

→ "추가 코드 0줄"은 **Supabase 클라이언트 재사용에만** 해당. 배포 경로는 신규 코드 필요.

### 3.3 라우트 게이팅 — 소유권 기반 (역할 아님)
uniqn 그룹 게이팅은 `UserRole`(staff/employer/admin) 기반인데, 운영툴 권한은 `owner_id = auth.uid()`(아무 인증 유저가 자기 대회 소유) + 공고연결 시 workspace 멤버. "ops 운영자" 역할은 없음.
- **결정**: `(ops)`는 **authenticated면 진입 허용**, 권한은 **데이터 레이어(RLS)에서 소유권/워크스페이스로 강제**.
- 편집 지점(전수): `src/hooks/useAuthGuard.ts`의 `RouteGroup` union + `ROUTE_CONFIGS`, 루트 `app/_layout.tsx` `<Stack.Screen>` 목록, `app/index.tsx` splash 리다이렉트, `src/shared/navigation/authRedirect.ts`.

### 3.4 레이어 (CLAUDE.md) + 네이밍
```
Presentation app/(ops)/*
 → Hooks src/hooks/ops/*
   → Service src/services/ops/*
     → Repository src/repositories/supabase/OpsXxxRepository.ts (+ interfaces/IOpsXxxRepository.ts)
       → Supabase ops_* 테이블 / RPC / Realtime
```
- **순수 도메인 로직은 `src/domains/ops/`** (좌석 배정 3종·상금 산정·블라인드 진행) — I/O 분리, 단위 테스트.
- **네임스페이스 `ops_*`**: uniqn에 "tournament"는 이미 **대회공고**(`posting_type='tournament'`, `src/schemas/tournament.schema.ts`, `tournamentApprovalService`). 충돌 방지 위해 신규 테이블/도메인은 `ops_` 접두사.
- Repository는 기존 **interface/impl 분리** 패턴 따름(per-feature 하위폴더 아님).

---

## 4. 데이터 모델 (Postgres) — v2

> 모든 테이블 `tournament_id`/`owner_id` 스코프 RLS. `owner_id`/`*_staff_id`는 **`public.users(id)`** 타깃(스키마 일관성; `auth.uid()`=`public.users.id`). Realtime publication은 실시간 대상 4테이블만.

### 4.1 `ops_tournaments`
`id uuid PK, owner_id uuid FK→public.users(id), job_posting_id uuid FK→job_postings nullable, name text(XSS refine), venue text, event_date date, status text CHECK(upcoming/active/completed), seats_per_table int DEFAULT 9, color text, created_at/updated_at timestamptz`
**정산/칩 config**: `buy_in_chips int, rebuy_chips int, addon_chips int, buy_in_cost int, rebuy_cost int, addon_cost int` (상금풀 = 바이인+리바이+애드온 수익 앵커).

### 4.2 `ops_blind_levels`
`id, tournament_id FK, level int, sb int, bb int, ante int DEFAULT 0, duration_sec int, is_break bool DEFAULT false, sort int` · UNIQUE(tournament_id, sort).

### 4.3 `ops_participants`
`id, tournament_id FK, name text(XSS refine), phone text?, status text CHECK(active/busted/no_show) DEFAULT active, chips int DEFAULT 0, buy_in_amount int, rebuys int DEFAULT 0, add_ons int DEFAULT 0, finish_position int?, busted_at timestamptz?, player_identifier text?, note text?`
- **좌석 컬럼 없음** — 점유는 `ops_seats`가 단일 진실원(이중 SoT 제거).
- `finish_position`/`busted_at` = 상금 매핑용(원본·v1엔 없던 핵심 누락 보완).
- 인덱스: `(tournament_id, status)`, `(tournament_id, finish_position)`.

### 4.4 `ops_tables`
`id, tournament_id FK, table_no int, name text?, status text CHECK(open/closed/standby) DEFAULT open, assigned_staff_id uuid FK→public.users(id) nullable, position jsonb?` · UNIQUE(tournament_id, table_no).

### 4.5 `ops_seats` (좌석 정규화 — v2 핵심)
`id, tournament_id FK, table_no int, seat_no int, participant_id uuid FK→ops_participants nullable`
- UNIQUE(tournament_id, table_no, seat_no) · **부분 UNIQUE(tournament_id, participant_id) WHERE participant_id IS NOT NULL**.
- → DB가 **단일 점유 강제**, 행단위 락(`FOR UPDATE`)으로 `move_seat` 원자성, **세밀 Realtime**(좌석 1행만 broadcast). `uuid[]` 배열의 lost-update·FK 불가·이중 SoT 문제 제거([pitfall_posting_role_filled_dead_counter] 클래스 회피).

### 4.6 `ops_staff` (uniqn 연동 — v2 재설계)
`id, tournament_id FK, staff_id uuid FK→public.users(id), role staff_role, source text CHECK(snapshot_import/manual), source_work_log_id uuid?, assigned_at timestamptz DEFAULT now()` · UNIQUE(tournament_id, staff_id).
- **`role`은 실제 `staff_role` enum(6값: dealer/floor/serving/manager/staff/other) 사용** — 3값 CHECK는 실데이터 reject.
- 한 staff = 1행(역할은 precedence dealer>floor>serving>manager>staff>other로 결정, `source_work_log_id`에 출처 기록).

### 4.7 `ops_clock` (서버 동기 타이머)
`tournament_id uuid PK FK, current_level int DEFAULT 0, level_started_at timestamptz, is_running bool DEFAULT false, paused_remaining_sec int?`
- 남은시간 = `level_started_at + blind.duration_sec - now()` (서버 기준).
- **일시정지**: `is_running=false`, `paused_remaining_sec=남은초` 저장. **재개**: `level_started_at = now() - (duration_sec - paused_remaining_sec)`, `is_running=true`.
- **레벨 종료**: 자동 진행 안 함 — 운영자 `set_level` 수동(휴식 레벨도 동일). (오토 어드밴스는 후속.)

### 4.8 `ops_prizes`
`id, tournament_id FK, rank int, amount int?, pct numeric?, participant_id uuid FK→ops_participants nullable` · UNIQUE(tournament_id, rank).

### 4.9 RLS / 보안 (프로젝트 함정 전수 반영)
- **관리 권한**: `owner_id = auth.uid()` **OR** (job_posting 연결 시) `is_workspace_member(job_postings.workspace_id, auth.uid())`. `job_postings.owner_id`(nullable·불안정)에 의존하지 않음.
- **배정 딜러 읽기**: `ops_staff.staff_id = auth.uid()`인 유저는 해당 대회의 **실시간 4테이블(participants/tables/seats/clock) read 허용** — postgres_changes는 구독자별 RLS 적용이라 4테이블 모두 정책 없으면 딜러가 라이브 0건 수신.
- **모든 RPC**: `REVOKE … FROM anon` 명시(신규 함수 anon 기본부여 함정) + **SECURITY DEFINER 본문에서 actor=auth.uid() 바인딩**(#195/`20260621090100` 교훈 — `p_actor` 파라미터 신뢰 금지). pgTAP fixture의 blanket 테이블 GRANT는 **함수 제외**라 RPC마다 `GRANT … TO authenticated` 마이그에 직접 명시.

---

## 5. uniqn 연동 (기반 — "시너지 핵심" 아님, 정직하게)

참가자는 운영자 입력(계정X)이라 계정공유 이득은 **딜러 명단 자동입력 편의** 수준. 진짜 시너지(플레이어 유입·랭킹)는 후속 포털 슬라이스에서. 슬라이스 1의 연동 = **운영자 편의 + 후속 기반**.

1. **수동 풀** (항상 동작): 운영자 staff 목록에서 직접 추가 → `ops_staff(source=manual)`.
2. **1회성 스냅샷 가져오기**: `import_confirmed_staff(tournament_id)` RPC — 연결된 공고의 **확정 work_logs**(status 필터)에서 distinct staff_id를 읽어 `ops_staff(source=snapshot_import)` 적재. **"스냅샷 · 미동기화" 명시 라벨.** uniqn에서 취소돼도 자동 반영 안 됨(동기화는 후속).
   - 권한: `is_workspace_member(job_postings.workspace_id, auth.uid())`.
   - 충돌: manual로 이미 있으면 import는 skip(또는 source 갱신) — 멱등.
3. **테이블 배정**: `ops_tables.assigned_staff_id`는 `ops_staff`의 `dealer` 중 선택.
4. UserRole(앱권한) ≠ StaffRole(직무) 구분 유지.

---

## 6. 실시간 + 타이머

- **Supabase Realtime**: 기존 `createRealtimeSubscription` 헬퍼(`src/utils/supabase.ts`, ref-count·재연결) 재사용. 단 기존 용례는 단일테이블·저빈도 → 본 건은 4테이블·고빈도(칩/좌석)라 **선례 초과**:
  - postgres_changes는 컬럼 필터 미지원·전체 행 payload → 클라 reconcile.
  - 칩/클럭 등 고빈도 변경 throttle, 필요 시 `REPLICA IDENTITY FULL` 검토(old-row 필요할 때만, WAL 증가).
  - 공유 prod publication에 고빈도 테이블 추가 = uniqn 전체 WAL 부하 → 좌석 정규화로 payload 최소화가 완화책.
- **Realtime은 CRUD 안정 후 레이어링**(슬라이스 순서 참고).

---

## 7. 도메인 로직 (순수함수 + RPC 트랜잭션)

원본 `useTableAssignment.ts` 3종 알고리즘을 `src/domains/ops/seatAssignment/`에 순수함수 이식, 커밋은 RPC 원자 트랜잭션:
1. **랜덤 리밸런스** · 2. **대기 채움**(최소인원 테이블 우선) · 3. **칩 스네이크 드래프트**(active·칩 DESC·상/중/하 균등, 인원차 ≤1).
- **`move_seat(participant_id, to_table_no, to_seat_no)`**: 대상 좌석 `FOR UPDATE` 락 → 빈자리 검증 → `ops_seats` 갱신. 정규화라 단순·원자적. 대회 간 이동 불가.
- **`bust_participant(participant_id)`**: status=busted, busted_at=now(), **finish_position = (현재 active 수)** 부여 → 상금 매핑. 원자 RPC.
- **`add_rebuy`/`add_addon(participant_id)`**: count++ **AND** chips += rebuy/addon_chips 원자 갱신(운영자 수기 2필드 편집 제거).
- **클럭**: `set_level`/`start`/`pause`/`resume` RPC(§4.7 공식).
- 다중행 갱신은 `runTransaction`/RPC 필수(CLAUDE.md).

---

## 8. 상금 분배

- `ops_prizes`에 순위별 상금(고정액 `amount` 또는 `pct`) 구조 입력. 풀 = 바이인+리바이+애드온 수익(§4.1 config 앵커).
- `bust_participant`가 finish_position 자동 부여 → 파이널 시 rank↔participant 매핑. 순수함수 `domains/ops/prize.ts` + 단위 테스트.

---

## 9. 품질 / 규약
불변성(스프레드)·Zod+`xssValidation`·`AppError`·`logger.info()`·`dark:`·camelCase(앱)/snake_case(DB) 경계 매핑·파일 200~400줄/함수<50줄. (CLAUDE.md·golden-principles)

---

## 10. 슬라이스 분해 (v2 — 5+1 sub-slice, 순차 머지)

| # | sub-slice | 내용 | 독립 머지 |
|---|---|---|---|
| **1a** | **CRUD 스파인** | `ops_tournaments`+`ops_participants` 마이그·RLS·Repository·기본 화면(대회 생성/수정, 참가자 단건/CSV 등록·상태·리바이/애드온) | ✅ 첫 출시 단위 |
| 1b | 테이블/좌석 | `ops_tables`+`ops_seats`+1종 배정(대기채움)+`move_seat` RPC | ✅ |
| 1c | 블라인드+클럭 | `ops_blind_levels`+`ops_clock`+서버동기 타이머 UI | ✅ |
| 1d | 나머지 배정 | 랜덤·칩 스네이크 드래프트 2종 | ✅ |
| 1e | 스태프 연동 | `ops_staff`+수동 풀+`import_confirmed_staff` 스냅샷+딜러 배정 | ✅ |
| 1f | 상금 | `ops_prizes`+`bust_participant`+산정 | ✅ |
| ↳ | Realtime | CRUD 안정 후 1b/1c 위에 구독 레이어링 | (1c 이후) |

**1a를 첫 번째 독립 출시 단위로 `writing-plans` 계획화.**

---

## 11. 테스트 전략
| 레이어 | 도구 | 대상 |
|---|---|---|
| 도메인 | Jest | 배정 3종·move_seat·bust 순위·상금·블라인드 (RED→GREEN) |
| DB | pgTAP | owner/workspace RLS 격리, anon REVOKE+actor 바인딩, 좌석 단일점유·원자성, import_confirmed_staff |
| E2E | Playwright | 대회 생성→참가자→좌석→블라인드→bust→상금 (웹) |

pgTAP는 SET ROLE 후 직접접근→fixture 명시 GRANT, **신규 RPC는 마이그에서 직접 GRANT**(fixture는 함수 제외). 신규 enum/status 도입 시 read/filter Zod·RLS·reader 전수 갱신.

---

## 12. 리스크 / 오픈 이슈
1. **prod DB 공유** — `ops_*` 신규 테이블이 uniqn prod에. RLS·anon REVOKE·actor 바인딩 철저, 마이그 멱등·로컬 검증 후 적용.
2. **번들 미분리 수용** — ops 코드가 메인 앱에도 포함(§3.2). 진짜 격리는 후속.
3. **Realtime 고빈도 부하** — 좌석 정규화로 완화, throttle/REPLICA IDENTITY 1c에서 결정.
4. **스냅샷 import staleness** — 취소 미반영(라벨 명시). 양방향 동기화 후속.
5. **드롭된 원본 기능** — `ParticipantLivePage`(계정 불필요 플레이어 라이브뷰)는 후속 포털로 보류(슬라이스1은 내부 운영 콘솔). 딜러 로테이션/브레이크·멀티데이·플라이트도 후속.

---

## 13. 다음 단계
이 v2 승인 후 **sub-slice 1a(대회+참가자 CRUD)** 만 `writing-plans`로 계획화(태스크·검증 게이트). 이후 1b~1f 각자 plan→구현. 후속 슬라이스(포털→랭킹→정산→커뮤니티)는 별도 spec.
