# ops 1e — 스태프 연동 (공고 확정 스태프 → 대회 현장 스태프 + 딜러 테이블 배정) 설계

> 작성 2026-07-06. 권위 명세 `docs/planning/2026-06-23-tournament-ops-revival-slice1-design.md`(§1 목표·§4.6·§116)
>
> - UX flows `docs/planning/2026-06-23-tournament-ops-ux-flows.md` + 핸드오프 `docs/planning/2026-06-30-ops-remaining-slices-design-handoff-prompt.md`의
>   1e 슬라이스를, 정찰 실측(prod 마이그·advisor·로컬 마이그 전수·앱 표면) 기반으로 확정한 스펙.
>   방향 결정: 브레인스토밍에서 사용자 확정 — **"공고로 대회 생성"이 아니라 "대회에 공고를 연결"(N:1)**.

---

## 0. 결정 요약 (브레인스토밍 (A)~(E) 확정)

| 결정              | 확정안                                                                                                                           | 근거 요약                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| (A) 데이터 모델   | **work_logs는 import "소스"로 재사용, 저장소는 `ops_staff` 신설**. 딜러-테이블 배정은 기존 `ops_tables.assigned_staff_id` 재사용 | §1.1 신설 근거 4가지                           |
| (B) import 방식   | **1회성 스냅샷 + 멱등 add-only 재실행**(`ON CONFLICT DO NOTHING`). live 동기화는 후속(설계 리스크 8 승계)                        | 설계 §4.6 source CHECK + §12 리스크 8          |
| (C) 딜러 로테이션 | **범위 제외**. 1e는 배정/해제만                                                                                                  | 설계 §12 리스크 9가 명시적 후속 보류           |
| (D) UX 서피스     | **STAFF 탭 신설**(7번째 세그먼트) + TABLES 탭에 딜러 지정/배지                                                                   | UX 갭 ①(1e 화면 미결정)을 사용자 선택으로 봉합 |
| (E) 슬라이스 경계 | **풀슬라이스 단독 PR**. 단, "공고→대회 생성 프리필/브릿지 라우트" 대신 **"대회에 공고 연결" 방향으로 재편**(§0.1)                | 사용자 결정                                    |

### 0.1 방향 재편 — "대회에 공고를 연결" (사용자 결정, §116 재해석)

- 공고 하나로 대회 여러 개를 여는 시나리오(페스티벌/이벤트 시리즈 — UX 목업 "#17 Women's Event"의 이벤트 넘버링)가 실사용이므로,
  **공고→대회 1:1 생성 브릿지가 아니라 대회 측에서 공고를 연결하는 N:1 모델**로 간다.
- 스키마는 이미 N:1 지원: `ops_tournaments.job_posting_id`에 UNIQUE 없음(20260625120000_ops_1a_enums_and_tables.sql:59).
- 현재 갭: `job_posting_id`는 생성 시 1회만 설정 가능(`ops_update_tournament` patch 화이트리스트에 없음, 20260625120200:87-131)
  - 생성 폼(new.tsx)에 공고 선택 UI 없음 + `/t/*` 라우트 미구현 + 공고 상세의 외부 링크는 ops.uniqn.app 미구축이라 죽은 링크.
- 따라서 1e 스코프: ① 연결 변경 RPC 신설(`ops_set_tournament_posting`) ② 생성 폼에 공고 picker(선택)
  ③ 공고 상세 ActionCard를 인앱 push로 전환(연결 대회 0개=생성 유도 / N개=필터된 목록). `/t/from-posting` 라우트·프리필 화면은 **제거**(ops.uniqn.app 브릿지는 후속 게이트 유지).

---

## 1. 데이터 모델

### 1.1 `ops_staff` 신설 — work_logs 재사용이 아닌 근거 (핸드오프 요구사항)

work_logs를 ops 로스터 저장소로 직접 재사용하지 않는 실측 근거 4가지:

1. **부작용 오염**: work*logs INSERT는 `notify_on_work_log_insert` 알림 트리거, `filled_positions` 정원 카운터·capacity_full 전이,
   정산(payroll*\*) 표면에 물려 있다(add_direct_staff의 정원 가드·filled 미러 20260629000000:133-238).
   ops 수동 스태프를 work_logs에 심으면 uniqn 공고 정원·알림·정산이 오염된다.
