# 핸드오프 — ops 전면 개방 S1 잔여분 SDD 실행 (다음 세션 메인 프롬프트)

> 2026-07-17 세션에서 S1의 서버 전량 + 클라 C계열/B2/D1 대부분을 구현·검증 완료.
> **이 세션의 범위 = 잔여분(A1~A4 클라·C4 클라·B1·B3·D2)을 SDD로 완주 + 검증 게이트 + 리뷰 + 커밋 정리.**
> 모델 라우팅: **구현 태스크는 opus/sonnet 서브에이전트 디스패치, 설계 판단·리뷰·최종 검증 판정만 fable.**

---

## 메인 프롬프트 (새 세션에 그대로 붙여넣기)

ops 전면 개방 S1 잔여분을 `superpowers:subagent-driven-development`(SDD)로 끝까지 구현해줘.

**작업 위치**: 워크트리 `C:\Users\user\Desktop\T-HOLDEM-ops-s1` 브랜치 `feat/ops-open-access-s1` (WIP 커밋에 지금까지 전부 스냅샷됨. node_modules 는 메인 레포 junction, `.env*` 복사 완료, 로컬 Supabase 스택 기동+`db reset` 적용 상태 — Docker Desktop 꺼져 있으면 먼저 기동).

**필독**: ① 이 문서 전체(완료 내역·잔여 태스크·함정) ② C6 스펙 `docs/superpowers/specs/2026-07-17-ops-tv-monitor-preset-slots-design.md`(T1~T6) ③ 설계 `docs/planning/2026-07-16-ops-open-access-monetization-design.md` §5-S1·§9·§12 ④ 원 핸드오프 `docs/planning/2026-07-16-ops-open-access-s1-implementation-handoff.md`

**모델 라우팅(핵심)**:
- 아래 잔여 태스크 1~8 = 구현 서브에이전트 디스패치. 태스크에 표기된 모델(`[opus]`/`[sonnet]`) 사용
- 각 태스크 완료 후 스펙 리뷰/코드 리뷰 판정 = `model: "fable"` (code-reviewer)
- 최종 검증 게이트 판정·보고 = fable(주 세션이 fable이면 직접)
- 디스패치 프롬프트에 금지사항 명시: `mcp__supabase__*` 직접 호출 금지 · **기존 마이그레이션 수정 금지** · PROD 우회 금지 · push/PR/OTA 금지 · S2/S3 착수 금지

---

## 완료 내역 (이 브랜치 WIP 커밋에 포함 — 재작업 금지)

### 서버 (마이그레이션 7개, 전부 로컬 `db reset` 적용 확인)
| 파일 | 내용 |
|---|---|
| `20260717090000_ops_s1_event_types.sql` | enum 3종 추가(monitor_config_set·prize_paid·prize_paid_undone) — ADD VALUE 는 사용 함수와 파일 분리(함정 준수) |
| `20260717090100_ops_s1_monitor_config_snapshot_break.sql` | `ops_tournaments.monitor_config` jsonb + `ops_set_monitor_config`(owner 전용·actor 바인딩·화이트리스트 검증 P0001·**알려진 키만 재조립 저장**) + `ops_get_monitor_snapshot`/`ops_get_player_view` CREATE OR REPLACE(**nextBreak**(레벨 시작 앵커 기준 누적 초)·**payouts 상위5**·**monitorConfig** 추가, 기존 키 전부 보존) |
| `20260717090200_ops_s1_duplicate_tournament.sql` | `ops_duplicate_tournament`(owner 전용) — 설정 전량+블라인드 구조+monitor_config 복사. **미복사**: job_posting_id·monitor_token·ops_prizes(절대금액이라 엔트리 종속)·참가자/테이블/좌석. 클럭/스탯 행은 트리거 자동 생성. 이벤트는 기존 tournament_created 재사용(payload.duplicated_from) |
| `20260717090300_ops_s1_prize_paid.sql` | `ops_participants.prize_paid_at` + `ops_set_prize_paid`(is_ops_member·멱등·undo=NULL 복귀·상금 미배정 거부 OPS_PRIZE_NOT_ASSIGNED) |
| `20260717090400_ops_s1_public_reports.sql` | `ops_public_reports` 테이블 — **anon RPC 대신 직접 RLS INSERT**(=2 계약 보존, board_reports 선례). BEFORE INSERT 가드 트리거가 토큰→대회 해석(무효 거부)·토큰 8자 절단 저장·대회당 시간당 5건 rate limit·reporter 캐노니컬라이즈. SELECT/UPDATE=admin 전용 |
| `20260717090500_ops_s1_funnel_events.sql` | `analytics_events` — 퍼널 6종 화이트리스트 CHECK(ops_hub_impression/ops_hub_entered/ops_tournament_created/ops_public_view_opened/ops_claim_converted/ops_limit_reached). anon 은 public_view_opened+props.tk 필수, 가드 트리거 rate limit(인증 240/h·anon tk당 120/h), user_id 는 트리거가 auth.uid() 강제 |
| `20260717090600_ops_s1_hub_flag.sql` | `app_config` `ops_hub_enabled` = `{"enabled": false}` 시드(S9 롤아웃: OTA OFF → 플래그 ON) |

