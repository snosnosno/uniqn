# 핸드오프 v2 — 주간 배치 그리드 (오케스트레이션 최적화판 · 다음 세션 메인 프롬프트)

> **이 문서 = 다음 세션의 메인 세션 프롬프트.** 그대로 메인(오케스트레이터)으로 사용한다.
> 목표: **메인 컨텍스트를 최대한 가볍게** 유지하면서 **ultracode 워크플로 + 팀 에이전트(subagent) + 스킬**로 남은 전체(Phase 2 잔여 ~ Phase 6 + 최종검증)를 끝까지 구현·검증한다.
> 진실의 원천: `docs/planning/2026-06-28-weekly-batch-grid-design.md` (설계 v2). 본 문서는 그 위에 **현재 상태 + 적대리뷰로 발견된 신규 불변식 + 정밀 통합지점**을 더한 실행 지시서다.

---

## 0. 메인 세션 운영 규칙 (컨텍스트 최적화 핵심)

**너(메인)는 오케스트레이터다. 직접 구현 파일을 읽지 말고 위임한다.**

1. **읽을 것(메인 컨텍스트에 적재)**: 본 문서 전체 + 설계 v2(필요부만 Grep/부분 Read) + 메모리 `project_weekly_grid_design_20260628`, `project_tholdem_ops_revival_20260623`. 그 외 소스는 **직접 읽지 말 것**.
2. **위임 원칙**:
   - **정찰**: 통합지점은 본 문서 §5에 이미 파일·라인까지 적혀 있다. 부족하면 **Explore subagent 1개**가 구조화 맵만 반환(파일 덤프 금지).
   - **구현**: 단위마다 **구현 subagent**(또는 2~3개 병렬 팀)에게 정밀 스펙 + 본 문서의 사실을 주고 **diff + 테스트 결과 요약만** 반환받는다. 본문 파일 내용을 메인으로 끌어오지 않는다.
   - **검증**: 메인이 `tsc/jest/pgTAP/eslint` 실행하고 **종료코드·실패개수만** 확인. 큰 출력은 `| tail`/`grep`로 잘라 본다.
   - **적대리뷰**: 마이그/RLS/RPC는 **Workflow(find→다수결 verify)**로 굳힌다(아래 §6 레시피).
3. **ultracode 기본값**: substantive 단위마다 Workflow 사용. 비용보다 정확성·완전성 우선. 단, 사소한 1~2파일 편집은 solo.
4. **모든 subagent 프롬프트에 금지 가드 명시(필수)**: `mcp__supabase__* 직접호출 금지 · 기존(커밋된) 마이그 수정 금지 · PROD 우회 금지 · push/PR 금지 · 절대경로는 워크트리(C:\Users\user\Desktop\T-HOLDEM-weekly-grid\uniqn-mobile) 기준`.
5. **스킬 루팅**: 단위마다 `superpowers:test-driven-development`(Red→Green→Improve) · DB/권한 전 mental `/guard` 체크리스트 · 작성 후 `/review`+`/type-check`+`/health` · 버그 `/investigate` · 커밋 `/commit` · 완료 전 `superpowers:verification-before-completion`.
6. **언어 규칙(필수)**: 응답·커밋·문서·주석 전부 한글(고유 기술용어만 원문).

---

## 1. 현재 상태 (검증된 커밋)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM-weekly-grid` · 브랜치 `feat/weekly-batch-grid`
- 커밋(최신순):
  - `9f3728f14` feat(grid): Phase 2(1/2) venue 스팬 읽기 RPC — **pgTAP 4/4**
  - `f73871177` feat(grid): Phase 1 데이터 토대 + fail-closed + 누수감사 — **pgTAP 8/8 · jest 188 · tsc 0 · eslint 0**
  - `45e649557` 토대 브랜치 머지(`origin/claude/staff-management-add-feature-g8wvsz`)
- **Phase 1 = 완료. Phase 2 = 진행중(읽기 RPC 완료, 훅/UI 미완).** Phase 3~6 = 미착수.
- 전부 **로컬**(워크트리 커밋 + 로컬 Supabase). PROD 마이그·push·PR·master 머지·의존브랜치 머지 = **전부 미수행(하드게이트)**.

---

## 2. 환경·셋업 사실 (그대로 재사용 — 재구성 금지)

