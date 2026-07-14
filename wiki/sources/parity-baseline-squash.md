---
area: sources
updated: 2026-07-14
status: current
sources:
  - uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql
  - .github/workflows/parity-smoke.yml
  - uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql
  - PR#241
  - memory/pitfall_pgdump_baseline_traps
  - memory/pitfall_prod_repo_schema_drift_massive
tags: [database, migration, parity, pgtap, e2e]
---

# 소스: prod↔repo 파리티 baseline squash (PR #241, 2026-07-12~13)

## 무엇을 했나
마이그레이션 248개를 `supabase/migrations/archive/`로 이동(재실행 제외·히스토리 보존)하고 prod `pg_dump --schema-only` 스냅샷 + 프렐류드·플랫폼 glue·데이터 시드 4파일로 재기록. 로컬 PG 15→17.6(prod 정합). fresh `db reset` == prod 실측 일치(함수·정책·pg_temp 0). 재발산 가드 2중: pgTAP `parity_baseline_guard.test.sql`(코드로 검증됨 — 함수 163·정책 104 카운트·gen-1 부활 0·SECDEF pg_temp 0, **테이블/컬럼은 세지 않음**) + `parity-smoke.yml`(주 1회 prod 라이브 대조, PR 게이트 아님). 배경 발산 규모·"왜"는 [[prod-parity-baseline]].

## pg_dump 재기록 함정 5종 (재실행 시 선확인)
1. **프렐류드에서 ALTER DEFAULT PRIVILEGES 금지** — 덤프보다 먼저 걸면 덤프 생성 함수 전체에 anon EXECUTE 선부여, pg_dump ACL은 델타 구문이라 오염을 못 지움 → prod의 anon 회수 하드닝이 로컬에서 무효화(pgTAP로 적발). 기본권한은 덤프 말미의 prod 원본이 담당.
2. pg_dump 17.6+의 `\restrict`/`\unrestrict` psql 메타커맨드 — CLI 마이그 러너가 파싱 실패 → 라인 제거.
3. `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` 12줄 — 로컬 적용 롤(postgres)이 타 롤 기본권한 변경 불가(42501) → 제거.
4. baseline이 처음 가져온 auth 트리거(`on_auth_user_created`·`prevent_role_escalation`)·FK NO ACTION이 테스트 픽스처를 대량 파괴 → ON CONFLICT 공존 + `raw_app_meta_data.role` 정렬 + 의존행 선정리로 해소.
5. 이벤트 트리거·storage 버킷/정책·realtime publication·cron·vault는 **스키마 덤프 밖** → prod 실측으로 glue 파일 별도 코드화.

## baseline이 노출한 것 (E2E 함정 2종 — "DB Tests GREEN인데 E2E만 red")
6. `--schema-only`는 계정 프로필 필드를 소실 — review-* 계정에 `phone_verified` 등 미설정 → 로그인은 되는데 온보딩으로 리다이렉트 → 로그인 후 전 화면 e2e 실패(255건). 데이터 시드에 prod 실측 반영으로 해소.
7. **master의 "거짓 GREEN"**: `board_reports` UPDATE 정책이 prod에 부재 → admin 신고처리가 RLS 0행 no-op(성공 토스트만). master는 마이그-replay의 고아 정책으로 통과해 왔음. `brep_update` 신설 prod 적용. 교훈: baseline 후 e2e red는 "테스트 버그"가 아니라 **master가 숨겨온 prod 실결함**일 수 있다.

## prod 진실 교정 (테스트가 로컬 잔상을 계약으로 오인하던 것)
`process_qr_checkin_atomically` 서버앵커(±300초) · work_logs INSERT 정책 부재(RPC 전용) · event_qr_codes INSERT 본인 바인딩 · `jp_insert` 역할게이트([[rls-model]] 참조).

## 운영 규율 (이후 모든 DB 작업의 전제)
- **이제 로컬 db reset은 prod를 대표한다** — 단 prod MCP 핫픽스는 같은 PR에서 repo 마이그+가드 기대값 동시 갱신.
- 컬럼 additive 추가는 가드 무영향(함수·정책만 카운트 — 2026-07-14 키오스크 conditions 컬럼에서 재실측).

관련: [[prod-parity-baseline]] · [[test-db-grants]] · [[rls-model]] · [[migration-timestamp-collision]] · [[userflow-audit-2026-07]]