2. **수명주기·단위 불일치**: work_logs는 (스태프, 날짜, 슬롯) 단위 근태·정산 행이고 `job_posting_id NOT NULL`(base_schema:195).
   ops 로스터는 (대회, 스태프) 단위이며, `job_posting_id NULL`인 수동 대회는 work_logs 행을 아예 가질 수 없다.
3. **권한 모델 불일치**: ops는 `is_ops_member` 게이트 SELECT-only RLS + SECDEF RPC 쓰기 봉인(1a_rls). work_logs는 staff 본인 SELECT/UPDATE 허용(workspace_m4_work_logs_rls).
4. **설계 문서가 이미 규정**: §4.6이 `ops_staff`(source CHECK snapshot_import/manual, source_work_log_id 역추적, UNIQUE(tournament_id, staff_id))를 명세(설계 문서 156-157행). 네임스페이스 충돌 없음(`ops_staff` 테이블·`staff_assignments` 테이블 미존재 실측).

단, **work_logs는 "확정 스태프" 판정의 SSOT로 재사용**한다(§2.2 import 소스 쿼리). `add_direct_staff`/`search_users_by_phone` 등 기존 스태프 표면은 그대로 두고 건드리지 않는다(전화검색 RPC만 UI에서 재호출).

### 1.2 DDL

```sql
CREATE TABLE public.ops_staff (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id      uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  staff_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role               public.staff_role NOT NULL DEFAULT 'dealer',   -- 기존 enum 6값 재사용
  custom_role        text,                                           -- work_logs 'other:라벨' 보존
  staff_name         text NOT NULL,                                  -- 이름 스냅샷 (§1.3)
  staff_nickname     text,
  source             text NOT NULL CHECK (source IN ('snapshot_import','manual')),
  source_work_log_id uuid REFERENCES public.work_logs(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, staff_id)
);
CREATE INDEX idx_ops_staff_staff_id ON public.ops_staff(staff_id);
CREATE INDEX idx_ops_staff_source_work_log_id ON public.ops_staff(source_work_log_id);
-- UNIQUE(tournament_id, staff_id)가 tournament_id 선두 인덱스를 겸함
```

- **이름 스냅샷이 필수인 이유**: `users` RLS는 self/admin only라 클라이언트가 타인 이름을 join할 수 없다
  (users cross lookup은 SECDEF RPC 전용 — 프로젝트 확립 패턴). `ops_participants`가 name을 인라인 보유하는 것과 동형.
  import는 work_logs의 staff_name/staff_nickname 스냅샷을 복사, 수동 추가는 SECDEF RPC가 users에서 서버측 복사.
- `assigned_at`(§4.6 원안)은 `created_at`으로 대체(동일 의미).

### 1.3 딜러-테이블 배정 — `ops_tables.assigned_staff_id` 재사용 + 백스톱

- 착지점은 1b에서 이미 생성된 `ops_tables.assigned_staff_id uuid REFERENCES public.users(id) ON DELETE SET NULL`(20260625130000:26). 신규 배정 테이블 불요.
- 백스톱 추가: **딜러 1명 = 동시에 테이블 1개** —
  `CREATE UNIQUE INDEX uq_ops_tables_assigned_staff ON public.ops_tables(tournament_id, assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;`
  (prod ops_tables 0행이므로 즉시·무충돌. RPC가 move 시맨틱으로 선해제하므로 평시 도달 불가한 방어선.)

### 1.4 `ops_event_type` enum 확장 (7값 append)

`posting_linked / posting_unlinked / staff_imported / staff_added / staff_removed / table_staff_assigned / table_staff_unassigned`
— 1d('prize_structure_set')·1f('player_bust_undone','prize_corrected')와 동일한 `ALTER TYPE ... ADD VALUE` append 패턴. enum 확장은 테이블 마이그(M1)에 배치하고 새 값 사용은 RPC 마이그(M2)에서 시작(같은 트랜잭션 내 신규 enum 값 사용 금지 제약 회피).

---

## 2. RPC 5종 — 계약

공통(기존 ops 규약 그대로, 20260625120200:6-12 명문 계약):

