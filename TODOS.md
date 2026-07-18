# TODOS

프로젝트의 후속 작업 목록. 플랜 리뷰에서 MVP 범위 밖으로 결정된 항목을 기록.

## 홈 대시보드 관련 (2026-04-16 plan-eng-review)

### 홈 진입 튜토리얼 오버레이

- **What**: 앱 첫 진입 시 1회만 표시되는 "로고 탭 = 홈" 안내 오버레이.
- **Why**: "로고 탭 = 홈 이동"은 비표준 패턴. 사용자가 홈 화면의 존재 자체를 발견하지 못할 위험. Reviewer Concern #3과 Codex plan review 모두 지적.
- **Pros**: 사용자 발견율 향상, 신규 기능 교육, 앱 첫인상 개선.
- **Cons**: 오버레이는 거슬림, 기존 사용자에게는 재진입 시에도 보일 수 있어 UX 품질 테스트 필요.
- **Context**: `useTutorial` hook이 이미 프로젝트에 존재하고, `APP_INTRO_STAFF`/`APP_INTRO_EMPLOYER` 튜토리얼 패턴으로 활용 중. `homeIntro`라는 새 튜토리얼 키로 확장하면 됨. 구현 비용 ~30분 (CC+gstack).
- **Depends on**: 홈 대시보드 MVP 배포 완료 (`user-master-design-20260416-114022.md`), 사용자 발견율/이탈 지표 관찰 1-2주.
- **Status**: 사용자가 "배포 후 결정"으로 선택. 배포 후 관찰 결과에 따라 구현 결정.

### viewport 기반 lazy 위젯 로딩

- **What**: 스크롤 아래에 있는 위젯은 viewport 진입 시로 hook 호출 지연.
- **Why**: 현재 홈 진입 시 6개 위젯이 동시 로딩. `useCurrentWorkStatus`(Realtime 구독), `usePendingReviews`(4-fan out), `usePublishedAnnouncements`(InfiniteQuery) 포함. 앱 시작 시간에 영향 가능성. Codex plan review #4 지적.
- **Pros**: 초기 페인트 개선, Supabase 쿼리 비용 절감, 배터리 소모 감소.
- **Cons**: 스크롤 반응 지연, react-native-intersection-observer 같은 추가 라이브러리 필요, 구현 복잡도 상승.
- **Context**: MVP 배포 후 앱 시작 시간(TTI) 측정 결과에 따라 결정. 3초 이내면 현재 상태 유지, 5초 이상이면 구현 고려. Expo의 기본 프로파일링 또는 `@shopify/react-native-performance` 활용 가능.
- **Depends on**: MVP 배포, 실측 데이터 수집.
- **Status**: 비용/최적화 추적 TODO. 성능 지표 정량화 후 판단.

---

## 전체 QA 발견 (2026-04-20 Phase 1~4)

> 상세는 `.gstack/qa-reports/MASTER_BASELINE.json` 참조. Health 평균 86/100, critical/high 0건, medium 14 + low 9.

### FIX WINDOW 2A (DB-only fast-track) ✅ 2026-04-20

- [x] **ST-001** board_posts.comment_count reconcile + QA 댓글 cleanup — migration `20260420142540_qa_fix_st001_...` (단, 일회성 reconcile — 2E에서 trigger로 구조 보강)
- [x] **ST-002** 레거시 `fn_notify_*` triggers DROP (phase1: 5개 / phase2: 7개) — migrations `20260420142649_qa_fix_st002_...`, `20260420235202_..._phase2.sql` + 후속 `drop_legacy_report_notify_trigger` + `drop_unreferenced_legacy_notify_functions`
- [x] **EJ-002** "주말 스태프 모집 템플릿" seed (b2222222) — migration `20260420142758_qa_fix_ej002_...`
- AD-001은 FIX WINDOW 2D로 이관 (별도 staff 계정 시드)
- 상세: `.gstack/qa-reports/FIX-WINDOW-2A.md`, `.gstack/qa-reports/LEGACY-TRIGGERS-AUDIT.md`

### FIX WINDOW 2B (copy fast-track) ✅ 2026-04-20