- 작업 디렉토리: `uniqn-mobile/`. 절대경로 alias `@/`.
- 토대 머지됨: `add_direct_staff`/`remove_direct_staff`/`search_users_by_phone` RPC, `AddStaffModal`, `confirmedStaffService`, `useConfirmedStaff`, `ConfirmedStaffList`.
- **node_modules 정션**: 이미 생성됨(PowerShell `New-Item -ItemType Junction`; **mklink 는 Git Bash 경로변환에 막힘**). 깨지면 PowerShell 로 재생성.
- **로컬 Supabase**: Docker 컨테이너 `supabase_db_uniqn`(:54322), studio :54323. `.env.development.local` 복사됨.
  - 마이그 적용: `cd uniqn-mobile && npx supabase migration up` (**`db reset` 금지** — 공유 DB 보존. reset 시 타 세션 ops 상태 소실).
  - **로컬 DB 직접 조회**: `docker exec supabase_db_uniqn psql -U postgres -d postgres -c "..."`.
  - **`/tmp` 경로로 docker exec psql -f 실행 시 `MSYS_NO_PATHCONV=1` 접두 필수**(Git Bash 경로변환 회피). 예: `docker cp x.sql supabase_db_uniqn:/tmp/x.sql && MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -f /tmp/x.sql`.
  - **pgTAP 단건 실행 전 1회**: `docker exec supabase_db_uniqn psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgtap;"` (로컬 임시. `npm run test:db` 러너는 자체 셋업).
- **함정/패턴(중요)**:
  - `supabase.rpc('fn', {...})` 는 **untyped**(클라가 Database 제네릭 미사용) → 신규 RPC를 `supabase.ts` Functions 에 추가하지 않아도 호출됨. 예: `ConfirmedStaffRepository.ts:453`(add_direct_staff).
  - **enum/타입 추가 시 `Record<JobPostingStatus, X>` 전수 보강** 필요(tsc 가 잡음). Phase 1 에서 `JobPostingCard.tsx` POSTING_STRIPE_TONE 보강함.
  - **적용했으나 미커밋인 마이그 수정**: 파일 고치고 `CREATE OR REPLACE`(멱등)로 psql 직접 재적용(`migration up`은 기적용분 재실행 안 함). 커밋된 마이그는 절대 수정 금지(새 마이그로).
  - pre-commit 훅: 스테이지에 eslint --fix + prettier(정션 필요). 커밋은 표준승인(로컬 자율), **push/PR만 게이트**.

---

## 3. 확립된 토대 (재사용·확장 대상 — 새로 만들지 말 것)

### 3.1 DB 마이그(적용·검증됨)
| 파일 | 내용 |
|---|---|
| `20260630000000_*_container_enum.sql` | `posting_status += 'container'`(단독, E4) |
| `20260630000100_*_columns_indexes.sql` | `job_postings.venue_id`(self-FK), `work_logs.{color,clocked_out_raw,end_time_source,edited_by}`, `idx_job_postings_venue_id`, `uniq_venue_container(workspace_id, lower(title), (schedule->>'kind')) WHERE status='container'` |
| `20260630000200_*_container_helper.sql` | `get_or_create_venue_container(p_workspace_id, p_name, p_kind, p_period)` SECDEF·ON CONFLICT 멱등·venue_id=self·anon REVOKE |
| `20260630000300_*_app_config_flag.sql` | `app_config.weekly_grid_enabled = {"enabled": false}`(OFF, 멱등) |
| `20260630000400_*_container_rls_failclosed.sql` | `job_postings_select_all` → `USING(status <> 'container')` (SELECT carve-out) |
| `20260630000500_*_container_write_failclosed.sql` | **RESTRICTIVE** `jp_container_no_direct_insert`/`jp_container_no_direct_update`(컨테이너 직접 쓰기 차단=SECDEF RPC 전용) + `CHECK chk_container_no_filled (status<>'container' OR filled_positions=0)` |
| `20260630000600_*_venue_span_ssot.sql` | `venue_span_posting_ids(p_venue) RETURNS SETOF uuid` (**E1 SSOT**), anon REVOKE |
| `20260630010000_*_read_rpcs.sql` | `get_venue_grid_summary(venue,from,to)→(d,headcount,job_count)`, `get_venue_day_slots(venue,date)→work_log 행` (둘 다 SECDEF+워크스페이스 게이트+anon REVOKE, venue_span SSOT 경유, cancelled/no_show 제외) |

