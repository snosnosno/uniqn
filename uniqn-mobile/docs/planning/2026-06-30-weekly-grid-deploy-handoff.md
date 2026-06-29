# 핸드오프 — 주간 배치 그리드 배포·통합 (다음 세션 메인 프롬프트)

> **상태: 구현 6 Phase 전부 완료(로컬). 남은 건 사용자 승인이 필요한 배포 하드게이트뿐.**
> 이 문서를 다음 세션 메인 프롬프트로 사용한다. 코드 변경은 거의 없고, **순서대로 게이트를 여는 통합 작업**이다.

---

## 0. 현재 상태 (검증된 사실)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM-weekly-grid` · 브랜치 `feat/weekly-batch-grid` · 최신 SHA `864d889d0`
- **전부 로컬**: push·PR·master 머지·PROD 마이그 = **전부 미수행(하드게이트, 사용자 승인 대기)**
- 토대 브랜치(`origin/claude/staff-management-add-feature-g8wvsz`)는 **이미 이 브랜치에 머지됨**(`45e649557`) → 단일 PR이 토대까지 전부 운반
- 최종 종합검증(fresh, 2026-06-30):
  - `npm run quality` **EXIT 0** (tsc + eslint 0 errors + prettier clean)
  - jest **359 스위트 / 4704 테스트 / 122 스냅샷 — 전부 통과**
  - grid pgTAP **33/33** (fail-closed 8 + staff/softtarget/deny 12 + QR 9 + read-RPC 4)

### 구현 커밋(최신순)

| SHA                     | Phase  | 내용                                                                                                            |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `864d889d0`             | 5+6    | 지난주복사(allSettled 멱등)·배치확인 알림·draftAdapter venue_id 전수(+serialize/deserialize/schema 양경계 수정) |
| `c7f484b2e`             | 4(2/2) | 정산 venue스팬+SQL날짜범위(E1/R5)·QR 앱측 슬롯해소                                                              |
| `2487e6d06`             | 4(1/2) | QR `process_qr_checkin_atomically` auto+container+원본보존+pg_temp 하드닝·deny-case                             |
| `7fba3233a`             | 3b     | Add/EditSlotSheet·VenueDayPanel 소프트타깃+부족신호·by-id carve-out                                             |
| `5d10b1058`             | 3a     | add/remove 컨테이너 회계 skip(R1/E7)·set_venue_soft_target RPC·TS래퍼                                           |
| `ada9948fe`             | 2잔여  | 플래그훅·WeeklyGridRepository·요약/슬롯/컨테이너 훅·다중뱃지셀·운영처선택·플래그게이트 화면                     |
| `9f3728f14`,`f73871177` | 1·2RPC | 데이터 토대·fail-closed·읽기 RPC                                                                                |

---

## 1. PROD 마이그 — 순서 고정 (12종, 첫 적용)

> ⚠️ 로컬은 공유 DB라 12종이 이미 적용돼 있지만 **PROD엔 weekly_grid 토대 전무 → 12종 모두 첫 적용**.
> `mcp__supabase__apply_migration` 으로 **아래 순서 그대로** 1종씩. 각 적용 후 결과 확인.

1. `20260629000000_staff_management_direct_add.sql` (토대: add/remove_direct_staff, search_users_by_phone)
2. `20260630000000_weekly_grid_container_enum.sql` — **⚠️ enum ADD VALUE 단독 트랜잭션 필수(E4). 이미 단독 마이그라 그대로.**
3. `20260630000100_weekly_grid_columns_indexes.sql` (venue_id self-FK, work_logs 4컬럼, 인덱스, 유니크)
4. `20260630000200_weekly_grid_container_helper.sql` (`get_or_create_venue_container`)
5. `20260630000300_weekly_grid_app_config_flag.sql` (`weekly_grid_enabled = {"enabled": false}` — **OFF로 출하**)
6. `20260630000400_weekly_grid_container_rls_failclosed.sql` (SELECT carve-out)
7. `20260630000500_weekly_grid_container_write_failclosed.sql` (RESTRICTIVE 쓰기 차단 + CHECK)
8. `20260630000600_weekly_grid_venue_span_ssot.sql` (`venue_span_posting_ids`)
9. `20260630010000_weekly_grid_read_rpcs.sql` (`get_venue_grid_summary`/`get_venue_day_slots`)
10. `20260701000000_weekly_grid_add_remove_container_branch.sql` (add/remove 컨테이너 skip + pg_temp 하드닝)
11. `20260701000100_weekly_grid_set_venue_soft_target.sql` (`set_venue_soft_target`)
12. `20260702000000_weekly_grid_qr_container_auto.sql` (QR auto/container + pg_temp 하드닝)

### 적용 후 보안 점검 (필수)

