# UNIQN 전방위 감사 — 2라운드 통합 (2026-08-09)

> **범위**: 성능·보안·UI·UX·데이터흐름·데이터정합성·에러처리·의존성·일관성·레거시·누락·중복·모순·비용·최적화
> **방법**: 1차 12축 병렬 발견 → 축별 적대적 검증 → 완전성 비평 → 2차 사각지대 7축 → 재검증 → 배포현실 기준 재배치
> **규모**: 에이전트 41개 · 툴 호출 1,391회 · 서브에이전트 토큰 5.5M · 대상 1,773 파일 / 320,878 LOC / 마이그 103개
> **결과**: 확정 **60건** (HIGH 7 · MEDIUM 22 · LOW 31) · 반증 **3건** · 미확인 0건

---

## 0. 결론 먼저

**이 코드베이스는 32만 LOC 치고 이례적으로 건강하다. 그리고 지금은 결함을 가장 싸게 고칠 수 있는 유일한 시점이다.**

prod 실측이 그 이유다 — `work_logs` **6행** / `applications` **6건** / `auth.users` **27명** / storage 객체 **11개** / 최신 알림 **3일 전**. 즉 **아직 실사용 전**이다. 발견된 60건 중 어느 것도 "지금 사용자가 피해를 입고 있다"가 아니라 **"런칭하면 피해가 시작된다"** 이다. 지금 고치면 데이터 마이그레이션·사고 대응·사용자 공지가 전부 불필요하고, 런칭 후엔 셋 다 붙는다.

건강함의 근거도 실측이다: `console.log` 0건 · `@ts-ignore` 0건 · `Alert.alert` 직접호출 0건 · 상대경로 `../../../` 0건 · knip 미사용 파일 0건 · 미사용 의존성 0건 · SECURITY DEFINER search_path 미고정 0건 · 파리티 208/111 일치. 반증된 3건도 "규약을 오독한 감사"였지 코드 결함이 아니었다.

약점은 하나의 패턴으로 수렴한다 — **규약이 "웨이브" 단위로 소급 적용되고, 웨이브가 지나간 뒤의 신규 코드와 웨이브 범위 밖 도메인에는 자동 전파되지 않는다.** HIGH 7건 중 5건이 정확히 이 패턴이다.

---

## 1. 메인 세션이 직접 실측 검증한 것

에이전트 보고를 그대로 신뢰하지 않고 재확인한 항목이다. 아래는 전부 **이 세션의 도구 결과**에 근거한다.

| 항목 | 실측 방법 | 결과 |
|---|---|---|
| **sec-01** chat 버킷 RLS | prod `pg_policies` SELECT | ✅ 확정 — chat 4정책 전부 `bucket_id='chat'` 만 검사. 나머지 11개 버킷은 전부 `(storage.foldername(name))[1] = auth.uid()::text` 보유. **UPDATE/DELETE 에 소유자 검사가 없는 버킷은 chat 이 유일** |
| **sec-02** temp MIME | `list_storage_buckets` | ✅ 확정 — `allowed_mime_types: null`, 20MB |
| sec-01 **실제 위험도** | prod SELECT | chat 객체 **0개** · chat/message 테이블 **0개** → 채팅 미구현, 버킷만 baseline 선생성. **시한 결함** 판정이 맞다 |
| **data-01** 4번째 Lost Update | `ConfirmedStaffRepository.ts` Read | ✅ 확정 — `:336-360`(역할) · `:566-578`(상태) 클라 read-modify-write. **같은 파일 `:370-374` 주석이 형제 경로는 RPC 전환됐다고 자백** |
| **err-01** 무타임아웃 | `withTimeout` 전수 Grep | ⚠️ **문구 정정** — `utils/timeout.ts:25` 정의 + `services/auth/` 3서비스에 배선됨, `repositories/` **0건**. 정확한 표현은 "**데이터 평면** 무타임아웃" |
| **skew-F2** 서버 버전 게이트 | prod `app_config` SELECT | ✅ 확정 — `force_update_version` = **1.0.0**(2026-04-10 초기값), `latest_version`/`recommended_version` = **1.0.3**(2026-07-19 정지). 현재 배포판 1.0.5 |
| **skew-F1** 게이트 UI 미배선 | `app/_layout.tsx` Read + Grep | ✅ 확정, **2차 보고보다 심각** — 아래 §2 참조 |
| 런칭 전 맥락 | prod 카운트 SELECT | work_logs 6 · applications 6 · users 27 · notifications 108 · storage 11 |