### 3.2 TS 토대
- enum 전파: `src/types/supabase.ts`(posting_status union+Constants 배열), `src/constants/statusValues.ts`(`JOB_POSTING_STATUS_VALUES.CONTAINER`→`STATUS.JOB_POSTING.CONTAINER`), `src/constants/statusConfig.ts`(union+`JOB_POSTING_STATUS.container`), `src/types/jobPosting.ts`(`JobPostingStatus`).
- `JobPostingRepository`(`src/repositories/supabase/JobPostingRepository.ts`):
  - **fail-closed**: `getList`/`getByOwnerId`/`getManagedJobPostings`/`getTypeCounts` 무조건 `.neq('status','container')`.
  - **VenueContainer 경량 read 경로**: `getVenueContainers(workspaceId)`, `getVenueContainerById(id)` (인터페이스에도 선언). **컨테이너는 JobPosting 으로 안 읽음**(rigid `JobPostingDocumentV3`라 Zod null 증발 → 경량 타입으로 우회). `includeContainer` 옵션은 **제거됨**(footgun).
- `src/domains/weeklyGrid/`(순수 도메인):
  - `softTargets.ts`: `getSoftTargets/getSoftTarget/withSoftTarget/computeShortage` (키 정규화 `@/utils/date` `toDateString`, requirements 와 분리=§4.4).
  - `gridSlotState.ts`: `computeDayCell({dateKey,headcount,jobCount,softTarget}) → GridDayCell{status:'empty'|'shortage'|'staffed', shortage, priorityBadge:{kind:'shortage'|'job'|'batch',count}|null}` (U2 우선순위 부족>공고>배치).
  - `venueContainer.ts`: `VenueContainer{id,name,workspaceId,ownerId,venueId,kind,softTargets}`, `parseVenueContainer(s)`, `VENUE_CONTAINER_COLUMNS`.
  - `index.ts` 배럴로 전부 export.
- 날짜 SSOT: **`@/utils/date` 의 `toDateString`(YYYY-MM-DD)·`getTodayString` 재사용**(신규 유틸 금지).

### 3.3 테스트 자산(패턴 복제 대상)
- pgTAP: `supabase/tests/weekly_grid_container_failclosed.test.sql`(8), `weekly_grid_read_rpcs.test.sql`(4). 패턴: `BEGIN; plan(N); CREATE TEMP TABLE _x; DO $$…RAISE/INSERT…$$; SELECT is/ok(...); finish(); ROLLBACK;` + 마커 이메일 `__sql_fixture_*@test.local` + 인증 컨텍스트 `set_config('request.jwt.claims', json_build_object('sub', uid,'role','authenticated')::text, true)` + 롤전환 `SET LOCAL ROLE authenticated; … SET LOCAL ROLE postgres;`.
- jest: `JobPostingRepository.container.failclosed.test.ts`, `JobPostingRepository.venue.test.ts`(`makeChain` supabase mock 패턴), `domains/weeklyGrid/__tests__/*`.

---

## 4. 불변식 (절대 회귀 금지 — 원본 + 적대리뷰 신규)

- **E1 venue 스팬 = SSOT 함수 경유**: 모든 count/부족/정산은 `job_posting_id IN (SELECT venue_span_posting_ids(:V))` 를 쓴다. **`venue_id=:V OR id=:V` 를 손으로 재작성 금지**(발산 방지). work_logs 레벨 `status NOT IN('cancelled','no_show')`.
- **R2 fail-closed(읽기+쓰기 양방향)**:
  - 읽기: repo 4 reader deny + `job_postings_select_all` carve-out. 컨테이너는 owner/멤버/콜라보/admin 만 SELECT.
  - 쓰기: **컨테이너 INSERT/UPDATE 는 SECDEF RPC 전용**(restrictive 정책). 클라 직접 PostgREST 쓰기 불가. (적대리뷰 HIGH — 하이재킹 차단. FORCE RLS off + definer=postgres=owner 라 RPC는 RLS 우회.)
  - 신규 통계/검색 reader 추가 시 `status<>'container'` 또는 allow-list 유지 — **누수 감사 pgTAP에 케이스 추가**.
