# UNIQN Mobile UX / IA Report

## 기준

- 기준 코드베이스: `uniqn-mobile`
- 최종 점검일: 2026-03-27
- 점검 방식:
  - Firebase Emulator + Playwright broad sweep
  - Live backend + 실계정/임시 테스트 계정 + Playwright deep sweep
- 이 문서는 “기획 의도”가 아니라 **현재 실제 코드와 실행 결과**를 기준으로 정리한다.

## 핵심 결론

UNIQN은 일반적인 단기 알바앱보다 **행사/포커/토너먼트 운영형 인력 플랫폼**에 가깝다.

- 공개 사용자는 공고를 탐색할 수 있다.
- 스태프는 공고 지원, 일정 확인, QR 출퇴근, 정산/리뷰 흐름을 탄다.
- 고용주는 공고 생성, 지원자 관리, 현장 운영, 정산을 처리한다.
- 관리자는 공지/문의/신고/유저/대회 승인 업무를 담당한다.

다만 실제 라우팅과 동선은 몇 가지 중요한 특성이 있다.

- 비로그인 공개 진입의 실제 중심 경로는 `/jobs`다.
- 인증 후 기본 진입점은 `getAuthenticatedEntryRoute()` 기준 `/(app)/(tabs)`이며 웹 기준 URL은 `/`다.
- `admin`도 로그인 직후 자동으로 관리자 대시보드로 떨어지지 않는다.
- 고용주 탭은 항상 노출되며, 비고용주는 탭 안에서 등록 유도 화면을 본다.
- QR 화면은 하단 탭에 고정 노출되지 않고 숨김 탭(`href: null`)로 운영된다.

## 실제 진입 구조

### 공개 / 인증

| 구분            | 실제 웹 경로       | 실제 내부 경로            | 비고                                                    |
| --------------- | ------------------ | ------------------------- | ------------------------------------------------------- |
| 스플래시        | `/`                | `app/index.tsx`           | 비로그인 시 `/jobs`로, 로그인 시 `/(app)/(tabs)`로 보냄 |
| 공개 공고 목록  | `/jobs`            | `/(public)/jobs`          | 비로그인 공개 진입의 실제 기준 경로                     |
| 공개 공고 상세  | `/jobs/:id`        | `/(public)/jobs/[id]`     | 상세 열람 후 지원 시 로그인 유도                        |
| 로그인          | `/login`           | `/(auth)/login`           | redirect 파라미터 사용                                  |
| 회원가입        | `/signup`          | `/(auth)/signup`          | 일반/소셜 미완료 공용                                   |
| 비밀번호 재설정 | `/forgot-password` | `/(auth)/forgot-password` | 계정 복구                                               |

### 인증 후 기본 흐름

| 역할     | 기본 진입 | 실제 랜딩                 |
| -------- | --------- | ------------------------- |
| staff    | 인증 성공 | `/(app)/(tabs)` -> 웹 `/` |
| employer | 인증 성공 | `/(app)/(tabs)` -> 웹 `/` |
| admin    | 인증 성공 | `/(app)/(tabs)` -> 웹 `/` |

중요:

- `admin`의 “관리자 대시보드”는 별도 전용 시작 화면이 아니라 프로필 메뉴 또는 관리자 URL 별칭을 통해 진입한다.
- 따라서 과거 문서처럼 “admin 기본 랜딩 = 관리자 대시보드”로 쓰면 실제와 다르다.

## 탭 / 스택 IA

### 메인 탭

실제 하단 탭 구성은 아래와 같다.

- 구인구직
- 내 스케줄
- 내 공고
- 프로필

QR은 탭 파일이 존재하지만 하단 탭에서는 숨겨져 있다.

- 근거: `app/(app)/(tabs)/_layout.tsx`
- `name="qr"`에 `href: null`

### 스태프

| 기능        | 실제 경로                | 비고                        |
| ----------- | ------------------------ | --------------------------- |
| 구인구직 홈 | `/(app)/(tabs)`          | 웹 `/`                      |
| 공고 상세   | `/(app)/jobs/[id]`       | 로그인 이후 상세            |
| 지원        | `/(app)/jobs/[id]/apply` | 실제 지원 제출 가능         |
| 일정        | `/(app)/(tabs)/schedule` | 지원/확정/완료 일정         |
| 알림        | `/(app)/notifications`   | 상태 변화 확인              |
| QR          | `/(app)/(tabs)/qr`       | 숨김 탭, 직접 진입/CTA 진입 |
| 리뷰 대기   | `/(app)/reviews/pending` | 리뷰 작성 전 대기           |
| 리뷰 작성   | `/(app)/reviews/write`   | 근무 후 리뷰                |
| 리뷰 이력   | `/(app)/reviews/history` | 버블스코어 포함             |
| 프로필      | `/(app)/(tabs)/profile`  | 공지/설정/고객센터 허브     |

