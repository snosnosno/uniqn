# 감사 후속 실행 원장 — 세션 프롬프트 (2026-08-09)

> **출처**: `docs/analysis/2026-08-09-full-app-audit-2rounds.md` (확정 60건 / 반증 3건)
> **새 세션은 이 파일부터 읽는다.** 아래 코드블록을 그대로 붙여넣으면 된다.

## 전제 — 배포 상황 (2026-08-09 사용자 확정)

| 사실 | 함의 |
|---|---|
| **1.0.6 심사 승인됨 · 수동 출시 대기** | 출시 타이밍을 우리가 통제한다. JS 수정을 먼저 준비해두고 출시하면 사용자가 1.0.6 받는 순간 OTA 수정본까지 함께 도달 |
| 1.0.6 빌드에 감사 수정은 **하나도 안 실림** | 네이티브 필수 2건(RN 0.83.10, expo-keep-awake)은 **1.0.7 대기** |
| `runtimeVersion = appVersion` | 1.0.6 출시 후 `eas update --branch production` 은 **1.0.6 설치 기기에만** 도달. 1.0.5 기기는 스토어 업데이트 필요 |
| prod 실사용 전 (users 27 · work_logs 6 · applications 6) | 모든 수정이 데이터 마이그레이션 없이 가능한 **마지막 구간** |

### 🚨 순서 강제 2개 (어기면 사고)

1. **`force_update_version` 을 skew-F1 UI 배선 OTA 발행 전에 올리지 마라.** 지금 올리면 1.0.5 기기가 차단되는데 표시할 화면이 없어 "알 수 없는 오류 + 무한 재시도"에 갇힌다. 순서는 **UI 배선 OTA → 값 갱신**.
2. **data-01 직접 PATCH 차단 트리거는 계측(testgap-01) 가동 확인 후에만.** 계측 없이는 구클라이언트 파손을 감지할 수 없다.

### 권장 진행 순서

```
세션1 (S0 서버 마이그)  ─┐
세션2 (S0 웹 배포)      ─┼─ 서로 독립, 병렬 가능. 심사 상태 무관하게 즉시 효력
세션3 (알림 파이프라인) ─┘
        ↓
세션4 (OTA-1 핵심)  ← skew-F1·계측·data-01 클라·realtime
        ↓
【1.0.6 스토어 출시】 → 출시 확인 후 eas update --branch production
        ↓
세션5 (OTA-2 견고성) → 2차 OTA
        ↓
세션6 (1.0.7 빌드분) → 네이티브 2건 + 잔여
```

### 모든 세션 공통 규율

- **전용 워크트리 + 브랜치**에서 작업 (메인 체크아웃은 읽기·계획 전용). node_modules 는 `mklink /J` 정션
- 마이그 작업은 **`/guard` 선행** · 접두사 충돌은 **머지 직전** 재확인 · 적용은 `prod-migrate`(파일 바이트 그대로) · 적용 후 `list_migrations` 실측
- 파리티 갱신은 **마커 `PARITY_EXPECT_FUNCS` + 단언 리터럴 + 설명 문구 3곳 동시** (현재 기대 208/111)
- 상수·enum·사용자 문구를 바꾸면 **`e2e/` 별도 Grep** (eslint ignores 사각)
- 완료 주장 전 **이 세션에서 실행한 증거** 필수
- **`eas update` 는 1.0.6 스토어 출시 확인 후에만** 발행

---

## 세션 1 — S0 서버 마이그 배치 (권장 시작점)

