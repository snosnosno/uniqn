# E2E 테스트 가이드

## 개요

Playwright 기반 E2E 테스트 스위트. Firebase Emulator 위에서 Expo Web 빌드를 테스트합니다.

- **테스트 수**: 182개 (29 spec 파일)
- **프레임워크**: Playwright + TypeScript
- **대상**: Expo Web (localhost:8081 dev / localhost:3000 CI)

## 사전 요구사항

```bash
# Node.js 20+
node --version

# Java 17+ (Firebase Emulator)
java --version

# Firebase CLI
firebase --version

# Playwright 브라우저 설치
npm run e2e:setup
```

## 빠른 시작

```bash
# 1. Firebase Emulator 시작 (프로젝트 루트에서)
cd ..
firebase emulators:start --only auth,firestore

# 2. E2E 테스트 실행 (uniqn-mobile 에서)
npm run e2e

# 3. UI 모드로 실행 (디버깅용)
npm run e2e:ui

# 4. 브라우저 표시 모드
npm run e2e:headed

# 5. 리포트 확인
npm run e2e:report
```

## 테스트 구조

```
e2e/
├── playwright.config.ts       # Playwright 설정
├── global-setup.ts            # 에뮬레이터 확인 + 계정 시딩
├── global-teardown.ts         # 정리
├── tsconfig.json              # E2E 전용 TS 설정
├── .env.test                  # 에뮬레이터 환경변수
│
├── fixtures/                  # 테스트 픽스처
│   ├── base.fixture.ts        # 확장 test 객체
│   ├── auth.fixture.ts        # storageState 생성
│   ├── test-accounts.ts       # 테스트 계정 정의
│   └── storage-states/        # 역할별 인증 세션 (gitignored)
│
├── factories/                 # 테스트 데이터 팩토리
│   ├── user.factory.ts
│   ├── job.factory.ts
│   ├── application.factory.ts
│   ├── work-log.factory.ts
│   ├── review.factory.ts
│   └── notification.factory.ts
│
├── helpers/                   # 공통 유틸리티
│   ├── firebase-admin.ts      # Admin SDK 헬퍼
│   ├── firebase-emulator.ts   # 에뮬레이터 관리
│   ├── auth-helpers.ts        # 인증 주입
│   ├── wait-helpers.ts        # 대기 유틸리티
│   ├── navigation-helpers.ts  # 라우팅 헬퍼
│   └── assertion-helpers.ts   # 텍스트 상수 + 단언
│
├── pages/                     # Page Object Model
│   ├── base.page.ts
│   ├── auth/                  # login, signup, forgot-password
│   ├── app/                   # tabs, settings, job-detail, notifications
│   ├── employer/              # my-postings, create-posting, posting-detail
│   ├── admin/                 # dashboard, users, reports, announcements
│   ├── public/                # public-jobs
│   └── components/            # toast, modal, loading
│
├── scripts/
│   └── seed-emulator.ts       # 독립 시딩 스크립트
│
└── tests/                     # 테스트 파일
    ├── p0-critical/           # 7 specs (27 tests) - 배포 차단
    ├── p1-important/          # 6 specs (42 tests) - 주요 기능
    ├── p2-standard/           # 5 specs (42 tests) - 일반 기능
    ├── p3-nice-to-have/       # 8 specs (51 tests) - 부가 기능
    └── p4-stretch/            # 3 specs (14 tests) - 확장
```

## 우선순위별 실행

```bash
# P0만 (배포 전 필수)
npm run e2e -- --grep "p0-critical"

# P0 + P1 (일반 PR)
npm run e2e -- --grep "p0-critical|p1-important"

# 특정 파일
npm run e2e -- tests/p0-critical/auth-login.spec.ts

# 특정 테스트
npm run e2e -- --grep "로그인 성공"
```

## 테스트 계정

| 역할 | 이메일 | 비밀번호 | UID |
|------|--------|----------|-----|
| Staff | staff@test.com | TestPass1! | test-staff-uid-001 |
| Employer | employer@test.com | TestPass1! | test-employer-uid-001 |
| Admin | admin@test.com | TestPass1! | test-admin-uid-001 |

## Playwright 프로젝트

| 프로젝트 | 인증 상태 | 대상 테스트 |
|----------|----------|------------|
| chromium | Staff | 일반 앱 테스트 |
| chromium-employer | Employer | employer 라우트 테스트 |
| chromium-admin | Admin | admin 라우트 테스트 |
| chromium-unauthenticated | 없음 | 로그인/회원가입/RBAC |

## 데이터 시딩

```bash
# 독립 시딩 (에뮬레이터 실행 중일 때)
npx ts-node e2e/scripts/seed-emulator.ts
```

global-setup.ts가 테스트 시작 전 자동으로 시딩합니다.

## CI/CD

GitHub Actions 워크플로우 (`.github/workflows/e2e.yml`):

- **트리거**: PR (uniqn-mobile/ 변경 시) + 주간 스케줄 (월요일 09:00 KST)
- **아티팩트**: playwright-report (14일), test-results (실패 시 7일)
- **PR 코멘트**: 테스트 결과 자동 코멘트

```bash
# CI 실행 확인
gh run list --workflow=e2e.yml
gh run view <run-id> --log
```

## 새 테스트 추가하기

1. Page Object 생성 (해당 page가 없을 경우)
2. Factory 생성 (테스트 데이터 필요시)
3. spec 파일 작성 (적절한 priority 폴더에)
4. e2e type-check 확인: `cd e2e && npx tsc --noEmit`

## 트러블슈팅

### 에뮬레이터 연결 실패
```bash
# 에뮬레이터 상태 확인
curl http://localhost:9099/
curl http://localhost:8080/

# 재시작
firebase emulators:start --only auth,firestore
```

### 테스트 타임아웃
```bash
# 디버그 모드로 실행
PWDEBUG=1 npm run e2e -- tests/p0-critical/auth-login.spec.ts
```

### 스크린샷 & 트레이스 확인
```bash
# 실패 시 자동 저장 경로
e2e/test-results/

# 트레이스 뷰어
npx playwright show-trace e2e/test-results/<test>/trace.zip
```
