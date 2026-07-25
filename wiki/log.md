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

## [2026-07-15] note | 구인 필터·주문서 후속 머지 6건 (#249~#254) — 세션랩 이력 기록
- **필터 3축 완결**: P1 지역(#250)·P2P3 역할/급여(#251, prod 마이그 2건)·**지역 전국 3단계 택소노미(#254**, `bfb83ce28`, 67→277 slug·그룹 접두 like 압축으로 URL 한도 근본수정·DB 변경 0**)**. 잔여=OTA·실기기 QA(사용자 게이트).
- **주문서 후속 UX 전량 출하**: S3+S2 카드조건·역할별급여(#252)·S1 일정그룹 복원(#253) 머지 + OTA `e01cdfc0`(2026-07-15). #249는 테스트 수정 핸드오프 문서.
- 택소노미 설계결정(8권역 하이브리드·시 slug="시 전체" 오버로드·구=부모 시 포함)의 wiki 졸업(/ingest)은 미실시 — 후속 후보. 상세=CHANGELOG Unreleased·memory(project_posting_filter_p1_p2_p3·project_region_taxonomy_3level_20260714).

## [2026-07-15] ingest | MEMORY.md 예산 초과 → 머지완료 함정 wiki 졸업 (3 decisions 신설)
- MEMORY.md(항상-로딩 인덱스)가 예산 14,000자 초과(~17.6k) → §10 졸업 규칙 적용. 머지·해결된 함정 20여종을 주제별 decisions로 종합 졸업하고 MEMORY 라인을 wiki 포인터로 압축.
- 신규 decisions 3: [[secdef-hardening]](anon EXECUTE REVOKE·search_path extensions·plpgsql NULL fail-open — memory 3함정+PR#195), [[supabase-write-pitfalls]](카운터 트리거·realtime publication·RPC 예외 매핑·RLS multi-cause·시드 zod/auth.users·storage 정책·존재하지 않는 테이블 — memory 10함정), [[nativewind-rn-pitfalls]](동적 className dark: 유실·flex-1 붕괴·Link asChild 터치·중첩 accessibilityRole hydration — memory 4함정+PR#136).
- 갱신: [[rls-model]] 관련 섹션에 신규 2페이지 상호링크(재귀/poison 함정은 이미 rls-model에 존재 → MEMORY 라인은 [[rls-model]] 포인터로 압축). index 3항목 추가.
- 원천: memory/MEMORY.md 인덱스 + 각 pitfall 토픽파일(informational, staleness 비추적 → `/lint` UNVERIFIABLE 예상, 향후 마이그 파일 경로 보강 대상). raw memory/ 무수정. e2e·시드 함정 5종은 별도로 `memory/MEMORY-archive.md`로 냉이관(wiki 미졸업, 니치).

## [2026-07-15] lint | all
- 진단만(자동수정 X). stale 21·UNVERIFIABLE 9·미흡수 docs 72·모순 0·데이터갭 0·증거공백 0·dangling 링크 0.
- **신규 3페이지 후속 확정**(이전 ingest 예상대로): `secdef-hardening`·`supabase-write-pitfalls`·`nativewind-rn-pitfalls` 전부 UNVERIFIABLE(file 소스 0). 고아/저연결: `nativewind-rn-pitfalls` 콘텐츠 백링크 **0**, `supabase-write-pitfalls` **1**(rls-model만) — 인바운드 보강 필요. `secdef-hardening`은 2(rls-model+supabase-write).
- stale top: `data-flow`(소스 4건 변경)·`order-sheet-form-contract`/`job-posting-kiosk-order-sheet`(orderSheet.schema·mappers 2026-07-15 변경)·`enum-divergence`(jobPosting.schema)·`knip-signal-hygiene`(package.json)·CLAUDE.md 파생(layers·roles·overview·data-flow). 자동수정 X — /ingest 승인 대기.
- 조치 후보=① 신규 3페이지에 repo 파일경로 sources 보강(UNVERIFIABLE 해소) ② 신규 2페이지 인바운드 백링크 추가 ③ 활성 stale(order-sheet 계열) /ingest 재반영.

## [2026-07-16] ingest | lint 조치 3 — 활성 stale 재sync (order-sheet 폼 계약 확장 + 3페이지 재확인)
- **order-sheet-form-contract**: §6 신설(`scheduleGroups` 그룹화 일정·`roleSalaries` 커버리지 refine·by_role `defaultSalary`=활성 최저값 CEO-1). sources+`roleSalaries.ts`·PR#252/#253. #253/#252/#257이 폼 계약을 확장 → 실제 내용 갭 해소.
- **enum-divergence**: 2026-07 필터 개편(#250/#251/#254=지역 택소노미·salary_*_max·역할필터)이 additive임을 재확인, `POSTING_STATUS_VALUES` SSOT 라인 25/115/504로 갱신(enum 발산 규칙 불변).
- **knip-signal-hygiene**: `knip:gate --max-issues=2344` 현행 확인. **job-posting-kiosk-order-sheet**(source): 후속 #252/#253/#257 범위 밖 포인터 추가.
- updated 전부 2026-07-16. 검증: check-staleness → 4페이지 STALE 제거 확인. 미처리=CLAUDE.md 파생 stale(data-flow·layers·roles·overview) 별도 패스.

## [2026-07-16] ingest | CLAUDE.md 파생 stale 4종 재sync — data-flow/layers 지갑 드리프트 교정
- **실제 드리프트 적발**: data-flow·layers가 삭제된 `walletService.ts`/`WalletRepository.ts`/`get_wallet_summary`/`create_job_posting_with_payment_atomically`(지갑/IAP 제거 #196~206)를 여전히 인용 중 — `check-staleness`는 **삭제된 소스를 못 잡는 blind spot**(git mtime 기반), grep 실측으로 적발.
- **data-flow**: 흐름2(지갑 요약)·흐름3(유료 게시) → 현행 무결제 `createSinglePosting`→`createWithTransaction`→`insert` 단일 경로로 재작성 + "제거된 흐름" note. 트리거 SSOT=baseline(`20260710000002`), 원 마이그는 archive/. 관련 revenue-model→[[wallet-iap-removal]].
- **layers**: Service→Repository 예시·에러패턴을 `jobManagementService`/`jobService`+`serviceErrorHandler.ts`로 교체(sources 정리).
- **roles·overview**: CLAUDE.md 최근 변경(#240)은 하네스/오케스트레이션 — 역할·아키텍처·스택 불변 확인 → `updated`만 갱신.
- 검증: check-staleness → 4페이지 STALE 제거. 활성 stale 0.
## [2026-07-17] ingest | 7일 머지(07-10~17, 33건) 졸업 — 주문서 통일·필터 3축·전체 정리·Alert 웹 no-op·ops S1 개방
sources 4 신설: order-sheet-unification(#261+#252/#253, conditions patch 계약·레거시 30파일 은퇴)·jobs-filter-3axis(#250/#251/#254/#257, 277 slug 택소노미·쿼리압축)·codebase-cleanup-2026-07(#263+#239, 버그8종·−3,464줄·전수 grep 프로토콜)·alert-web-noop(#264, rn-web Alert 완전 no-op+ESLint 강제). decisions 3 갱신: order-sheet-form-contract §7 patch-conditions·§8 단일경로/은퇴, whitelist-silent-drop 실증 3→4회(#261 patch 변형), nativewind-rn-pitfalls 5함정(Alert no-op). architecture/ops-engine S1 전면 개방 섹션(anon SECDEF=2 불변 코드검증·배포순서 BLOCKING). index 갱신(sources 4행+decisions 2행+ops-engine행). 작성=opus 에이전트 4기 병렬, 메인(fable) 검증=인용 경로 실존·mappers.ts:303/:397 conditions ?? {}·eslint.config.js Alert 가드·S1 마이그 7개 실측. 출처 PR#239~#265·memory 토픽 7종.

## [2026-07-19] ingest | 좌석 기준 filled_positions 전환 + E2E 시드 낙오 (PR#269→#275)
sources 1 신설: **seat-basis-e2e-seed-drift** — `filled_positions` 유지 주체가 applications 트리거→work_logs 좌석 트리거(`fn_sync_filled_positions_seat`)로, 전이는 job_postings BEFORE 트리거(`fn_recalc_total_and_capacity`) 단일 지점으로 이관(PR#269). `cancellation-lifecycle.spec.ts` 시드가 구 계약(applications 직접 INSERT, work_logs 0건)에 묶여 낙오 → 07-17~19 전 브랜치 P0 red. 회귀 브래킷=마지막 성공 `07-17T12:29Z`↔#269 머지 `16:15Z`↔첫 실패 `18:08Z`(사이 성공 0건). decisions 1 신설: **test-seed-contract-drift** — 계약 소유권 이관 시 단언 테스트 전수 스캔·시드의 RPC 우회 취약성·**red보다 vacuous green 우선 의심**(`:313`/`:434` 복원 단언 2건이 전제 미성립으로 공허하게 통과 중이었음)·수정 후 비-공허성 red-green 증명 의무·사전조건 단언을 남기는 설계. decisions 1 교정: **capacity-full** M2/M3가 구 주체(applications 트리거·cancel RPC 재개 분기)를 서술하던 **모순 해소** — 담당 주체 이관표 추가, M3 재개 분기 삭제 사실 반영. index 갱신(sources 1행+decisions 1행+capacity-full 경고). 판정 근거=prod 실측 4갈래(prosrc filled 쓰기 0·불변식 mismatch 0·pgTAP 11/11·prod↔로컬 함수 5종 md5 일치) → **테스트 노후화이지 라이브 결함 아님**. 출처 PR#269·PR#275(master `9cfec82db`).

## [2026-07-19] ingest | 머지 6건 일괄 졸업 (#267·#268·#271·#273·#276·#277) — MEMORY.md 예산 초과 대응
sources 6 신설: **grid-order-sheet-security-hardening**(#267, 4축 리뷰 HIGH2=RPC NULL `owner_id` fail-open 라이브 노출·대회 자체승인, prod 마이그 8/8·advisor 0 ERROR, squash `3dcb1d9`)·**jpc-rls-stale-guc**(#277, `auth.uid()`는 singular GUC 우선·`get_my_role()`은 plural만 → 인라인 JWT 주입이 남긴 stale singular로 역할게이트는 통과하는데 owner 바인딩만 42501, 하네스 결함·prod 무영향)·**jobposting-timestamp-type-honesty**(#268, 뿌리=공용 `BaseDocument` → `BaseDocument<T=Date>` 제네릭화로 형제 13종 무영향+런타임 string 도메인만 졸업)·**overnight-worktime-ssot**(#271, 자정 넘는 근무 SSOT 3입력+3표시 수렴·음수 `work_duration` 차단, 클라 전용)·**nickname-search-unification**(#273, 전화검색 E.164 vs 010 포맷버그로 100% 실패 → 닉네임 prefix 통일·구 RPC 2종 DROP·prod 마이그 6)·**home-dashboard-removal**(#276, 위젯이 `cancellation_requested` 딥링크 결함을 가리고 있어 선행 수정 필요·삭제된 래퍼 describe에 얹힌 회귀가드 동반소실).
decisions 2 신설: **secdef-replace-search-path-loss**(`CREATE OR REPLACE`는 DDL 미기재 속성을 원본형으로 되돌림 → `check_rate_limit` 재정의가 `20260711100000`의 pg_temp 일괄보정을 삭제, CI parity test 7이 검거. "STABLE이면 중첩 DML 거부"는 거짓 — read-only 강제는 함수 자신의 `provolatile` 기준이고 전파되지 않음)·**type-honesty-runtime-vs-declared**(zod 경계가 정규화하는데 인터페이스가 이전 형태를 선언 → TS가 영원히 못 잡는 거짓말, 도메인별 런타임 진실이 다름).
decisions 3 갱신: **wallet-pgtap-caller-binding** — `auth.uid()` 의존 강화가 pgTAP 하네스를 깨뜨리는 **2회 재발 클래스**로 일반화(1회차 미주입 #195→#198, 2회차 stale singular #267→#277) + 테스트 JWT 주입 헬퍼 단일경로 규칙·하네스 vs 운영 결함 판별법 추가. **secdef-hardening** — 규칙3 NULL fail-open 2회차 실증(#267 HIGH) 추가 + "재정의는 별개 문제" 절 신설. **worktime-ssot** — duration 축 확장(#271) + 서버 클램프 부재 리스크 명시.
index 갱신(sources 6행+decisions 2행+wallet-pgtap 재작성). 작성=opus 에이전트 5기 병렬 + 메인이 #277 직접 집필·중앙 통합. 검증=신규 8페이지 frontmatter 5/5·dangling 링크 0·인용 repo 경로 133개 중 신규분 전건 실재(미실재 8건은 전부 기존 페이지의 baseline squash 후유증, /lint 후속). MEMORY.md 17,987자→13,985자(예산 14,000 달성), 냉이력 8건 MEMORY-archive.md 이관.
## [2026-07-23] note | 주문서 미설정 항목 연쇄 입력 — 확인 시 다음 미설정 시트로 이어감

공고작성 주문서에서 미설정 항목의 `확인`을 누르면 목록으로 돌아가지 않고 다음 미설정 항목 시트로 이어진다. 순회는 `nextUnsetRowAfter`(current 다음부터 순환, 제자리 복귀 시 null)로 분리해 무한 재오픈을 구조적으로 차단했고, 전환 연출은 `SheetChainContext`(`src/components/ui/`)로 `SheetModal`에만 전달해 시트 컴포넌트 12개를 건드리지 않았다.

핵심 함정 3건:
- 주문서 시트는 조건부 렌더라 `visible=false` 경로를 타지 않고 즉시 언마운트된다 — exit 애니메이션이 없으므로 전환 대기(`SHEET_CHAIN_SWAP_MS=180`)는 시각 대기가 아니라 iOS 네이티브 모달 겹침 회피용이다.
- **시트 13종 중 `ScheduleDatesSheet`만 `SheetModal`이 아니라 `DatePickerModal`(`ui/Modal`) 래핑**이라 `onEntered` 통지 주체가 없다. 딤 인수인계를 `SheetModal`에만 걸면 날짜 시트 경로에서 딤이 영구 잔존한다(확인·취소 어느 쪽으로도 안 걷힘). 래퍼가 다른 시트를 Context 계약에서 빠뜨리면 같은 클래스가 재발한다.
- `closeSheet`의 딤 해제는 **예약 존재로 분기해야 한다** — 모든 시트가 `onConfirm` 직후 `onClose`를 호출하므로, 무조건 해제하면 `confirmRow`가 방금 켠 딤이 꺼져 번쩍임이 복귀한다.

테스트 함정: 예약 취소 시 딤 해제를 검증하려고 `SheetModal` 계열 시트를 탭하면, 그 시트의 `onEntered`가 딤을 대신 걷어 **가드를 제거해도 green**이 된다(프로덕션 `onShow`도 동일 마스킹 — mock 아티팩트 아님). `clearPendingSwap`이 유일한 해제 주체인 경로(그룹 삭제·일정 추가·언마운트)로 검증해야 한다.

후속 함정 2건 (#307·#308):
- **딤/스크림은 대상 컴포넌트 내부가 아니라 "커버해야 할 형제 트리의 최상위(호스트)"에서 렌더해야 한다** — `OrderSheetScreen` 내부 absolute-fill 딤은 `SafeAreaView`의 형제인 `StackHeader`·`VenueSelectChips`를 못 덮어 스왑 갭 동안 상단 띠가 번쩍였다. 해법은 콜백 위임(`onChainSwappingChange`) + 호스트 렌더(`OrderSheetChainScrim`, 非Modal View라 중첩 RN Modal 무위험). 이때 위임 콜백은 **안정 콜백 필수** — inline arrow면 useCallback deps 체인을 타고 cleanup-only effect가 재실행되어 대기 스왑 예약이 조기 취소된다(연쇄 침묵사).
- **잠긴/무효 행은 연쇄 순회에서 그룹 불문 `skipKeys`로 제외해야 한다** — 그룹 스코프(`coveredKeys`)만으로 거르면 확정 지원자 잠금 상태에서 연쇄가 잠긴 행을 타깃해 조기 종료·유령 경고가 발생한다(#307).

## [2026-07-24] ingest | 인원카운트 하루 기준 표시 통일 (PR#309)
- 신규: `sources/headcount-daily-basis-display`(출하 기록+교훈 4종) · `decisions/headcount-daily-basis`(표시 계약: 분자=일별 max·마감=대기 지원·hydrate 키 단일 소스)
- 갱신: `decisions/capacity-full` 관련 링크(표시 마감 vs 공고 상태 마감 층위 구분 — 모순 아님 명시) · index 2줄
- memory 졸업: project_headcount_daily_display_20260723 → MEMORY.md 포인터 압축(잔여=실기기 QA·배포)

## [2026-07-24] ingest | ops 콘솔 리디자인 + 블라인드 프리셋 (PR#313)

## [2026-07-25] note | 내정보 화면 정리 + 동의정보 정합성 (PR#321 머지 `14def4e40`) — 🎓 ingest 후보
- **결함**: 가입 EF `verify-and-save-portone-profile`이 `user_consents`의 **존재하지 않는 컬럼**(terms_of_service/privacy_policy/marketing)에 upsert하고 반환 에러를 확인하지 않아, 가입 때마다 조용히 전건 실패(prod 0행 실측). `users.terms/privacy/marketing_agreed`도 미기록 → 내정보 '동의 정보' 전원 미동의 표시.
- **수정**: EF가 `users.*_agreed` 저장 + `user_consents` 행 단위(consent_type) 원장 upsert(onConflict `user_id,consent_type`, 실패 시 CRITICAL 로그). 마이그 `20260725014644`: uq 인덱스 + 기존 사용자 terms/privacy 백필(third_party_agreed 근거, 4→20). UI 정리(닉네임 수정·내보내기 버튼 제거+데드코드 체인).
- **🎓 졸업 후보 교훈**(Supabase 쓰기 함정 계열, wiki `decisions/supabase-write-pitfalls` 편입 검토): ①Supabase upsert는 존재하지 않는 컬럼/스키마 불일치를 반환 에러로 주는데 미확인 시 침묵 실패 — **EF의 모든 DB 쓰기는 error 확인+가시 로깅 필수**. ②표시 소스와 원장(user_consents) 이중 기록의 drift — 설정 토글이 원장 미경유(후속 MEDIUM). ③`user_consents`는 self UPDATE RLS 정책 부재로 클라 직접 upsert의 on-conflict UPDATE가 막힘 → 원장 경유는 SECDEF RPC 필요.
- **잔여**: 실기기 QA(동의 표시·신규가입 원장 3행)·마케팅 토글 원장 후속.
- 신규: `sources/ops-console-redesign`(출하 기록+교훈 5종: RNW pointerEvents 드롭·Pressable 중첩 재발·RNModal+gorhom z-순서·워크트리 expo EMFILE·parity 가드 누락 파급)
- 갱신: `decisions/nativewind-rn-pitfalls`(함정 3종 추가 — pointerEvents는 prop 필수·행/액션 형제 분리·시트 visible 게이트) · `decisions/prod-parity-baseline`(#311 갱신 누락 실패 사례 — red는 머지 후 master에서 터짐) · `architecture/ops-engine`(콘솔 리디자인+프리셋 절, 잔여=서버 levels 상한) · index 3줄
- memory 졸업 예정: project_ops_console_redesign_20260723 → MEMORY.md 포인터 압축(잔여=실기기 QA 7항목·서버 levels 상한)

## [2026-07-25] note | 머지 이력 공백 메움 (#314~#332)

`#313` 이후 로그가 끊겨 있어 19개 PR을 소급 기록한다. 상세는 `CHANGELOG.md` [Unreleased] 참조.

- **유지보수·ops**: #314 전체 유지보수 감사(중복 통합·순환 차단·SDK55 의존성) · #315 wiki 졸업(ops 콘솔) · #316 블라인드 levels 서버 상한 100 · #317 지점 역할별 급여 JIT 후속
- **출하·정리**: #318 Apple 로그인 하드 OFF · #319 근무표·정산 버그 6종 + 급여 SECDEF RPC · #320 조건 시트 프리셋 칩 · #321 내정보 정리+동의정합성
- **인증·권한 계열(4연쇄)**: #322 구인자 승인 role 즉시 갱신 · #325 웹 Enter 로그인 + 회원가입 순서 재설계 + 지원 본인인증 게이트 · #327 관리자 role 즉시 반영 + 구인자 본인인증 서버 게이트 + **identity 셀프승격 차단(보안 HIGH)** · #330 순서 재배치 부작용인 본인인증 만료 dead-end 복구
- **인프라·수정**: #323 신규 설치 첫 세션 OTA 즉시 적용 · #324 이미지 업로드 0바이트 회귀(RN fetch(file://)→Blob=0바이트) · #326 관리자 문의 응답 RPC 부재(PGRST202) · #328 중복 알림 트리거 3쌍 정리 + 알림설정 화면 분리 + 모두삭제 · #329 jpc 픽스처 JWT 잔류로 red된 DB Tests 복구 · #331 설정 E2E 마케팅 토글 회귀 · #332 시트·모달 푸터 잘림 오버플로 전면 수정

## [2026-07-25] ingest | E2E 회귀 3-PR 전파 + parity-smoke 첫 실가동

- 신규: `decisions/e2e-gate-absence`(요구 체크 부재가 회귀를 전파시킨 구조 + 승격 선결과제)
- 갱신: `decisions/prod-parity-baseline`(주간 parity-smoke 첫 실가동 실측 + Session pooler 접속 함정 2종) · index 2줄
- memory: `project_rls_secdef_audit_20260710` 잔여 해소 반영 · master E2E red 줄을 "원인 확정·수정 머지"로 정정 · `pitfall_e2e_spec_stale_after_screen_split` 신설

핵심 실측 2건:
- **E2E가 required check가 아니어서 결정적 회귀가 3개 PR을 타고 전파**됐다. #328이 마케팅·푸시 토글을 `settings/index.tsx`→`settings/notifications.tsx`로 분리하며 E2E spec을 안 옮겼고, `settings.spec.ts:73`이 retry 포함 60초 타임아웃으로 죽은 채 #327·#328·#330이 전부 머지됐다(#331에서 해소). `gh api .../branches/master/protection` 실측 결과 **master에는 branch protection이 아예 없다** — E2E뿐 아니라 ci.yml의 quality-gate·test조차 required가 아니다.
- **주간 파리티 감시가 07-11 설계 이래 처음으로 실제 가동**됐다. `PROD_DB_URL` 미설정으로 매주 skip을 성공 처리하고 있었고(마지막 07-20 실행 로그가 skip notice), 시크릿 등록 후 첫 실측이 `repo 기대값 180/111/0 == prod 180/111/0`으로 일치. 드리프트는 없었으나 감시 자체가 꺼져 있던 기간에 prod로 마이그레이션 12건이 직접 들어갔다는 점이 위험 신호다.