```
docs/analysis/2026-08-09-full-app-audit-2rounds.md 의 S0 서버 항목 중 마이그레이션 배치를 실행한다.

## 대상 (마이그 1~2 파일로 묶어라)
1. sec-01 [MEDIUM] storage.objects 의 chat 버킷 4정책(select/insert/update/delete)에 owner-scope 추가.
   - prod 실측: chat 4정책 전부 `bucket_id='chat'` 만 검사. 나머지 11개 버킷은 전부
     `(storage.foldername(name))[1] = auth.uid()::text` 를 건다. UPDATE/DELETE 에 소유자 검사가 없는 버킷은 chat 이 유일.
   - 원천: 20260710000003_baseline_platform_glue.sql:96-99
   - ⚠️ 설계 결정 필요: chat 객체 0개 · chat/message 테이블 0개(채팅 미구현)다.
     (a) 최소 owner-scope(uid) 로 봉합하고 채팅 스펙 확정 시 참여자 판정으로 교체, 또는 (b) 버킷 자체 제거.
     둘 중 무엇이 맞는지 먼저 판단해 근거와 함께 보고하고 진행하라.
2. sec-02 [LOW] temp 버킷 allowed_mime_types 화이트리스트 (현재 null, 20MB). 원천 :69
3. cost-01 [LOW] job_postings SELECT RLS 정책 2개가 동일 조건 중복 평가 → 통합
4. cost-04 [LOW] ops_prizes 정책 auth 함수 행마다 재평가 → (select auth.uid()) 래핑
5. cost-05 [LOW] work_logs.edited_by FK 커버링 인덱스 (⚠️CONCURRENTLY 는 트랜잭션 밖)
6. cost-03 [LOW] notifications 보존정책(TTL 크론) — prod 108건이라 지금은 소급 자유
7. cost-02 [LOW] sync-schedule-board-outbox 크론 */1 → */5
   🚫 트리거 직결(http_post) 전환 금지 — 재시도 루프·내구성이 사라진다. 스케줄 완화까지만.

## 금지
- 기존 마이그레이션 파일 수정 금지 (새 파일로만)
- execute_sql 로 DDL 실행 금지 — apply_migration 또는 prod-migrate 경로만
- 파리티 숫자만 올리지 말 것 (과거 201=201 이 반대 드리프트 상쇄였던 이력)

## Exit proof
- prod pg_policies 재조회: chat 4정책 qual 에 owner 술어 포함 확인
- list_storage_buckets: temp allowed_mime_types non-null
- get_advisors(performance) 재실행: job_postings multiple_permissive_policies · ops_prizes auth_rls_initplan WARN 소멸
- pg_indexes 에 work_logs.edited_by 인덱스 존재
- SELECT * FROM cron.job: outbox 스케줄 */5, notifications 정리 잡 1건
- pgTAP: 정책 변경 전후 anon/authenticated 의 job_postings 조회 결과 불변 단언
  🚨 "0건 반환 = 차단"이 아니다 — 행이 보이는 역할로 대조군 단언 병행
- list_migrations 실측 + 파리티 3곳 동시 갱신 후 npm run quality
```

---

## 세션 2 — S0 웹 배포 (세션 1과 병렬 가능)

