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
| 1.0.6 스토어 출시 | ✅ **Android·웹 출시** / ⏸ **iOS 심사 중** | — | 사용자 확정 (08-11) |
| **1.0.7 빌드 전 준비** | ✅ **완료 (08-11)** | `chore/1.0.7-build-prep` | 아래 §1.0.7 빌드 전 착지 |
| **1.0.7 머지 + 네이티브 빌드** | ✅ **완료 (08-12)** | **#471 `fa205d76a`** | 서버 변경 없음 · 아래 §1.0.7 빌드 착지 |

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

### ✅ 1.0.7 빌드 전 착지 (2026-08-11, 브랜치 `chore/1.0.7-build-prep`)

| 단계 | 결과 | 증거 |
|---|---|---|
| prod 실측 | ✅ 이상 없음 | `list_migrations` 최신 **`20260811100000`** = 레포 일치(미적용 0건) · 함수 **208** / 정책 **110** 불변 · users 27→**31** · work_logs 6 · applications 6 (07:23 UTC) |
| 🔑 **계측 도달 확인** | ✅ **OTA 가 실기기에 닿았다** | `app_session_start` 2건 · `v=1.0.6` · `ota=019fed8e-a5a6-79a3-b270-4a77898f9183`(**`embedded` 아님**) · 06:31→07:01 UTC |
| `app_config` 갱신 | ✅ **android·web 만** | `latest_version`·`recommended_version` → android/web `1.0.6`, **ios 는 `1.0.3` 유지**(심사 중). `jsonb_typeof` 전 키 `object` 유지 확인 (07:31 UTC) |
| `force_update_version` | ⏸ **보류 확정 (1.0.0 유지)** | 아래 §순서 강제 1 판정 참조 |
| 1.0.6 OTA 트리 태깅 | ✅ `ota/1.0.6-production` @ `d1e1a3752` | master 가 1.0.7 로 가면 **이 트리에서만** 1.0.6 함대용 OTA 를 낼 수 있다 (로컬 태그 — 푸시는 사람 판단) |
| 의존성 동기화 | ✅ `npx expo install --check` → **`Dependencies are up to date`** | 메인 체크아웃에서 `npm install`. react-native **0.83.10** · expo-keep-awake **55.0.8** 설치 실측(직전엔 RN 0.83.6 로 낡아 있었다 — `b3737621c` 가 `--package-lock-only` 만 했기 때문) |
| 버전 범프 | ✅ **1.0.6 → 1.0.7** | `npm version patch --no-git-tag-version`. `npx expo config` 실측: `version=1.0.7` · `runtimeVersion={"policy":"appVersion"}` · `web.lang=ko` 유지 |
| QA 체크리스트 | ✅ 신규 `docs/qa/2026-08-11-device-qa-1.0.7.md` | 243줄 · 실행 체크 52항목. 1순위 = auth-F3 자동로그인 회귀 |

🚫 **`npm version patch` 는 `--no-git-tag-version` 으로 돌렸다** — 이 저장소는 squash 머지라
기본 동작이 만드는 `v1.0.7` 태그가 머지 후 고아 커밋을 가리키게 된다.

### 🔴 순서 강제 1 판정 — `force_update_version` 은 **아직 올리지 않는다**

원장은 "skew-F1 OTA 도달 확인 후" 를 조건으로 걸었고 도달은 확인됐다. 그런데도 보류다.

1. **iOS 는 전 사용자가 ≤1.0.5 다** — 1.0.6 이 심사 중이라 올리면 iOS 사용자 전원이 차단된다.
2. **구 빌드는 안내 문구조차 못 띄운다** — `bootstrapCore` 의 `ForceUpdateError` throw 자체는
   1.0.5 빌드에도 있었다(`appInitializeSession.ts:91-97`). #461 이 새로 만든 건 **화면**뿐이다.
   게다가 `ForceUpdateError` 는 `AppError` 가 아니라 일반 `Error` 라 구 `extractUserMessage` 가
   메시지를 **「알 수 없는 오류」로 치환**한다 — 스토어 링크가 없는 정도가 아니라 이유조차 안 보인다.
