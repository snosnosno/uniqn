# 감사 후속 실행 원장 — 세션 프롬프트 (2026-08-09)

> **출처**: `docs/analysis/2026-08-09-full-app-audit-2rounds.md` (확정 60건 / 반증 3건)
> **새 세션은 이 파일부터 읽는다.** 아래 코드블록을 그대로 붙여넣으면 된다.

---

## 🔴 실행 현황 (2026-08-11 갱신 — 다음 세션은 여기부터)

| 세션 | 상태 | PR/커밋 | prod 반영 |
|---|---|---|---|
| 문서 착지 | ✅ 완료 | #457 | — |
| **세션1** S0 서버 마이그 | ✅ **완료** | #458 | 마이그 2건 적용 · exit proof 전항목 실측 |
| **세션2** S0 웹 | ✅ **완료** | #459 | CF Pages 배포(`8cad683a`) · 실브라우저 관측 |
| **세션3** 알림 파이프라인 | ✅ **완료** | #460 | 마이그 1건 적용 · EF 자동배포 |
| **세션4** OTA-1 핵심 | ✅ **완료 5/5** | #461 · #466+#467 · **#469** | 마이그 `20260810100000` + **`20260811100000` 적용 완료** |
| **세션5** OTA-2 견고성 | ✅ **완료 8/8** | **#469** | 서버 변경 없음 |
| **세션6** 1.0.7 빌드분 | ✅ **코드 완료** | **#469** | 서버 변경 없음 |
| **머지·마이그·OTA·웹배포** | ✅ **완료 (08-10 21:2x UTC)** | `d1e1a3752` | 아래 §착지 기록 |
| 1.0.6 스토어 출시 | ⏸ 사람 게이트 | — | — |

### ✅ 착지 기록 (2026-08-10, PR #469 `d1e1a3752`)

| 단계 | 결과 | 증거 |
|---|---|---|
| PR #469 머지 | ✅ squash | CI 13/13 pass — DB Tests 3m2s · E2E 9m53s · Quality 4종 · Tests 4m19s · Bundle · EAS Config |
| 마이그 `20260811100000` prod 적용 | ✅ `prod-migrate` run 31433175979 (16s) | 적용 전후 실측(21:17:33→21:18:23 UTC): 함수 **208 불변** · 정책 **110 불변** · event CHECK **1개 유지**(AND 결합 없음) · `app_session_start` 포함 · 인덱스 신설 1 |
| OTA 발행 | ✅ group `2249087e-1be8-4802-a309-162a197deb5c` | 채널 `production` · runtime **1.0.6** · Commit `d1e1a3752`(사전 기록 HEAD 와 일치, 긴 명령 중 트리 교체 없음) |
| 웹 배포 | ✅ `uniqn-app.pages.dev` | 번들 10.02MB · 게이트(라우트 마커·CSS) 통과 · 배포본이 로컬 해시 `index-e18c05d5…` 와 일치 · `lang="ko"` 유지 |

🔎 **발행 중 발견 — `extra.environment` 가 OTA 에서 `development` 로 박힌다 (무해, 그러나 함정)**
`app.config.ts` 의 `getEnvironment()` 는 `APP_ENV`/`EAS_BUILD_PROFILE` 만 보는데 `eas update` 엔 둘 다 없다.
**앱 동작은 멀쩡하다** — 진짜 환경 축은 `src/config/env.ts` 의 `detectEnvironment()` 이고 그건
metro 가 번들에 inline 하는 `EXPO_PUBLIC_RELEASE_CHANNEL`/`NODE_ENV` 를 본다(웹 번들 실측:
`{environment:'production', isDevelopment:!1, isProduction:!0}` 상수 접힘 확인).
`extra.environment` 의 유일한 소비처 `versionInfo.fullVersion` 은 화면에 안 쓰인다.
🚨 **다음에 물릴 지점**: `Constants.expoConfig.extra.environment` 를 새로 읽으면 OTA 사용자만 `development` 다.
환경 판정은 **`@/config/env` 의 `env.*` 만** 쓸 것.

### 🔴 남은 것은 전부 사람 게이트다 (코드 잔여 0 · 서버 잔여 0)