- `mcp__supabase__get_advisors` (security) — ERROR 0 확인.
- anon REVOKE 실측: 신규 SECDEF RPC 전부 `has_function_privilege('anon', ..., 'execute') = false` 여야 함:
  `get_or_create_venue_container`, `venue_span_posting_ids`, `get_venue_grid_summary`, `get_venue_day_slots`, `set_venue_soft_target`. (process_qr_checkin_atomically, add/remove_direct_staff 도 anon=false 유지.)
- `search_path` 점검: add/remove_direct_staff, set_venue_soft_target, process_qr_checkin_atomically 가 `public, extensions, pg_temp` 인지(pg_temp 마스킹 차단 하드닝).

---

## 2. Push / PR / 머지 (하드게이트)

1. **토대 PR 확인**: `origin/claude/staff-management-add-feature-g8wvsz` 가 별도 PR로 master에 먼저 가야 하는지 사용자에게 확인. (이미 feat 브랜치에 머지돼 있으므로 단일 PR로 통합 가능하나, 팀 규칙상 토대 분리 PR을 원할 수 있음.)
2. `feat/weekly-batch-grid` push (`-u`) → PR 생성(`/pr`). PR 본문에 6 Phase 요약 + 검증 증거 + 마이그 순서 + 플래그 OFF 출하 명시.
3. **master 직접 push 금지**(branch protection이 required check 강제 안 함 — e2e 우회 위험). 반드시 PR.
4. CI 그린 확인 후 머지.

---

## 3. 앱 출하 (OTA)

- JS만 변경(네이티브 무변경) → **OTA 가능**(EAS update). app_config `weekly_grid_enabled` **OFF로 출하 후 점진 ON**.
- OTA 명령 함정: `android/` mv + `NODE_ENV=production` + `--environment production`(메모리 `pitfall_fixed_schedule_strict_parse_kills_backcompat` 참조). `eas update`는 shell `process.env`만 평가(`pitfall_eas_update_shell_env_not_loaded`).
- ON 전환 후 운영자 1명으로 스모크: 운영처 생성→그리드→풀/전화/공고열기 추가→편집→소프트타깃→QR auto→정산→지난주 복사→배치확인 알림.

---

## 4. 이월 follow-up (비차단 — 출하 후/별도 PR)

- **weekly-grid 딥링크 라우트 미등록**: `deepLinkRouteParser`의 `employer` 분기가 `weekly-grid`를 `my-postings`로 오해소. 배치확인 알림 link(`/employer/weekly-grid`) 탭 시 '내 공고'로 라우팅. 플래그 OFF·prod ops 0행이라 실사용 전 무해. → RouteRegistry/NOTIFICATION_ROUTE_MAP에 weekly-grid 등록 후 해소. (알림 라우팅은 link 우선 함정: executor `getRouteFromNotification`.)
- 배치확인 알림이 `SCHEDULE_CREATED` 타입 재사용 — 전용 타입 도입 시 `Record<NotificationType, X>` 전수 보강 필요.
- **다중슬롯/일 venue QR fail-closed**: 같은 (스태프, 컨테이너, 오늘)에 work_log 2건↑이면 venue QR(slot-agnostic)이 BUSINESS_INVALID_STATE로 막힘(잘못 매칭은 아님). 단발알바 타깃엔 희소. 다중슬롯 지원 시 슬롯 선택 UI 필요.
- `getByOwnerAndPostingType`/`getByPostingTypeAndApprovalStatus` 에 `.neq('status','container')` 명시 가드 없음 — 현재 실누수 아님(타입/경로 분리), 방어심층으로 추가 권장.
- 3a 권한게이트 deny-case·capacity_full 전이 무회귀 pgTAP는 Phase 4에서 보강 완료(12/12).

---

## 5. 운영 메모 (함정)

- **공유 로컬 DB 드리프트**: 타 세션 `db reset`으로 weekly_grid 객체 수시 소실. 로컬 pgTAP/DB작업 전 재적용 필수:
  ```bash
  cd uniqn-mobile && for f in supabase/migrations/20260629*.sql supabase/migrations/20260630*.sql supabase/migrations/20260701*.sql supabase/migrations/20260702*.sql; do docker cp "$f" supabase_db_uniqn:/tmp/m.sql; MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f /tmp/m.sql; done
  ```
  전부 멱등(CREATE OR REPLACE / IF NOT EXISTS). `npx supabase migration up`은 원격전용 마이그 3종으로 차단=정상(reset/repair 금지).
- docker psql `/tmp` 경로는 `MSYS_NO_PATHCONV=1` 접두. pgTAP 단건 전 `CREATE EXTENSION IF NOT EXISTS pgtap;`. node_modules 정션은 PowerShell `New-Item -ItemType Junction`(mklink 실패).
- 진실의 원천(구현 설계): `docs/planning/2026-06-28-weekly-batch-grid-design.md`(설계 v2), `docs/planning/2026-06-28-weekly-grid-handoff-v2-orchestrated.md`(구현 핸드오프).