3. 🔑 **"1.0.5 잔존 기기를 analytics 로 확인하고 올린다" 는 게이트는 구조적으로 무효다.**
   `app_session_start` 계측 **자체가 runtime 1.0.6 OTA 로만 배포**됐다. 1.0.5 기기는 그 OTA 를
   영원히 못 받으므로 이 이벤트를 **발화할 수 없다** — 쿼리는 항상 "1.0.5 트래픽 0" 을 반환한다.
   그 **공허한 0** 을 근거로 값을 올리면 실재하는 구버전 사용자가 **무signal 차단**된다.
   → 잔존 확인의 권위 소스는 **Play Console / App Store Connect 의 버전별 설치 분포**다.
4. ⚠️ 한정 조건(과장 방지): `checkForceUpdate` 는 fail-open 이라(`versionService.ts:172-179`, `:241-242`)
   원격 설정 로드가 실패·타임아웃한 세션은 그냥 통과한다. "전 기기 즉시 차단" 은 아니고,
   값을 되돌리면 다음 콜드스타트에 풀린다 — **비가역 피해가 아니라 무감지 차단**이 위험의 실체다.
5. 🚨 **다음에 물릴 지점**: 나중에 `force_update_version` 을 **1.0.7 로** 올릴 때도 같은 함정이 있다.
   임베디드 1.0.6 바이너리에는 skew-F1 이 없으므로, OTA 를 아직 못 받은 **신규 설치 1.0.6 기기의
   첫 콜드스타트**가 구 `ErrorState` 에 걸린다. `useOtaUpdateGate` 5초 창이 대부분 구제하지만
   보장은 아니다 — **1.0.7 강제 상향은 OTA 포화 후에**.
6. 🚨 **값 모양을 절대 스칼라로 덮지 마라.** `versionService.ts:110` 이 `forceUpdate?.[platform]` 로
   읽으므로 `'1.0.6'` 문자열로 덮으면 `undefined → '0.0.0'` 이 되어 **게이트가 조용히 무력화**된다
   (에러 없음). 반드시 `{"ios","android","web"}` 객체를 유지할 것.

### ✅ 1.0.7 빌드 착지 (2026-08-12, PR #471 `fa205d76a`)

| 단계 | 결과 | 증거 |
|---|---|---|
| 로컬 검증 | ✅ | `npm run quality` **exit 0**(0 errors / 124 warnings=선재) · `npx jest` **664 suites / 7,548 tests / 122 snapshots** 전량 통과(105.9s) |
| `expo config`(production) | ✅ | `version 1.0.7` · `runtimeVersion {policy:'appVersion'}` · `environment 'production'` · `web.lang 'ko'` · `com.uniqn.mobile` |
| `expo-doctor` | ⚠️ **17/19** — 2건은 **선재 baseline** | ①`knip` 스크립트명이 `node_modules/.bin/knip` 과 충돌 ②`expo-modules-core` 직접 의존성 — 후자는 `af6f88083`(install exclude)·`027a5c5a1`(knip 봉인)로 **의도된 상태**. 빌드 비차단 |
| PR #471 CI | ✅ **12/12 pass** | E2E 9m58s · Tests 4m43s · Quality 4종 · Bundle Size · EAS Config Validation |
| master 머지 | ✅ squash `fa205d76a` | 🔑 squash 트리 해시가 PR head 와 **바이트 동일**(`82f6255e6…`) = CI 가 검증한 그 트리가 빌드에 들어갔다 |
| **iOS 빌드** | ✅ **FINISHED** `build#45` (**7분 23초**) | `.ipa` · runtime **1.0.7** · channel `production` · distribution STORE |
| **Android 빌드** | ✅ **FINISHED** `build#43` (**47분 35초** — 대부분 EAS 큐 대기) | `.aab` · runtime **1.0.7** · channel `production` · distribution STORE |
| 커밋 추적성 | ✅ | 두 빌드 모두 `gitCommitHash = fa205d76a` = master HEAD. **긴 명령 전·중·후 3회 `git rev-parse` 대조 — 전부 동일**(트리 교체 실사고 2회의 회귀 가드) |
| prod 정합 | ✅ 무변화 | 파리티 **208/110 불변**(22:53 UTC) · 마이그 미적용 **0건** · `get_advisors(security)` **ERROR 0건**(WARN 133 = SECDEF 노출 131 + leaked-password 1, 전부 기지) |

