# UNIQN Mobile UX/IA 감사 보고서

- 감사일: 2026-03-28
- 기준 문서: `docs/uniqn-mobile-ux-ia-report.md`
- 감사 범위: 정적 코드 감사, `npm run quality`, `npm test -- --runInBand`, Playwright 에뮬레이터, live web verify suite, 기존 아티팩트 재판독, Apple 공식 가이드 대조
- 제외/제약: 이 Windows 워크스테이션에서는 실제 iPhone/TestFlight 실행을 수행할 수 없었음. Sentry 실데이터 조회는 `SENTRY_AUTH_TOKEN` 부재로 수행 불가.

## 결론 요약

기존 `uniqn-mobile-ux-ia-report.md`의 큰 IA 서술은 대체로 실제 프로젝트와 맞는다. 특히 공개 진입점이 `/jobs`라는 점, 로그인 후 기본 랜딩이 역할과 무관하게 `/(app)/(tabs)`라는 점, `admin`이 로그인 직후 관리자 대시보드로 자동 진입하지 않는 점, `employer` 탭이 항상 보이고 비고용주는 안내 화면을 본다는 점, QR 탭이 숨김 탭이라는 점은 모두 코드와 자동화 결과가 일치했다.

다만 출시 관점에서 그냥 넘기기 어려운 실제 리스크도 확인됐다. 가장 큰 문제는 딥링크/알림/외부 URL 진입 계층이 실제 Expo 라우트와 불완전하게 어긋나 있다는 점이다. `settings/change-password`, `support/faq`, `admin/users`, `admin/announcements`, `admin/stats` 같은 실제 화면이 존재하는데도 deep link SSOT 타입과 매퍼가 이를 충분히 표현하지 못한다. 이 문제는 문서에 거의 드러나지 않으며, 실제 사용자 기준으로는 알림 탭 이동, 외부 링크, 동일 출처 URL 재진입, 리뷰어 직접 URL 접근에서 오동작할 수 있는 구조다.

크래시 관점에서는 현재 확보한 자동화 범위 안에서 P0 수준의 광범위한 크래시나 blank screen 증거는 없었다. 하지만 "앱이 완전히 크래시가 없다"고 결론내릴 근거도 충분하지 않다. iPhone/TestFlight 실기기 검증을 이번 환경에서는 수행하지 못했고, Sentry 실데이터도 확인하지 못했다.

## 수행한 검증