- [x] **ST-003** 리뷰 D-day 문구 "근무 완료 후" → "퇴근 후" (checkOutTime anchor 명확화) — fc0f8a48c
- [x] **ST-004** 공지 탭 empty state notice 분기 추가 ("아직 등록된 공지가 없어요") — 16830bde5
- [x] **JS-001** 튜토리얼 "날짜 슬라이더" → "달력" — 7c9e685f7
- [x] **ES-002** 정산 모달 퇴근 시간 색상 중립 + "익일" 배지 — 78cf7d871
- 상세: `.gstack/qa-reports/FIX-WINDOW-2B.md`

### FIX WINDOW 2C (코드 수정) ✅ 2026-04-21

- [x] **EJ-001** 공고 카드 지원자 카운트 실시간 하이드레이션 — 4968a7345
- [x] **JS-002** JobCard aria-label role_catalog 최대 급여 fallback — 7ebff9ffd
- [x] **JS-003** 공고 상세 헤더 titleSuffix headerTint 색상 통일 — aa2c577e3
- [x] **JS-004** 지원 카운트 라벨 단일화 (applicationStatusLabel.ts) — 4968a7345 (JS-004+EJ-001 합쳐짐)
- [x] **WK-001 + WK-002** QR 스캐너 닫기 X + 5초 타임아웃 fallback + 설정 열기 — 9616540ab
- [x] **EJ-003** formatE164ToDisplay 적용 (ContactInfoSection + admin 구인자 신청 상세) — d6cfcdb3a
- [x] **EJ-004** 스태프 관리 COMPLETED 필터 옵션 추가 — 179ef5822
- [x] **AD-002** 이미 구현됨(a5bd38440) → verified-closed
- 상세: `.gstack/qa-reports/FIX-WINDOW-2C.md`

### FIX WINDOW 2D (기획 동의) ✅ 2026-04-21

- [x] **AD-001** 심사용 pending employer_application 시드 (d4444444 / pending-employer-staff@uniqn.app) — 5a2a1ceae
- [x] **ES-001** 정산 요약 '총 정산액(수당 포함)' 라벨 + staff '확정' 의미 차이 안내 — a6ed4b5f3
- [x] **ES-003** 정산 완료 시점 customAllowances snapshot 자동 저장 (retro-active 차단) — 1475218d0
- [x] **WK-004** work_logs.check_in/out_time 레거시 Firebase Timestamp → ISO string(jsonb) 정규화 — 1ee82ccaf
- 상세: `.gstack/qa-reports/FIX-WINDOW-2D.md`

### FIX WINDOW 2E (검증 리런 후속) ✅ 2026-04-21

- [x] **ST-001 regression 구조 fix** board_comments INSERT/UPDATE/DELETE trigger 추가 (`tr_board_comment_count_sync`) — migration `20260421030000_qa_fix_st001e_...`. 2A의 일회성 reconcile은 쓰기 trigger 부재로 drift 재발했음(검증 결과 post e2222222 stored 0 vs actual 1). 이제 구조적으로 동기화.
- [x] **WK-005** WorkTab 퇴근 "예정 미정" → "예정 / 시간 협의" (value === '미정'일 때 copy 대체, 출근도 대칭 적용)
- [x] TODOS.md FIX WINDOW 2A 섹션 재라벨링 + checkbox 반영 (docs drift 해소)
- **AD-003** (admin) group 라우팅 prefix 혼동 → **deferred** (Expo Router 구조 결정 필요, LOW severity, 후속 세션)
- 상세: `.gstack/qa-reports/FIX-WINDOW-2E.md`

### 후속 세션

- **Phase 5 qa/offline**: 오프라인 복구 QA — 실기기 + 별도 세션 필요
- 알림 emitter 통합: notifications 중복 SQL fix 후 code path 레거시 참조 정리
- [x] **레거시 trigger 함수 본체 정리**: `tr_notify_*` trigger DROP 후 `fn_notify_*` 함수 참조 경로 최종 확인 → DROP FUNCTION 완료 — `uniqn-mobile/supabase/migrations/20260421030000_drop_unreferenced_legacy_notify_functions.sql` (2026-04-20 감사 `.gstack/qa-reports/LEGACY-TRIGGERS-AUDIT.md`)
- **tr_notify_tournament_approval 이관**: UPDATE(재제출) 경로를 `notify_on_job_posting_update` 또는 전용 신규 trigger로 이관 후 레거시 DROP — 현재는 INSERT 중복이지만 재제출 알림 유실 방지 위해 보존