- `SECURITY DEFINER` + `SET search_path = 'public','extensions','pg_temp'`
- actor 바인딩: `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin())` → `PERMISSION_DENIED`
- 에러: `RAISE EXCEPTION 'CODE: 한글 메시지' USING ERRCODE='P0001'` — 클라 `opsRpcError` 매퍼가 접두어 파싱
- 락 불변식(1d): `pg_advisory_xact_lock(hashtext('ops_tournament_'||id)::bigint)` → 대회 FOR UPDATE → 대상 행들 id asc.
  tournament_id가 파라미터로 직접 오므로 비잠금 선취 불필요(1d의 참가자→대회 역참조 케이스와 다름).
- 감사: 상태 변경 1건당 `ops_events` 1행 append(actor_id 포함)
- GRANT: `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated, service_role` (DO 루프 패턴)
- **work_logs에는 일절 쓰지 않는다**(읽기 전용 소스)

### 2.1 `ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid)` → jsonb

- 의미: 공고 연결/변경/해제(NULL). N:1이므로 같은 공고를 여러 대회가 연결 가능.
- 게이트: **대회 owner_id = actor OR is_admin()** — is_ops_member보다 좁게. 연결은 `is_ops_member`의 워크스페이스 분기
  (1a_rls 16-30행: owner OR 공고 workspace 멤버)를 바꾸는 조작이므로, 공고 경유 멤버가 연결을 갈아치워 접근권을 재편하는 것을 차단.
- 연결 시(NOT NULL): 공고 존재 + 접근권 `jp.owner_id = actor OR is_workspace_member(jp.workspace_id, actor) OR is_admin()`
  (ops_create_tournament의 공고 게이트 20260625120200:43-57과 동일). 공고 타입 제한 없음(홀덤펍 상시공고 연결도 유효 시나리오).
- 동작: `UPDATE ops_tournaments SET job_posting_id = p_job_posting_id`. 동일 값이면 no-op 반환(이벤트 미기록).
- 감사: `posting_linked` payload `{old_posting_id, new_posting_id}` / 해제는 `posting_unlinked`.
- 에러: `TOURNAMENT_NOT_FOUND` / `PERMISSION_DENIED` / `POSTING_NOT_FOUND`(존재하지 않거나 접근권 없음 — 존재 여부 비노출 위해 동일 코드).
- 반환: `{tournamentId, jobPostingId}`.

### 2.2 `ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text DEFAULT NULL)` → jsonb

- 게이트: `is_ops_member(tournament_id, actor) OR is_admin()`.
- 대회의 `job_posting_id`가 NULL이면 `NO_LINKED_POSTING`.
- 소스 쿼리(확정 스태프 SSOT — 정찰 검증된 정답 쿼리):

```sql
SELECT DISTINCT ON (wl.staff_id)
       wl.staff_id, wl.role, wl.custom_role, wl.staff_name, wl.staff_nickname, wl.id
FROM public.work_logs wl
WHERE wl.job_posting_id = v_posting_id
  AND wl.status NOT IN ('cancelled','no_show')       -- 서버 전역 표준 활성 필터
  AND (p_date IS NULL OR wl.date = p_date)           -- date는 text 'YYYY-MM-DD' (base_schema:198)
ORDER BY wl.staff_id, wl.date DESC, wl.created_at DESC  -- staff별 최신 행의 role/이름 채택
```

- 확정 판정에 applications를 보지 않는 이유: 직접추가 스태프(application_id NULL)가 누락되고 배정 단위 정보가 없음 — work_logs 행 존재가 확정의 SSOT(confirm_application·add_direct_staff 모두 status='scheduled'로 INSERT).
- 역할 필터 없음: dealer/floor/serving/manager/staff/other 전 역할 import(로스터는 전 직무, 딜러 필터는 배정 UI에서).
- INSERT `source='snapshot_import'`, `source_work_log_id=wl.id`, `ON CONFLICT (tournament_id, staff_id) DO NOTHING`
  → **멱등 add-only**: 재실행 시 기존 행(수동 편집 포함) 불변, 새 확정자만 추가. 삭제 동기화 없음(리스크 8 승계).
- `p_date` 기본값은 클라이언트가 주입(UI 기본 = 대회 event_date, "전체 기간" 토글 시 NULL). RPC 자체 기본은 NULL(전체).
- 감사: `staff_imported` 1행 payload `{job_posting_id, date, imported, skipped}`.
- 반환: `{imported, skipped}` (skipped = 후보 - 신규).
- 에러: `TOURNAMENT_NOT_FOUND` / `PERMISSION_DENIED` / `NO_LINKED_POSTING`.

