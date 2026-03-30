# 문서 허브

최종 업데이트: 2026-03-30  
현재 기준: `uniqn-mobile/`, `functions/`

이 폴더는 현재 운영 문서와 역사 문서를 분리해서 관리합니다. 현재 제품 동작을 확인할 때는 아래의 `활성 문서`만 먼저 보세요.

## 활성 문서

### Core

- `core/DEVELOPMENT_GUIDE.md`
- `core/TESTING_GUIDE.md`

### Reference

- `reference/ARCHITECTURE.md`
- `reference/API_REFERENCE.md`
- `reference/AUTHENTICATION.md`
- `reference/DATA_SCHEMA.md`

### Guides

- `guides/DEPLOYMENT.md`
- `guides/ROLLBACK_PROCEDURES.md`

### Operations

- `operations/MONITORING.md`
- `operations/TROUBLESHOOTING.md`

### User

- `user/ONBOARDING.md`
- `user/USER_MANUAL.md`
- `user/ADMIN_GUIDE.md`

### Mobile Release Docs

- `../uniqn-mobile/docs/EAS_BUILD_GUIDE.md`
- `../uniqn-mobile/docs/PUSH_NOTIFICATION_TEST_CHECKLIST.md`
- `../uniqn-mobile/docs/apple-app-review-demo-setup.md`
- `../uniqn-mobile/README-E2E.md`

## 아카이브 문서

아래 문서군은 현재 운영 기준이 아니라 설계, 이행, 기록, 레거시 참고 자료입니다.

- `../specs/react-native-app/*`
- `planning/*`
- `features/*`
- 날짜가 들어간 운영 로그/감사 대응 문서
- `../ROADMAP.md`
- `../TODO.md`
- `../mobile-payment-plan.md`
- `../refactor PLAN.md`
- `../app2/**/*.md`

이 문서들은 삭제 대상이 아니라 참고 자료입니다. 다만 현재 구현처럼 읽히지 않도록 상단 배너와 canonical 문서 링크를 유지합니다.

## 문서 작성 원칙

- 코드와 다르면 코드를 기준으로 수정합니다.
- 존재하지 않는 파일, 라우트, 스크립트, Functions 이름은 문서에 적지 않습니다.
- 계획 문서는 계획이라고 명시합니다.
- 운영 문서에는 실제 코드 경로와 실행 명령을 함께 적습니다.
- `app2/`는 현재 runtime source가 아닙니다.

## 빠른 탐색 순서

1. `../README.md`
2. `core/DEVELOPMENT_GUIDE.md`
3. `reference/ARCHITECTURE.md`
4. `reference/API_REFERENCE.md`
5. `guides/DEPLOYMENT.md`