```
docs/analysis/2026-08-09-full-app-audit-2rounds.md 의 S0 웹 항목을 실행하고 Cloudflare Pages 에 배포한다.
이 항목들은 웹 사용자에게 즉시 도달한다 (eas update 금지와 무관한 허용 경로).

## 대상
1. monitor-01 [HIGH] 폴링 1회 실패 = 영구 정지 + "무효 링크" 오탐
   - src/hooks/ops/useMonitorSnapshot.ts:26,28 · usePlayerView.ts:23,25 · app/(public)/monitor/[token].tsx:172
   - 토큰 무효(P0001)와 네트워크 오류를 구분하고, 정지 조건을 연속 실패 임계로 바꾼다
2. web-02(웹 절반) [HIGH] navigator.wakeLock.request('screen') + visibilitychange 재요청
   - app/(public)/monitor/[token].tsx — 전광판 화면인데 keep-awake 가 프로젝트 전체 0건
   - 네이티브 절반(expo-keep-awake)은 세션 6 (네이티브 모듈이라 OTA 불가)
3. web-01 [MEDIUM] <html lang="en"> → lang="ko"
   🚫 public/index.html 신설 금지 — 정식 경로는 app/+html.tsx. dist 충돌 + 게이트 재통과 확인 필수
4. web-03 [MEDIUM] scripts/verify-web-build.js:17 마커가 (app)/(auth) 2종뿐
   - 21시간 다운 사고의 재발방지 장치가 라우트 그룹 6종 중 4종에 장님이다 → 6그룹 전부로 확장
   - 정상 번들에 6마커가 실재하는지 먼저 확인하고 확장하라
5. ui-01 [MEDIUM] 같은 화면 SafeArea 부재 — 한 번에 처리 (TV 는 인셋 0이라 무영향)

## 금지
- 모니터를 Supabase Realtime 구독으로 전환 금지 — monitor_token 게이트를 잃는 보안 절충
  (설계문서 2026-06-23:198 에 근거 실재)
- eas update 발행 금지 (1.0.6 출시 전)

## Exit proof (fablize 그라운딩 — 실제 렌더러에서 관찰)
- verify-web-build.js 6마커 green 상태로 CF 배포
- 실브라우저에서: ① devtools 오프라인 5초 주입 후 복구 시 폴링 자동 재개(클럭 갱신 재관측)
  ② 토큰 훼손 시에만 "무효 링크" 화면 ③ curl https://uniqn.app | head 에 lang="ko"
  ④ navigator.wakeLock sentinel active (Playwright evaluate)
- 🚨 워크트리에서 웹배포하면 빈 번들이 된다 — EXPO_ROUTER_APP_ROOT 절대경로 + --clear +
  메인에서 .env.local 복사 + --branch=master 명시 (detached HEAD 는 Preview 로 샌다)
```

---

## 세션 3 — 알림·정산 서버 파이프라인 (서버, 독립)

```
docs/analysis/2026-08-09-full-app-audit-2rounds.md 의 push 축을 실행한다. 전부 서버라 즉시 효력.

## 대상
1. push-01 [MEDIUM] 일괄 정산(최대 100건)이 FOREACH 루프로 건당 알림 발화
   - 20260802161000:200-233 — ops⑦-2 가 "20명=최대 60발화"를 근거로 일괄 버튼을 금지했는데
     같은 곱셈이 정산 도메인엔 가드 없이 살아 있다
   - 다중행 INSERT 배치로 전환해 STATEMENT 트리거 배치 이득 복원
2. push-02 [MEDIUM] send-push-notification EF: 재시도 0 + receipts 미폴링(ticket ok ≠ 전달)
   + net.http_post 응답 폐기로 DB측 관측 0
   - supabase/functions/send-push-notification/index.ts:183-191, 206-216
   - DeviceNotRegistered 토큰 정리가 반쪽인 것도 같이
   - ⚠️ EF 는 master push 시 자동배포된다 — 머지 타이밍 주의
3. push-04 [LOW] notify_on_work_log_update Case 4(음수정산 admin 브로드캐스트)만 개별 INSERT 루프
   → INSERT...SELECT 단문. is_active 필터 동반 여부 결정(현재 비활성 admin 도 수신)

## Exit proof
- 로컬 Supabase 에서 bulk_settle_work_logs 100건 실행 → net.http_post 호출이
  100회 → 1~수회로 줄었음을 pg_net 큐/로그로 관측
- 의도적 실패 티켓 주입 시 receipts 폴링 결과가 기록되는 것 확인
- 파리티 3곳 동시 갱신 + npm run quality + list_migrations 실측
```

---

## 세션 4 — OTA-1 핵심 (1.0.6 출시 전 준비, 출시 직후 발행)