### 2.3 `ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role DEFAULT 'dealer', p_custom_role text DEFAULT NULL)` → jsonb

- 게이트: is_ops_member **AND actor가 employer/admin 롤**(아래 SEC 주). 대상 사용자 검증: 존재 + `is_active` + `COALESCE(status,'active') NOT IN ('deleted','deactivated')` — add_direct_staff 20260629000000:112·search_users_by_phone :65와 **문자 그대로 동일**(users.status는 `text DEFAULT 'active'` nullable, base_schema:104 → COALESCE 필수. 누락 시 NULL status 활성 사용자가 `NULL NOT IN(...)`=NULL로 오거부되어, 전화검색엔 뜨는데 추가 시 STAFF_NOT_FOUND 나는 막다른 UX).
- **SEC 주(적대검증 SEC-1)**: ops_add_staff는 임의 uuid로 타 사용자 실명/닉네임을 ops_staff에 복사하는 프리미티브다. users RLS는 self/admin-only인데 `ops_create_tournament`가 롤 게이트 없이 authenticated 전원에게 열려 있어(일회용 대회 생성→owner→is_ops_member 자명 충족), is_ops_member 게이트만으로는 아무 인증 사용자나 이름 하베스팅이 가능하다. 따라서 대상 사용자 검증 **전에** actor 롤 게이트를 얹어 전화검색(`search_users_by_phone`, employer/admin 게이트)과 신뢰경계를 일치시킨다: `IF NOT (public.is_admin() OR EXISTS(SELECT 1 FROM public.users WHERE id = p_actor_id AND role IN ('employer','admin') AND is_active)) THEN RAISE 'PERMISSION_DENIED'`. import 경로는 work_logs 확정자 한정이라 이 게이트 불요(§7 "대상층=employer" 수용과 정합 — UX 손실 없음).
- 이름 스냅샷: SECDEF가 `public.users`에서 name/nickname 서버측 복사(클라이언트 전달 금지 — 위조 방지).
- `source='manual'`, `source_work_log_id=NULL`. UNIQUE 충돌 시 `DUPLICATE_STAFF`(수동 추가는 명시 에러가 UX상 정확).
- 감사: `staff_added` payload `{staff_id, role}`.
- 에러: `TOURNAMENT_NOT_FOUND` / `PERMISSION_DENIED` / `STAFF_NOT_FOUND` / `DUPLICATE_STAFF`.

### 2.4 `ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid)` → jsonb

- 게이트: is_ops_member. 대상 행이 해당 대회 소속인지 확인(`STAFF_NOT_FOUND`).
- **cascade-clear**: 해당 스태프가 배정된 `ops_tables.assigned_staff_id`를 먼저 NULL로(같은 대회 한정, id asc 잠금) → 로스터 행 DELETE.
- 감사: `staff_removed` payload `{staff_id, cleared_table_ids}` 1행(테이블 해제 별도 이벤트 미기록 — 원인 1개=이벤트 1개).
- 주의(문서화): 삭제된 import 행은 재-import 시 부활한다(add-only 특성). STAFF 탭 import 확인 다이얼로그에 명시.

### 2.5 `ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid DEFAULT NULL)` → jsonb

- 게이트: is_ops_member. 테이블이 해당 대회 소속인지 확인(`TABLE_NOT_FOUND`).
- `p_staff_id IS NULL` = 해제. NOT NULL이면 **로스터 멤버십 강제**: `ops_staff(tournament_id, staff_id)` 존재 필수 → `STAFF_NOT_IN_ROSTER`.
  역할은 강제하지 않음(매니저 딜러 겸임 등 현장 유연성 — UI가 딜러 우선 필터).
- **move 시맨틱**: 대상 스태프가 같은 대회의 다른 테이블에 배정돼 있으면 선해제 후 배정(§1.3 partial UNIQUE는 백스톱).
  잠금: advisory → 대회 FOR UPDATE → 관련 ops_tables 행들 FOR UPDATE(id asc — 이전 테이블+대상 테이블).
