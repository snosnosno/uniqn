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

## [2026-07-02] note | T-HOLDEM ops 배정 2종 — 랜덤·칩드래프트 전원 재배치 (설계 1d 배정분)
- 배정 2종 (PR#220, master `685e4e1f8`): 적격(open·unlocked) 테이블 active+checked_in을 **랜덤**(균일) 또는 **칩 드래프트**(칩 내림차순 스네이크 버킷+테이블내 랜덤 좌석)로 전원 재배치. 1b redraw 패턴(클라 순수함수 미리보기→서버 확정 RPC TOCTOU) 재사용. 순수 알고리즘 3종(randomDraw/chipDraft/seatWithinTable·RNG 주입)+확정 RPC `ops_reseat_participants`+Zod/repo/hook/UI+에러 E6129~E6131. 신규 테이블/트리거 0(live_stats 트리거 자동).
- **확정 RPC 핵심**: 잠금 `advisory→대회→좌석(id asc)→참가자(id asc)` **좌석-우선**=1b assign/move/redraw와 통일→ABBA 데드락 회피(초안 참가자-우선은 비-advisory 좌석 RPC와 40P01). **전원 비우기→앉히기**로 좌석 단일점유 partial UNIQUE 충돌 회피(derangement RED-GREEN 실증). 피처/잠금 테이블 점유자 소스 보호 가드·외부인 착석/동시 bust TOCTOU·checked_in 승급·`table_redraw` 이벤트(컬럼명 `type`).
- **적대검증 WF(7차원 14에이전트)가 머지 전 11결함 하드닝**(설계·계획 diff 대상): ①락순서 역전 ABBA→좌석-우선 ②`event_type`→`type`(ops_events 실컬럼, plpgsql 늦은바인딩 42703 런타임 차단) ③`mapOpsRpcError` 2인자/never/경로 ④피처테이블 소스보호 ⑤pgTAP 무위시드(착석·차등칩·derangement) ⑥INSUFFICIENT phantom 제거 ⑦Zod v4 `.uuid()` RFC4122 strict→그룹형 정규식. SDD 3배치+배치별리뷰+최종 opus READY.
- prod 2마이그 MCP apply·advisor 0 ERROR(anon-executable ops SECDEF=monitor/player 2개 유지·search_path0)·supabase.ts reseat 타입 수술적 추가. 검증 jest 4557·pgTAP Files39/Tests390·tsc0·quality0·CI 9/9. OTA 보류(prod ops 0행). → memory `project_tholdem_ops_revival_20260623`. 앞서 1d(bust/재진입/ITM #218 `2fa2dea3a`)도 prod 출하. 다음=1f 잔여 상금·1e 스태프. ⚠️후속 추적 LS-매개 데드락(DEFERRED CONSTRAINT TRIGGER, TODOS).

## [2026-07-08] ingest | 미사용 export triage 졸업 — sources/knip-unused-export-triage + decisions/knip-signal-hygiene 생성
- knip 미사용 ~3000건 단계별 정리(2951→2313, ✅PR#231 머지 `c75d78add`)의 교훈을 위키로 졸업. 원천: 로드맵(개정2)·핸드오프 실행세션1·2 로그·memory `project_knip_triage_execution`.
- **decisions/knip-signal-hygiene**: (1) knip "unused export"=외부 미import일 뿐 실제 삭제가능 ~35%만(나머지 로컬사용/의도적계약/SSOT) — 안전오라클=선언 전체삭제→tsc red=실사용→리버트(`--fix`는 noUnusedLocals와 양립불가). (2) 배럴 협응삭제(소스+배럴 라인 둘다)·dead-coupled 클러스터 묶음삭제·전량죽은파일 `git rm`. (3) `knip:gate --max-issues=N` 단조감소 래칫, phase경계·병합시 재baseline. (4) 🔑병합 시 오래된 base 삭제가 신규 소비와 충돌→tsc 안전망(`getStaffRoleLabel` #230 소비 복원 사례).
- **sources/knip-unused-export-triage**: Phase0~3 실행 요약 + 잔여(OTHER 중복 disambiguation·생성타입 불가촉·P4/P5 비권장). index.md decisions·sources 각 1줄 추가. cross-link → [[layers]]·[[enum-divergence]].

## [2026-07-08] ingest | ops 1e 스태프 연동 — sources/ops-1e-staff-integration + decisions/migration-timestamp-collision 생성. index 갱신(decisions·sources 각 1). 재사용 교훈 3: ①병렬세션 마이그 타임스탬프 충돌(병합 후 db reset schema_migrations_pkey 23505)→신규분 리네임 ②MCP apply_migration 은 prod version 별도 부여라 파일명 무관(충돌은 로컬/CI db reset 한정) ③anon-executable ops SECDEF=monitor/player 2개 불변 계약(신규 SECDEF 함수는 anon 명시 REVOKE, 카탈로그 카운트+집합 단언이 회귀 가드). 출처 PR#230(머지 master 5018d4bc4·prod 마이그 적용)·PR#229·마이그 3종(20260708100000/100100/100200)·memory(project_ops_1e_staff_integration_design)
## [2026-07-08] lint | all — stale 10·UNVERIFIABLE 6·미흡수docs 51·고아(백링크≤2) 5·모순 0·증거공백 0. 실제 고아=worktime-ssot(inbound 0). 신규 2페이지(ops-1e-staff-integration/migration-timestamp-collision) UNVERIFIABLE는 현 워크트리(chore/knip-config-harden) master 미체크아웃으로 1e 마이그 파일 부재 = transient(frontmatter 정상). 데이터갭=대회운영(ops 1a~1f) architecture/domain 페이지 부재(source만 존재). top3=①worktime-ssot 상호링크 ②CLAUDE.md(2026-07-05) 소스 STALE 4종 재검토 ③ops 엔진 아키텍처/도메인 페이지 신설(+ops docs 우선 ingest). 자동수정 없음(진단만).
## [2026-07-08] ingest | ops 엔진 architecture 페이지 + lint 조치 — architecture/ops-engine 신설(이벤트 스파인 ops_events append-only·SECDEF 쓰기경계+actor바인딩+락순서·is_ops_member RLS·anon SECDEF monitor/player 2 불변·서버앵커 클럭/live_stats·슬라이스 1a~1f+배정 지도). index 갱신. lint 조치(재검토): roles.md "포커룸 직무"→"현장 직무" 교정+bump(타깃 pivot 반영)·overview.md 지갑IAP "휴면 중"→"전체 제거"(#196) 교정+ops 엔진 MOC 편입+bump·layers.md 관련에 worktime-ssot(고아 해소)+ops-engine 상호링크. 데이터갭(ops architecture 부재) 해소. 출처 마이그 20260625120000(1a enums/tables)·20260625120100(rls)·20260628110000(1c4 player)·OpsEventRepository·types/ops.ts·PR#207~#230·memory(project_tholdem_ops_revival_20260623). 잔여 STALE(코드소스, 미조치=재검토 필요): data-flow·layers(walletService 죽은예시)·enum-divergence·test-db-grants — 날짜 bump 아닌 내용 갱신 대상.

## [2026-07-14] ingest | 2026-07-08 이후 머지 4건 졸업 — baseline squash·유저플로우 감사·iOS 버그수정
- 신규 sources 3: [[parity-baseline-squash]](PR#241 — pg_dump 함정 5종+E2E 함정 2종+prod 진실 교정) · [[userflow-audit-2026-07]](PR#242 — 감사 방법론+P0~P2+반복 교훈) · [[ios-userflow-fixes]](PR#243·#244 — filled counts 서브맵 함정)
- 신규 decisions 2: [[prod-parity-baseline]](prod가 진실 — 발산 규모·가드 2중·핫픽스 규율) · [[whitelist-silent-drop]]("화이트리스트 조용한 증발" 재발 클래스 3회 실증 합성 — #194 region·#243 filled counts·키오스크 conditions 9지점)
- index 5항목 추가. 원천: memory 토픽 4편 + docs/analysis/2026-07-10-userflow-audit.md + 커밋 이력.

## [2026-07-14] ingest | 키오스크 주문서 개편 출하 — sources/job-posting-kiosk-order-sheet + decisions/order-sheet-form-contract 신설
- 신규 sources 1: [[job-posting-kiosk-order-sheet]](PR#246 본·#247 후속 — 무엇/왜·출하 게이트 실측·재발 교훈·폴리시 소건). 신규 decisions 1: [[order-sheet-form-contract]](3제네릭 zodResolver z.input/z.output·canonical 매퍼 등가성·Design B 승인 일탈·#244 지연전환·중첩Modal embedded·guaranteedHours PROVIDED_FLAG 함정).
- [[whitelist-silent-drop]] 갱신: 규칙 #5 "읽기 배선 ≠ 표시 UI" 추가(conditions 읽기 hydration은 #246 완료였으나 표시 UI JobDetail 섹션은 별개 갭→#247 완결). sources에 PR#247·JobDetail.tsx 추가.
- index 2항목 추가(decisions·sources 각 1). 원천: PR#246(`beb28d1f0`)·PR#247(`0326682f4`)·마이그 job_postings_conditions·OTA group `4193f9ab`·memory(project_job_posting_kiosk_order_sheet).