---

## 2. 가장 중요한 발견 — 버전 게이트가 3계층 모두 죽어 있다

`skew-F1` + `skew-F2` 를 합치면 이렇게 된다.

| 계층 | 상태 | 증거 |
|---|---|---|
| `useVersionCheck` 훅 (모달·스토어 이동 로직 완비, 141행 점검모드 / 170행 소프트업데이트) | **프로덕션 호출부 0건** — 정의 + 배럴 export + JSDoc 예시뿐 | `useVersionCheck.ts:94` · `hooks/index.ts:7` |
| `useAppInitialize` 의 `requiresUpdate` / `isMaintenanceMode` | 계산해서 **반환하는데 아무도 안 읽는다** | 반환: `useAppInitialize.ts:28-29, 184, 206-207, 218-219` / 소비: `app/_layout.tsx:216` 이 `{isInitialized, isLoading, error, retry}` 만 구조분해 |
| prod `app_config` 값 | force=1.0.0(전원 통과) · latest=1.0.3(배포판 1.0.5보다 **낮아** shouldUpdate 항상 false) | prod SELECT 실측 |

**이것이 메모리 항목 "인앱 업데이트 안내 경로 0개"를 정정한다.** 경로가 없는 게 아니라 **3계층이 전부 구현돼 있는데 마지막 배선 한 줄과 서버 값 갱신이 빠져 통째로 죽어 있다.** 고치는 비용은 신규 개발이 아니라 배선이다.

왜 이게 최우선인가: 이 앱은 이번 달 **#441 실사고**(클라가 서버보다 먼저 배포돼 ops 전면 파손)를 겪었다. 그 유형의 유일한 서버측 방어선이 `force_update_version` 인데, 발동해도 사용자에게는 "알 수 없는 오류 + 무한 재시도 버튼"으로만 보인다. 그리고 이건 **네이티브 바이너리에만 실린다** — 1.0.6 빌드를 놓치면 1.0.6 세대 기기조차 다음 빌드까지 차단 불능이 고착된다.

---

## 3. 배포 현실 — 재배치의 축

1차 로드맵(P0~P3)을 폐기하고 **배포 채널 도달 속도**로 다시 짰다. 채널 3개의 속도가 전부 다르다.

| 채널 | 도달 속도 | 비고 |
|---|---|---|
| **서버** (DB/RPC/RLS/EF) | **즉시** — 1.0.5 기기 포함 전원 | EF 는 master push 자동배포 |
| **웹** (CF Pages) | **즉시** — 클라 코드 수정도 웹 사용자에게 바로 | 공개 모니터/플레이어뷰의 주 소비 경로 |
| **네이티브** | **스토어 빌드 1.0.6 전까지 도달 불가** | OTA 채널 1.0.6 잠금, `eas update` 발행 금지 상태 |

🏷️ = 런칭 전에만 싸게 고칠 수 있는 항목 (지금은 데이터 0, 나중엔 마이그레이션 필요)

### S0 — 서버·웹 즉시 (지금 고치면 바로 효력)

**서버**

