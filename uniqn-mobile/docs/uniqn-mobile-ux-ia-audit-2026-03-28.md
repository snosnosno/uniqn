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