- **컨테이너 ≠ JobPosting**: rigid 타입이라 강제 시 Zod null 증발(적대리뷰 HIGH). 컨테이너는 `VenueContainer` 경량 타입으로만 읽는다.
- **R1 카운터**: 컨테이너 `filled_positions` 미사용(read-time COUNT). `chk_container_no_filled` 가 강제. **Phase 3 의 add/remove_direct_staff 에 `IF status='container' THEN filled±1/capacity_full 미러 skip` 분기 필수**(없으면 CHECK 위반으로 fail-closed). 하루 인원=COUNT, 부족=softTargets[D]−COUNT(0 clamp).
- **soft-target**: 컨테이너 `schedule.softTargets`(requirements 와 분리). 날짜키 YYYY-MM-DD SSOT(`toDateString`).
- **S1 XSS**: 운영처명/메모/color 는 TS 경계 `z.string().refine(xssValidation)`(`src/utils/security.ts:263`) 통과분만. color 는 토큰 팔레트 화이트리스트(자유 hex 금지). **S2 anon REVOKE**: 신규 RPC 전부 `REVOKE … FROM anon, public` + `GRANT … TO authenticated` + `has_function_privilege` 실측. **S3 SECDEF**: `SET search_path = public, extensions, pg_temp`.
- **S5/R4 QR**: live 함수(`pg_get_functiondef`) 기준 작업(20260414 파일은 구버전). status 가드만 완화(`NOT IN('active','container')`), **is_active(계정) 가드 유지**, `clocked_out_raw` 원본보존(덮어쓰기 금지).
- **무회귀**: 신규 UI 는 `weekly_grid_enabled` 플래그 뒤. DB/RPC 하위호환 + 회귀 테스트.

---

## 5. 남은 작업 (정밀 스펙 + 통합지점)

> 각 항목은 subagent 1개(또는 병렬 팀)에 그대로 위임 가능한 스펙이다. 파일·라인은 정찰 완료분.

### Phase 2 잔여 (읽기 그리드 UI)
1. **플래그 훅**: `useWeeklyGridEnabled()` — `app_config.weekly_grid_enabled`(`{enabled:bool}`) TanStack Query 읽기 + 빌드타임 fallback `src/config/featureFlags.ts`(`weekly_grid_enabled:false` 추가). app_config 읽기 패턴=`src/services/versionService.ts:67-140`.
2. **`useGridSummary(venueId, monthDate)`**: `supabase.rpc('get_venue_grid_summary',{p_venue, p_from, p_to})` + `getVenueContainerById(venueId).softTargets` 조합 → 날짜별 `computeDayCell` → `Record<dateKey, GridDayCell>`. TanStack Query(읽기전용=Repository 직접 호출 허용).
3. **`useVenueDaySlots(venueId, date)`**: `supabase.rpc('get_venue_day_slots',{p_venue,p_date})` → 행 목록.
4. **CalendarCell 다중뱃지**(`src/components/jobs/DateCalendar/CalendarCell.tsx`, 현 props 24-34·뱃지 89-96): optional `gridCell?: GridDayCell` 추가 → `priorityBadge` 렌더(U2 압축 1개) + a11y 라벨("배치/공고/부족 N", U1 숫자+종류) + status별 색(shortage=warning, staffed=success/primary, U3 토큰). **`gridCell` 없으면 기존 `count` 동작 그대로**(공개 캘린더 무회귀). `CalendarGrid.tsx`(23-30,66-84): optional `gridCells?: Record<string,GridDayCell>` → `gridCell={gridCells[key]}` 전달.
5. **운영처 선택기**: `useActiveWorkspaceStore`(`src/stores/activeWorkspaceStore.ts`: activeWorkspaceId/setActiveWorkspaceId) + `WorkspaceRepository.listMyWorkspaces()`(rpc `list_my_workspaces`) + `jobPostingRepository.getVenueContainers(workspaceId)`.
6. **날짜 상세**: `ConfirmedStaffList`(`src/components/employer/applicants/ConfirmedStaffList.tsx`, `showActions=false`). `get_venue_day_slots` 행 → `ConfirmedStaff[]` 매핑(타입 확인 필요). 대형=FlashList, 소형 일별리스트=FlatList.
7. **그리드 화면/라우트**: 홈=캘린더 오버뷰(설계 §9.6). 라우트 배치 결정(`app/(employer)/` 신규 또는 보조 토글). 플래그 OFF면 미노출.