🔑 **`autoIncrement: true` 가 정상 동작했다** — iOS 44→**45**, Android 42→**43**. `appVersionSource: remote` 라 EAS 가 원격에서 센다.

#### 🔎 빌드 전 위험 스윕 (4렌즈 × 적대적 검증, 15 에이전트) — **차단 사유 0건**

1.0.6 바이너리(`26b227ad5`) 이후의 **네이티브 델타**만 겨냥했다. OTA 로 이미 프로덕션에서 돈 순수 JS 로직은 관심 밖이다.

| 축 | 1.0.6 빌드 | 1.0.7 빌드 | 판정 |
|---|---|---|---|
| `react-native` | 0.83.6 | **0.83.10** | 🔑 **유일한 실질 네이티브 델타.** Hermes 는 **0.14.1 불변**(JS 엔진 동일) · 0.83.10 변경분은 iOS 프리빌트 캐싱 + Yoga `display:contents` 수정 → 저위험 |
| `expo` / `react` | 55.0.28 / 19.2.0 | 동일 | 무변화 |
| `react-native-mmkv` / `nitro-modules` | 4.1.2 / 0.33.2 | **동일**(정확 핀) | Android Kotlin 컴파일 지뢰 없음 |
| `expo-keep-awake` | **전이 의존성으로 이미 설치**(`expo` → `~55.0.8`, 1.0.6 락파일 실측) | 직접 의존성으로 승격 | 🔑 **네이티브 skew 없음.** 새것은 모듈이 아니라 **호출 JS** 다 — `src/hooks/useScreenAwake.ts` 는 `26b227ad5` 에 **없었고**(`git show` 실측) monitor 화면 호출부도 0건 → 현재 2건 |

#### 🍏 그 과정에서 드러난 것 — **두 OS 의 검증 이력이 비대칭이다**

| OS | 세션4·5·6(`#469`) 코드가 실기기에서 돈 적 | 왜 |
|---|---|---|
| Android | ✅ 있다 | 1.0.6 이 출시됐고 runtime 1.0.6 OTA(group `2249087e`)가 도달 |
| **iOS** | ❌ **없다 — 1.0.7 이 최초 실행** | 1.0.6 이 심사 중이라 **출시된 적이 없다** → iOS 기기에 runtime 1.0.6 바이너리가 없다 → OTA 자격이 구조적으로 없다 |

🔑 **인과는 `runtimeVersion` 매칭이지 `app_config.latest_version`(ios=1.0.3) 이 아니다.** 후자는 업데이트 **안내** 값일 뿐 OTA 배포 자격과 인과가 없다 — 스윕이 이 둘을 섞어 서술했기에 정정한다.
📊 방증(약한 증거): `app_session_start` **전량이 `platform=android`**(2건, 08-11 06:31~07:01 UTC). 분모가 2라 결정적이진 않고, 결정적인 것은 위 구조적 논증이다.
→ **QA 는 iOS 를 먼저·더 깊게.** 체크리스트 머리에 `§🍏` 신설. 기기가 1대면 iOS 를 고를 것.

### 🔴 남은 것은 전부 사람 게이트다 (코드 잔여 0 · 서버 잔여 0)

