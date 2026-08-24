# Wiki Index

> 전 위키 페이지 카탈로그. 질문 답변 시 여기부터 읽고 페이지로 드릴다운.
> 규약: [[AGENTS]] · 시작점: [[overview]]

## architecture
- [[layers]] — Presentation→Hooks→Service→Repository→Supabase 단방향 5레이어
- [[data-flow]] — 대표 데이터 흐름(읽기 TanStack Query 예외 + 쓰기 Service 경유)
- [[rls-model]] — RLS 정책 3계층 + 재귀/SECDEF 함정 3건
- [[ops-engine]] — 대회 운영 엔진(ops 1a~1f + S1 전면 개방·대회사 레일 + 콘솔 리디자인·블라인드 프리셋): 이벤트 스파인·SECDEF 쓰기 경계·anon SECDEF 2 불변·서버앵커 클럭·진입 허브/악용 방어/TV 프리셋 (PR#207~#265·#313)

## decisions
- [[enum-divergence]] — enum 발산 → 읽기 레코드 증발 방지 규칙 (3회 재발 클래스)
- [[worktime-ssot]] — 근무시간 표시 SSOT(WorkTimeDisplay) 우회 금지
- [[capacity-full]] — 공고 자동마감 capacity_full + dead counter 제거 (⚠️PR#269로 담당 주체 이관: filled=work_logs 좌석 트리거·전이=job_postings BEFORE 트리거)
- [[test-seed-contract-drift]] — DB 계약 소유권 이관 시 테스트 시드 전수 점검: red보다 **vacuous green**이 위험(사후단언만 있으면 시드가 죽어도 조용) + 수정 후 비-공허성 red-green 증명 (PR#269→#275)
- [[test-db-grants]] — 테스트 DB는 명시 GRANT + setup-cli 버전 pin (기본 default-privilege 의존 금지)
- [[wallet-pgtap-caller-binding]] — `auth.uid()` 의존 강화가 pgTAP 하네스를 깨뜨리는 **2회 재발 클래스**: 1회차=JWT 미주입(PR#195→#198), 2회차=인라인 주입이 남긴 stale singular GUC(PR#267→#277). 테스트 JWT 주입은 헬퍼 단일 경로
- [[knip-signal-hygiene]] — knip 신호 정화: 래칫 게이트 + 안전 삭제 프로토콜(미사용≠죽음 ~65% 보존, tsc 오라클, 배럴 협응삭제, stale-base 안전망) (PR#231)
- [[migration-timestamp-collision]] — 병렬 세션이 같은 마이그 타임스탬프 → 병합 후 db reset `schema_migrations_pkey` 23505, 신규분 리네임 해소. **2026-08-07 하루에 2회 재발** → 확인 시점을 "브랜치 딸 때"가 아니라 **머지 직전**으로 이동(빈 슬롯이 그 사이 채워진다). prod 는 MCP-apply라 무증상이지만 **양방향 드리프트는 별개로 존재**(PR#436)
- [[prod-parity-baseline]] — prod가 진실: baseline squash 채택 이유(함수163vs142·정책103vs173 발산) + 가드 2중 + MCP 핫픽스=같은 PR 가드 갱신 규율 (PR#241). **2026-07-25 parity-smoke 첫 실가동**(그전엔 시크릿 미설정으로 skip을 success 처리 — fail-open 가드의 침묵) + Session pooler 접속 함정 2종
- [[e2e-gate-absence]] — E2E가 required check가 아니라 결정적 회귀가 3 PR 전파(#327→#328 유입→#330→#331 해소). 그 사이 방어=화면 분리를 지키는 "진입 경로 케이스" + 죽은 로케이터 제거. **✅2026-08-07 1단계 착지(PR#432)**: branch protection 활성화, required=`Quality Gate`·`E2E Gate`. 🔑`paths` 필터 잡을 required 로 걸면 **영구 pending 데드락** → required 는 `if: always()` **애그리게이터**에 건다(`skipped`=성공). 켜는 순간 기존 열린 PR 전부 BLOCKED
- [[error-vs-empty-state]] — 조회 실패를 빈 배열로 그리면 화면이 **성공을 가장한 안내**를 띄운다(8화면, PR#434). "모든 평가를 완료했어요"→평가 기회 소멸 · "내역 없음"→중복 신청. 🔑근본 원인은 화면이 아니라 **error·refetch 를 반환조차 않던 훅** · error 합성은 `enabled` 와 대칭 · 에러를 **세우는 경로만큼 지우는 경로**도 필요
- [[server-validation-completeness]] — 서버 검증이 길이·XSS·형식·enum 을 다 보면서 **관계(퇴근≥출근)만** 안 봤다(PR#433). 하류의 `GREATEST(0,…)` 가 음수를 접어 **₩0 정산 확정**까지 갔다 — 방어가 오류를 **정상값으로 세탁**한다. 🔑병합 후 최종값으로 판정 · 같음(=)도 거부 · 한쪽 NULL 이면 판정 안 함
- [[local-only-seed-reached-prod]] — 공개 레포 평문 비밀번호로 **prod admin 이 열려 있었다**(PR#427·#428). 🔑결함은 "평문이 레포에 있다"가 아니라 **로컬 전용 시드가 prod 에 적용됐다** — 레포에서 지워도 계정은 산다. 회전 필수 · **계정 수는 prod 에서 센다**(문서 4개 vs 실제 5개)
- [[rollout-instrumentation-gap]] — "롤아웃 확인 후에 한다"고 못박은 작업(#407 REVOKE)이 **판정 수단 부재로 영구 대기** 중이다. `expo-insights` 미설치·Sentry `release`/`dist` 미태깅·앱 버전 서버 기록 0건이고, prod 트래픽 `users 27` 이라 **기다려서 로그 쌓는 방식이 성립하지 않는다**. 🔑게이트를 걸 때 **그 게이트를 열 열쇠도 같이** 만들 것 · UNMEASURED 를 1급 결과로 · 함께 prod 마이그를 **파일 바이트 그대로** 싣는 워크플로우(PR#437)
- [[whitelist-silent-drop]] — "화이트리스트 조용한 증발" 재발 클래스(4회 실증: #194 region·#243 filled counts·conditions 9지점·#261 conditions patch) — 신규 필드는 지점 전수+읽기 방향 테스트+표시 UI 별도 확인
- [[order-sheet-form-contract]] — 주문서 폼 계약: 3제네릭 zodResolver(z.input/z.output)·canonical 매퍼 등가성·Design B(단일화면 카드+시트)·#244 지연전환·중첩Modal embedded·update=patch conditions 상시 전달·전 타입 단일 경로+레거시 은퇴 (PR#246/#247/#261)
- [[ops-no-money-flow]] — ops 엔진 돈-흐름 비관여 경계: 프라이즈 계산만, 바이인 결제·시드권 발급·상금 정산 금지 (관광진흥법 카지노업 유사행위 리스크)
- [[secdef-hardening]] — SECURITY DEFINER 함수 하드닝 **4규칙**: anon EXECUTE 명시 REVOKE·search_path에 extensions·plpgsql NULL fail-open 차단·**트리거 전용 함수는 PUBLIC/anon/authenticated 전부 회수**(PR#455 이탈 실증 — 권한상승은 아니나 규약 이탈+PostgREST 노출. 🚨게이트를 못 넘은 이유=회귀 테스트가 anon 만 단언) (memory 졸업, PR#195)
- [[deploy-channel-skew]] — 배포 채널 3속도(서버·웹=즉시 / 네이티브=스토어 빌드까지 불가)라 **서버를 항상 먼저** 내야 한다. 어겼을 때의 실사고=#441(마이그 미적용 → `archived_at` 42703 으로 ops 전면 파손, 🔑기능 플래그는 라우트 게이트가 아니라 안 막아준다). 그 유일한 방어선인 **버전 게이트는 3계층 모두 죽어 있다** — 구현 부재가 아니라 배선 한 줄+서버 값 정지
- [[secdef-replace-search-path-loss]] — 기존 함수 `CREATE OR REPLACE` 시 DDL에 안 적은 속성(`search_path`·volatility)이 원본형으로 되돌아감 → 재정의 전 `proconfig`/`provolatile` 실측 필수. "STABLE이면 중첩 DML 거부"는 거짓 (PR#273). **확장(PR#360)**: 재정의 베이스는 반드시 `grep -l "CREATE OR REPLACE FUNCTION <name>" migrations/*.sql | sort | tail -1` 이 가리키는 **최신 정의** — 낡은 판을 복사하면 그 사이 개선이 통째로 되돌아간 채 prod 까지 간다
- [[type-honesty-runtime-vs-declared]] — 선언 타입 ≠ 런타임 진실: zod 경계가 정규화하는데 인터페이스가 이전 형태를 선언 → TS가 영원히 못 잡는 거짓말. 제네릭 기본값으로 도메인별 졸업 (PR#268)
- [[supabase-write-pitfalls]] — Supabase 쓰기 경로 함정 종합: 카운터 트리거·realtime publication·RPC 예외 매핑·시드 zod·storage 정책·존재하지 않는 테이블 (memory 졸업)
- [[nativewind-rn-pitfalls]] — NativeWind/RN UI 함정: 동적 className dark: 유실·flex-1 붕괴·Link asChild 터치 유실·중첩 Pressable/role hydration·style pointerEvents 드롭(웹 딤)·RNModal+gorhom z-순서 (memory 졸업, PR#136·#313)
- [[semantic-merge-conflicts]] — 병합은 텍스트가 아니라 **의미**에서 충돌한다: 충돌 0 ≠ 안전. 실증 5종(같은 결함 양쪽 수정·상대 신규 테스트 사망·리네임+삭제·래칫 병합 산술·SQL 전용 PR 이 클라 상태 매핑 흔듦) + 종료조건=재통합 후 전체검증 green (PR#356·#357·#360)
- [[persisted-cache-shape-drift]] — 지속 캐시는 OTA 를 건너 살아남는다: 코드만 갈리고 기기의 구 payload 는 그대로 → 신규 필드가 `undefined` 로 화면까지. 버전 승격 금지(안전망 폐기), **정규화 경계에서 필드 전량 기본값** (PR#356→#362). ⚠️`useApplications`·`useJobDetail` 은 아직 정규화 0
- [[headcount-daily-basis]] — 인원 표시 계약: 하루 기준 분수·분자=일별 max(통지원 전제)·마감=대기 지원 허용·hydrate 키 단일 소스(postingHydrateKeys) — capacity_full(공고 단위)과 의도된 이원화 (PR#309)
- [[vacuous-verification]] — **초록불이 "아무것도 검사하지 않았다"를 뜻할 때** 5유형(단언 미도달·구조적 0·미실행 성공·판정축 오류·도구 사각지대). 오탐이 아니라 **무음**이라 신호를 기다리면 영영 못 찾는다 → 고의로 깨뜨려 빨간불을 볼 것 (PR#474·#478·#481)
- [[knowledge-layer-budget]] — 항상-로딩 지식이 예산을 넘으면 **잘라내지 말고 계층을 분리**한다: 가지치기 6회 실패(07-19~08-10) 원인=완료분 적체(`✅` 15건). 경고는 원인을 지목해야 하고, 잘린 색인은 "없음"과 "안 보임"을 구별 못 한다

## domain
- [[roles]] — UserRole(앱권한: admin/employer/staff) vs StaffRole(직무: dealer/floor/serving)
- [[target-market]] — 홀덤펍 + 대회사 (포커룸 비타깃)
- [[revenue-model]] — **구인구직 영구 무료 · 과금은 운영 레이어**(매장 월 5만 / 대회 건당 10만 / 긴급공고 1만). 설계 확정·구현 미착수 (PR#361). 폐기된 이중통화·IAP 이력은 페이지 하단

## sources
- [[db-tests-cli-grant-drift]] — pg_prove red 근본원인: setup-cli `version:latest` 드리프트로 implicit 테이블 GRANT 소실 (PR#179/#180)
- [[e2e-cli-grant-drift]] — e2e ~96% red 같은 드리프트, pin(2.107.0)으론 미해결 → 명시 GRANT 마이그레이션이 수정 (PR#183)
- [[wallet-iap-removal]] — 지갑/IAP 수익모델 전체 제거 (구인구직엔 불필요) — ✅PR#196/#198 머지·prod 마이그·웹 배포
- [[knip-unused-export-triage]] — 미사용 export ~3000건 단계별 정리 (2951→2313, 래칫+리프 죽은코드) — ✅PR#231 머지 `c75d78add`
- [[ops-1e-staff-integration]] — 대회 스태프 슬라이스: ops_staff·공고 N:1 연결(owner)·work_logs 스냅샷 import(읽기 전용)·딜러 배정(move) — ✅PR#230 머지·prod 마이그
- [[parity-baseline-squash]] — baseline squash 실행 기록: pg_dump 함정 5종 + E2E 함정 2종(프로필 시드 소실·master 거짓 GREEN) + prod 진실 교정 — ✅PR#241
- [[userflow-audit-2026-07]] — 코어 유저플로우 실측 감사→P0~P2 전항 수정(적대검증 44% 기각·prod 재판정·postingAuthority 신설) — ✅PR#242
- [[ios-userflow-fixes]] — iOS 유저플로우 버그 8종+신고모달 승격+타이머 후속(filled counts 서브맵 함정 포함) — ✅PR#243·#244
- [[job-posting-kiosk-order-sheet]] — 공고작성 키오스크 "주문서" 개편(단일화면 카드+프리셋+conditions) — ✅PR#246 본·#247 후속(모집조건 표시+폴리시)·마이그·OTA `4193f9ab`
- [[order-sheet-unification]] — 공고작성 전 타입 주문서 단일화(S1~S4)+레거시 폼 30파일 은퇴+후속 UX(일정그룹·역할별급여·카드조건) — ✅PR#261·#252·#253 머지·서버무변경
- [[jobs-filter-3axis]] — 구인구직 필터 3축(지역 P1·역할 P2·급여 P3)+전국 3단계 택소노미(67→277 slug)+공고작성 지역 필수화 — ✅PR#250/#251/#254/#257 머지·P3만 마이그(salary_*_max)
- [[codebase-cleanup-2026-07]] — 전체 코드 정리: 버그 8종·죽은코드 −3,464줄·중복 수렴·주석 정정·"호출0"=전수 grep 프로토콜 — ✅PR#263(선행 #239 타임존 off-by-one 병기)
- [[alert-web-noop]] — rn-web Alert.alert 완전 no-op 전수 교정: confirmAction/showAlert 단일화+ESLint 강제 — ✅PR#264
- [[seat-basis-e2e-seed-drift]] — 좌석 기준 filled_positions 전환(사람→좌석·유지 주체 work_logs 트리거 이관) + E2E 시드 낙오로 P0 취소플로우 이틀간 red+vacuous green — ✅PR#269·#275 머지 `9cfec82db`(라이브 결함 아님, 4갈래 실측)
- [[grid-order-sheet-security-hardening]] — 그리드+주문서 출시전 보안 하드닝 4축 리뷰: HIGH 2(RPC NULL `owner_id` fail-open=라이브 노출·대회 자체승인)+MED2+LOW6, prod 마이그 8/8·advisor 0 ERROR — ✅PR#267 squash `3dcb1d9`
- [[jpc-rls-stale-guc]] — db-tests 이틀 red의 정체: `auth.uid()`(singular GUC 우선) vs `get_my_role()`(plural)의 비대칭 → 인라인 JWT 주입이 남긴 stale singular. 하네스 결함, prod 무영향 — ✅PR#277
- [[jobposting-timestamp-type-honesty]] — JobPosting 시간필드 `Date`→`string` 정직화: 뿌리는 공용 `BaseDocument` → 제네릭화로 형제 13종 무영향 + 런타임 string 도메인만 졸업 — ✅PR#268
- [[overnight-worktime-ssot]] — 자정 넘는 근무시간 SSOT 단일화(3입력+3표시 우회 수렴), 음수 `work_duration` 저장 차단. 클라 전용·서버 무변경 — ✅PR#271
- [[nickname-search-unification]] — 스태프·협업자 검색을 닉네임 prefix로 통일(전화 검색 E.164 vs 010 포맷버그로 100% 실패) + 서버 rate limit·구 RPC 2종 DROP — ✅PR#273·prod 마이그 6
- [[home-dashboard-removal]] — 홈 대시보드 전면 삭제(동선·중복·비용 3중 문제). 위젯이 `cancellation_requested` 딥링크 결함을 가리고 있어 선행 수정 필요 — ✅PR#276
- [[headcount-daily-basis-display]] — 인원카운트 하루 기준 표시 통일(요약 곱셈 폐기·지원화면 dead counter 주입 해소·시간 정렬·hydrate 키 공용화) + 교훈 4종(키 중복=조용한 (0/N) 회귀 등) — ✅PR#309 머지 `ceb420ac9`
- [[post-1-0-5-merge-wave]] — 1.0.5 스토어 빌드 이후 머지 웨이브 12 PR(공고 도메인 감사 W1 / 근무표·스케줄 축 / 공유 3종+모션 / 웨이브가 스스로 만든 OTA 회귀) + prod 마이그 6·네이티브 변경 0 → OTA 전량 전달 가능 · 배포 사전 검증 실측 (PR#350~#362)
- [[revenue-model-rebuild-2026-07]] — 수익모델 원점 재분석 + 운영 과금 **확정** 설계: 매칭 무료·운영 유료, 기각 후보 4종 사유, 복잡도 억제 규칙 4개(핵심=**한도 없음**). 요금 수치는 operations-billing-design 이 최신 (PR#361, 코드 0줄)
- [[ops-console-redesign]] — ops 콘솔 리디자인+블라인드 프리셋(SDD 13태스크+후속 3묶음) + 교훈 5종(RNW pointerEvents 드롭·Pressable 중첩·RNModal z-순서·워크트리 EMFILE·parity 가드 누락 파급) — ✅PR#313 머지 `b76668b5e`
- [[settlement-history-lost-update]] — 정산 수정 이력이 클라 read-modify-write 라 **무음 유실**(금액 분쟁의 유일 근거가 지워진다). 형제 2경로는 이미 닫혀 있었고 **컬럼 기준으로 세면 이 하나만** 남아 있었다. 🔑해법의 본체는 잠금이 아니라 **시그니처에서 이력 배열 인자를 없앤 것** — 검사는 우회되지만 없는 인자는 못 보낸다 — ✅PR#436 머지 `a6a59cf9c`(🔴prod 미적용)
- [[logger-sentry-web-recursion]] — 웹 Sentry 폴백 로깅이 자기를 재귀 호출해 콘솔 370만건. **E2E 만성 flake 의 진짜 원인**이었다(러너 탓으로 오해). 🚨이 레포 Jest 는 **동적 import 가 항상 reject** → "호출 0회" 단언이 통째로 **빈 통과** — ✅PR#413
- [[time-model-wave-2026-08]] — 시간 '미정' 키가 분열돼 **고정공고 정원 우회**가 열려 있었다(R0) → 센티넬은 DB 한 곳에서 정본화, 클라는 표현만(R1). 정원 0 은 "미상=통과"가 아니라 **"자리 없음=거부"**(⚠️원인 3종 중 B 는 의도적으로 열림). 편집기 3곳→한 시트·한 RPC — ✅PR#409·#410·#412·#417·#424
- [[settlement-rpc-wave-2026-08]] — 정산 축 RPC 화 웨이브. 🔑**편도 문 금지**(지급완료로 가는 문만 만들고 취소 진입점을 안 만들었다) · 판정 복제 2건 제거(⚠️M11 축 통일은 미결) · 🚨**트리거로 쓰기 채널 좁히면 기존 pgTAP 이 깨진다 — 착수 전 `supabase/tests/` 전수 grep** — ✅PR#387·#388·#393·#400·#402·#420
- [[notification-offline-contract-2026-08]] — "목록에 없으면 지운다"가 **관측 창 없이** 돌아 다른 달 예약을 침묵 취소. 창 밖은 "없는 것"이 아니라 **"모르는 것"**. 오프라인 TTL≠온라인 staleTime. 🔑알림 미등록 타입은 **증상** — 등록표를 늘리기 전에 **값의 출생**을 물어라(리팩터 회귀였다) — ✅PR#396·#397·#398·#404·#429
- [[dead-circuit-cleanup-2026-08]] — 죽은 회로 30건: **제거 14 · 완성 9**. 🔑"안 쓰인다"에는 *필요 없었다*와 *배선이 덜 끝났다*가 섞여 있어 전자로 단정하면 **미완성 기능을 영구 삭제**한다. 대표 사례=복원하지 않으면서 성공한 척하던 **거짓 Undo** — ✅PR#406·#408
- [[address-geocoding-2026-08]] — 주소 검색 결과를 **탭해도 입력 안 되던** 원인=WebView 문서에 실제 origin 미부여(무음 실패라 UI 버그로 오진). 네이티브/웹 분기 파일은 **쌍으로** 확인. 🔑카카오 `x`=경도 `y`=위도(뒤집어도 그럴듯한 위치가 나와 눈으로 못 잡는다) — ✅PR#391·#411·#419
- [[ui-device-report-2026-08]] — 실기기 UI 리포트: `RefreshControl` 을 쿼리 상태에 묶어 **유령 스피너** · `stickyHeaderIndices`+Fragment(=자식 1개로 셈) 스크롤 잠김 · **SafeArea 가드가 있었는데 vacuous** · iOS `canOpenURL` 미선언 스킴은 항상 false(빌더 테스트가 빈 통과) · **개수 비교로 사용자 조작을 판정하면 오고지** — ✅PR#422·#423·#425·#426
- [[account-withdrawal-pipeline]] — 탈퇴 요청 **0건이 "수요 없음"이 아니라 "기능 불능"**이었다. 🔑0 을 만나면 **왜 0인가**를 먼저 확인(정상 0과 이상 0은 같은 숫자, 정반대 결론) · 🚨RLS 테이블의 pgTAP 0건은 "없다"가 아니라 **"안 보인다"**일 수 있다 — ✅PR#427
- [[ops-defect7-wave-2026-08]] — ops 가 앱의 나머지와 **통합돼 있지 않았다**(offline·notification·payroll 참조 전부 0건). 오프라인 가드 44곳(🔑큐잉은 존재하지 않는 기능 — `offlineFirst`+`retry:false`) · 배정 알림에 **딥링크를 일부러 안 걸었다**(도착 화면이 RLS 로 빈 화면) · 근태 write-back 은 **새 저장소를 안 만들고** 해석기 1개+기존 RPC 위임 · UI 는 `reason==='ok'` 일 때만 열고 **일괄 버튼 금지를 테스트로 고정**(notify 트리거 3개=20명이면 60발화) — ✅PR#451~#456
- [[full-app-audit-2026-08-09]] — 41 에이전트 2라운드 감사, 확정 **60건**·반증 3. 🔑약점이 한 패턴으로 수렴: **규약이 웨이브 단위로 소급 적용되고 신규 코드·범위 밖 도메인엔 자동 전파되지 않는다**(HIGH 7 중 5). 🏷️prod 데이터가 사실상 0이라 **지금이 가장 싼 시점** · 🚨"Grep 0건" 부재증명은 **브레이스 글롭 공허 매칭** 함정을 밟았을 수 있다 · 스키마 키에 한글 넣으면 에이전트 400 즉사
- [[ops-followups-2026-08]] — 전광판·QR 링크가 **DNS 미해석 도메인**을 가리켰다(설계에서 "선택적"이던 인프라가 코드엔 전제로 박힘). 칩 입력이 realtime 재렌더마다 되돌아간 원인=**복제한 effect 관용구의 전제**(deps 인라인 객체). 🚨**카운트 가드는 숫자가 우연히 같으면 머지 충돌이 안 난다** — ✅PR#435·#438
- [[memory-live-traps-2026-08]] — MEMORY.md 「라이브 함정」 25항목 졸업 기록(2026-08-25). **무엇이 wiki 로 갔고 무엇이 인덱스에 남았는지**의 대조표 — 영속적 사실만 졸업, 현재 상태(플래그·웨이브 계약·삭제금지 자산)는 잔류