### 고용주

| 기능           | 실제 경로                                            | 비고                  |
| -------------- | ---------------------------------------------------- | --------------------- |
| 내 공고 탭     | `/(app)/(tabs)/employer`                             | 항상 보임             |
| 고용주 등록    | `/(app)/employer-register`                           | 비고용주 진입 시 유도 |
| 공고 생성      | `/(employer)/my-postings/create`                     | 라이브 검증 완료      |
| 공고 목록/운영 | `/(employer)/my-postings`                            | 실제 파일 존재        |
| 공고 상세      | `/(employer)/my-postings/[id]`                       | 운영 허브             |
| 지원자 관리    | `/(employer)/my-postings/[id]/applicants`            | 확정/거절             |
| 취소 요청      | `/(employer)/my-postings/[id]/cancellation-requests` | 검토/처리             |
| 정산/현장 운영 | `/(employer)/my-postings/[id]/settlements`           | QR/정산/근무시간      |

### 관리자

| 기능      | 실제 내부 경로                                  | 실제 웹 별칭                               |
| --------- | ----------------------------------------------- | ------------------------------------------ |
| 대시보드  | `/(admin)`                                      | `/admin`, `/admin/dashboard`               |
| 통계      | `/(admin)/stats`                                | `/admin/stats`                             |
| 사용자    | `/(admin)/users`, `/(admin)/users/[id]`         | `/admin/users`, `/admin/users/:id`         |
| 신고      | `/(admin)/reports`, `/(admin)/reports/[id]`     | `/admin/reports`, `/admin/reports/:id`     |
| 문의      | `/(admin)/inquiries`, `/(admin)/inquiries/[id]` | `/admin/inquiries`, `/admin/inquiries/:id` |
| 공지      | `/(admin)/announcements...`                     | `/admin/announcements...`                  |
| 대회 승인 | `/(admin)/tournaments`                          | `/admin/tournaments`                       |

중요:

- 내부 Expo 경로는 `/(admin)` 그룹이지만, 웹 직접 진입용으로 `app/admin/...` 별칭 라우트를 추가해 `/admin...` 계열을 실제로 받을 수 있게 맞췄다.
- 웹에서 별칭으로 진입해도 내부 canonical URL은 `/` 또는 그룹이 제거된 실제 라우트로 수렴할 수 있다.

## 실제 문서-앱 불일치와 정정

이번 점검에서 문서와 실제 앱이 다르거나 모호했던 항목은 아래와 같다.

1. 공개 진입점

- 이전 문서 뉘앙스: 앱 첫 진입이 막연한 “공개 홈”
- 실제: `app/index.tsx`가 스플래시 역할을 하며 비로그인 사용자를 `/jobs`로 보낸다.

2. admin 기본 랜딩

- 이전 문서 뉘앙스: admin은 기본적으로 관리자 대시보드에 진입
- 실제: 인증 후 기본 진입은 모든 역할 공통으로 `/(app)/(tabs)`다.
- 관리자 대시보드는 프로필 메뉴 또는 `/admin` 별칭으로 들어간다.

3. 고용주 탭 노출

- 이전 문서 뉘앙스: 고용주만 별도 탭을 가진다
- 실제: 하단 탭의 `employer`는 항상 보인다.
- 비고용주는 탭 안에서 `NonEmployerView`를 본다.

4. QR 진입 방식

- 이전 문서 뉘앙스: QR이 일반 탭처럼 보일 수 있음
- 실제: `href: null` 숨김 탭이다.
- 즉 파일은 탭 그룹 안에 있지만 하단 탭바에서는 노출되지 않는다.

5. 관리자/고용주 웹 URL

- 이전 상태: `/admin`, `/admin/reports`, `/employer/...` 같은 경로는 deep link 해석은 되지만 실제 웹 직접 진입 시 404/경고가 섞일 수 있었다.
- 현재: 웹 별칭 라우트를 추가해 직접 진입을 정상화했다.

6. unread counter 초기화

- 이전 상태: live 웹에서 `?emulator=false`로 시작해도 라우팅 후 오래된 localStorage override 때문에 Cloud Functions가 `localhost:5001`로 새는 경우가 있었다.
- 현재: 쿼리 기반 emulator override를 localStorage에 즉시 반영하도록 수정해 live 모드 유지가 실제로 확인됐다.

## 2026-03-27 실제 검증 결과

### 1차: Emulator broad sweep

실행 결과:

- Playwright 회귀 통과
- `85 passed, 2 skipped`

주요 검증 범위:

- 비로그인 공개 진입
- 로그인 / 로그아웃 / 세션
- staff / employer / admin RBAC
- 공고 목록 / 상세 / 지원
- employer 공고 생성 / 수정 / 마감 / 지원자 확인
- 설정 / 프로필 / 알림 / 스케줄 / QR

증빙 로그:

- `output/playwright/logs/p0-critical-final-emulator.log`
- `output/playwright/logs/p1-p2-emulator-rerun-final.log`

### 2차: Live deep sweep

실행 결과:

- 공개 공고 진입: 성공
- staff 로그인/프로필/알림/스케줄/QR: 성공
- employer 탭/공고 생성 진입/프로필: 성공
- admin `/admin` 직접 진입: 성공
- live unread counter emulator 누수: 재현되지 않음

실제 확인값:

- 공개 경로: `/jobs`
- staff 랜딩 URL: `/`
- admin 랜딩 URL: `/`
- `adminText`에 `404` 미포함
- `localhost:5001 initializeUnreadCounter` 실패 0건

Live 증빙:

- `output/playwright/live-smoke/diagnostics.json`
- `output/playwright/live-smoke/public-home.png`
- `output/playwright/live-smoke/staff-landing.png`
- `output/playwright/live-smoke/staff-schedule.png`
- `output/playwright/live-smoke/staff-notifications.png`
- `output/playwright/live-smoke/staff-qr.png`
- `output/playwright/live-smoke/staff-profile.png`
- `output/playwright/live-smoke/employer-tab.png`
- `output/playwright/live-smoke/employer-create.png`
- `output/playwright/live-smoke/employer-profile.png`
- `output/playwright/live-smoke/admin-dashboard.png`
- `output/playwright/live-smoke/admin-profile.png`

추가 headed Playwright 확인:

- `/admin?emulator=false` 비로그인 직접 진입 시 로그인 화면과 `redirect=%2F%28admin%29` 확인
- 산출물:
  - `.playwright-cli/page-2026-03-26T17-12-59-474Z.yml`
  - `.playwright-cli/console-2026-03-26T17-12-49-218Z.log`

## 남아 있는 운영상 리스크

1. 원격 버전 설정 문서 없음 경고

- live 검증 동안 staff/employer/admin 공통으로 `versionService` 경고가 남았다.
- 기능 장애는 아니지만 운영 문서/Remote Config 데이터 부재 상태다.

2. 웹 canonical URL과 내부 Expo 경로의 차이

- `/admin` 같은 별칭은 지원되지만 내부 canonical URL은 `/`로 수렴한다.
- 외부 공유 링크 정책을 더 엄격히 운영하려면 별도 canonical URL 전략이 필요하다.

3. Firestore Listen `net::ERR_ABORTED`

- live 브라우저 종료/화면 전환 시 Firestore streaming request aborted 로그가 남는다.
- 이번 회차에서는 사용자 기능 장애로 이어지지 않았다.

## 웹에서 완전 검증할 수 없는 항목

아래 항목은 웹 브라우저 기준으로 일부만 확인 가능하거나 완전 검증이 불가능하다.

- QR 카메라 스캔
  - 웹에서는 QR 진입 화면과 카메라 관련 UI 진입만 확인 가능
  - 실제 네이티브 카메라 스캔 안정성은 디바이스 검증 필요

- 생체인증
  - 웹 완전 검증 불가
  - 실제 사용성은 iOS/Android 네이티브에서 확인 필요

- 푸시 실수신
  - 웹에서 실제 앱 푸시 수신 검증 불가
  - 실디바이스/FCM/APNs 경로 필요

- Apple 로그인
  - 웹 기준 완전 검증 불가
  - iOS 네이티브 검증 필요

## 참고 코드

- 진입/리다이렉트: `app/index.tsx`
- 인증 후 기본 진입: `src/shared/navigation/authRedirect.ts`
- 권한 가드: `src/hooks/useAuthGuard.ts`
- 앱 초기화/세션 복구: `src/hooks/useAppInitialize.ts`
- 탭 노출/QR 숨김: `app/(app)/(tabs)/_layout.tsx`
- 고용주 탭: `app/(app)/(tabs)/employer.tsx`
- 관리자 레이아웃: `app/(admin)/_layout.tsx`
- 웹 관리자 별칭: `app/admin/index.tsx`, `app/admin/[...slug].tsx`
- 웹 고용주 별칭: `app/employer/index.tsx`, `app/employer/[...slug].tsx`
- emulator/live 분기: `src/lib/emulatorMode.ts`