- 감사: `table_staff_assigned` payload `{table_id, staff_id, previous_table_id}` / 해제는 `table_staff_unassigned` `{table_id, staff_id}`.
- 에러: `TOURNAMENT_NOT_FOUND` / `PERMISSION_DENIED` / `TABLE_NOT_FOUND` / `STAFF_NOT_IN_ROSTER`.

---

## 3. RLS · Realtime · Grants

- `ops_staff`: `ENABLE` + `FORCE` RLS. 정책은 타 ops 테이블과 동형 1종 —
  `FOR SELECT TO authenticated USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()))`.
  **`is_admin()`은 `(SELECT ...)`로 initplan 래핑**(적대검증 SEC-2 — 기존 ops SELECT 정책 6종 전부 `OR (SELECT public.is_admin())` 자구, auth_rls_initplan advisor·행별 재평가 회피). `is_ops_member(tournament_id, ...)`는 행별 tournament_id 의존이라 래핑 불가(정상).
  INSERT/UPDATE/DELETE 정책 없음 + `REVOKE INSERT,UPDATE,DELETE ON ops_staff FROM anon, authenticated`(쓰기는 SECDEF RPC 100%).
- Realtime: `ops_staff`를 publication에 추가(participants/tables와 동형) — **멱등 가드 필수**(적대검증 SEC-3): `IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ops_staff') THEN ALTER PUBLICATION ... END IF` (1a/1b grants 문형. bare ADD는 db:reset 드리프트 시 42710). `ops_tables`는 이미 등록돼 있어 딜러 배지 실시간 반영은 기존 구독으로 커버.
- **anon 표면 불변**: anon-executable SECDEF은 `ops_get_monitor_snapshot`/`ops_get_player_view` 2개 유지. 신규 RPC 5종 전부 anon REVOKE.
  모니터/플레이어뷰에 스태프 정보 미노출(후속 논의).
- prod 게이트 검증 항목: advisor ERROR 0 + anon SECDEF 2개 불변 + 신규 RPC 5종 `has_function_privilege(anon)=false` 실측.

---

## 4. 클라이언트 (작업 디렉토리 `uniqn-mobile/`, 아키텍처 Presentation→Hooks→Service→Repository→Supabase)

### 4.1 계층 신설/확장

| 계층        | 파일                                                              | 내용                                                                                                                 |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Repository  | `src/repositories/supabase/OpsStaffRepository.ts` (신규)          | `listByTournament`(SELECT), RPC 5종 호출, `opsRpcError` 매퍼 재사용. `src/repositories/ops.ts` 배럴 등록             |
| Service     | `src/services/ops/opsStaffService.ts` (신규)                      | 쓰기 5종 경유(읽기는 TanStack Query 직접 규약). `services/ops/index.ts` 배럴 등록                                    |
| Hooks       | `src/hooks/ops/useOpsStaff.ts` (신규) + `useOpsMutations.ts` 확장 | 로스터 쿼리+`ops_staff` Realtime invalidate. mutation 5종(import/add/remove/assign/link). `queryKeys.ops.staff` 추가 |
| 타입/스키마 | `src/types/ops.ts`, `src/schemas/opsStaff.schema.ts` (신규)       | zod 파싱(읽기 `.catch()` 관용 — enum 발산 함정 예방). `supabase.ts`는 수술적 추가만(전체 재생성 금지)                |

### 4.2 STAFF 탭 (신규 — 7번째 세그먼트)

- `app/(ops)/tournaments/[id].tsx` 세그먼트 배열에 `staff` 키 추가(라벨 "스태프 N", 순서 = 참가/현황/테이블/블라인드/**스태프**/이력/상금), 렌더는 `src/components/ops/StaffTab.tsx`(신규, 800줄 제한 준수 — 시트/행 컴포넌트 분리).
- 구성(위→아래):
  1. **연결 공고 카드**: 연결된 공고 제목 표시. owner에게만 "연결/변경/해제" 노출 → 공고 picker(내 관리 공고 목록) → `ops_set_tournament_posting`. 미연결 시 "공고를 연결하면 확정 스태프를 가져올 수 있어요" 안내.
  2. **import CTA**: "확정 스태프 가져오기" — 기본 대회 event_date, "전체 기간" 토글. 확인 다이얼로그에 "이미 있는 스태프는 건너뛰고, 삭제했던 스태프는 다시 추가됩니다" 명시. 결과 toast "N명 추가 · M명 건너뜀".
  3. **로스터 리스트**: `AppFlashList`. 행 = 이름(닉네임) + 역할 배지(딜러/플로어/서빙/기타 — custom_role 라벨) + 배정 테이블 배지(T3) + source 구분(가져옴/수동). 행 탭 → `SelectBottomSheet` 액션: [테이블 지정(§4.3 시트 재사용) / 로스터에서 삭제(destructive)].
  4. **수동 추가**: 🟢 FAB/버튼 → 전화 검색(`useStaffPhoneSearch` 재사용, `search_users_by_phone` RPC) + 역할 선택 → `ops_add_staff`.
