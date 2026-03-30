> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 기록, 레거시 참고 또는 시점 한정 로그입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/guides/DEPLOYMENT.md`를 우선 확인하세요.

# UNIQN Mobile UX/IA 감사 보고서

- 감사 일시: 2026-03-28
- 기준 문서: `docs/uniqn-mobile-ux-ia-report.md`
- 기준 저장소: `uniqn-mobile`
- 감사 범위:
  - 정적 코드 대조
  - `npm run quality`
  - `npm test -- --runInBand`
  - `npm run e2e`
  - 기존 실패 아티팩트 및 page object 재검토

## 감사 결론

기준 문서의 큰 IA 설명은 현재 프로젝트와 대체로 일치한다. 다만 이전 감사 성격의 메모에 섞여 있던 `deep link SSOT 부족`, `format:check 실패`, `Jest 실패`는 2026-03-28 기준 사실과 다르므로 핵심 리스크로 유지하면 안 된다.

이번 재감사에서 실제로 의미 있었던 리스크는 다음 세 가지였다.

- 스케줄 화면의 월 네비게이터 중복
- 알림 `모두 읽음`과 고용주 필터의 웹 semantics 취약
- 운영 측면의 버전/푸시/Functions 로그 watchlist

위 세 항목 중 UX/UI와 semantics는 이번 수정으로 정리됐고, 운영 watchlist만 후속 추적 대상으로 남겼다.

## 감사 매트릭스

| 항목                                                                | 감사 결과    | 근거                                                          |
| ------------------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| 공개 진입이 `/jobs`다                                               | 일치         | `app/index.tsx`, public pages E2E                             |
| 인증 후 기본 진입은 역할 공통 `/(app)/(tabs)`다                     | 일치         | auth redirect 로직, 로그인 E2E                                |
| admin은 로그인 직후 자동으로 관리자 대시보드에 강제 이동하지 않는다 | 일치         | 실제 landing URL 검증, 관리자 별칭 경로 E2E                   |
| employer 탭은 항상 노출되고 비고용주는 안내 UI를 본다               | 일치         | `app/(app)/(tabs)/employer.tsx`                               |
| QR은 하단 탭에서 숨김 탭(`href: null`)로 운영된다                   | 일치         | `app/(app)/(tabs)/_layout.tsx`                                |
| nested settings/support/admin/employer deep link가 표현되지 않는다  | 불일치       | 현재 구현은 타입, mapper, deepLinkService, 테스트를 모두 보유 |
| quality가 깨져 있다                                                 | 불일치       | `npm run quality` 통과                                        |
| Jest가 실패한다                                                     | 불일치       | `npm test -- --runInBand` 통과                                |
| 스케줄 월 네비게이터가 중복된다                                     | 재현 후 수정 | `schedule.tsx`, `CalendarView.tsx`, schedule E2E              |
| 알림 `모두 읽음` 버튼 semantics가 약하다                            | 재현 후 수정 | `notifications.tsx`, role/query 안정화                        |
| 고용주 공고 필터 `tab` semantics가 약하다                           | 재현 후 수정 | `my-postings/index.tsx`, employer E2E                         |

## 이번에 반영한 수정

### 제품

- 스케줄 화면 월 이동 UI를 단일 소스로 정리
- 알림 `모두 읽음` 액션에 명시적 button semantics 추가
- `/my-postings` 필터 칩과 컨테이너에 `tab` / `tablist` semantics 추가

### E2E

- 스케줄 월 제목 locator가 단일 요소인지 검증 추가
- 설정 page object를 직접 URL 기준으로 강화
- 설정 메인에서 비밀번호 변경 / 계정 삭제 이동 회귀 추가
- 고용주 공고 필터 role 기반 검증 추가

## 최종 검증 결과

### 정적 / 단위

- `npm run quality`: 통과
- `npm test -- --runInBand`: 통과
  - 178 suites passed
  - 3522 tests passed

### E2E

- targeted 회귀: 통과
  - settings 전용 재검증 `18 passed`
- 전체 회귀: 통과
  - `182 passed / 3 skipped`

## 운영 watchlist

### 1. 버전 운영 진실 소스

- `src/services/versionService.ts`
  - `appVersions/{platform}` 문서가 없으면 fallback 처리
  - 로그:
    - `원격 버전 설정 문서 없음`
    - `원격 버전 설정 없음 - 업데이트 체크 스킵`

해석:

- 앱이 깨지지는 않지만, 원격 버전 정책이 비어 있으면 업데이트 운영의 데이터 정합성이 약해진다.

### 2. iOS 스토어 URL

- `src/constants/version.ts`
  - `https://apps.apple.com/app/uniqn/idXXXXXXXXXX`