### pgTAP (실행 증거 있음)
- 신규 `supabase/tests/ops_open_access_s1.test.sql` **60/60 GREEN**
- **red-green 실측**: ops_set_monitor_config 의 anon REVOKE 를 로컬서 일시 GRANT → 테스트 1·7·8 정확히 RED → REVOKE 원복 → PASS
- 가드 2건 **같은 PR 갱신 계약 이행**: `ops_staff_schema.test.sql` enum 28→**31**, `parity_baseline_guard.test.sql` FUNCS 163→**168**·POLICIES 104→**110**(+ 기계 마커 PARITY_EXPECT_* 동시 갱신) — 갱신 후 2파일 GREEN 재확인
- ⚠️ **CI parity-smoke 는 prod 대조라 마이그 prod 적용 전까지 fail 이 정상** — 머지 시점에 MCP apply_migration(메인 세션 전용)과 동기해야 함(보고에 명시)

### 클라이언트 (tsc --noEmit EXIT 0 확인 시점까지)
- **타입**: `types/ops.ts`(OpsNextBreak·OpsPayoutEntry·OpsReportReason+라벨·snapshot/playerView 확장·monitorConfig·prizePaidAt), `types/supabase.ts` ops_event_type 21→31 수술 편집(1e stale 7종+신규 3종 — 재생성 아님)
- **에러**: ERROR_CODES E6135~E6138 + 메시지 + `opsRpcError.ts` PREFIX_MAP 5건 추가
- **도메인(테스트 GREEN)**: `domains/ops/monitor/monitorConfig.ts`(parseMonitorConfig — v≠1/비객체→기본, 미지 preset→full, 미지 id→null, 중복→첫 항목, 길이 5 정규화) · `monitor/nextBreak.ts`(computeNextBreakRemaining·findNextBreakFromLevels·formatHms) · `resume/selectResumeTournament.ts`(kstDateString +9h 시프트, active 최신>당일 upcoming>null) — **3스위트 32개 GREEN, KST 00~09 고정시계 포함**
- **레지스트리(테스트 10개 GREEN)**: `components/ops/monitor/registry.ts` — 10모듈(label+pickerLabel+getValue+gold 톤)·resolveMonitorSlots(빈/데이터없음 제외 당김)
- **모니터 개편**: `app/(public)/monitor/[token].tsx` — full/mirror/classic + 세로 스택(width<height||<700) + 프라이즈 패널(payouts 5·KO 조건부) + 골드는 상금만(블라인드 gold→off-white) + 헤더 등록 배지 제거(T4 — regStatus 슬롯 일원화) + 신고 링크 + 열람 이벤트
- **플레이어뷰**: `live/[view_token].tsx` — nextBreak 줄 + **C5 CTA 교체**("로그인하면 이 대회 참가 기록이 내 계정에 연결돼요"+로그인 버튼) + 신고 링크 + 열람 이벤트
- **운영자 C1**: `ClockControl.tsx` — "다음 브레이크까지 HH:MM:SS"(remainingSec 파생 → 클럭과 구성상 드리프트 0)
- **C6 설정 UI**: `MonitorConfigCard.tsx`(인라인 확장 카드 — **중첩 RN Modal iOS 터치먹통 함정 회피**, SelectBottomSheet 만 모달) + `[id].tsx` STATUS 탭 배선(MonitorLinkButton 아래)
- **C3 완료**: HistoryTab EVENT_LABEL 10종 보완(1e 7종+신규 3종)
- **B2 완료**: `PublicReportSheet.tsx`+ReportFooterLink(익명 폼 사유 3종+상세 500자·44px hitSlop·접수됨 상태) + `opsReportService`(zod+xssValidation) + `OpsReportRepository`
- **D1 배선 완료분**: `analyticsService.trackOpsFunnel`(로깅+영속 이중 레일, fire-and-forget) + `AnalyticsEventRepository` — 공개뷰 2표면 열람·생성/복제(method 구분)·claim 전환 배선됨
- **훅/서비스/레포**: useDuplicateTournament·useSetMonitorConfig·useSetPrizePaid(+배럴) / opsTournamentService.duplicateTournament·setMonitorConfig / opsParticipantService.setPrizePaid / Tournament·Participant 레포 메서드+COLUMNS(monitor_config·prize_paid_at)