| id | 심각도 | 내용 | 근거 | 공수 |
|---|---|---|---|---|
| sec-01 🏷️ | MED | chat 버킷 4정책 owner-scope 추가 (또는 미사용 버킷 제거) | prod 정책 실측 | S |
| sec-02 | LOW | temp 버킷 MIME 화이트리스트 | prod 실측 | S |
| data-01 (서버 절반) 🏷️ | HIGH | `update_work_log_slot` 에 status-only patch 확장 — 상태변경 이력을 서버로 흡수할 그릇 | `20260808120000:522` · `ConfirmedStaffRepository.ts:559-578` | M |
| push-01 🏷️ | MED | 일괄 정산(최대 100건) FOREACH → 다중행 INSERT 배치. ops⑦-2 가 금지한 패턴이 정산 도메인엔 가드 없이 생존 | `20260802161000:200-233` | M |
| push-02 | MED | 발송 EF 재시도 0 + receipts 미폴링(ticket ok ≠ 전달) + `net.http_post` 응답 폐기 | `send-push-notification/index.ts:183-191, 206-216` | S~M |
| push-04 | LOW | 음수정산 admin 브로드캐스트 개별 INSERT 루프 → `INSERT...SELECT` | `notify_on_work_log_update` Case 4 | S |
| cost-01 | LOW | job_postings 중복 SELECT 정책 통합 | prod RLS | S |
| cost-02 | LOW | outbox 크론 `*/1`→`*/5` (⚠️트리거 직결 전환 금지) | prod cron | S |
| cost-03 🏷️ | LOW | notifications TTL — 108건뿐이라 정책 소급 자유 | prod | S |
| cost-04 | LOW | ops_prizes `auth_rls_initplan` 래핑 | advisor | S |
| cost-05 | LOW | `work_logs.edited_by` 커버링 인덱스 | advisor | S |

**웹 (CF Pages — `eas update` 금지와 무관한 허용 경로)**

| id | 심각도 | 내용 | 근거 | 공수 |
|---|---|---|---|---|
| monitor-01 | HIGH | 폴링 1회 실패 = 영구 정지 + "무효 링크" 오탐. 토큰무효(P0001)와 네트워크 오류 구분, 연속 실패 임계로 | `useMonitorSnapshot.ts:26,28` · `usePlayerView.ts:23,25` · `monitor/[token].tsx:172` | M |
| web-02 (웹) | HIGH | `navigator.wakeLock` + visibilitychange 재요청 — 전광판 기능 실효의 대부분 | `monitor/[token].tsx:4`, Grep 0건 | S |
| web-01 | MED | `<html lang="en">` → `app/+html.tsx` 로 `lang="ko"` (⚠️`public/index.html` 신설 금지) | dist/index.html:2 | S |
| web-03 | MED | `verify-web-build.js` 마커가 (app)/(auth) 2종뿐 — 21시간 다운 사고의 재발방지 장치가 6그룹 중 4종에 장님 | `verify-web-build.js:17,53-59` | S |

**프로세스**

| id | 내용 |
|---|---|
| skew-F2 | `app_config` 버전값 갱신을 릴리즈 체크리스트에 편입 + 런북 1줄. 값 갱신은 1.0.6 출시와 동기 |

### S1 — 1.0.6 빌드 탑승 (빌드 전 마감. 놓치면 다음 빌드까지 네이티브 도달 불가)