해석:

- 출시 직전 실제 App Store ID 반영이 필요하다.

### 3. 푸시 실기기 검증

- `src/services/notifications/notificationService.ts`
- `src/services/notifications/pushNotificationService.ts`

해석:

- 코드 상 TODO가 남아 있으며, EAS Build 후 실제 기기 검증이 필요하다.

### 4. Functions 로그 모니터링

- `functions/src/utils/notificationUtils.ts:568`
  - `FCM 토큰이 없습니다`
- `functions/src/triggers/workLogs.ts:266`
  - `Skipping worklog completion sync for missing application`

해석:

- Emulator에서는 허용 가능한 잡음일 수 있지만, 운영에서 누적 빈도가 높으면 알림 전달률과 worklog-application 정합성 이슈로 이어질 수 있다.

## 최종 판단

- 문서-실제 프로젝트 정합성: 높음
- 이전 문서의 오래된 경고 항목: 제거 또는 축소 필요
- 사용자 관점의 핵심 UX/UI 리스크: 이번 수정으로 해소
- 남은 리스크: 운영 정합성 및 실기기 출시 게이트

# UNIQN Mobile UX / IA Report

## 기준

- 기준 저장소: `uniqn-mobile`
- 최종 재검증 일시: 2026-03-28
- 검증 기준:
  - `npm run quality`
  - `npm test -- --runInBand`
  - `npm run e2e`
- 판단 원칙:
  - 문서보다 현재 코드와 실제 실행 결과를 우선한다.
  - Emulator/Web 기준 검증과 실기기 출시 게이트는 분리해서 기록한다.

## 핵심 결론

`uniqn-mobile-ux-ia-report.md`의 큰 IA 서술은 현재 프로젝트와 대체로 일치한다. 공개 진입은 `/jobs`, 인증 후 기본 진입은 역할 공통으로 `/(app)/(tabs)` 계열이며, 관리자도 로그인 직후 곧바로 관리자 대시보드로 강제 이동하지 않는다. 고용주 탭은 항상 노출되고, 비고용주는 안내 화면을 보며, QR은 숨김 탭(`href: null`) 방식으로 운영된다.

이번 재검증으로 과거 문서의 핵심 오류도 정리했다. `settings/support/admin/employer`의 nested deep link가 SSOT에 없다는 결론은 현재 코드 기준으로 성립하지 않는다. `src/shared/deeplink/types.ts`, `src/shared/deeplink/RouteMapper.ts`, `src/services/observability/deepLinkService.ts`와 관련 테스트가 이미 해당 경로를 광범위하게 커버한다. 또한 `format:check` 실패, Jest 실패도 현재 상태와 맞지 않는다.

대신 실제 사용자 관점에서 더 중요했던 문제는 UX/UI와 웹 semantics였다. 스케줄 화면의 월 네비게이터가 중복 노출되던 문제, 알림의 `모두 읽음` 액션이 웹에서 버튼 의미가 약했던 문제, 고용주 공고 리스트 필터가 시각적으로는 정상이어도 `tab` semantics가 불안정했던 문제를 이번에 확인했고 제품과 E2E를 함께 보강했다.

## 실제 IA 스냅샷

### 공개 / 인증

| 구분           | 실제 URL           | 비고                                      |
| -------------- | ------------------ | ----------------------------------------- |
| 스플래시       | `/`                | 비로그인 사용자는 공개 공고 진입으로 연결 |
| 공개 공고 목록 | `/jobs`            | 공개 진입의 실제 기준 경로                |
| 공개 공고 상세 | `/jobs/:id`        | 비로그인 상태에서도 열람 가능             |
| 로그인         | `/login`           | 인증 실패/리다이렉트 처리 포함            |
| 회원가입       | `/signup`          | 다단계 가입 플로우                        |
| 비밀번호 찾기  | `/forgot-password` | 인증 보조 플로우                          |