## 옵저버빌리티 (2026-04-25 plan-eng-review)

### tokenRefreshService → fcmTokenRefreshService 이름 변경

- **What**: `src/services/observability/tokenRefreshService.ts`의 파일명/심볼/주석을 FCM 토큰 전용임이 드러나도록 변경. 이름이 "auth token 갱신"으로 읽혀 새로 들어온 사람이 Supabase 세션 코드와 혼동하기 쉬움.
- **Why**: 실제 책임은 FCM(푸시) 토큰 주기 갱신 + Exponential Backoff 재시도. 본 plan(`2026-04-25-session-keep-alive`) 작성 중 Supabase auth token과 별개임을 추론하느라 시간 낭비. 다음 사람도 같은 함정에 빠질 가능성 높음.
- **Pros**: 코드 의도가 즉시 명확. 검색/grep 시 auth와 분리됨. CLAUDE.md/AGENTS.md 새 룰 불필요.
- **Cons**: import 경로 변경되는 파일 ~10개. 별도 PR 필요 (`chore` 스코프).
- **Context**: 파일 헤더 주석 (line 1-12): "FCM 토큰 갱신 서비스 (Exponential Backoff 기반)" — 이미 명확하나 파일명이 거짓말. `src/hooks/useFCMTokenManager.ts`가 주 호출자.
- **Depends on / blocked by**: `2026-04-25-session-keep-alive` PR 머지 후 (충돌 회피).
- **Status**: 후속 chore PR로 처리 예정.

## T-HOLDEM ops 라이브 운영 — 후속 PR (2026-06-30)

> 권위 추적: 스펙 `uniqn-mobile/docs/superpowers/specs/2026-06-29-ops-1d-bust-reentry-itm-design.md` §14 · 메모리 `project_tholdem_ops_revival_20260623`.

### [MEDIUM] LS-매개 데드락 — `ops_live_stats` 트리거를 DEFERRED CONSTRAINT TRIGGER로 전환