## 잔여 태스크 (SDD 디스패치 대상 — 번호 순서 권장)

1. **[opus] ops_hub_enabled 플래그 스택 4파일** — weekly_grid 패턴 그대로: `src/config/featureFlags.ts` 에 `ops_hub_enabled: false` 추가 → `src/services/appConfigService.ts` 에 `getOpsHubFlagRaw()`(키 'ops_hub_enabled') → 파서 `src/domains/ops/opsHubFlag.ts`(parseWeeklyGridFlag 동형: zod `{enabled: boolean}` safeParse+fallback) → `src/hooks/useOpsHubEnabled.ts` + `src/lib/queryClient.ts` `queryKeys.appConfig.opsHubEnabled()` 추가(590행 부근 weeklyGridEnabled 옆)
2. **[opus] A1 진입 표면 조합(D5)** — 전부 useOpsHubEnabled 게이트: ① `app/(app)/(tabs)/profile.tsx` MenuItem 패턴(51-73행)으로 "라이브 대회 운영" 항목(**전 회원** — 역할 조건 없음, 189행 부근 Card 블록) + 노출 시 `trackOpsFunnel('ops_hub_impression')`(마운트 1회) ② 1회성 신기능 안내 카드 — MMKV 키 `@uniqn:ops_hub_intro_dismissed`(useVersionCheck.ts 65행 패턴), dismiss 후 재노출 없음, CTA "라이브 운영 열기" ③ `app/(app)/(tabs)/schedule.tsx` 빈 상태 크로스링크(캘린더 756-764·리스트 796-804행 EmptyState — 기존 액션 유지하고 보조 링크 추가). **홈 탭 상시 노출 금지**
3. **[opus] A2+A3 (ops) 목록 개편** — `app/(ops)/tournaments/index.tsx`: ① 재개 카드 — `selectResumeTournament(tournaments, Date.now())`(이미 구현·테스트됨, `@/domains/ops`), 구성 3요소 = 대회명/상태 배지/보조 메타(장소·날짜), 탭→상세 ② 빈 상태 3단(인지+가치+"첫 대회 만들기" CTA) ③ raw gray(`border-gray-200 bg-white dark:...`)→디자인 토큰(`bg-surface`·`text-content-primary` 등 nativewind-patterns 준수) ④ ActivityIndicator→Skeleton 3행(공간 예약, `@/components/ui` Skeleton) ⑤ 마운트 시 `trackOpsFunnel('ops_hub_entered')` ⑥ 기존 스크린 테스트(`app/(ops)/tournaments/__tests__/`) 갱신. §9.1 상태 매트릭스 준수(에러 시 진입점 유지)
4. **[opus] A4 복제 액션 배선** — 목록 카드(완료 대회 위주) 또는 상세 헤더에 "복제" 액션: `useDuplicateTournament` 호출, `Alert.alert` 확인("'{이름}' 설정으로 새 대회를 만들까요?"), `eventDate` = 오늘 KST(`kstDateString(Date.now())` 재사용), 성공 시 새 대회 상세로 `router.push`
5. **[opus] C4 클라 PayoutLedger 지급 토글** — `src/components/ops/payoutRows.ts` row 에 `prizePaidAt` 배선(buildLedgerRows 는 prizes+participants 조인, participant.prizePaidAt 사용) + `PayoutLedger.tsx`(44-69행 map) 행에 지급 완료 체크 토글(`useSetPrizePaid`, **undo-first**: 확인 다이얼로그 없이 왕복, 지급됨 행은 체크 아이콘+흐림). 기존 PrizeCorrectSheet 진입과 충돌하지 않게 별도 터치 타깃(44px)
6. **[sonnet] B1 noindex** — `public/_headers` 에 `/monitor/*`·`/live/*` 경로 `X-Robots-Tag: noindex` 블록 추가(기존 규칙 형식 준수). `app/+html.tsx` 신설 금지(SPA 전역 오염 위험 — 헤더 방식 채택 사유 주석)
7. **[sonnet] B3 약관 사행성 금지 조항** — `src/constants/legal/termsOfService.ts` **만** 수정(단일소스): 금지행위/이용제한 성격의 기존 조항에 항목 추가(조 번호 재배열 금지) — "사행성 도박, 불법 도박장 개설·운영, 금전 배팅 중개 목적의 서비스 이용 금지 및 위반 시 이용 제한·관계기관 통보" 취지. version '1.1'→'1.2', publishDate '2026-07-17', effectiveDate '2026-07-24'(제3조 7일 공지 규정 준수)
8. **[sonnet] D2+B4+DONE 마킹** — 설계 문서 §5-S1 에: P1 성공 기준 기록("출시 30일 내 비-employer 계정 생성 대회 N건" — 목표치는 보고에서 사용자 확인 요청, 제안 기본값 10건 / 분모 = ops_hub_impression 대비 ops_hub_entered 진입율, 쿼리는 analytics_events) + B4 "금액 필드 전 티어 동일 노출 — 작업 없음 확인(E11)" 기록 + S1 완료 항목 DONE 마킹
9. **[fable] 검증 게이트(전부 실행 증거 필수)** — ① `npm run quality` EXIT 0 ② `npx jest` 전체 green(재개 카드 KST 00~09 케이스 포함 — 이미 존재) ③ `npm run test:db` 전체(761+60) green + `npx supabase db reset` 파리티 ④ **브라우저 렌더 관찰**: expo web(`EXPO_ROUTER_APP_ROOT=C:\Users\user\Desktop\T-HOLDEM-ops-s1\uniqn-mobile\app` 절대경로+`--clear` — 워크트리 라우트0 함정) + 로컬 DB 시드(pgTAP 시드 참고: 대회+블라인드 4레벨 중 sort3 브레이크+클럭 running+prizes 6단+monitor_token 48자 — psql 직접 INSERT 가능) → `/monitor/<token>` 가로(TV)/세로(폰) 각 1회 + 프리셋·슬롯 + **브레이크 카운트다운이 클럭과 어긋나지 않는지** 관찰(playwright MCP 사용 가능)
10. **[fable] 리뷰** — code-reviewer + security-reviewer(**신규 anon 쓰기 표면 2개 집중**: ops_public_reports·analytics_events RLS/트리거) 디스패치, CRITICAL/HIGH 해소(수정은 opus 디스패치 가능)
11. **커밋 정리** — WIP 커밋을 유지한 채 잔여분을 논리 단위 `feat(ops): …` 한글 커밋(또는 최종 1커밋). **push/PR/OTA 금지 — 로컬 커밋까지만.** 잔여(실기기 QA·OTA·prod 마이그 적용·플래그 ON·CI parity 동기)는 사용자 게이트로 보고

