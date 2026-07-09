# RLS/SECDEF 전수 감사 + prod↔repo 파리티 실측 (2026-07-10)

> 라이브 prod(`ygfxukhktpqymahfrvbz`) 실측 기반. 3렌즈(anon·RLS·authenticated) 적대 감사 + 함수/정책 파리티.
> 하드닝 2건은 **prod 적용·검증 완료**. Tier-3는 제품 결정 대기.

## 0. 결론 먼저

- **prod에 적용 완료(검증 GREEN)**: anon 잔존 EXECUTE 3함수 회수 + board 토글 IDOR 가드. advisor anon SECDEF **48→45**, WARN 191→188, ERROR 0 불변.
- **최대 발견 = prod↔repo 대규모 발산**: 함수 본문 52 불일치·prod전용 21, RLS 정책 prod 103 vs repo 173(repo전용 77). 로컬 pgTAP가 prod를 대표하지 못한다. → 별도 baseline 정합화 프로젝트 권장.
- **Tier-3 제품 결정 대기**: 공고 anon 노출 범위, board 비공개댓글, 알림 카운터 griefing, 배치함수 authenticated 노출.

## 1. 파리티 (prod vs repo, `supabase db reset`로 재구성한 로컬 대조)

| 대상        | prod | repo(로컬) | 격차                                      |
| ----------- | ---- | ---------- | ----------------------------------------- |
| public 함수 | 163  | 142        | prod전용 21 · 본문불일치 52               |
| RLS 정책    | 103  | 173        | repo전용 77 · prod전용 7 · 표현식불일치 2 |
| PG 메이저   | 17.6 | 15.8(dev)  | functiondef 포맷 상이                     |

- `schema_migrations` 버전 대조는 무의미(MCP apply 자체 타임스탬프 → prod 280 vs repo 240 거의 disjoint). 유효 오라클 = 실제 객체 정의 비교.
- 본문 52 불일치 다수는 주석/포맷(cosmetic)이나 `is_workspace_member`(구조 상이)·`is_admin`(prod=STABLE/repo=VOLATILE, prod 하드닝 앞섬) 등 SEMANTIC 혼재. → **prod에 적용됐으나 repo 미커밋된 hotfix 다수 존재**.
- 정책 repo전용 77 = 긴이름 세트(`<table>_<cmd>_<who>`)와 짧은이름(`bp_select`) **공존** → 로컬은 PERMISSIVE 중복 OR로 prod보다 느슨. 로컬 db-tests가 prod와 다르게 동작.
- **위험**: 신규 마이그가 prod 실상태 미전제 → 깨질 수 있음(`IF EXISTS` 방어 필수). 로컬 GREEN을 prod 증거로 쓰지 말 것.
- **권장 복구**: prod 스키마 덤프 baseline squash로 repo↔prod 정합(별도 프로젝트, 다운타임 없음: 정의 비교만).

## 2. 하드닝 적용 완료 (prod)

### A1 [HIGH] anon 레이트리밋 우회 + rate_limits DoS — `20260710000000`

- `check_rate_limit`/`check_ip_rate_limit` anon-exec, 클라 통제 인자. **anon 재현**: `max_requests=2^31-1` → `allowed:true`. 임의 key로 rate_limits 무한 INSERT.
- 근본원인: 2026-06-21 하드닝 REVOKE 리스트가 `check_user_rate_limit`만 포함, 원본 2개 누락. 전 저장소 호출자 0(dead).
- 수정: anon REVOKE. **prod 적용·재현 차단 확인**.

### A2 [MEDIUM] anon 전화번호 열거 — `20260710000000`

- `check_phone_exists` anon-exec(prod drift; repo는 authenticated 의도). 2026-06-21 stale allowlist("가입 경로"라 유지했으나 가입은 email만 확인, 전화 호출자 0). 수정: anon REVOKE.

### B1/B2 [MEDIUM] board 투표/리액션 토글 IDOR — `20260710000100`

- `toggle_board_post_vote`·`toggle_comment_reaction`가 `p_user_id`(클라 통제)를 `auth.uid()` 검증 없이 신뢰 → 타인 명의 위조/삭제/카운트 조작. 앱은 자기 uid 전달(정상 무회귀).
- 수정: 표준 호출자 바인딩 가드(`auth.uid() IS DISTINCT FROM p_user_id AND NOT is_admin()`). **prod 적용·라이브 위조 차단 확인**. prod-only/드리프트였던 두 함수를 현행 prod본문+가드로 재정의(정합화 겸함).

## 3. Tier-3 — 제품 결정 대기 (미적용)

- **C1 [MEDIUM] `job_postings_select_all`**: [public] `USING status <> 'container'` → anon이 cancelled(현 2행 라이브 확인)/draft/pending/rejected/expired 열람. careful `jp_select_public_search`(화이트리스트)를 PERMISSIVE OR로 무력화. **결정 필요**: 공유링크가 cancelled/expired 상태표시로 anon 읽기에 의존하는가? 아니면 화이트리스트로 축소?
- **C2 [LOW, latent] `board_comments.bc_select`**: board_posts.visibility 무시 → anon이 post_id 알면 participants_only 글 댓글 열람(현재 노출 0). bp_select 조건 미러 권장.
- **B3 [LOW] 알림 카운터 4종**: authenticated가 임의 p_user_id로 타인 알림 read 처리(griefing)/카운트 열람. 2026-06-21이 authenticated 의도 재부여. service_role-only 축소 검토.
- **배치 함수군 [LOW]**: `fn_expire_*`·`fn_cleanup_*`·`expire_pending_workspace_invitations`·`fn_send_review_reminders` authenticated 호출 가능(대부분 멱등, `fn_send_review_reminders`만 알림 스팸 벡터). cron/service_role-only 검토.
- **A4 [LOW] `get_posting_filled_counts`**: SECDEF가 status 필터 없이 임의 UUID[] 확정슬롯 카운트. allowlist 계약 유지 중, 노출 최소.

## 4. 정상 확인 (오탐 기각)

- ops\_\* 40여 함수: 강한 호출자 바인딩(`IS DISTINCT FROM p_actor_id`) 정상.
- `permanently_delete_user`/`confirm_application`/`cancel_application_atomically`/`process_qr_checkin_atomically`: 하드닝 정상(pgTAP 계약 일치).
- `increment_view_count`: anon-exec이나 `auth.uid() IS NULL → RAISE` 가드.
- no-actor-arg 51개: search_path 결함 0, 동적SQL은 `rls_auto_enable`(무입력)만.
- 트리거 함수 37종 anon-exec: 트리거 컨텍스트 전용.

## 5. 검증 증거

- 마이그 2종 prod MCP apply + red-green(has_function_privilege/pg_get_functiondef + 라이브 재현).
- pgTAP: `anon_rate_limit_phone_revoke.test.sql`(존재가드 skip) + `toggle_vote_reaction_caller_binding.test.sql`(위조 throws_ok) 로컬 GREEN.
- advisor: 191→188, anon SECDEF 48→45, ERROR 0.
