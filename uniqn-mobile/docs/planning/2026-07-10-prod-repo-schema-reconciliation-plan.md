# prod↔repo 스키마 정합화 계획 (baseline squash)

> 2026-07-10 RLS/SECDEF 감사가 적발한 대규모 발산의 근본 복구 계획. 별도 세션 실행용.
> 감사 보고서: `docs/analysis/2026-07-10-rls-secdef-parity-security-audit.md`

## 0. 결론 먼저

- **문제**: prod DB와 repo 마이그레이션이 대규모로 발산 → 로컬 pgTAP/db-tests가 prod를 대표하지 못하고, 신규 마이그가 prod 실상태를 전제하지 못해 깨질 수 있다.
- **권장 전략 = Option B (prod 덤프 baseline squash + 아카이브)**. 다운타임 0(정의 비교·재기록만), prod 무변경, repo만 prod에 맞춘다.
- **선결 조건**: 진행 중 브랜치(weekly-grid #222·ops·changelog PR들) 머지 안정화 후 착수(마이그 히스토리 동결 시점 필요).

## 1. 발산 실측 (2026-07-10, prod `ygfxukhktpqymahfrvbz` vs `supabase db reset` 로컬)

| 대상        | prod | repo(로컬) | 발산                                               |
| ----------- | ---- | ---------- | -------------------------------------------------- |
| public 함수 | 163  | 142        | prod전용 **21** · 본문불일치 **52** · 메타불일치 2 |
| RLS 정책    | 103  | 173        | repo전용 **77** · prod전용 7 · 표현식불일치 2      |
| PG 메이저   | 17.6 | 15.8(dev)  | functiondef 포맷 상이                              |

- **정책 77 repo전용 = 두 세대 공존**: 긴이름 세트(`<table>_<cmd>_<who>`, 예 `board_posts_select_public`)와 짧은이름(`bp_select`)이 로컬에 동시 존재. prod엔 짧은이름만. → 로컬은 PERMISSIVE OR 중복합산으로 prod보다 느슨.
- **함수 52 본문drift**: 다수 cosmetic(주석/포맷/대소문자)이나 SEMANTIC 혼재(`is_workspace_member` 구조 상이, `is_admin` prod=STABLE/repo=VOLATILE=prod 하드닝 앞섬). = prod에 적용됐으나 repo 미커밋된 hotfix 다수.
- **prod전용 21함수**: `check_rate_limit`류·`list_all_*`·unread 카운터·`fn_notify_*` 등. repo CREATE 부재 → 로컬 재현 불가.
- **버전목록 대조는 무의미**: MCP `apply_migration` 자체 타임스탬프 → prod 280 vs repo 240 파일명 거의 disjoint. 유효 오라클 = **실제 객체 정의(pg_proc.prosrc/pg_policies) 비교뿐**.

## 2. 전략 옵션

### Option A — 항목별 역이식 (prod-only/drift를 repo에 개별 마이그로 추가)

- 21함수 + 77정책 + 52본문을 하나씩 repo에 반영. 세밀하나 **수십 세션·오류 누적 위험**. 비추천.

### Option B — prod 덤프 baseline squash ✅추천

1. 진행 브랜치 머지 동결(마이그 히스토리 확정).
2. `supabase db dump --schema public`(또는 pg_dump `--schema-only`)로 **prod 현행 스키마 전체 덤프**.
3. 기존 240 마이그를 `supabase/migrations/archive/`로 이동(히스토리 보존, 재실행 제외).
4. 덤프를 단일 `<ts>_baseline_from_prod.sql`로 재기록(정합 시작점). 이후 마이그는 이 위에 쌓임.
5. 로컬 `db reset` = prod와 동일 형상 → pgTAP/db-tests가 prod 대표. `supabase migration repair`로 원격 히스토리 정합.

- **prod 무변경**(덤프는 읽기). 다운타임 0. 리스크 = 덤프 정확성·CI 마이그 순서. PG17 로컬 스택으로 올려 메이저 정합(현 dev 15.8→17).

### Option C — prod를 repo에 맞춤(repo 마이그를 prod에 적용)

- 77 repo전용 정책을 prod에 적용. **prod 동작 변경 = 위험**(느슨한 중복정책 유입). 비추천.

## 3. Option B 실행 단계 (다음 세션)

1. **동결 확인**: `git log`로 진행 PR 머지 완료 확인. 미머지 마이그 있으면 대기.
2. **PG17 로컬 스택**: dev Supabase CLI 이미지를 prod와 동일 PG17로. `supabase/config.toml` 버전 상향 후 `db start`.
3. **prod 덤프**: 읽기 전용. `pg_dump --schema-only --schema=public`(RLS·GRANT·함수 포함). anon/authenticated/service_role GRANT 보존 확인.
4. **아카이브**: `git mv supabase/migrations/*.sql supabase/migrations/archive/`. knip/CI가 archive 제외하는지 확인.
5. **baseline 재기록 + 검증**: `db reset` → 로컬 형상이 §1 prod 카운트(함수163·정책103)와 일치하는지 pgTAP로 단언(파리티 회귀 가드 신설).
6. **원격 repair**: `supabase migration list`로 drift 확인 후 `migration repair --status applied`.
7. **가드 신설**: CI에 "prod 함수/정책 카운트 == 로컬 카운트" 스모크(주기적 실측)로 재발산 조기경보.

## 3-b. 재빌드 시 보안 퇴행 주의 (레포 전용 gen-1 정책 부활 — prod엔 없음)

`db reset`/신환경 재빌드는 prod가 수동 DROP한 base_schema gen-1 정책을 되살린다. 특히 **위험 2건**:

- **`action_logs.action_logs_insert_any`** — `WITH CHECK (true)` = 누구나 감사로그 INSERT(로그 위조). prod=정책없음(deny).
- **`notifications.notifications_insert_service`** — `WITH CHECK (auth.uid() IS NOT NULL)`(수신자 바인딩 없음) = 인증된 아무나 타인에게 알림 위조. prod=deny.
  → baseline squash가 이 gen-1을 제거하므로 근본 해소. 그 전까지 **로컬 db-tests 결과를 prod 보안 근거로 쓰지 말 것**(로컬이 prod보다 느슨한 테이블 13종).

## 3-c. `decrement_unread_counter` 오버로드 모호성 (baseline 재기록 시)

prod에 `(uuid)`와 `(uuid, integer)` 2종 공존, repo엔 `(uuid,int)`만. prod에서 단일인자 `decrement_unread_counter($uuid)` 호출 시 두 후보 매치 → `function is not unique`(42725) 가능(로컬 재현불가·미확인). baseline 재기록 시 잉여 `(uuid)` 제거 또는 호출부 2-인자 고정 검토. (2026-07-10 Tier-3가 두 오버로드 모두 authenticated 회수 = 클라 트리거 표면은 이미 닫힘, service_role 경로만 잔존.)

## 4. 주의

- 이 계획 실행 전까지 **모든 DB 주장은 prod 라이브 실측**(`mcp__supabase__execute_sql` pg_proc/pg_policies/has_function_privilege). 로컬 GREEN을 prod 증거로 쓰지 말 것.
- 신규 마이그는 prod 실상태 미전제 → `IF EXISTS`/`IF NOT EXISTS` 방어 필수(2026-07-10 하드닝 마이그가 이 패턴 사용).
- 관련 함정: `wiki/decisions/migration-timestamp-collision.md`, 메모리 `pitfall_prod_repo_schema_drift_massive`.

## 부록 — 발산 상세

- 전체 목록: 세션 스크래치패드 `parity_result.json`(only*prod 21 / body_diff 52 / meta_diff 2) + `parity_report.txt` + 정책 해시 `policies*{prod,local}\_hashes.txt`.
- prod전용 21함수 대표: check_rate_limit·check_ip_rate_limit·check_user_rate_limit·check_xss_fields·rls_auto_enable·update_updated_at·list_all_applications/event_qr_codes/managed_postings/work_logs/workspace_members·get_unread_notification_count·reset_unread_counter·decrement_unread_counter(uuid)·get_workspace_owner_profile·toggle_board_post_vote·fn_notify_cancellation_request/inquiry_created/review_created/tournament_approval·fn_sync_application_completion.
  - ⚠️`toggle_board_post_vote`·unread 카운터 3종은 2026-07-10 하드닝이 이미 repo에 재정의/회수 반영(baseline 재기록 시 중복 주의).