- 다크모드 `dark:` 전 요소, 알림 `toast`/`Alert.alert`, 로깅 `logger`.

### 4.3 TABLES 탭 확장

- `TableRow`: 딜러명 배지 추가(assigned_staff_id → 로스터 쿼리에서 이름 매핑 — 둘 다 멤버 RLS 가시).
- 테이블 액션 시트(잠금/우선순위 기존 시트)에 "딜러 지정" 항목 추가 → 로스터 피커 시트(딜러 우선 그룹핑, 전 역할 표시, 현재 배정자 표시+해제 옵션) → `ops_assign_table_staff`.

### 4.4 생성 폼·목록·공고 상세

- `app/(ops)/tournaments/new.tsx`: "공고 연결(선택)" 필드 — 내 관리 공고 picker. 선택 시 `ops_create_tournament`의 기존 `p_job_posting_id`로 전달(서버 게이트 기존재).
- `app/(ops)/tournaments/index.tsx`: `postingId` 쿼리 파라미터 필터 지원(해당 공고 연결 대회만) + 필터 상태에서 "+ 대회"는 new.tsx에 postingId 프리셋.
- `app/(employer)/my-postings/[id]/index.tsx` ActionCard: `openExternalUrl`(죽은 링크) 제거 → 인앱 `router.push`.
  `useOpsTournamentForPosting`을 목록형(`useOpsTournamentsForPosting`)으로 교체: 0개="라이브 운영 시작"→`/(ops)/tournaments/new?postingId={id}` / N개="라이브 운영 (N)"→`/(ops)/tournaments?postingId={id}`.
  노출 조건은 현행 유지(이미 노출 중인 카드의 링크 수선 — 신규 노출면 없음이므로 별도 플래그 불요).

---

## 5. 검증 계획

### 5.1 pgTAP (`supabase/tests/ops_staff_integration.test.sql` 신규)

1. RLS: 멤버(owner/공고 워크스페이스 멤버) SELECT 가시 / 비멤버 0행 / anon 직접 SELECT 불가.
2. anon REVOKE: 신규 RPC 5종 `has_function_privilege('anon', ...)=false` + anon-executable SECDEF 총량 2개 불변.
3. actor 바인딩: `p_actor_id ≠ auth.uid()` 비-admin 거부(5종).
4. `ops_set_tournament_posting`: owner 성공 / 공고-경유 워크스페이스 멤버 거부(owner-only) / 접근권 없는 공고 연결 거부 / 해제 후 is_ops_member 축소 실측.
5. import: 확정 스태프 시드(confirm 경로 + 직접추가 경로 혼합) → 전원 import·이름/역할/custom_role 스냅샷 정확 / **멱등성**(2회 실행 → imported=0, 기존 행 불변) / p_date 필터 / `NO_LINKED_POSTING` / cancelled·no_show 행 제외.
6. add/remove: 중복 `DUPLICATE_STAFF` / 비활성 사용자 `STAFF_NOT_FOUND` / remove 시 배정 테이블 cascade-clear 실측.
7. assign: 로스터 외 `STAFF_NOT_IN_ROSTER` / move 시맨틱(이전 테이블 해제) / partial UNIQUE 백스톱 / 해제(NULL).
8. 감사: 각 변이 후 ops_events 신규 행 type·payload 단언.
9. 무위 시드 금지 — 각 단언은 실제 매칭 행 수 사전 검증(RLS vacuous 함정 예방).

### 5.2 jest