| id | 심각도 | 내용 | 근거 | 공수 |
|---|---|---|---|---|
| **dep-01** | LOW | RN 0.83.6→**0.83.10** — 빌드 전제조건, 최상단 | `package.json:96` | S |
| **skew-F1** | HIGH | 강제업데이트/점검모드 전용 화면 배선 (`requiresUpdate`/`isMaintenanceMode` 구조분해 + 스토어 링크 + `canRetry=false`). 소프트업데이트(`shouldUpdate`)도 동일 지점 | `_layout.tsx:216` · `ErrorState.tsx:70-77` | S |
| **testgap-01** | MED | 계측 3종: Sentry release/dist 태깅 + trackEvent prod 활성 + 앱버전 서버기록 — #407 게이트·data-01 차단의 선행조건 | `analyticsService.ts:178` | M |
| **auth-F3** 🏷️ | MED | Supabase 세션을 LargeSecureStore(AES 키만 SecureStore)로 — **전 세션 무효화가 무비용(27명)인 마지막 시점** | `supabase.ts:20` · `secureStorage.ts:84-86` | M |
| **web-02** (네이티브) | HIGH | `expo-keep-awake` 직접 의존 승격 — **네이티브 모듈이라 OTA 불가, 빌드에만 실림** | package-lock transitive만 | S |
| realtime-01 | HIGH | `useConfirmedStaff` 렌더 소스 단일화 — realtime=true 에서 낙관적 업데이트 3벌이 죽은 코드 | `useConfirmedStaff.ts:109,423` · 유일 소비처 `StaffManagementTab.tsx:143` | M |
| data-01 (클라) | HIGH | `updateStatus`/`updateRoleWithTransaction` 이력 append 제거 → S0 RPC 로 전환 | `ConfirmedStaffRepository.ts:336-360, 566-578` | M |
| auth-F2 🏷️ | MED | 사용자 로그아웃만 `{scope:'local'}` — 현재 기본 global 이라 로그아웃 버튼이 **전 기기 세션 종료** | `authCoreService.ts:409` · `authStore.ts:213` | S |
| auth-F1 | MED | role 변경 재조정 경로에 `refreshSession` 배선 (JWT 미갱신 → RLS 가 옛 역할로 동작하는 창) | `appInitializeSession.ts:447-489` | S |
| realtime-02 | MED | Repository realtime 콜백 debounce / invalidateQueries 전환 | `ConfirmedStaffRepository.ts:677-687` | S |
| arch-01 + err-02 | MED | 오프라인 가드 잔여 배선 (ops 허브 "켤 예정" 확정이라 arch-01 필수) | `useOpsMutations.ts:850` | M |
| err-01 | HIGH | **데이터 평면** 타임아웃 — 기존 `utils/timeout.ts` 패턴 재사용 (신규 유틸 만들지 말 것) | repositories 0건 실측 | M~L |
| err-03 | MED | 5개 라우트그룹 ErrorBoundary | 1차 확정 | S~M |
| ux-02 | MED | 지원 버튼 조용한 비활성화 → 사유 노출 (staff 핵심 전환 경로) | `ApplicationForm.tsx:160-184` | S |
| dep-02 | LOW | npm audit 21건 triage — 13건은 expo 내부 빌드 툴체인이라 `audit:fix` 로 안 닿음 | — | S~M |

### S2 — 빌드 이후 (JS 전용 → 1.0.6 채널 OTA 로 도달 가능)

realtime-05(onError/RECOVERED 갭 **19곳**, 배선 3곳) · data-01 차단 트리거(**계측 가동 확인 후에만**) · monitor-02(RPC rate limit, ⚠️INSERT 가드 패턴 이식 금지) · monitor-03 🏷️(토큰 생명주기) · auth-F4 · finding-04(role 변경 죽은 API **삭제**) · perf-01/02/03 · err-04 · ui-01 · ui-02 · ux-01 · cost-06 · consistency-01(⚠️`e2e/` 별도 Grep) · legacy-01(**재배선**, 삭제 아님) · legacy-02 · testgap-02 · testgap-03

### S3 — 백로그 (위생)

realtime-03(죽은 API) · realtime-04(`useRealtimeSubscription` 384줄 삭제) · finding-03(RPC 폴백 비원자 재구현) · push-03(quiet hours — 코드가 스스로 "후속 PR" 명시) · monitor-04(N-viewer 공유 캐시) · ux-03 · legacy-03 · consistency-02/03 · dep-03(⚠️knip false positive 이력)

---

## 4. 1.0.6 빌드 탑승 체크리스트

**하드 게이트 — 없으면 빌드 보류 권고**

