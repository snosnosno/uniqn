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
- [[migration-timestamp-collision]] — 병렬 세션이 같은 마이그 타임스탬프 → 병합 후 db reset `schema_migrations_pkey` 23505, 신규분 리네임 해소 (MCP-apply prod는 무관)
- [[prod-parity-baseline]] — prod가 진실: baseline squash 채택 이유(함수163vs142·정책103vs173 발산) + 가드 2중 + MCP 핫픽스=같은 PR 가드 갱신 규율 (PR#241). **2026-07-25 parity-smoke 첫 실가동**(그전엔 시크릿 미설정으로 skip을 success 처리 — fail-open 가드의 침묵) + Session pooler 접속 함정 2종
- [[e2e-gate-absence]] — E2E가 required check가 아니라 결정적 회귀가 3 PR 전파(#327→#328 유입→#330→#331 해소). master에 branch protection 자체가 없음. 승격 선결과제=CI 먼저 required + 러너 경합 flake 해소. 그 사이 방어=화면 분리를 지키는 "진입 경로 케이스" + 죽은 로케이터 제거 (PR#331)
- [[whitelist-silent-drop]] — "화이트리스트 조용한 증발" 재발 클래스(4회 실증: #194 region·#243 filled counts·conditions 9지점·#261 conditions patch) — 신규 필드는 지점 전수+읽기 방향 테스트+표시 UI 별도 확인
- [[order-sheet-form-contract]] — 주문서 폼 계약: 3제네릭 zodResolver(z.input/z.output)·canonical 매퍼 등가성·Design B(단일화면 카드+시트)·#244 지연전환·중첩Modal embedded·update=patch conditions 상시 전달·전 타입 단일 경로+레거시 은퇴 (PR#246/#247/#261)
- [[ops-no-money-flow]] — ops 엔진 돈-흐름 비관여 경계: 프라이즈 계산만, 바이인 결제·시드권 발급·상금 정산 금지 (관광진흥법 카지노업 유사행위 리스크)
- [[secdef-hardening]] — SECURITY DEFINER 함수 하드닝 3규칙: anon EXECUTE 명시 REVOKE·search_path에 extensions·plpgsql NULL fail-open 차단 (memory 졸업, PR#195)
- [[secdef-replace-search-path-loss]] — 기존 함수 `CREATE OR REPLACE` 시 DDL에 안 적은 속성(`search_path`·volatility)이 원본형으로 되돌아감 → 재정의 전 `proconfig`/`provolatile` 실측 필수. "STABLE이면 중첩 DML 거부"는 거짓 (PR#273)
- [[type-honesty-runtime-vs-declared]] — 선언 타입 ≠ 런타임 진실: zod 경계가 정규화하는데 인터페이스가 이전 형태를 선언 → TS가 영원히 못 잡는 거짓말. 제네릭 기본값으로 도메인별 졸업 (PR#268)
- [[supabase-write-pitfalls]] — Supabase 쓰기 경로 함정 종합: 카운터 트리거·realtime publication·RPC 예외 매핑·시드 zod·storage 정책·존재하지 않는 테이블 (memory 졸업)
- [[nativewind-rn-pitfalls]] — NativeWind/RN UI 함정: 동적 className dark: 유실·flex-1 붕괴·Link asChild 터치 유실·중첩 Pressable/role hydration·style pointerEvents 드롭(웹 딤)·RNModal+gorhom z-순서 (memory 졸업, PR#136·#313)
- [[headcount-daily-basis]] — 인원 표시 계약: 하루 기준 분수·분자=일별 max(통지원 전제)·마감=대기 지원 허용·hydrate 키 단일 소스(postingHydrateKeys) — capacity_full(공고 단위)과 의도된 이원화 (PR#309)

## domain
- [[roles]] — UserRole(앱권한: admin/employer/staff) vs StaffRole(직무: dealer/floor/serving)
- [[target-market]] — 홀덤펍 + 대회사 (포커룸 비타깃)
- [[revenue-model]] — ⚠️ 이중통화(하트·다이아)·IAP — **전체 제거 완료**(PR#196 머지 `967e9f5e2`, [[wallet-iap-removal]])

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
- [[ops-console-redesign]] — ops 콘솔 리디자인+블라인드 프리셋(SDD 13태스크+후속 3묶음) + 교훈 5종(RNW pointerEvents 드롭·Pressable 중첩·RNModal z-순서·워크트리 EMFILE·parity 가드 누락 파급) — ✅PR#313 머지 `b76668b5e`
