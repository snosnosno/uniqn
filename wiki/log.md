# Wiki Log

> 시간순 append-only. 포맷: `## [YYYY-MM-DD] <op> | <제목>` (op = bootstrap | ingest | query | lint | note)
> `note` = 프로젝트 마일스톤/스택 변경 이력(CLAUDE.md는 규칙만 유지, 변경 이력은 여기 + `CHANGELOG.md`).
> 최근 5건: `grep "^## \[" wiki/log.md | tail -5`

## [2026-06-18] bootstrap | 위키 초기화 (골격 + 백본 시드 + 커맨드 + 감지 스크립트)

## [2026-06-18] bootstrap | 백본 시드 완료 — 9페이지 (architecture×3 + domain×3 + decisions×3), stale 0, 링크 9/9, citation 10/10 OK

## [2026-06-19] ingest | db-tests CLI grant 드리프트 — sources/db-tests-cli-grant-drift + decisions/test-db-grants 생성, rls-model 갱신(테이블 GRANT 레이어 보강). 출처 PR#179/#180

## [2026-06-19] ingest | e2e CLI grant 드리프트 — sources/e2e-cli-grant-drift 생성(같은 드리프트가 e2e도 타격, pin 2.107.0으론 미해결 반증, 명시 GRANT 마이그레이션이 수정). decisions/test-db-grants 보정(pin≠fix, 무대별 grant 위치). 출처 PR#183(run 27769458739/27787809344/27829125384)

## [2026-06-23] ingest | 지갑/IAP 수익모델 전체 제거 + db-tests 회귀 — sources/wallet-iap-removal + decisions/wallet-pgtap-caller-binding 생성. revenue-model 휴면→폐기 전환(모순 플래그), rls-model 느슨 INSERT 의도 원칙 보강, test-db-grants allowlist 함수 grant 예외 명확화. 출처 memory(project_wallet_iap_removal_20260622·pitfall 2건)·PR#196(제거,✅머지 967e9f5e2+prod마이그+웹배포)·PR#198(db-tests green)