| # | 항목 | 왜 사람이어야 하나 |
|---|---|---|
| 1 | ✅ **1.0.6 스토어 수동 출시** — Android·웹 완료 / iOS 심사 중 | 스토어 콘솔. OTA 는 이미 대기 중이라 출시되는 즉시 신규 설치자에게 함께 도달한다 |
| 2 | ✅ 출시 확인 후 `app_config.latest_version`/`recommended_version` → 1.0.6 (android·web 만) | 🚨 **출시 전에 올리면 스토어에 없는 버전으로 업데이트를 안내**하게 된다 |
| 3 | ⏸ 그 다음 `force_update_version` 검토 — **보류 확정** | 순서 강제 1 판정 참조 (iOS 전원 ≤1.0.5 · 공허한 0) |
| 4 | ✅ 1.0.7 `eas build` **완료** / 🔴 **실기기 QA 남음** | 네이티브 빌드 — 핵심은 **auth-F3 자동로그인 회귀**(업데이트 후 로그아웃되지 않아야 한다) |
| 5 | 🔴 Supabase Auth **Rate Limits** 콘솔 확인 (#408) | 레포로 증명 불가 |
| 6 | 🔴 Supabase **Leaked Password Protection** 켜기 | `get_advisors(security)` 재실측(08-12) — 여전히 **꺼짐**. 켜는 것만으로 끝나는 항목, 코드 변경 0 |
| 7 | 🔴 **GCP 콘솔 — 유출 Google API 키 6건 처리** | 아래 §시크릿 스캐닝 6건 위치 특정 참조. 레포 트리엔 0건이나 **커밋 이력에 영구 잔존**한다 |
| 8 | 🔴 **ASC 심사 노트** 테스트 계정 비밀번호가 08-07 회전 이후 값인지 | 어긋나면 심사 리젝 사유 |

### 🔎 잔여 항목 실측 정정 (2026-08-12)

레포로 증명 **가능한** 잔여는 이번에 전부 실측했다. 결과는 상당수가 **stale** 이었다.

| 항목 | 종전 기록 | 08-12 실측 | 판정 |
|---|---|---|---|
| `ruleset`(#375) | 🔴 미확인 잔여 | `master` **classic branch protection 활성** — required checks = `Quality Gate` · `E2E Gate`, force-push·삭제 차단 | ✅ **이미 적용됨** (rulesets API 는 0건이지만 protection API 가 응답). ⚠️ `enforce_admins:false` 는 남아 있다 |
| #426 LOW/MEDIUM 잔여 | ⏸ ~9건 | **3건 직접 반증** — ①퇴근≥출근 서버 검증 = `20260807180000_work_log_slot_checkout_after_checkin.sql` 존재 ②`no_show` 진입점 = 마이그 2건(`202608082000/210000`) 존재 ③`OrderSheetScreen.tsx` "1,400줄" = 실측 **722줄** | ✅ **목록이 낡았다.** 08-09 전방위 감사(60건)가 이미 흡수했다 |
| Dependabot 알림 | 9건 open (high 8 / medium 1) | `image-size`·`js-yaml`·`nanoid`·`brace-expansion`·`uuid`. **`uuid@7.0.3` 은 `expo → @expo/config-plugins → xcode` 경유**(`npm ls uuid` 실측) = prebuild 전용 | ✅ **전부 빌드타임 체인**. `docs/analysis/2026-08-11-npm-audit-triage.md` 의 21건 판정이 9건에도 그대로 유효 — SDK 57 열차 |
| Dependabot PR #464 | 열림 | `expo-local-authentication` 55.0.16 → **57.0.2**. SDK 55 프로젝트이고 `expo install --check` = `Dependencies are up to date` | ❌ **닫음** + `@dependabot ignore this major version`. 56.0.0 에 최소 iOS 16.4 상향(breaking) |
| Dependabot PR #463 | 열림 | `react-hook-form` 7.82 → 7.84. 핀이 `^7.68.0` 이라 **범위상 이미 허용**되고 실제 버전은 lockfile 이 고정한다 | ⏸ **1.0.7 출시 후로 연기.** 인증 플로우 전체가 이 라이브러리다 — 검증된 스냅샷과 스토어 빌드 사이에 끼우지 않는다 |
| 800줄 규약 초과 | 미집계 | `schedule.tsx` 1,249 · `JobPostingRepository.ts` 1,157 · `useNotifications.ts` 1,079 · `useOpsMutations.ts` 870 · `scheduleService.ts` 807 (`src/types/supabase.ts` 3,654 는 생성 파일이라 제외) | ⏸ **1.0.8 열차.** 스토어 빌드 직전에 손댈 성질이 아니다 |

### 🔴 시크릿 스캐닝 6건 — 위치 특정 (2026-08-12, GitHub API 실측)

**전부 커밋 이력에만 있다. 현재 트리 추적 파일에는 0건이다.** 그러나 레포가 public 이므로 이력은 영구 공개다.

| alert | 커밋 | 경로 | 성격 | 해야 할 일 |
|---|---|---|---|---|
| #1 | `9bed31fe8` 외 6곳 | `app2/src/firebase.ts` · `.env` · `.backup` | **폐기된 `app2/` Firebase 웹 키** | GCP 콘솔에서 **삭제**(app2 는 트리에서 사라졌다) |
| #2 | `24155804b` | `debug-user-role.html` | 동상 | 동상 |
| #3 | `9f89c4b86` | `app2/public/test-notifications.html` | 동상 | 동상 |
| #4 | `74c169982` | `app2/check-jobpostings.js` | 동상 | 동상 |
| #5 | `673a2f39c` | `uniqn-mobile/google-services.json` | **현행 Android Firebase 클라이언트 설정** | 🔑 **삭제하면 안 된다** — 모든 배포 바이너리에 들어가는 공개 식별자다. GCP 에서 **Android 앱 제한 + API 제한**만 건다 |
| #6 | `673a2f39c` | `uniqn-mobile/GoogleService-Info.plist` | **현행 iOS Firebase 클라이언트 설정** | 동상 — **iOS 앱 제한 + API 제한** |

🔑 **#5·#6 을 #1~#4 와 같이 취급하지 마라.** 전자는 설계상 공개되는 클라이언트 식별자이고(방어선은 키 비밀성이 아니라 Firebase 보안 규칙·App Check), 후자는 진짜 유출이다.
🔑 **현재 두 파일은 gitignore + 미추적이고, EAS 시크릿 환경변수**(`GOOGLE_SERVICES_JSON_BASE64` / `GOOGLE_SERVICE_INFO_PLIST_BASE64`)로 빌더에 주입된다(`scripts/eas-build-pre-install.sh`). 배선 자체는 이미 옳다.
🚨 **키를 실제로 폐기·제한하기 전에 GitHub 알림을 닫지 마라** — 닫는 순간 추적 수단이 사라진다.

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
3. ✅ 스토어에서 1.0.6 수동 출시 — **Android·웹 완료 / iOS 는 심사 중**(08-11 사용자 확정)
4. ⏸ iOS 심사 결과 대기 (승인되면 7번의 ios 키를 그때 올린다)
5. ✅ OTA 발행 완료 — group 2249087e-1be8-4802-a309-162a197deb5c, runtime 1.0.6, Commit d1e1a3752(HEAD 전후 대조 일치)
     (긴 명령 중 트리가 교체돼 Commit 라벨이 어긋난 이력 2회)
     ⚠️ 채널은 production 이다 — 원장 구판의 `--branch master` 는 틀렸다
     ⚠️ 발행 트리의 package.json version 이 **1.0.6** 인지 확인
        (1.0.7 이면 runtimeVersion 이 갈려 1.0.6 기기에 도달하지 않는다)
6. ✅ 기록 완료 (위 §착지 기록)
7. ✅ app_config latest/recommended → 1.0.6 — **android·web 만**(07:31 UTC). ios 는 심사 중이라 1.0.3 유지
     ☐ 잔여: iOS 승인·출시 확인 후 ios 키를 1.0.6(또는 그때 출시된 버전)으로
8. ✅ **계측 도달 확인 완료** — `v=1.0.6` / `ota=019fed8e…`(embedded 아님) 2건 · 06:31→07:01 UTC
     🔑 다만 이 쿼리로 **구버전 잔존은 셀 수 없다** — 계측이 runtime 1.0.6 OTA 로만 배포됐기 때문
9. ⏸ **force_update_version — 보류 확정.** 근거 전문은 위 §순서 강제 1 판정 (iOS 전원 ≤1.0.5 · 공허한 0)
10. ⏸ **data-01 직접 PATCH 차단 트리거 — 보류.** 계측은 열렸으나 분모가 2건이고 구버전 인구를
      배제할 근거가 없다. 클라 직접 PATCH 경로는 코드상 이미 0건(실측)이라 급하지 않다.
      재판단 조건 = `app_session_start` 의 `v` 분포가 신버전 우세로 수일 수렴
11. ✅ list_migrations 실측 — prod 최신 `20260811100000` = 레포 완전 일치, 미적용 0건 (07:23 UTC)
```

## 1.0.7 빌드 런북 (세션6 코드 완료 — 빌드만 남았다)

```
1. ✅ 1.0.6 런북 5번(OTA 발행) 완료 — group 2249087e, runtime 1.0.6
2. ✅ npm install (메인 체크아웃, 워크트리 1개 재실측 후) → `npx expo install --check` = **Dependencies are up to date**
3. ✅ `npm version patch --no-git-tag-version` → **1.0.7**. `npx expo config` 로 runtimeVersion 해석 확인
     🚫 `--no-git-tag-version` 필수 — squash 저장소라 기본 태그가 머지 후 고아가 된다
3.5 ✅ **PR #471 → master 머지** (`fa205d76a`) — CI **12/12 pass**. squash 트리 해시가 PR head 와 **바이트 동일**(`82f6255e6…`)
     🔑 순서가 중요하다 — 4번보다 **먼저** 해야 빌드 커밋이 master 이력에서 도달 가능하다
4. ✅ `eas build --platform all --profile production` — **실행 완료 (08-12)**
     · iOS `build#45` · Android `build#43` · 둘 다 `appVersion 1.0.7` / `runtimeVersion 1.0.7` / commit `fa205d76a` / channel `production`
     🚨 **긴 명령이다** — 시작 직전·완료 직후 `git rev-parse HEAD` 대조(트리 교체 실사고 2회) → 이번엔 **동일**(교체 없음)
     🚨 **범프 커밋을 머지한 뒤 빌드하라** — 미머지 브랜치에서 빌드하면 스토어 바이너리의 커밋이
        squash 머지 후 master 이력에서 도달 불가능해진다(추적성 손실)
     ℹ️ EAS 는 **원격 빌드**라 서버에서 lockfile 로 새로 설치한다 — 로컬 node_modules 는 빌드 산출물에
        영향이 없다. 그래도 2번을 하는 이유는 로컬 검증(expo-doctor·실기기 QA 정확성) 정합 때문
     ℹ️ Firebase 네이티브 설정은 **레포에 없다**(gitignore·미추적). EAS 시크릿 환경변수
        `GOOGLE_SERVICES_JSON_BASE64` / `GOOGLE_SERVICE_INFO_PLIST_BASE64` → `scripts/eas-build-pre-install.sh` 가 복원한다.
        빌드 성공 자체가 `assertSupportedNativeFirebaseBuild()` fail-closed 가드 통과의 증거다(`app.config.ts:159-183`)
5. ☐ 실기기 QA — **`docs/qa/2026-08-11-device-qa-1.0.7.md` 를 따를 것**(52항목, 1순위 auth-F3)
     🍏 **iOS 를 먼저·더 깊게** — 두 OS 의 검증 이력이 비대칭이다(체크리스트 머리 §🍏 신설). Android 는 OTA 로
        세션4·5·6 이 이미 프로덕션에서 돌았고, **iOS 는 1.0.6 미출시라 runtime 1.0.6 OTA 를 받을 자격 자체가 없었다**
        → iOS 에겐 1.0.7 이 그 코드 전량의 **최초 실행**이다
     🚨 §0 선행 조건을 어기면 1번이 통째로 무의미해진다: **덮어쓰기 업데이트**(삭제 후 재설치 금지) ·
        **한글/이모지 이름 계정**(UTF-8 청킹 경계는 여기서만 검증된다) · 기기 2대
     🚨 §2(버전 게이트)는 **prod app_config 를 직접 바꾼다** — 실행 전 사람 승인 + 원복 기준값 준수
6. ☐ 스토어 제출 → 승인 → 출시
     🚨 **iOS 는 1.0.6 이 심사 중이면 1.0.7 을 제출할 수 없다**(ASC 는 동시 심사 1개).
        1.0.6 승인·출시가 먼저다. **빌드 자체는 지금 해도 무방**하고 제출만 대기하면 된다
7. ☐ app_config latest_version/recommended_version → 1.0.7 (**출시된 플랫폼 키만**)
     🚨 값은 반드시 `{"ios","android","web"}` **객체**를 유지하라 — 스칼라로 덮으면 `forceUpdate?.[platform]` 이
        `undefined → '0.0.0'` 이 되어 게이트가 **에러 없이 조용히 무력화**된다(`versionService.ts:110`)
8. ☐ 출시 후 `app_session_start` 의 `v` 분포 확인 → 그 뒤에야 force_update / data-01 트리거 재판단
     🍏 iOS 행이 처음 나타나는 시점이 곧 "iOS 가 세션4·5·6 코드를 처음 돌린 시점" 이다(08-12 기준 iOS 계측 **0건**)
9. ☐ **1.0.7 이후 첫 OTA 를 낼 때** — `production` 채널의 현재 최신 update 는 runtime **1.0.6** 이다(08-12 `channel:view` 실측).
     🚨 1.0.7 기기에 닿으려면 **`package.json` 이 1.0.7 인 트리에서** 발행해야 한다(`runtimeVersion = appVersion`).
     🚨 그리고 **1.0.6 함대는 그 순간 갈라진다** — 1.0.6 용 OTA 는 태그 `ota/1.0.6-production`(@`d1e1a3752`, 08-12 원격 push 완료)
        트리에서만 낼 수 있다. 두 함대에 같은 수정을 넣으려면 **발행을 2번** 해야 한다
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

## 사람이 콘솔에서 해야 할 일 (레포로 증명 불가 — 2026-08-11 갱신)

### Supabase Dashboard
- 🔴 **Authentication → Attack Protection → Leaked Password Protection 이 꺼져 있다**
  (`get_advisors(security)` 실측, 08-11). HaveIBeenPwned 대조가 비활성이라 유출 비밀번호가 그대로 통과한다.
  **켜는 것만으로 끝나는 항목** — 코드 변경 0.
- 🔴 **Authentication → Rate Limits** (#408) — `Token refresh requests` 기본값은 IP 당 1,800/hr 다.
  users 31명 규모엔 과대하니 하향 검토. #406 이 클라 로그인 잠금을 지웠으므로 **서버 한도가 유일한 방어선**이다.
  ⚠️ CAPTCHA 는 콘솔에서 켜도 **클라가 토큰을 보내도록 배선돼 있지 않다** — 안심 근거로 삼지 말 것.
- 단일/다중 세션 모드 설정 (auth-F2 실효를 좌우)
- 백업 주기·PITR 활성 여부 (testgap-03 런북 기입용)

### App Store Connect / Play Console
- 🔴 **심사 노트(App Review Information)의 테스트 계정 비밀번호가 2026-08-07 회전 이후 값인지 확인.**
  레포에는 회전 사실만 있고 콘솔 반영 여부는 증명 불가 — **어긋나면 심사 리젝 사유**다.
  대상 계정: `review-staff` / `review-employer` / `review-admin`.
- 🔵 **버전별 설치 분포** — `force_update_version` 을 올릴지 판단할 **유일한 권위 소스**다
  (analytics 로는 구버전을 셀 수 없다. 위 §순서 강제 1 판정 3번 참조).
- ⚪ `pending-employer-staff@uniqn.app` 은 심사 시나리오 미사용 — 이번 제출을 막지 않으나 잔존 리스크로 관리.

### 코드로 확인된 것 (다시 조사하지 말 것)
- ✅ iOS `infoPlist` 권한 문구·Android permissions 전량이 **실사용 코드와 1:1 대응**한다(미사용 권한 선언 0건).
- ✅ 이번에 편입된 `expo-keep-awake`·`expo-secure-store` 는 **새 권한 문구를 요구하지 않는다**.
- ✅ `supabase/functions/` 배포본과 소스에 drift 0건. 미적용 마이그레이션 0건.