### Phase 3 (추가/편집)
1. **컨테이너 생성 TS 래퍼**: `getOrCreateVenueContainer(workspaceId,{name,kind,period})` — S1: `z.string().refine(xssValidation)` 통과분만 → `supabase.rpc('get_or_create_venue_container',...)`. (repo 또는 venue 서비스에.)
2. **add/remove 컨테이너 분기**(신규 마이그 `CREATE OR REPLACE`): `add_direct_staff`(토대 마이그 `20260629000000` 217-238: `IF v_already=0` 안 filled+1/capacity_full) → **`IF v_job.status='container' THEN` 해당 블록 skip**. `remove_direct_staff`(306-333) 대칭 skip(E7). **컨테이너에 스태프 추가는 허용(설계 §6) — 거부 아님**. MAX_CAPACITY 가드(133-170)는 requirements 만 읽어 컨테이너(softTargets 분리)엔 inert(검증됨).
3. **추가 시트**: 풀 꽂기 / 전화검색(`AddStaffModal`+`useStaffPhoneSearch` 재사용) / 공고 열기(`templateToDraft`(`src/types/jobTemplate.ts:145`)→인원→발행, `venue_id=container`).
4. **편집**: 시간/역할/색상(U3 토큰 팔레트 화이트리스트=`tailwind.config.js` Midnight Craft: primary-300/500/600/700, surface-*, secondary-50/100/200/900, success/warning/error/info)/메모(S1). 시작시간 자동정렬 + 중복충돌 경고.
5. **soft-target 쓰기**: 신규 SECDEF RPC `set_venue_soft_target(venue,date,count)` — 컨테이너 `schedule.softTargets` read-modify-write(restrictive 정책이 직접 UPDATE 차단하므로 RPC 필수). 날짜키 `toDateString` 정규화(E5 — **write 경계 정규화**). 부족 신호(U1).
6. **이월 처리**: by-id hydration 시 컨테이너 표현(getById/getByIdBatch가 work_log 카드에서 컨테이너 해소 — VenueContainer 로 처리, 일반 카드로 노출 금지).

### Phase 4 (QR + 정산)
1. **QR 트리밍**(신규 마이그 `CREATE OR REPLACE process_qr_checkin_atomically`): **먼저 `pg_get_functiondef('public.process_qr_checkin_atomically'::regproc)` 로 live 정의 재취득**(시그니처: `(p_work_log_id,p_staff_id,p_job_posting_id,p_action,p_check_time,p_expected_date)`). 변경: ① `p_action='auto'` 분기(현 status checked_in→checkOut, else checkIn) ② status 가드 `!= 'active'` → `NOT IN('active','container')` ③ checkOut 시 `clocked_out_raw`(NULL일 때만 보존)·`end_time_source='qr'` 세팅 ④ **is_active(계정) 가드 유지**(이 함수엔 caller-binding `auth.uid()=p_staff_id`만 있음 — 계정 is_active 가드는 별도 위치이니 **반드시 find**). 고정 운영처 QR(회전/만료/날짜재생성 제거). 앱이 `(staff, container, date=today)` work_log 해소.
2. **정산**: venue 스팬 + 날짜범위 **SQL 레벨**. `WorkLogRepository.getByJobPostingId`(`src/repositories/supabase/WorkLogRepository.ts:179`, 날짜필터 없음) + `settlementQuery`(`src/services/work/settlement/settlementQuery.ts:45-132`, 클라필터) → `venue_span_posting_ids` + `date BETWEEN`. `isCanonicalDatedPosting`(`jobPostingVisibility.ts:30-40`)은 status 무시 → 컨테이너 통과(무변경). `SettlementCalculator`(`src/domains/settlement/SettlementCalculator.ts`).

### Phase 5 (편의)
1. **지난주 복사**: 지난주 동요일 work_logs(venue 스팬, no_show/cancelled 제외) → `add_direct_staff` 벌크(p_assignments 배열, 중복가드 멱등). 대량이면 단일 벌크 RPC(선택).
2. **"이번 주 배치 확인" FCM** 알림(기존 푸시 인프라 `send-push`/notifications 경유).