| # | 항목 | 왜 사람이어야 하나 |
|---|---|---|
| 1 | **1.0.6 스토어 수동 출시** | 스토어 콘솔. OTA 는 이미 대기 중이라 출시되는 즉시 신규 설치자에게 함께 도달한다 |
| 2 | 출시 확인 후 `app_config.latest_version`/`recommended_version` → 1.0.6 | 🚨 **출시 전에 올리면 스토어에 없는 버전으로 업데이트를 안내**하게 된다. 그래서 이번 세션에서 손대지 않았다 |
| 3 | 그 다음 `force_update_version` 검토 | 순서 강제 1 — skew-F1 OTA 도달 확인 후 |
| 4 | 1.0.7 `eas build` iOS/Android + 실기기 QA | 네이티브 빌드 — 핵심은 **auth-F3 자동로그인 회귀**(업데이트 후 로그아웃되지 않아야 한다) |
| 5 | Supabase Auth **Rate Limits** 콘솔 확인 (#408) | 레포로 증명 불가 |

📊 **계측 도달 확인 쿼리** (OTA 가 실제로 닿았는지 = #407 게이트를 열 분모):
```sql
SELECT props->>'v' AS app_version, props->>'ota' AS ota_bundle, count(*)
  FROM analytics_events WHERE event='app_session_start' GROUP BY 1,2 ORDER BY 3 DESC;
```
`ota_bundle` 이 `'embedded'` 가 아닌 행이 보이면 OTA 가 실제 기기에 적용된 것이다.

### ✅ 세션4 잔여 — realtime-01 · realtime-02 · **testgap-01** (2026-08-11, `f676c039d`)

🚨 **원장이 "잔여 2건" 이라고 적었지만 실제로는 3건이었다.** `testgap-01` 은 커밋 이력 0건의
미착수였다(`git log --grep` 실측). "3/5" 를 셀 때 data-01 과 finding-04 를 2건으로 센 것이
원인이다 — **완료 개수가 아니라 항목 이름으로 세라.**

| 항목 | 핵심 |
|---|---|
| realtime-01 | `enabled` 에서 `!realtime` 제거 + `onUpdate` → `setQueryData`. 낙관적 업데이트 3벌 부활 |
| realtime-02 | 리딩+트레일링 병합(300ms) — 4곳. `NotificationRepository` 도 동형이라 동반 처리 |
| testgap-01 | Sentry release/dist/OTA 태깅 + `trackEvent` → 브레드크럼 + **서버 레일 `app_session_start`** |

**실행이 확정한 사실**:
- 🔑 **realtime-01 에는 원장에 없던 함정이 하나 더 있었다** — `staffQueryKey` 가 배열 리터럴이라
  구독 useEffect 의존성에 넣으면 **매 렌더 재구독**된다. `useMemo` 로 고정해야 한다(회귀 가드 추가).
- 🔑 **Sentry release/dist 는 빌드 설정이 아니다.** 원장은 "1.0.7 로 갈 수 있음" 이라 적었지만
  `Sentry.init({release, dist})` 는 런타임 값(`expoConfig`)을 받으므로 **OTA 로 도달한다**.
- 🔑 **계측의 서버 절반은 마이그 1건이면 된다** — `analytics_events` 테이블·트리거·RLS 는 이미
  있고(#265 ops S1), 막고 있던 건 `event` CHECK 화이트리스트뿐이었다. 파리티 208/110 불변.
- 🚨 **CHECK 제약 교체는 이름을 잘못 짚으면 조용히 제약이 2개가 되어 AND 결합된다** — 새 값은
  여전히 막히는데 마이그는 성공으로 보인다. 정의(`pg_get_constraintdef`)로 찾아 지우고,
  마이그 안과 pgTAP 양쪽에서 "CHECK 정확히 1개"를 단언한다.

### ✅ 세션5 완료 (2026-08-11, `ce0f95881`) — err-01·err-02·arch-01·err-03·err-04·auth-F1·auth-F2·ux-02·perf-01

**실행이 확정한 사실**:
- 🔑 **err-01 의 choke point 는 리포지토리가 아니라 Supabase 클라이언트의 `global.fetch` 다.**
  리포지토리는 47개 파일에서 330회 직접 await 하고 공통 래퍼가 없다 — `handleSupabaseError` 는
  실패 뒤에 부르는 변환기라 감쌀 대상이 아니고, `runRpc` 는 5개 파일만 쓴다.
  fetch 를 갈아끼우면 PostgREST·RPC·Storage·Auth 가 **한 지점에서** 덮인다.
- 🚨 **postgrest-js 는 fetch 예외의 `code` 를 항상 빈 문자열로 버린다**(dist 실측).
  살아남는 건 message 뿐이라 **에러 코드가 아니라 메시지 마커**로 판별해야 E1002 에 닿는다.
- 🔑 **err-02 는 78곳이었다**(원장은 "44곳 밖 나머지 25곳" 이라 파일 수를 셌다). 파일 25개 / 지점 78개.
  개별 수정만으로는 5번째 누락이 또 나오므로 **파일 파싱형 회귀 테스트로 승격**했다.
- ⚠️ **낙관적 업데이트는 가드보다 먼저 칠해진다** — TanStack 은 `onMutate` → `mutationFn` 순서다.
  오프라인에서 캐시가 잠깐 칠해졌다 `onError` 롤백된다. 완전 차단을 원하면
  `shouldApplyOptimisticUpdate()` 를 `onMutate` 첫 줄에 쓰는 **별도 작업**이 필요하다(미착수).
- ⚠️ auth-F2 에서 원장과 **다르게 판정한 1건**: `clearAutoLoginBlockedSession` 은 원장이
  "정리 경로" 로 묶었지만 실제로는 기기 한정 설정 반영이라 `local` 로 했다. 근거는 코드 주석.

### ✅ 세션6 코드분 완료 (2026-08-11, `b3737621c`) — dep-01·web-02(네이티브)·auth-F3·dep-03·dep-02

**실행이 확정한 사실**:
- 🔑 **auth-F3 는 `aes-js` 없이 된다.** Supabase 공식 LargeSecureStore 는 AES 키만 SecureStore 에
  두고 암호문을 AsyncStorage 에 두는데, **청킹**하면 새 의존성 0개로 전부 SecureStore 에 넣을 수 있다.
  검증할 암호 코드가 없다는 것 자체가 보안 이득이다.
- 🔑 **청킹은 문자 수가 아니라 UTF-8 바이트로 잘라야 한다** — 한글 3바이트·이모지 4바이트다.
  문자 수로 세면 2048 상한을 넘겨 **실기기에서 저장이 조용히 실패**한다(=로그인 유지 불가).
  `TextEncoder` 는 Hermes 존재 여부가 갈려 직접 센다.
- 🔑 **구버전 평문 세션은 마이그레이션했다** — 원장은 "전 세션 무효화가 무비용" 이라 했지만
  옮기는 비용이 더 싸다. 옮긴 뒤 평문 원본은 반드시 지운다.
- ⚠️ **dep-03 은 이미 완료 상태였다** — `expo-modules-core` 는 direct dependency + `install.exclude`
  + knip `ignoreDependencies` 가 전부 돼 있다. 변경 없음.
- 🔑 **dep-02 는 `npm audit fix` 로 고칠 수 있는 것이 0건이다** — 제안이 전부 메이저 **하향**
  (`expo@53`·`react-native@0.72`). 21건 전부 빌드타임 툴체인이라 앱 번들에 도달하지 않는다.
  분류 문서: `docs/analysis/2026-08-11-npm-audit-triage.md`
- 🚨 **앱 버전은 1.0.6 그대로 두었다** — `runtimeVersion = appVersion` 이라 여기서 1.0.7 로 올리면
  세션4·5 OTA 묶음이 **1.0.6 기기에 도달하지 못한다**. 범프는 OTA 발행 뒤 1.0.7 빌드 직전에.
- ⚠️ **워크트리에서 `npm install` 금지** — node_modules 가 메인 체크아웃과 정션이라 다른 워크트리까지
  같이 바뀐다. lock 갱신은 `npm install --package-lock-only`.

### ✅ 세션4 완료분 — data-01 + finding-04 (2026-08-10)

**서버 먼저** 순서를 지켜 2개 PR 로 착지했다. 이력 jsonb Lost Update 의 **4번째 경로가 닫혔다**.

| PR | 내용 | 검증 |
|---|---|---|
| **#466** `21abe6d46` | 서버 — `update_work_log_slot` 에 `status` 패치 축 신설 | pgTAP Red→Green **59/59** · CI 전항목 pass |
| **prod 적용** | run 31366499378 | md5 `9078334312cf`(27,265) → **`7fa40ecc03a0`**(31,147) · 로컬 md5 **동일** · 파리티 **208/110 불변** |
| **#467** `4739f7174` | 클라 — `updateStatus` RPC 전환 + finding-04 죽은 체인 삭제 | 654 suites/7483 tests · tsc 0 · quality 0 · CI 전항목 pass |

**실행이 확정한 사실**:
- 서버 절반의 정체 = 패치 키 화이트리스트에 `'status'` 추가. **시그니처는 안 바뀐다**(CREATE OR REPLACE)
  → 구클라(1.0.5/1.0.6)는 `status` 키를 보낼 코드가 없어 **기존 10키 경로가 바이트 하나 안 바뀐다**.
  역방향(신클라 → 구서버)만 위험해서 서버 선행이 강제였다 — 화이트리스트가 fail-closed 라
  `INVALID_INPUT: 알 수 없는 수정 항목입니다: status` 로 상태 변경이 **전면 파손**된다(#441 동형).
- **정산 잠금은 fail-closed 로 채택**(사용자 확정). 기존 키에 잠금을 안 건 이유가 "구 빌드 즉사"였는데
  `status` 는 신설 키라 구 빌드가 보낼 수 없다 — 처음부터 조일 수 있는 **유일한 시점**이었다.
- **finding-04 는 삭제가 정답임이 실측으로 확인됨** — `changeRole`/`changeRoleAsync` 는
  `useConfirmedStaff.ts` **자기 자신과 자기 테스트 밖 참조 0건**이고, `app/` 유일 소비처
  `settlements.tsx:62` 는 `{stats, grouped}` 만 꺼낸다. e2e `changeRoleButton` 은 admin **UserRole**
  화면이라 **보존**(이름만 비슷한 별개 기능).
- 부수 효과: 출근 기록 0인 행에 `checked_out` 요청 시 출퇴근이 둘 다 `now()` 가 되어 기존
  등호 거부 가드가 **"근무 0분" 사고를 공짜로 막는다**(pgTAP 51번).

**여전히 하지 않은 것**: 직접 PATCH 차단 트리거(계측 이후 — 순서 강제 2 준수).

### 이번 실행이 원장을 정정한 것 (실측 근거)

| 원장 문구 | 실측 결과 |
|---|---|
| web-01: "정식 경로는 `app/+html.tsx`" | ❌ **이 프로젝트에선 무시된다.** `web.output` 이 없어 SPA(single) 모드이고 index.html 은 `@expo/cli/static/template/index.html` 의 `%LANG_ISO_CODE%` ← `exp.web.lang` 로 만들어진다. `+html.tsx` 를 두고 빌드해도 `lang="en"` 그대로였다 → `app.config.ts` 의 `web.lang: 'ko'` 가 정답 |
| sec-01: "(b) 버킷 제거" 선택지 | ❌ **SQL 로 불가능.** `storage.protect_delete()` 트리거가 막는다 — Storage API 전용 |
| sec-01: "(a) 4정책 DROP+CREATE" | ❌ **prod 에서 실패.** `storage.objects` owner=`supabase_storage_admin`, prod `postgres` 는 `rolsuper=f`·`pg_has_role=f` → **RESTRICTIVE 정책 1개를 얹어 AND 결합**이 유일한 in-migration 해법 |
| push-01: "ops⑦-2 가 같은 곱셈을 지적" | ❌ 그 기록은 **근태 UI 건**이고 `bulk_settle_work_logs` 를 지목한 적이 없다. 별개 미문서화 결함 |
| monitor-01: "훅이 `retry:false`" | ⚠️ 전역 `queryClient` 는 `retry: shouldRetry`(최대 3회)다. **두 ops 훅만** 덮어쓰고 있었고, 에러 타입도 이미 갈려 있었다(E6119/E6120 vs E1xxx) — 소비처가 구분을 버린 것 |

### 08-10 실행이 정정한 것

| 원장/감사 문구 | 실측 결과 |
|---|---|
| 세션4 프롬프트: data-01 은 "세션1 서버 RPC 확장이 끝난 뒤 착수" | ❌ **세션1 에 그 항목이 없었다**(원장 공백). 08-10 세션이 서버(#466)부터 새로 만들어 해소 |
| 감사: `update_work_log_slot` **에 status-only patch 확장** | ⚠️ 표현이 모호했다 — 새 RPC·오버로드·시그니처 변경이 **전부 아니다**. `(uuid, jsonb)` 시그니처는 이미 patch 형태이고 **키 화이트리스트에 문자열 하나 추가**가 전부다 |
| `ops_open_access_s1` #59 실패 | ⚠️ 처음엔 "선재 결함"으로 판정했으나 **CI 신선 DB 에서는 통과**한다 → 레포 결함이 아니라 **공유 로컬 Docker DB 오염 아티팩트**. 🔑 로컬 pgTAP 실패는 CI 와 대조하기 전엔 결함으로 단정하지 말 것 |
| (신규) 로컬 Supabase 낡음 | 🚨 로컬 DB 가 **이틀 낡아** 최근 마이그 3건(`0809130000`·`140000`·`150000`) 미적용 상태였다 → pgTAP 5파일이 거짓 실패. **작업 시작 전 로컬 DB 최신화 확인이 필요하다** |

### 이번 실행이 **추가로 찾은** 결함 (감사에 없던 것)

- **푸시 ticket 정렬 버그** — `sendPushes` 가 실패한 chunk 의 ticket 을 배열에서 빼서 뒤 인덱스가 밀렸고,
  `handleTickets` 가 `tickets[i]↔messages[i]` 로 짝지어 `DeviceNotRegistered` 때 **엉뚱한 사용자의
  토큰을 지우고 있었다.** #460 에서 같이 고쳤다.
- **`COMMENT ON POLICY … ON storage.objects` 는 42501** — 같은 파일의 `CREATE POLICY` 는 통과한다.
  로컬 psql 에서는 성공하므로 **로컬 통과 ≠ CI/prod 통과**. CI DB Tests 가 잡았다.
- **`document?.x` 는 미선언 식별자를 못 막는다** — 옵셔널 체이닝은 값이 nullish 인 경우만 막는다.
  RN 네이티브·jest node 환경에는 `document` 바인딩이 아예 없어 `ReferenceError` 다.

### 08-11 실행이 추가로 찾은 것 — **테스트 목이 거짓 통과를 만들고 있었다 (3건)**

셋 다 "테스트는 초록인데 실제로는 아무것도 검증하지 않고 있던" 유형이다.
새 단언을 붙이는 순간 드러났고, 고친 것은 구현이 아니라 **목**이다.

- 🚨 **`SheetModal` 목이 `footer` prop 을 통째로 버렸다** — `ApplicationForm` 의 제출 버튼과
  그 주변이 이 테스트에서 **한 번도 렌더된 적이 없다**. 지원 폼 테스트 5개가 전부
  버튼이 없는 화면을 검사하고 있었던 셈이다.
- 🚨 **`useConfirmedStaff` 테스트의 `useMutation` 목이 `onMutate` 를 호출하지 않았다** —
  낙관적 업데이트 3벌과 롤백이 **한 번도 검증된 적이 없다**. realtime-01 이 되살린 그 코드다.
- ⚠️ **`useQueryClient` 목이 매 렌더 새 객체를 반환했다** — 실제 TanStack 은 컨텍스트의 단일
  인스턴스를 준다. 목이 만든 거짓 신호 때문에 "구현이 무한 재구독한다"로 오독될 뻔했다.

🔑 **교훈**: 목이 실제 컴포넌트/라이브러리의 **계약 일부를 빠뜨리면**, 그 부분을 지나는
   코드는 테스트가 있어도 검증되지 않는다. 새 단언이 예상 밖으로 실패하면
   **구현을 의심하기 전에 목이 무엇을 빠뜨렸는지 먼저 보라.**

- ⚠️ **`void repo.insert(...)` 는 계측이 앱 프로세스를 죽일 수 있는 경로였다** — 리포지토리가
  지금은 절대 reject 하지 않지만, 그 계약이 깨지면 `void` 만으로는 unhandled rejection 이 된다.
  fire-and-forget 은 **부르는 쪽에도** `.catch` 가 있어야 한다.

---

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

## 세션 1 — S0 서버 마이그 배치 ✅ 완료 (#458)

> 아래 프롬프트는 **기록용**이다. 다시 실행하지 말 것.

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

## 세션 2 — S0 웹 배포 ✅ 완료 (#459)

> 아래 프롬프트는 **기록용**이다. 다시 실행하지 말 것.

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

## 세션 3 — 알림·정산 서버 파이프라인 ✅ 완료 (#460)

> 아래 프롬프트는 **기록용**이다. 다시 실행하지 말 것.

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

## 세션 4 — OTA-1 핵심 ✅ 완료 5/5 (#461 · #466+#467 · `f676c039d`)

> 아래 프롬프트는 **기록용**이다. 다시 실행하지 말 것.
> ⚠️ 이 블록의 "잔여" 서술은 낡았다 — 현황은 파일 머리 표를 보라.

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
3. ✅ data-01 + finding-04 — **완료 (08-10: #466 서버 → prod 적용 → #467 클라). 착수 금지.**
   - 서버 절반은 "새 RPC" 가 아니라 **패치 키 화이트리스트에 'status' 추가**였다(시그니처 불변)
   - updateStatus 는 이제 updateWorkLogSlot(id, {status, reason, editedBy}) 1회다.
     여기에 .update() 를 되살리면 Lost Update 가 재발한다(회귀 가드=statusAudit.test.ts)
   - finding-04 는 삭제 완료 — changeRole 계열 참조가 훅 자기 자신 밖에서 0건임을 실측했다
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

## 세션 5 — OTA-2 견고성 ✅ 완료 8/8 (`ce0f95881`)

> 아래 프롬프트는 **기록용**이다. 다시 실행하지 말 것.

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

## 세션 6 — 1.0.7 빌드분 ✅ 코드 완료 (`b3737621c`) · 빌드는 사람 게이트

> 아래 프롬프트는 **기록용**이다. 다시 실행하지 말 것.

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

## 1.0.6 출시 런북 — ✅ 1·2·5 완료(08-10), 남은 것은 스토어 출시부터

🚨 **1번을 건너뛰면 계측이 첫 세션부터 비어 있다.** `app_session_start` 는 서버 화이트리스트
CHECK 에 걸려 조용히 버려지고(fire-and-forget), 그러면 #407 REVOKE 게이트를 열 분모가
또 안 쌓인다. 클라는 안 깨지지만 **이번 작업의 목적 자체가 무산된다.**

```
1. ✅ 마이그 20260811100000 prod 적용 — run 31433175979, 파리티 208/110 불변 실측 (prod-migrate 워크플로우, 파일 바이트 그대로)
     → list_migrations 실측 + analytics_events CHECK 에 app_session_start 포함 확인
     → 파리티 208/110 불변 확인 (이 마이그는 함수·정책을 안 바꾼다)
2. ✅ 세션4·5·6 묶음 머지 — PR #469 d1e1a3752, CI 13/13 pass
3. ☐ 스토어에서 1.0.6 수동 출시   ← 🔴 여기부터 사람
4. ☐ 출시 반영 확인 (스토어 페이지 버전 표기)
5. ✅ OTA 발행 완료 — group 2249087e-1be8-4802-a309-162a197deb5c, runtime 1.0.6, Commit d1e1a3752(HEAD 전후 대조 일치)
     (긴 명령 중 트리가 교체돼 Commit 라벨이 어긋난 이력 2회)
     ⚠️ 채널은 production 이다 — 원장 구판의 `--branch master` 는 틀렸다
     ⚠️ 발행 트리의 package.json version 이 **1.0.6** 인지 확인
        (1.0.7 이면 runtimeVersion 이 갈려 1.0.6 기기에 도달하지 않는다)
6. ✅ 기록 완료 (위 §착지 기록)
7. ☐ app_config latest_version/recommended_version → 1.0.6  🚨 출시 확인 **후에만**(전에 올리면 스토어에 없는 버전을 안내한다)
8. ☐ **계측 도달 확인** — analytics_events 에서 app_session_start 가 쌓이는지:
     SELECT props->>'v', props->>'ota', count(*) FROM analytics_events
      WHERE event='app_session_start' GROUP BY 1,2;
     여기서 ota 가 'embedded' 가 아닌 행이 보이면 OTA 가 실제로 닿은 것이다
9. ☐ skew-F1 OTA 도달 확인(8번) 후에만 force_update_version 갱신 (순서 강제 1)
10. ☐ 계측 가동 확인(8번) 후에만 data-01 직접 PATCH 차단 트리거 검토 (순서 강제 2)
11. ☐ list_migrations 실측 — 클라가 참조하는 서버 객체가 prod 에 있는지 (#441 재발 방지)
```

## 1.0.7 빌드 런북 (세션6 코드 완료 — 빌드만 남았다)

```
1. ☐ 위 1.0.6 런북 5번(OTA 발행)이 끝난 뒤에 시작한다
2. ☐ npm install (정션 아닌 **메인 체크아웃**에서) → npx expo install --check 0건
3. ☐ npm version patch → 1.0.7 (app.config.ts 가 package.json 을 읽는다)
4. ☐ eas build --platform all --profile production
5. ☐ 실기기 QA — auth-F3 회귀가 핵심이다:
     · 기존 로그인 상태로 업데이트 → **로그아웃되지 않아야 한다**(평문 세션 마이그레이션)
     · 로그아웃 → 재로그인 → 앱 재시작 시 세션 유지
     · 전광판 화면을 5분 이상 켜두고 화면이 안 꺼지는지 (web-02 네이티브 절반)
6. ☐ 스토어 제출 → 승인 → 출시
7. ☐ app_config latest_version/recommended_version → 1.0.7
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