1. 문서 claim 분해 후 실제 라우트/가드/별칭 코드 대조
2. `npm run quality`
3. `npm test -- --runInBand`
4. 핵심 Playwright 재실행 및 기존 실패 아티팩트 재판독
5. `node scripts/run-live-verify-suite.js`
6. live `diagnostics.json`, 스크린샷, 실패 컨텍스트 분석
7. Apple 공식 가이드 대조
   - [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
   - [Offer account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
   - [Account deletion and Sign in with Apple token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)

## 문서 정합성 판정

| 항목                               | 문서 주장                                                  | 실제 판정 | 근거                                                                                 |
| ---------------------------------- | ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| 공개 진입점                        | 비로그인 공개 중심 경로는 `/jobs`                          | 일치      | `app/index.tsx`의 `PUBLIC_ENTRY_ROUTE = '/(public)/jobs'`                            |
| 인증 후 기본 랜딩                  | 로그인 후 기본 랜딩은 `/(app)/(tabs)`                      | 일치      | `src/shared/navigation/authRedirect.ts`의 `AUTH_ENTRY_ROUTES.appTabs`                |
| admin 기본 랜딩                    | `admin`도 로그인 직후 관리자 대시보드로 자동 진입하지 않음 | 일치      | `getAuthenticatedEntryRoute()`가 role이 아니라 프로필 상태만 보고 결정               |
| employer 탭 가시성                 | employer 탭은 항상 노출되고 비고용주는 안내 화면           | 일치      | `app/(app)/(tabs)/employer.tsx`의 `NonEmployerView` 반환                             |
| QR 노출 방식                       | QR은 숨김 탭으로 운영                                      | 일치      | `app/(app)/(tabs)/_layout.tsx`의 `href: null`                                        |
| admin 웹 별칭                      | `/admin...` 직접 진입 가능                                 | 일치      | `app/admin/index.tsx`, `app/admin/[...slug].tsx`, `resolveAdminAliasHref()`          |
| employer 웹 별칭                   | `/employer...` 직접 진입 가능                              | 일치      | `app/employer/index.tsx`, `app/employer/[...slug].tsx`, `resolveEmployerAliasHref()` |
| settings/legal/delete-account 노출 | 설정에서 약관/개인정보/탈퇴 진입 가능                      | 일치      | `app/(app)/settings/index.tsx`, `delete-account.tsx`                                 |
| Apple 로그인/탈퇴 구조             | Apple 로그인과 계정 삭제 흐름이 존재                       | 부분일치  | 코드상 구현은 존재하나 실기기 재검증은 이번 환경에서 불가                            |
| 웹 직접 URL/딥링크 안정성          | 문서는 대체로 정상 흐름 중심 서술                          | 문서누락  | 실제로는 nested route 딥링크 계층 누락이 있음                                        |

## 실제 제품 리스크

### 1. 딥링크 SSOT 불완전

판정: `UX위험`, `심사위험(간접)`, `출시 전 수정 권고`

실제 존재하는 화면과 deep link 계층이 서로 다르다.

| 경로군                     | 실제 Expo 라우트 존재 | DeepLink 타입 | `RouteMapper` | `pathToRoute()`                                      | 판정   |
| -------------------------- | --------------------- | ------------- | ------------- | ---------------------------------------------------- | ------ |
| `settings/change-password` | 있음                  | 없음          | 없음          | `settings`로 축약                                    | 불일치 |
| `support/faq`              | 있음                  | 없음          | 없음          | `support`로 축약                                     | 불일치 |
| `support/create-inquiry`   | 있음                  | 없음          | 없음          | `support`로 축약                                     | 불일치 |
| `support/my-inquiries`     | 있음                  | 없음          | 없음          | `support`로 축약                                     | 불일치 |
| `admin/users`              | 있음                  | 없음          | 없음          | `admin/dashboard`로 축약                             | 불일치 |
| `admin/stats`              | 있음                  | 없음          | 없음          | `admin/dashboard`로 축약                             | 불일치 |
| `admin/announcements...`   | 있음                  | 없음          | 없음          | `admin/dashboard` 또는 legacy `notifications`로 축약 | 불일치 |

핵심 근거:

- `src/shared/deeplink/types.ts`의 `DeepLinkRoute`는 nested settings/support/admin users/stats/announcements를 표현하지 못함
- `src/shared/deeplink/RouteMapper.ts`는 `settings`, `support`, 일부 admin route만 매핑함
- `src/services/observability/deepLinkService.ts`
  - `case 'settings' => { name: 'settings' }`
  - `case 'support' => { name: 'support' }`
  - `case 'announcements' => { name: 'notifications' }`
  - `case 'admin'`은 `reports`, `inquiries`, `tournaments` 외에는 `admin/dashboard`
- `src/components/app/AuthenticatedRuntime.tsx`가 인증 사용자에 대해 항상 `useDeepLinkSetup()`을 활성화함

영향:

- 알림 링크, 외부 공유 링크, universal link, 같은 URL 재진입, cold start 후 초기 링크 처리에서 의도한 상세 화면 대신 부모 화면 또는 다른 화면으로 이동할 수 있음
- 관리자/설정/고객센터 세부 화면 검증 시 리뷰어가 URL 또는 링크 기반으로 진입하면 실제 기능 접근성이 흔들릴 수 있음
- 문서에는 이 위험이 드러나지 않음

주의:

- `admin` 관련 Playwright 실패 일부는 테스트가 잘못된 URL(`/stats`, `/announcements`)을 사용한 탓도 있다
- 그러나 "딥링크 계층 자체가 세부 경로를 표현하지 못한다"는 문제는 별개의 실제 구조 결함이다

### 2. 품질 게이트가 녹색이 아님

판정: `출시 리스크`, `크래시위험 아님`

- `npm run quality`
  - `type-check` 통과
  - `lint` 경고 16건, 에러 0건
  - `format:check` 실패 3건
    - `src/hooks/useSchedules.ts`
    - `src/repositories/interfaces/IJobPostingRepository.ts`
    - `src/services/jobs/jobService.ts`
- 이는 현재 즉시 크래시 증거는 아니지만, 출시 전 상태가 "clean"하지 않다는 뜻이다

### 3. Jest 1건 실패는 날짜 의존 테스트로 보임

판정: `테스트 문제`, `제품 결함 근거 약함`

- `npm test -- --runInBand`
  - 177 suite 중 176 통과, 1 실패
  - 3578 test 중 3577 통과, 1 실패
- 실패: `src/hooks/__tests__/useReviews.test.ts`
- 원인 방향:
  - 테스트가 `2026-03-20`, `2026-03-25` 같은 고정 날짜를 사용
  - 구현은 `REVIEW_DEADLINE_DAYS = 7` 기준 동작
  - 감사일 `2026-03-28` 기준 stale test 가능성이 높음

### 4. Playwright 전체 실패는 mostly P3, 일부는 테스트 드리프트

판정: `부분일치`

- 전체 E2E: 182개 중 173 통과, 6 실패, 3 스킵
- 실패는 모두 `p3-nice-to-have`

분류:

- `admin-dashboard.spec.ts`
  - 실제 페이지는 정상 로드됨
  - 기대 문구가 실제 UI와 다름
  - `dashboard.page.ts`도 `/stats`를 사용
  - 판정: 테스트 드리프트
- `admin-reports-announcements.spec.ts`
  - page object가 `/announcements`, `/announcements/create`를 사용
  - 실제 admin 별칭은 `/admin/announcements...`
  - 판정: 테스트 경로 오류
- `support-faq.spec.ts`
  - support home에서 `자주 묻는 질문` 클릭 후 FAQ 이동 기대 실패
  - direct FAQ 페이지 자체는 다른 테스트가 통과
  - 판정: low confidence web 클릭/semantics 이슈 또는 테스트 클릭 포인트 이슈
- `error-handling.spec.ts`의 `/settings/change-password`
  - 실패 snapshot 기준 설정 메인 화면이 렌더링됨
  - nested URL 진입/초기 링크 처리와 관련된 실제 라우팅 위험과 방향성이 일치
  - 판정: follow-up 필요, 실제 UX 위험 가능성 높음

### 5. live smoke에서만 보이는 abort 요청

판정: `감시 필요`, `즉시 차단 아님`

- `output/playwright/live-smoke/diagnostics.json`
  - `identitytoolkit.googleapis.com/v1/accounts:update`
  - `initializeUnreadCounter`
  - 일부 섹션에서 `actionableFailedRequestCount` 1~2
- `output/playwright/live-deep/diagnostics.json`
  - `actionableFailedRequestCount: 0`
  - `hydrationTimeoutCount: 0`

해석:

- 재현이 안정적이지 않고 live deep에서는 사라짐
- 현시점에는 "사용자 흐름을 확실히 끊는 blocker"보다 watchlist에 가깝다
- 다만 로그인 후 프로필/읽지 않음 카운터 초기화 구간의 abort 분류 기준은 계속 모니터링해야 한다

### 6. 버전 관리/스토어 연결 상태 미완성

판정: `UX위험`, `심사 준비 미완료`

- `src/services/versionService.ts`
  - `appVersions/{platform}` 문서가 없으면 경고 후 fallback
- live smoke/deep 전반에 `versionWarningCount`가 반복적으로 남음
- `src/constants/version.ts`
  - iOS App Store URL이 `idXXXXXXXXXX` placeholder

영향:

- 강제 업데이트/권장 업데이트 운영을 실제로 신뢰하기 어려움
- 심사/운영 중 "업데이트 버튼" 경험이 부정확해질 수 있음

### 7. 푸시 알림은 실기기 릴리즈 체크가 남아 있음

판정: `출시 리스크`, `실기기 미검증`

근거:

- `src/services/notifications/notificationService.ts`
  - `TODO [출시 전]: EAS Build 후 실제 디바이스에서 FCM 테스트`
- `src/services/notifications/pushNotificationService.ts`
  - `TODO [출시 전]: 푸시 알림 활성화 체크리스트`
  - `현재 상태: 코드 구현 완료, EAS Build 필요`
  - `실제 디바이스에서만 작동합니다` 로그 분기 존재

## 사용자 관점 판정

### 문제없음으로 본 흐름

- 비로그인 공개 진입에서 `/jobs` 열람
- 로그인 후 기본 홈 진입
- 스태프 핵심 홈/스케줄/프로필/QR 핵심 흐름
- employer 탭 접근, 고용주 CRUD 핵심 흐름
- `/admin` 직접 진입과 관리자 기본 대시보드 진입
- live deep 기준 hydration timeout/blank screen 징후 없음

### 문제가 남은 흐름

- 외부 링크/알림/딥링크 기반 세부 화면 진입
- 일부 nested URL 재진입 시 부모 화면으로 흡수될 가능성
- support home에서 FAQ 클릭의 웹 hit target/semantics 안정성
- 실기기 QR 카메라, 푸시 권한, 백그라운드 복귀, Apple 로그인/탈퇴 후 토큰 파기 재검증

## Apple 심사 판정

### 긍정 요소

- 인앱 탈퇴 UI 존재
  - Apple은 [Guideline 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/)에서 account creation을 지원하면 앱 내 account deletion도 제공하라고 명시
- Apple 로그인 구현 존재
  - `app.config.ts`에 `usesAppleSignIn: true`
  - 로그인 화면은 iOS에서만 Apple 버튼 노출
- Apple 계정 탈퇴 시 토큰 파기 흐름 존재
  - `accountDeletionService.ts`에서 `revokeAppleToken` 호출
- 개인정보처리방침/이용약관/내 데이터/계정 삭제 진입점 존재
- iOS 권한 문구, privacy manifests, associated domains 설정 존재

### 심사 리스크

1. 실기기 검증 부재

- Apple은 제출 전 [Before You Submit / 2.1(a)](https://developer.apple.com/app-store/review/guidelines/)에서 crash/bug 테스트, 리뷰 계정, live backend, 필요한 리소스 제공을 요구
- 이번 감사는 Windows 환경이라 실제 iPhone/TestFlight에서 다음 항목을 끝까지 재현하지 못함
  - Apple 로그인
  - Apple 사용자 탈퇴 후 토큰 파기
  - 카메라/QR
  - 푸시 권한/수신
  - 백그라운드 복귀 안정성

2. 홀덤/토너먼트 도메인으로 인한 오해 가능성

- Apple [Guideline 5.3.4](https://developer.apple.com/app-store/review/guidelines/)는 real money gaming, poker, casino games를 강하게 규제
- 이 앱은 코드상으로는 "홀덤 스태프 매칭/운영"에 가깝고, real-money gaming 자체를 제공하는 흔적은 이번 감사에서 확인하지 못했다
- 그러나 `홀덤`, `토너먼트`, `대회 승인` 문맥 때문에 리뷰어가 도메인을 오해할 가능성은 있다
- 이 판단은 코드/문구 기반 추론이며, 심사 메타데이터와 리뷰 노트에서 서비스 성격을 명확히 설명하는 것이 안전하다

3. 스토어 연결 준비 미완료

- iOS store URL placeholder는 제출 전 정리 필요

## 크래시/안정성 판정

현재 근거로는 "광범위한 앱 크래시가 확인됐다"라고 볼 증거는 없다.

근거:

- root에 `ScreenErrorBoundary` 존재
- live deep에서 `hydrationTimeoutCount: 0`
- critical/P0/P1/P2 범위 자동화는 대체로 안정

하지만 아래 이유로 "크래시 없음"을 확정할 수는 없다.

- iPhone/TestFlight 미검증
- Sentry 실데이터 미조회 (`SENTRY_AUTH_TOKEN` 없음)
- 푸시/카메라/Apple auth/native resume 경로 미검증

따라서 최종 판정은 `크래시 미발견`이지 `무크래시 보증`이 아니다.

## 최종 판정

- 문서-프로젝트 정합성: `대체로 일치`
- 실제 사용자 UX: `핵심 흐름은 대체로 정상, 링크 기반 세부 진입은 위험`
- Apple 심사 준비도: `기초 요건은 상당수 충족, 실기기 검증과 운영 마감 작업이 남음`
- 즉시 출시 가능 여부: `보수적으로는 아직 아님`

출시 전 최소 권고:

1. deep link SSOT를 실제 Expo route 전체와 맞추기
2. `settings/support/admin` nested URL 진입 회귀 테스트 추가
3. iPhone/TestFlight에서 Apple 로그인, 탈퇴, QR, 푸시, resume 검증
4. version config 문서와 실제 iOS store URL 정리
5. smoke에서 보인 abort 요청 2종을 로그/분류 기준 포함해 재추적