```
docs/analysis/2026-08-09-full-app-audit-2rounds.md 의 JS 전용 핵심 수정을 준비한다.
1.0.6 이 스토어에 출시되면 곧바로 eas update --branch production 으로 발행할 묶음이다.

## 대상 (우선순위 순)
1. skew-F1 [HIGH] 버전 게이트가 3계층 모두 죽어 있다 — 배선으로 살린다
   - useVersionCheck 훅(모달·스토어이동 로직 완비)의 프로덕션 호출부 0건
     (useVersionCheck.ts:94 · hooks/index.ts:7 배럴 export + JSDoc 예시뿐)
   - useAppInitialize 가 requiresUpdate/isMaintenanceMode 를 반환하는데
     app/_layout.tsx:216 이 {isInitialized, isLoading, error, retry} 만 구조분해해서 버린다
   - 강제업데이트/점검모드 전용 화면 + 스토어 링크 + canRetry=false.
     소프트업데이트(shouldUpdate) 안내도 같은 지점에서
   - 🔑 이것이 메모리의 "인앱 업데이트 안내 경로 0개" 의 해법이다 (신규 개발 아님, 배선)
   - 🚨 이 OTA 가 나가기 전에 prod app_config.force_update_version 을 올리지 마라
2. testgap-01 [MEDIUM] 프로덕션 계측이 전부 무동작 — analyticsService.ts:178 trackEvent
   - #407 REVOKE 게이트와 data-01 차단 트리거의 선행조건이다
   - Sentry release/dist 태깅은 빌드 설정이라 1.0.7 로 갈 수 있음 — JS 로 되는 부분만 이번에
3. data-01 [HIGH] 클라 절반: ConfirmedStaffRepository 이력 jsonb read-modify-write 제거
   - :336-360 (role_change_history) · :566-578 (modification_history)
   - 같은 파일 :370-374 주석이 형제 경로는 RPC 전환됐다고 자백한다
   - update_work_log_slot RPC 가 서버에서 append 하는데 클라가 통째 덮어써 교차 레이스 발생
   - ⚠️ 세션 1 에서 서버 RPC 확장이 끝난 뒤에 착수 (서버 선행 — #441 재발 방지)
   - finding-04: changeRole/updateStaffRole 계열 죽은 API 는 RPC 재구현이 아니라 **삭제**
4. realtime-01 [HIGH] useConfirmedStaff realtime=true 에서 낙관적 업데이트 3벌이 죽은 코드
   - useConfirmedStaff.ts:109 (enabled: !!jobPostingId && !realtime) · :423 (렌더 소스 이원화)
   - 유일 소비처 StaffManagementTab.tsx:143 이 realtime:true
   - 해법: useJobDetail.ts:93-98 의 queryClient.setQueryData 직접 기록 패턴으로 단일화
5. realtime-02 [MEDIUM] Repository realtime 콜백이 행 변경마다 전체 재조회 (디바운스 없음)
   - ConfirmedStaffRepository.ts:677-687 · ApplicationRepositoryQueries.ts:158-173, 400-406

## Exit proof
- skew-F1: 로컬 config 의 force_update_version 을 현재 버전 초과로 올렸을 때
  전용 화면(스토어 버튼, 재시도 없음)이 뜨는 것을 웹에서 실측 → 원복 후 정상 부팅 확인
- data-01: Grep 으로 src 전역에서 modification_history/role_change_history 를 담는
  클라 .update() 0건 + RPC append pgTAP Red-Green + 상태변경/시간편집 교차 실행 시
  이력 배열이 양쪽 항목을 모두 보존하는 통합 시나리오 1건
- realtime-01: 노쇼 처리 시 서버 응답 전 UI 즉시 반영 테스트 green + ops 전계층 31 suites green
- npm test 전량 + npm run quality
```

---

## 세션 5 — OTA-2 견고성 (1.0.6 출시 후 2차 발행)