## 이 세션에서 실측한 함정 (디스패치 프롬프트에 관련분 포함할 것)

- **pgTAP fixture 가 GRANT ALL ON ALL TABLES 재부여**(ops_helpers.sql) → 테이블 grant 거부 단언은 테스트 환경에서 무의미 — RLS 동작(0행/42501)으로 단언(신규 테스트가 이미 이 방식)
- **=2 계약**: `ops_` 접두 SECDEF 에 anon EXECUTE 가 생기면 ops_staff_security+ops_open_access_s1 이중 가드가 즉시 RED — 신규 ops RPC 는 반드시 REVOKE 동봉
- **supabase 클라이언트는 untyped**(createClient 제네릭 없음) — 신규 테이블 `from()` 에 타입 추가 불필요. 단 `OpsEventType` 은 `types/supabase.ts` Constants 파생이라 enum 추가 시 그 파일 수술 편집 필요(이미 31로 갱신됨)
- **중첩 RN Modal = iOS 터치먹통** — 설정류 UI 는 인라인 확장 카드로(MonitorConfigCard 방식), 모달은 SelectBottomSheet 하나만
- **KST 00~09**: 날짜 판정은 `kstDateString`(+9h 시프트) 경유 — `toISOString` 직접 사용 금지
- 워크트리 expo: `EXPO_ROUTER_APP_ROOT` 절대경로+`--clear` 필수(라우트 0 함정), env 는 `.env.development.local`(로컬 스택) 복사돼 있음
- 커밋 전 `git branch --show-current` 재확인(병렬 세션 브랜치 섞임 실증 이력)

## 검증 게이트 요약 (완료 주장 전 이 세션 안에서 실행 증거)
`npm run quality` EXIT0 · `npx jest` 전체 · `npm run test:db` 전체 · `db reset` 파리티 · 모니터 실브라우저 가로/세로(C6 프리셋·슬롯·카운트다운 정합) · 리뷰 CRITICAL/HIGH 0 · 로컬 커밋만