### 인증 후 공통

| 역할     | 기본 진입       | 설명                                              |
| -------- | --------------- | ------------------------------------------------- |
| staff    | `/(app)/(tabs)` | 웹 기준 canonical URL은 `/`                       |
| employer | `/(app)/(tabs)` | 하단 탭에서 고용주 진입                           |
| admin    | `/(app)/(tabs)` | 관리자 기능은 메뉴 또는 `/admin...` 별칭으로 진입 |

### 주요 영역

- Staff:
  - 구인구직
  - 스케줄
  - 알림
  - QR
  - 리뷰 대기 / 작성 / 이력
  - 프로필 / 설정 / 고객센터
- Employer:
  - 하단 탭의 employer 진입
  - `/my-postings`
  - `/my-postings/create`
  - `/my-postings/:id`
  - `/my-postings/:id/applicants`
  - `/my-postings/:id/settlements`
- Admin:
  - `/admin`
  - `/admin/stats`
  - `/admin/users`
  - `/admin/reports`
  - `/admin/inquiries`
  - `/admin/announcements`
  - `/admin/tournaments`

## 이번 재검증에서 정정한 문서 항목

### 1. Deep link SSOT 부족 결론은 현재 기준으로 틀림

현재 코드는 아래 경로를 타입, mapper, observability parse/create, 테스트까지 일관되게 가지고 있다.

- `settings/change-password`
- `settings/delete-account`
- `support/faq`
- `support/create-inquiry`
- `support/my-inquiries`
- `employer/my-postings`
- `admin/stats`
- `admin/announcements`

관련 근거:

- `src/shared/deeplink/types.ts`
- `src/shared/deeplink/RouteMapper.ts`
- `src/services/observability/deepLinkService.ts`
- `src/shared/deeplink/__tests__/RouteMapper.test.ts`
- `src/services/observability/__tests__/deepLinkService.test.ts`

### 2. Quality / Jest 실패 서술은 현재 기준으로 틀림

2026-03-28 기준 재실행 결과:

- `npm run quality`: 통과
- `npm test -- --runInBand`: 통과
  - 178 suites passed
  - 3522 tests passed

즉, 문서에 `format:check` 실패나 Jest 실패를 현재 핵심 결론처럼 남겨두면 실제 상태를 왜곡한다.

## 이번 재검증에서 발견 후 수정한 UX/UI 및 접근성 항목

### 1. 스케줄 월 네비게이터 중복

문제:

- 스케줄 탭 상단과 캘린더 내부 헤더가 모두 월 이동 UI를 렌더링해 월 제목 locator가 중복됐다.
- 실제 사용자 입장에서도 같은 기능이 두 번 보여 시선이 분산되고, Playwright locator도 불안정했다.

조치:

- 상단 월 네비게이터만 단일 소스로 남겼다.
- 캘린더 쪽은 요일 헤더만 유지하도록 정리했다.
- E2E에서 월 제목이 단일 요소인지 직접 검증하도록 보강했다.

관련 파일:

- `app/(app)/(tabs)/schedule.tsx`
- `src/components/schedule/CalendarView.tsx`
- `e2e/pages/app/tabs/schedule.page.ts`
- `e2e/tests/p2-standard/schedule-tab.spec.ts`

### 2. 알림 `모두 읽음` 버튼 semantics 보강

문제:

- 시각적으로는 액션이 보였지만 웹 role/query 기준으로는 안정적인 버튼 의미가 약했다.

조치:

- `accessible`
- `role="button"`
- `accessibilityRole="button"`
- `accessibilityLabel="모두 읽음"`
- `testID="notifications-mark-all-read"`

관련 파일:

- `app/(app)/notifications.tsx`

### 3. 고용주 공고 필터 tab semantics 보강

문제:

- `/my-postings` 필터 칩은 눈으로는 동작했지만 웹 기준 `tablist/tab/selected` semantics가 약했다.

조치:

- 필터 컨테이너에 `tablist`
- 각 칩에 `tab`
- `accessibilityState.selected`
- 안정적인 label / testID 부여

관련 파일:

- `app/(employer)/my-postings/index.tsx`
- `e2e/tests/p1-important/employer-posting-crud.spec.ts`

### 4. 설정 화면 직접 URL / 클릭 플로우 회귀 강화

조치:

- `/settings/change-password`
- `/settings/delete-account`
- `/settings/profile`

직접 URL 기반 page object를 강화하고, 설정 메인에서 각 페이지로 이동하는 회귀를 추가했다.

관련 파일:

- `e2e/pages/app/settings/change-password.page.ts`
- `e2e/pages/app/settings/delete-account.page.ts`
- `e2e/pages/app/settings/profile-edit.page.ts`
- `e2e/pages/app/settings/settings.page.ts`
- `e2e/tests/p2-standard/settings.spec.ts`

## 데이터 / 운영 정합성 watchlist

아래 항목은 이번 범위에서 제품 blocker로 단정하지 않았지만, 운영 관점에서 추적이 필요한 리스크다.

### 1. Remote version 문서 fallback 의존

- `src/services/versionService.ts`
  - `appVersions/{platform}` 문서를 읽음
  - 문서가 없으면 `원격 버전 설정 문서 없음`
  - 이후 `원격 버전 설정 없음 - 업데이트 체크 스킵`

의미:

- 버전 체크는 graceful fallback 되지만, 강제 업데이트/권장 업데이트 운영의 진실 소스가 비어 있으면 배포 통제가 약해진다.

### 2. iOS 스토어 URL placeholder

- `src/constants/version.ts`
  - `https://apps.apple.com/app/uniqn/idXXXXXXXXXX`

의미:

- iOS 스토어 등록 전까지는 의도된 placeholder지만, 실제 출시 직전에는 반드시 실 앱 ID로 교체해야 한다.

### 3. 푸시 / FCM 실기기 검증 미완료

- `src/services/notifications/notificationService.ts`
  - `TODO [출시 전]: EAS Build 후 실제 디바이스에서 FCM 테스트`
- `src/services/notifications/pushNotificationService.ts`
  - `TODO [출시 전]: 푸시 알림 활성화 체크리스트`

의미:

- Emulator/Web 기준 UI와 로직은 검증했지만, 실제 기기 권한 플로우와 수신 동작은 출시 게이트로 별도 확인이 필요하다.

### 4. Functions 로그 watchlist

- `functions/src/utils/notificationUtils.ts:568`
  - `FCM 토큰이 없습니다`
- `functions/src/triggers/workLogs.ts:266`
  - `Skipping worklog completion sync for missing application`

의미:

- Emulator 문맥에서는 곧바로 결함으로 단정하지 않았지만, 운영에서 반복 빈도가 높으면 데이터 동기화 및 알림 전달률 점검이 필요하다.

## 검증 결과

### 정적 / 단위 검증

- `npm run quality`: 통과
- `npm test -- --runInBand`: 통과
  - 178 passed suites
  - 3522 passed tests

### E2E 검증

- 문제 재현 및 수정 후 targeted 회귀:
  - schedule
  - notifications
  - settings
  - employer posting CRUD
- 최종 전체 회귀:
  - `npm run e2e`
  - 결과: 182 passed / 3 skipped

### 해석

현재 repo와 emulator/web 검증 범위 안에서는 문서와 실제 앱의 IA가 대체로 맞고, 이번에 발견한 UX/UI 및 semantics 문제도 재현 후 수정됐다. 따라서 과거 문서가 강조하던 “deep link SSOT 부족”과 “quality/Jest 실패”는 더 이상 핵심 리스크가 아니다.

다만 실기기 iPhone/TestFlight, Apple 로그인, 카메라 QR, 실제 push 수신은 이번 완료 조건에 포함하지 않았다. 이 항목들은 출시 전 별도 게이트로 남겨야 한다.

## 최종 판단

- IA 정합성: 대체로 일치
- 사용자 경험: 이번 재검증에서 발견한 주요 중복/semantics 문제는 수정 완료
- 데이터/운영 정합성: 버전 문서, iOS 스토어 URL, push 실기기, Functions 로그는 watchlist 유지
- 출시 준비도: emulator/web 기준 blocker 없음, 실기기 검증은 별도 필요