```
docs/analysis/2026-08-09-full-app-audit-2rounds.md 의 에러처리·인증·UX 잔여를 실행한다.

## 대상
1. err-01 [HIGH] 데이터 평면 무타임아웃
   - ⚠️ 문구 주의: withTimeout 은 이미 존재하고(src/utils/timeout.ts:25) auth 3서비스에 배선됨.
     src/repositories/ 만 0건이다. **신규 유틸을 만들지 말고 기존 패턴을 확장하라**
2. err-02 + arch-01 [MEDIUM] 오프라인 가드 잔여 배선
   - arch-01: useOpsMutations.ts:850 useRecordOpsAttendance — 같은 파일 헤더가
     "모든 쓰기 mutationFn 첫 줄 가드"를 문서화했는데 이 함수만 어긴다
   - err-02: #451 이 배선한 44곳 밖 나머지 도메인 25곳
   - 🔑 개별 수정과 별개로 "쓰기 mutationFn = 가드 필수"를 파일 파싱형 회귀 테스트나
     커스텀 lint 룰로 승격하는 것을 검토하라 — 강제 장치 없이는 5번째 누락이 또 나온다
3. err-03 [MEDIUM] (admin)/(employer)/(ops)/(public)/(auth) 5개 라우트그룹 ErrorBoundary 부재
4. err-04 [MEDIUM] AdminRepository.ts:133-176 대시보드 count 8종이 에러를 0으로 표시
5. auth-F2 [MEDIUM] signOut 이 기본 scope='global' → 로그아웃 버튼이 전 기기 세션 종료
   - authCoreService.ts:409 · authStore.ts:213 사용자 경로만 {scope:'local'}, 정리 경로 6곳은 global 유지
6. auth-F1 [MEDIUM] role 변경 재조정 경로에 refreshSession 미배선 (JWT 가 옛 역할로 남는 창)
   - appInitializeSession.ts:447-489 → authStore.refreshProfile() 위임으로 좁게
7. ux-02 [MEDIUM] 지원 폼 필수 미입력 시 버튼이 아무 신호 없이 비활성화
   - ApplicationForm.tsx:160-184, 236-240 — staff 핵심 전환 퍼널
8. perf-01 [MEDIUM] app/(app)/notifications.tsx:56-60 인라인 객체가 useMemo 체인 무력화

## Exit proof
- 기내모드에서 정산 버튼 탭 → 무한 스피너가 아니라 즉시 차단 토스트 (실기기/웹 관찰)
- 타임아웃 강제 테스트(fetch 지연 모킹)에서 E1002 매핑 단언 pass
- dev 에서 (ops) 하위에 강제 throw 삽입 → 전역이 아닌 섹션 fallback 확인 (임시코드 제거 후 커밋)
- 기기 A 로그아웃 후 기기 B 세션 생존
- npm test 전량 + npm run quality
```

---

## 세션 6 — 1.0.7 빌드분 (네이티브 필수)

```
1.0.7 스토어 빌드에만 실을 수 있는 항목이다. OTA 로는 영원히 못 나간다.

## 대상
1. dep-01 [LOW] react-native 0.83.6 → 0.83.10 (Expo SDK 55 기대 패치)
   - package.json:96 exact pin. 관례상 핀은 유지하고 값만 상향: npx expo install react-native@0.83.10
   - 착수 전: git log -S '"react-native": "0.83' -- uniqn-mobile/package.json 으로
     핀이 박힌 맥락 확인 (mmkv/nitro 처럼 의도적 고정인지)
2. web-02(네이티브 절반) expo-keep-awake 직접 의존 승격 + useKeepAwake
   - 현재 package-lock 에 transitive 로만 존재. knip peer-deps 래칫 확인
3. auth-F3 [MEDIUM] Supabase 세션 저장을 LargeSecureStore(AES 키만 SecureStore) 패턴으로
   - supabase.ts:20 · secureStorage.ts:84-86 — 현재 네이티브 평문 AsyncStorage
   - 🔑 users 27명인 지금이 전 세션 무효화가 무비용인 마지막 시점
   - 웹 절반(sessionStorage)은 자동로그인과 트레이드오프 — 결정 기록만 남기고 교체하지 마라
4. dep-03 expo-modules-core direct dependency 정리
   - ⚠️ knip false positive 이력 있음(삭제 금지 메모리) — 삭제가 아니라 선언 위치·버전 정합만
   - prebuild/eas build 실검증 필수
5. dep-02 npm audit 21건 triage — 13건은 expo 내부 빌드 툴체인이라 audit:fix 로 안 닿음
   - Expo SDK 57 마이그 계획에 편입 (eslint react-hooks 7.x 천장과 같은 열차)

## Exit proof
- npx expo install --check 0건 + npm run quality + eas build 성공(iOS·Android)
- 실기기에서 세션이 SecureStore(암호문)에 저장됨 확인 + 기존 자동로그인 회귀 테스트 green
- 빌드 직후: app_config latest_version/recommended_version → 1.0.7 갱신
```