## [2026-06-25] note | CLAUDE.md 변경이력 이관 — CLAUDE.md를 "규칙 전용"으로 정리하면서 날짜 노트 5건을 여기로 옮김:
- [2026-06-25] 지갑/IAP 수익모델 전체 제거 완료(#196~206, prod 마이그·웹배포·모바일 OTA). 앱 결제표면 0. 신규 수익모델 작업 전 폐기 이력 확인. 타깃=홀덤펍+대회사(포커룸 비타깃). → `sources/wallet-iap-removal`, `domain/target-market`
- [2026-06-19] 공고 `posting_status` enum에 `capacity_full`(PR#155). 신규 status값 도입 시 read/filter Zod·공개 RLS·통계 reader 전수 갱신. LLM Wiki 운영. db-tests pgTAP는 fixture 명시 GRANT + setup-cli pin(#179/#180). → `decisions/capacity-full`, `decisions/test-db-grants`
- [2026-04-18] `job_posting_templates.description` 컬럼 추가(migration+types). JobPostingTemplate 리팩토링(userId/updatedAt 추가, createdBy/lastUsedAt 제거, usageCount 필수). edit.tsx 템플릿 저장 + TemplateModal 통합.
- [2026-04-17] Firebase 레거시 규칙/스펙 archive(docs/archive/firebase-legacy/2026-04/), Firebase MCP 제거.
- [2026-04-13] Expo 55/RN 0.83.4 업그레이드, Supabase 이전 완료, Black & Gold 완료.

## [2026-06-28] note | T-HOLDEM 라이브 운영 슬라이스 1c 전체 출하 — 클럭/모니터/플레이어뷰
- 1c-1/1c-2 클럭+live_stats+STATUS (PR#212, master `150f81e11`): 서버앵커(`level_started_at`)+클라틱+offset 보정 클럭(`computeClockRemaining` 순수함수)·트리거 기반 `ops_live_stats` 단일행 재계산(16 RPC 무수정)·5탭(PLAYERS/STATUS/TABLES/LEVELS/HISTORY). push 전 7차원 적대리뷰 WF(confirmed 4, CRITICAL/HIGH 0): 편집폼 stale state·actor-guard/DELETE/폴백 회귀테스트.
- 1c-3 B2배포+모니터 (PR#213, `f4d7a625e`): `deploy-cloudflare.js --project-name` CLI인자>env>기본값 파라미터화(cross-env 미사용, Windows 호환)+`deploy:ops`. 공개 전광판 `ops_get_monitor_snapshot(token)` anon SECDEF 비-PII 화이트리스트 투영·`app/(public)/monitor/[token]`.
- 1c-4 플레이어뷰 (PR#214, `3f215a622`): `ops_get_player_view(claim_token)` anon SECDEF **본인 안전필드만**(phone/nationality/claim_token/player_user_id/note/타참가자 미반환)·claim 바인딩+운영자 unclaim 복구. 적대검증 WF 5렌즈→claim 하이재킹(LOW~MED)→확인다이얼로그+복구RPC+PII pgTAP.
- **보안 패턴(#195 차단)**: anon 은 ops 테이블 직접 SELECT 0 — token→스코프 SECDEF RPC + 반환값 화이트리스트 투영만. prod advisor anon-executable SECDEF = `ops_get_monitor_snapshot`·`ops_get_player_view` 2개만(화이트리스트 예외, 0 ERROR).
- **🔑🔑 1d 착수 전 BLOCKING**: `player_user_id` 가 권한키로 승급(재진입/플레이어액션)되기 전 **claim view/write 토큰 분리 + PIN(또는 운영자승인) 신원게이트 재설계 필수**. 현 capability-URL은 player_user_id 가 dead column(인가 미사용)인 1c 한정 안전.
- prod 7마이그(P1 3·P2 2·P3 2) MCP apply·advisor 0 ERROR·supabase.ts MCP gen 정합. OTA 보류(prod ops 0행). ops.uniqn.app 2nd CF Pages=사용자 게이트(공개링크 origin 동적). 검증 pgTAP 35/315·jest 4521. → memory `project_tholdem_ops_revival_20260623`. ⚠️ 1b·1c 함정 wiki /ingest 졸업 미수행(백로그).

## [2026-06-29] note | T-HOLDEM ops STEP A — claim 읽기/쓰기 토큰 분리 (1d BLOCKING 해소)
- claim 토큰 분리 (PR#216, master `ab4ec00ee`): `claim_token`(읽기+쓰기 겸용)→`view_token`(읽기 anon, 유출 무해)+`claim_pin_hash`(쓰기 비밀, 8자 Crockford base32 PIN·bcrypt) 분리. 읽기 URL 유출→계정 하이재킹 차단. RPC 4종(`ops_get_player_view(p_view_token)`·`ops_issue_player_credentials`→{viewToken,claimPin}·`ops_claim_participant(view_token,pin,user_id)`·unclaim 불변), 구 2-인자 claim·issue_claim_token·player_view(text) **명시 DROP**(오버로딩 우회 차단).
- 적대검증 WF **6렌즈 26에이전트**(확정10/기각10)가 HIGH 2건 적출→해소: ①**NULL PIN fail-open**(`NOT(NULL~regex)=NULL`+`crypt(NULL,hash)=NULL`→`NULL<>hash=NULL` 둘 다 IF-false 통과→PIN없이 바인딩)→`IS NULL` 명시+`IS DISTINCT FROM`. ②**잠금 DoS**(잠금 카운터가 유출 view_token 단위→정당 플레이어 봉쇄)→**8자 PIN으로 잠금 자체 제거**(설계 단순화). +42P13(player_view rename DROP후CREATE)·오라클(미발급=PIN_INVALID 통합).
- 방법론=브레인스토밍→설계doc→적대검증 WF→writing-plans(10태스크)→SDD(implementer+태스크리뷰+최종 opus 리뷰 Ready). prod 3마이그 MCP apply·advisor 173WARN/ERROR0(anon-executable SECDEF=monitor/player 2개 유지)·CI 9/9 GREEN·검증 pgTAP 35/319·jest 4524. → memory `project_tholdem_ops_revival_20260623`·pitfall `pitfall_plpgsql_null_through_regex_fail_open`. 다음=STEP B 1d 핸드오프=`docs/planning/2026-06-29-ops-1d-handoff-prompt.md`.