1. ☐ **dep-01** RN 0.83.10 + `npx expo install --check` 0건
2. ☐ **skew-F1** 강제업데이트/점검/소프트업데이트 UI 배선 — 놓치면 1.0.6 세대에도 "차단 불능 + 안내 경로 0개"가 고착
3. ☐ **testgap-01** 계측 3종 — 이게 실려야 #407 REVOKE 게이트와 data-01 차단 게이트가 열린다
4. ☐ **auth-F3** 세션 저장 어댑터 — 전 세션 무효화 비용이 0 인 마지막 열차
5. ☐ **web-02 네이티브 절반** `expo-keep-awake` — 네이티브 모듈은 OTA 로 영원히 못 실음

**동승 권장**: realtime-01/02 · data-01 클라 전환 · arch-01+err-02 · err-03 · err-01 · ux-02 · auth-F1/F2 · dep-02

**빌드 직후 절차**
- ☐ `app_config` `latest_version`/`recommended_version` → 1.0.6 (현재 1.0.3 정지 — 갱신 없으면 skew-F1 을 고쳐도 죽은 안전장치)
- ☐ `list_migrations` 실측으로 서버 선행 확인 (#441 재발 방지 — 머지 ≠ 서버 반영)
- ☐ 파괴적 DDL 부재증명 재확인 (§6 — 시점 한정 증명)

---

## 5. 묶음 제안 (exit proof 포함)

### 묶음 A — 알림·정산 서버 파이프라인 위생 (S0)
push-01 + push-02 + push-04 + cost-02 + cost-03
**Exit proof**: 로컬 Supabase 에서 `bulk_settle_work_logs` 100건 실행 → `net.http_post` 호출이 100회 → 1~수회로 줄었음을 pg_net 큐로 관측. 의도적 실패 티켓 주입 시 receipts 폴링 결과가 기록되는 것 확인. 파리티 가드(마커 + 리터럴 + 문구 **3곳 동시**) green.

### 묶음 B — 공개 화면 신뢰성, 웹 즉시 출고 (S0-웹)
monitor-01 + web-02(웹) + web-01 + web-03
**Exit proof**: `verify-web-build.js` 6마커 green 으로 CF 배포 → 실브라우저에서 ① 오프라인 5초 주입 후 복구 시 폴링 자동 재개, ② 토큰 훼손 시에만 "무효 링크", ③ `curl https://uniqn.app | head` 에 `lang="ko"`, ④ `navigator.wakeLock` sentinel active. ⚠️워크트리 웹배포 함정(빈 번들·`--branch=master`) 준수.

### 묶음 C — 인증 수명주기 마감 (S1)
skew-F1 + skew-F2 런북 + auth-F1 + auth-F2 + auth-F3
**Exit proof**: ① 로컬 config 에서 `force_update_version` 을 현재 버전 초과로 올렸을 때 전용 화면(스토어 버튼, 재시도 없음)이 뜨는 것을 웹에서 실측 — 원복 후 정상 부팅. ② role 변경 시 refreshSession 호출 로그 + 직후 RLS 쓰기 성공. ③ 기기 A 로그아웃 후 기기 B 세션 생존. ④ 세션이 SecureStore(암호문)에 있음 확인.

### 묶음 D — 이력 jsonb 단일 쓰기 경로 완결 (S0→S1→S2 순차)
data-01(서버 RPC → 클라 전환) + finding-04 삭제 + finding-03 폴백 제거. **차단 트리거는 testgap-01 이후로 명시적 보류.**
**Exit proof**: `src/` 전역에서 `modification_history`/`role_change_history` 를 담는 클라 `.update()` **0건** + RPC status patch 이력 append pgTAP **Red-Green** + 상태변경/시간편집 교차 실행 시 이력 배열이 양쪽 항목을 모두 보존하는 통합 시나리오 1건.

### 묶음 E — realtime 정합성 단일화 (S1 + S2)
realtime-01 + realtime-02 + realtime-05
**Exit proof**: StaffManagementTab 노쇼 처리 시 서버 응답 전 UI 즉시 반영 테스트 green + 채널 장애 모킹 후 RECOVERED 발행 시 invalidate 호출 단언 + ops 전계층 31 suites green. `scheduleService.ts:767-776` 낡은 주석 삭제 확인.

---

## 6. 하지 말아야 할 것 (15건)

1. **venue-settlements 의 FlatList 를 FlashList 로 바꾸지 마라** — CLAUDE.md 가 소형 리스트의 FlatList 를 명시 허용. 단일 지점 + 단일 월 스코프. *(감사 반증 1)*
2. **`setProfile` 직접 호출 3곳을 `refreshProfile` 로 교체하지 마라** — CLAUDE.md 조항은 Supabase Auth 직접 호출 제한이지 Zustand setter 제한이 아니다. 교체하면 매 토글마다 `refreshSession` 왕복. *(감사 반증 2)*
3. **`board_posts.comment_count` 클라 카운터를 "레이스 수정"하지 마라** — `tr_board_comment_count_sync` 트리거(baseline:12247)가 이미 원자 증감하고 RLS 때문에 클라 쓰기는 대부분 무음 no-op. 허용되는 건 죽은 클라 증감 코드의 **제거뿐**. *(감사 반증 3)*
4. **`detectSlotConflicts` 를 죽은 코드로 지우지 마라** — `slotEdit.ts:394-395` 가 "청소에서 지우지 말 것"을 명시한 의도적 보존. 재배선 대상이고, 시트 prop 주입 방식은 금지.
5. **outbox 크론을 트리거 직결로 대체하지 마라** — 재시도 루프와 내구성 상실. 스케줄 완화까지만.
6. **정산 배지 색상을 강제 통일하지 마라** — 700/300 대비는 `GroupedSettlementCard:77-78` 주석에 문서화된 의도. 이름 충돌 해소까지만.
7. **`RoleInfo` 의 `| string` 을 곧장 제거하지 마라** — `RoleResolver.ts:263-264` 커스텀 역할 흐름이 의존.
8. **iOS `canOpenURL` 경로를 되살리지 마라** — PR#422 가 경로 자체를 제거. 되돌리면 version bump 유발.
9. **data-01 직접 PATCH 차단 트리거를 성급히 넣지 마라** — 계측 없이는 구클라 파손을 감지 못 한다. RPC 전환 먼저.
10. **monitor-02 rate limit 에 신고/분석 가드 패턴을 그대로 이식하지 마라** — 그건 INSERT 방어다. 읽기 폴링(4초×N)에 DB 카운트를 붙이면 **모든 읽기가 쓰기로 증폭**된다.
11. **모니터를 Supabase Realtime 구독으로 전환하지 마라** — `monitor_token` 게이트를 잃는 보안 절충이 설계문서(2026-06-23:198)에 실재. 캐시는 토큰 게이트 유지 방식으로만.
12. **web-01 을 `public/index.html` 신설로 고치지 마라** — 정식 경로는 `app/+html.tsx`. dist 충돌 + verify-web-build 재통과 확인 필수.
13. **finding-04 를 RPC 로 재구현하지 마라** — 호출부 0건인 죽은 API. **삭제**가 정답이고 재구현이 더 비싸다.
14. **웹 세션을 sessionStorage 로 결정 기록 없이 교체하지 마라** — persistSession/자동로그인과 정면 트레이드오프.
15. **`eas update` 발행 금지 유지** — 발행하면 1.0.5 기기가 조용히 누락된 채 "배포했다"로 기록된다. 웹 배포(CF)는 허용 경로.

---

## 7. 부재증명 평가 ("없다"를 어디까지 믿을 수 있나)

**신뢰할 만함**
- **파괴적 DDL 부재** (OTA 락 이후 마이그 7개 전문 열람 + 패턴 grep 이중) — 단 **시점 한정 증명**. 새 마이그가 추가되는 순간 무효. 배포 직전 재확인을 체크리스트에 편입했다.
- **realtime 배선 갭** — Grep 전수 + 소비처 Read + `RECOVERED` 역방향 교차검증. 검증 단계에서 11→**19곳**으로 확장 정정됨.
- **jsonb Lost Update 46개 컬럼** — 컬럼별 근거 개별 명시, 한계(repositories 계층 한정) 자진 선언. 반증 1건(comment_count)을 트리거+RLS 로 잡아낸 것이 스캔 품질의 방증.
- **TanStack 캐시 크로스유저 누출 없음** — 키 팩토리→실소비처 추적, uid 명시 부착 확인.

**중간 신뢰**
- **푸시 중복 트리거 없음** (91개 트리거 사람 눈 대조) — 재현 명령이 없다. 트리거 신설 시 pgTAP 상호배타 단언으로 승격할 가치.
- **네이티브 API 웹 크래시 없음** — 번들 문자열 실측까지 갔으나, 검증 중 **Grep 브레이스 글롭 공허매칭 함정**(`{src,app}/**` 이 0파일 매칭)이 이 환경에 실재함이 드러났다. "Grep 0건" 형태의 다른 부재증명도 같은 함정을 밟았을 수 있다.

**여전히 미확인**
- `functions/`(CF Pages Functions) · `supabase/functions/` 의 jsonb RMW — 스캔이 명시적으로 제외. eslint 사각과 겹친다.
- **Supabase 콘솔 설정 전반** — Auth Rate Limits(브루트포스 방어선이 0 일 수 있음) · 단일/다중 세션 모드(auth-F2 실효 좌우) · 인프라 API rate limit(monitor-02 실위험 좌우). **레포로 증명 불가 — 사람이 콘솔에서 볼 일.**

---

## 8. 남은 사각지대 (2라운드로도 못 본 것)

1. **`functions/` + `supabase/functions/` 전체 감사** — 두 라운드 모두 `send-push-notification` 하나만 정독. eslint ignores 사각과 겹쳐 정적 도구도 못 본다.
2. **테이블 RLS 전면 재감사** — 1차는 storage 정책만, 파리티 가드는 함수 "개수"만 본다. #241 RLS 감사 이후 마이그가 수십 개 쌓였는데 **정책 의미론** 재검증이 없다.
3. **스토어 심사 표면** — app.config.ts 권한 문구·심사노트·1.0.6 리젝 리스크. 빌드 게이트가 코드 밖에서 막힐 유일한 지점.
4. **접근성(a11y)** — 1차 ui 축은 SafeArea/터치타깃 2건뿐. 스크린리더 순회·포커스 관리·reduce-motion 미감사.
5. **성능 실측** — perf 축 전체가 코드 패턴 판독. 콜드스타트·번들 크기·저사양 Android 실측이 0.

---

## 9. 감사 방법론 메모 (재현용)

- **적대적 검증이 값을 했다**: 발견을 그대로 받았으면 반증 3건이 작업 목록에 들어갔을 것이고, 그중 2건은 **규약이 명시 허용한 패턴을 결함으로 고치는** 퇴행이었다.
- **`UNVERIFIABLE` 을 `REFUTED` 와 분리한 것이 핵심**이었다. 과거 이 프로젝트는 한도로 죽은 에이전트의 `verdict=null` 을 "기각"으로 오분류한 사고 이력이 있다.
- **실패 사례 기록**: 2차 1회차는 JSON Schema 에 한글 property key(`부재증명`)를 넣어 7/8 에이전트가 400(`^[a-zA-Z0-9_.-]{1,64}$`)으로 즉사했다. **스키마 키는 ASCII, 한글은 후처리·enum 값에만.**
- **부재증명을 산출물로 강제한 것**이 "5번째 Lost Update" 축에서 46개 jsonb 컬럼 전수 스캔을 끌어냈다. "없다"를 그냥 믿지 않으려면 스캔 범위를 자산으로 요구해야 한다.