- `OpsStaffRepository`/`opsStaffService`/`useOpsStaff`·mutation 훅 단위 테스트(기존 ops 테스트 관용 준수 — `restoreMocks` 함정: spy는 beforeEach 재설치).
- `StaffTab` 컴포넌트(연결/미연결/빈 로스터/행 액션), `TableRow` 딜러 배지, ActionCard 라우팅 회귀(0개/N개 분기 — 기존 외부링크 테스트 교체).

### 5.3 로컬 검증 명령 (전부 GREEN 후 완료 주장)

`npm run db:reset && npm run test:db:helpers && npx supabase test db` (reset이 ops_helpers 지움—재적재) · `npx tsc --noEmit` · `npx jest` · `npm run quality`

---

## 6. 마이그레이션 (신규 3종 — 기존 마이그 수정 금지, MCP apply_migration 전용)

| 파일                                             | 내용                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `2026070XNNNNNN_ops_1e_staff_table_and_enum.sql` | ops_event_type 7값 append + ops_staff DDL/인덱스 + ops_tables partial UNIQUE + RLS(FORCE·SELECT정책·DML REVOKE) |
| `..._ops_1e_staff_rpcs.sql`                      | RPC 5종                                                                                                         |
| `..._ops_1e_grants_and_realtime.sql`             | REVOKE/GRANT DO 루프 + Realtime publication(ops_staff)                                                          |

- 구현 브랜치는 **최신 origin/master(`8e2293aad` 이상) 기반 필수** — 1f 4종+bigint가 로컬 db:reset 정합에 필요.

## 7. 리스크·수용·범위 외

| 항목                                             | 처리                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| import staleness(공고측 취소 미반영)             | 설계 리스크 8대로 수용. STAFF 탭에 "가져온 시점 기준" 라벨 + 재-import 버튼                                                                                                                                                                                                   |
| 삭제 후 재-import 시 부활                        | add-only 특성. import 확인 다이얼로그에 명시(§2.4)                                                                                                                                                                                                                            |
| 전체기간 import 시 역할 채택(적대검증 L3-3)      | `DISTINCT ON(staff_id) ORDER BY date DESC`는 스태프별 **최신 활동일** 역할을 채택 → 같은 스태프가 대회일 dealer·타일 floor면 전체기간 import 시 floor로 등록. 기본값=event_date 특정일이라 평시 회피. 배정 UI가 전 역할 표시라 실피해 작음. 로스터 행 역할 인라인 편집은 후속 |
| import 스냅샷 revocation-후 잔존(적대검증 SEC-4) | import는 동기 신규 노출 없음(is_ops_member ⊆ work_logs wl_select). unlink 시 워크스페이스 멤버 가시성은 자동 축소되나 owner 스냅샷은 잔존 — 스냅샷 모델 내재 특성으로 수용                                                                                                    |
| `search_users_by_phone`이 employer/admin 게이트  | staff 역할 대회 owner는 전화검색 불가. 대상층=employer라 수용, 문서화만                                                                                                                                                                                                       |
| 공고 연결 변경 시 워크스페이스 멤버 접근권 변동  | 의도된 동작(owner-only 게이트로 통제). posting_linked/unlinked 감사로 추적                                                                                                                                                                                                    |
| 대회 활성 중 연결 변경                           | 제한 없음(로스터는 스냅샷이라 무영향)                                                                                                                                                                                                                                         |
| **범위 외(후속)**                                | 딜러 로테이션·딜러뷰(딜러 본인 화면)·live 동기화·모니터/플레이어뷰 딜러 표시·ops.uniqn.app `/t/*` 브릿지·STATUS 탭 "딜러 페이아웃" 토글(1f/후속 소속 미정 목업)                                                                                                               |

## 8. 출하 게이트 (기존 ops 패턴)

1. 로컬 전 검증 GREEN(§5.3) → 2. 사용자 "go" 후 prod: MCP apply_migration 3종 → get_advisors ERROR 0 + anon SECDEF 2개 불변 실측 → push+PR → CI 9종 → squash.
2. 별도 게이트(코드 아님, 병행 인지): 수동 QA iOS SelectBottomSheet 피커 [BLOCKING] + ops.uniqn.app 2nd CF Pages + app_config 플래그.
   단 ActionCard 인앱 전환으로 **ops 첫 실동선이 생기므로**, 머지 후 배포(OTA) 타이밍은 기존 "ops 실사용 오픈" 게이트와 함께 사용자가 결정.