---

## 1.0.6 출시 런북 (세션 4 완료 후)

```
1. ☐ 세션 4 OTA 묶음이 master 에 머지되고 npm test/quality green
2. ☐ 스토어에서 1.0.6 수동 출시
3. ☐ 출시 반영 확인 (스토어 페이지 버전 표기)
4. ☐ git rev-parse HEAD 기록 → eas update --branch production → 다시 HEAD 대조
     (긴 명령 중 트리가 교체돼 Commit 라벨이 어긋난 이력 2회)
5. ☐ Update 그룹 ID·runtime 버전 기록
6. ☐ app_config latest_version/recommended_version → 1.0.6
7. ☐ skew-F1 OTA 도달 확인 후에만 force_update_version 갱신 검토 (순서 강제 1)
8. ☐ list_migrations 실측 — 클라가 참조하는 서버 객체가 prod 에 있는지 (#441 재발 방지)
```

---

## 착수 금지 목록 (감사 반증 + 설계 의도)

전문은 `docs/analysis/2026-08-09-full-app-audit-2rounds.md` §6. 요약:

1. venue-settlements FlatList → FlashList 전환 금지 (규약이 소형 리스트에 명시 허용)
2. setProfile → refreshProfile 교체 금지 (Zustand setter 제한 아님)
3. board_posts.comment_count 클라 카운터 "레이스 수정" 금지 (트리거가 이미 원자 증감) — 죽은 코드 제거만
4. detectSlotConflicts 삭제 금지 (의도적 보존, **재배선** 대상)
5. outbox 크론 트리거 직결 전환 금지
6. 정산 배지 색상 강제 통일 금지 (문서화된 의도)
7. RoleInfo `| string` 즉시 제거 금지
8. iOS canOpenURL 부활 금지 (version bump 유발)
9. data-01 차단 트리거 성급 투입 금지 (계측 이후)
10. monitor rate limit 에 INSERT 가드 패턴 이식 금지 (읽기가 쓰기로 증폭된다)
11. 모니터 Realtime 전환 금지 (monitor_token 게이트 상실)
12. web-01 을 public/index.html 로 고치기 금지 (app/+html.tsx 가 정식)
13. finding-04 RPC 재구현 금지 (삭제가 정답)
14. 웹 세션 sessionStorage 교체 금지 (결정 기록만)
15. 1.0.6 스토어 출시 전 eas update 발행 금지

---

## 남은 사각지대 (별도 감사 필요)

1. `functions/` + `supabase/functions/` 전체 — 두 라운드 모두 send-push-notification 하나만 정독
2. 테이블 RLS 의미론 재감사 — #241 이후 마이그 수십 개, 파리티는 함수 "개수"만 본다
3. 스토어 심사 표면 (권한 문구·심사노트)
4. 접근성(a11y) — 스크린리더 순회·포커스·reduce-motion
5. 성능 실측 — 콜드스타트·번들 크기·저사양 Android (현재 전부 코드 판독)

## 사람이 콘솔에서 해야 할 일 (레포로 증명 불가)

- Supabase Auth **Rate Limits** — #406 이 클라 로그인 잠금을 지웠으므로 서버 한도가 기본값/off 면 브루트포스 방어선이 0
- 단일/다중 세션 모드 설정 (auth-F2 실효를 좌우)
- 백업 주기·PITR 활성 여부 (testgap-03 런북 기입용)