### Phase 6 (정합)
1. "내 공고" 토글 정리(컨테이너 deny 재확인) + 공고작성 풀폼 → "템플릿/상세편집" 강등.
2. **venue_id draft 경로**: `draftAdapter`(`src/utils/job-posting/draftAdapter.ts`) **5 매퍼 + 3 location 헬퍼 전수갱신**(toCanonical/toCreate/toUpdate/toForm Location 43-118, formDataToDraft 326, draftToFormData 438, draftToCreate 494, draftToUpdate 567, jobPostingToDraft 687) — `hasRegionField`(94) 패턴처럼 `hasVenueIdField` 가드(region 유실 함정 재현 방지). `templateToDraft` venue_id 매핑. 고정공고 lifecycle 무회귀.

---

## 6. 오케스트레이션 레시피 (복붙용)

- **정찰(필요시만)**: `Workflow` 또는 Explore subagent 1개, 구조화 스키마로 "파일:라인 + 현재동작 + 변경점 + 함정"만 반환.
- **구현 파이프라인(phase별)**: `pipeline(units, 구현, 적대검증)` — 각 unit 을 `superpowers:test-driven-development` 로 구현(Red→Green) 후, DB/RLS/RPC 면 adversarial verify 단계.
- **적대리뷰(DB/RLS/RPC 굳히기, 다수결)**:
  ```
  phase 'Find': 4 렌즈(sql-correctness / security-rls / failclosed-completeness / invariants-e1) 병렬, 결함만 구조화 반환
  phase 'Verify': HIGH+ 결함마다 3 렌즈(정확성/보안/재현) 다수결 → confirmed 만 수정
  ```
  (Phase 1 에서 이 패턴이 HIGH 2건[컨테이너 직접쓰기 fail-open, Zod null 증발]을 잡았다 — 반드시 유지.)
- **검증(메인 직접)**: `npx tsc --noEmit` → `npx jest <path>` → pgTAP(docker cp+psql) → `npx eslint <files>`. 종료코드·실패개수만 확인.
- **커밋**: 단위/phase 단위 한글 conventional 커밋(로컬 자율). 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 7. 검증(증거 기반) + 하드게이트

- **명령어**: jest `npm test` / 단건 `npx jest <p>` · pgTAP 전체 `npm run test:db` / 단건 docker cp+`MSYS_NO_PATHCONV=1 docker exec … psql -f`(+`CREATE EXTENSION pgtap`) · type `npx tsc --noEmit` · lint `npx eslint` · 종합 `npm run quality`.
- **회귀는 Red→Green 1회**(특히 fail-closed/카운터). 마이그/RPC는 로컬 적용 후 결과 실측.
- **전체 종료 전**: `npm run quality` + jest + pgTAP 실행출력 증명. (`get_advisors` 는 PROD MCP=게이트라 로컬 수동검토로 대체, advisor 는 PROD 적용 단계에서.)
- **하드게이트(멈추고 사용자 승인)**: `git push`/PR/master 머지 · PROD Supabase 마이그(`mcp__supabase__apply_migration`) · 의존 브랜치 master 머지. 그 외는 자율.

---

## 8. 이월 항목 (적대리뷰 MEDIUM — 잊지 말 것)
- **by-id 컨테이너 처리**(getById/getByIdBatch/SettlementRepository): Phase 3/4 에서 work_logs.job_posting_id=컨테이너가 생기면, by-id hydration 이 컨테이너를 일반 카드로 노출하지 않도록(VenueContainer 경로/그룹헤더). 테스트로 고정.
- **work_logs.date 포맷 정규화**: 전역 CHECK 위험(기존데이터) → **그리드 write 경계에서 `toDateString` 정규화**(Phase 3 add/soft-target 경로).
- **`get_regular_posting_date_counts` 기존 capacity_full 누락 버그**: 본 기능 무관(컨테이너는 이미 제외) — 범위 밖, 메모만.
- **정리 잔여**: orphaned 워크트리(T-HOLDEM-ops), 로컬 임시 `pgtap` extension(무해).

---

### 착수 첫 행동(메인)
1. 본 문서 + 설계 v2 §9~10 + 메모리 로드(그 외 소스 직접 읽기 금지).
2. `git -C C:\Users\user\Desktop\T-HOLDEM-weekly-grid log --oneline -3` 로 상태 확인.
3. Phase 2 잔여(§5)부터 **구현 subagent + TDD 스킬**로 착수 → 검증 → 커밋 → 1단락 보고 → 다음.