- **What**: 1c `fn_ops_live_stats_recompute` 재계산 트리거를 일반 `AFTER ROW` → `DEFERRED CONSTRAINT TRIGGER`(트랜잭션 커밋 직전 1회)로 전환. LS행을 항상 모든 데이터행 락 **이후**에만 획득하게 만들어 `(전 데이터행) < LS` 전역 락 순서를 복원.
- **Why**: 1d 출하 적대검증(conc-7)이 적발. AFTER ROW 트리거가 변경 직후 LS행을 잠가, bust는 `UPDATE ops_participants`(→LS 획득) **후** winner/좌석을 잠가 `LS < {S, P_winner}` 역전이 발생. advisory 비보유 변이(`add_rebuy`/`add_addon`/좌석 RPC/`claim`/`redraw` = `(P,S) → LS`)와 bust가 ABBA 순환(40P01) 가능.
- **심각도/긴급도**: [MEDIUM] 비긴급. **자기치유**(40P01 자동 abort+재시도) + **prod `ops_tournaments` 0행**이라 실피해 미미. **이번(1d) 락순서 수정과 인과 무관·선재** — 1c 트리거 + 1b redraw 양쪽 관여.
- **Context**: 1c 메커니즘(live_stats 트리거) + 1b redraw에 걸침 → 독립 작업. 신규 마이그(트리거 정의 변경) + pgTAP + 적대검증 재실행 필요. **남은 슬라이스가 live_stats 트리거를 건드리면(특히 1f 풀 산정) 함께 처리 고려**.
- **Depends on / blocked by**: 없음(독립). 1d(#218) 머지 후 언제든 별도 PR 가능.
- **Status**: ✅ **해소(1f D6·T2)** — `20260704100100_ops_1f_live_stats_deferred.sql`에서 트리거 6종(participants/seats/tables/blind_levels/clock + 신설 tournaments)을 `AFTER ROW` → `CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED`로 전환. LS행 락이 항상 커밋 직전 최후라 `{advisory,대회,참가자,좌석} < LS` 전역 순서 복원 → bust의 `LS<{S,P}` 역전 및 `(P,S)→LS` ABBA 순환 근원 제거. pgTAP `ops_live_stats_deferred.test.sql` DEFERRED RED-GREEN 실증. E1(자기 txn live_stats 읽는 RPC 없음) grep 실측 확인. 이 슬라이스에 편입.

### [LOW] 배정 2종 fast-follow (PR #220 비차단 잔여, 적대 최종리뷰 triage)

- **reseat Zod 런타임 배선**: `reseatAssignmentsSchema`/`reseatModeSchema`가 정의됐으나 테스트에서만 사용(repo/service/hook/UI 미호출) → 스펙 §6.2 경계 미실행. 단 머신생성 UUID·RPC fail-closed·형제 RPC(moveSeat/redrawWaitlistFill) 동일 선례. → service safeParse 배선 **또는 수용**.
- **pgTAP 칩균형 주석 정정**: `ops_reseat_participants.test.sql` [13] 칩균형 임계 주석("≤4000")이 실제(seed_pid 30000 포함 max=30000)와 불일치. 균형 실검증은 jest 전담이라 무해. → 주석 정정 또는 seed_pid 제외 서브쿼리.
- **RPC 비-uuid 선검증**: step3 `(e->>'participant_id')::uuid`가 비-uuid에 22P02 raise(스펙 §4.3-3은 `SEAT_ASSIGNMENT_INVALID` 요구). fail-closed·클라 Zod 방어라 실발생 불가. → RPC에 uuid 정규식 선검증(선택).
- **Status**: 추적만. LS-데드락 PR과 묶거나 별도 소규모 PR. prod 데이터 안전 무관.

---

## 근무표 대회 포함 — 이월 (2026-07-19)

### required CTE 에 job_postings.status 필터 부재
- **What**: `get_venue_grid_summary` 의 `required` CTE 가 공고 status 를 전혀 보지 않아 **취소된(`cancelled`) 일반 공고의 requirements 도 필요인원에 산입**된다.
- **Why 이월**: `closed` 는 만석 마감(capacity_full→closed)일 수 있어 배제하면 required 만 떨어지고 headcount 는 남아 셀이 왜곡된다. 상태별 구분 판단이 선행돼야 한다.
- **Effort**: S | **Priority**: P2 | 대회 포함과 무관하게 기존 배치에 이미 존재하는 동작.

### 근무표에서 대회를 구분할 수단이 전무
- **What**: 근무표 어디에도 "이 수요가 대회에서 왔다"를 알 표식이 없다. 셀 표식도, 상세 패널 배지도 없다.
- **⚠️ 최초 기록의 완화 근거는 거짓이었다**: "상세 패널에 `대회` 배지가 이미 뜬다"고 적었으나 **존재하지 않는다**. `대회` 문자열이 `src/components/weeklyGrid/`·`src/domains/weeklyGrid/`·`src/hooks/weeklyGrid/` 전체에 0건. 원인=`venueDayDetailMapping.ts:30-44` 의 `mapVenueDaySlotToConfirmedStaff` 가 `job_posting_id`·`is_container` 를 투영에서 떨궈 `ConfirmedStaff` 에 공고 정체성이 없다.
- **Why 지금 문제인가**: 대회 포함 배치로 대회 좌석이 `required_count` 를 올려 필요/부족 숫자가 커지는데, 운영자는 그 출처를 어느 깊이에서도 확인할 수 없다. D-7 대회가 몰리는 주에 특히 혼란.
- **해법 2갈래**: (a) 상세 패널 배지 — `get_venue_day_slots` 가 이미 `job_posting_id` 를 반환하므로 매퍼 투영만 살리면 된다. RPC 계약 무변경, 저비용. (b) 캘린더 셀 표식 — `get_venue_grid_summary` 에 날짜별 대회 포함 컬럼 추가 필요, 고비용.
- **Effort**: (a) S / (b) M | **Priority**: **P2** | 권장=(a) 먼저.

### 대회사 대상 "지점" 라벨
- **What**: 대회사에게 "지점"은 장소가 아니라 대회를 담는 서랍이라 어색할 수 있다.
- **Why 이월**: 구조가 아니라 문구만의 문제. 실사용 피드백 후 라벨만 조정.
- **Effort**: S | **Priority**: P3.
