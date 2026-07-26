# 문서 허브

최종 업데이트: 2026-07-26  
현재 기준: `uniqn-mobile/` (백엔드: Supabase)

이 폴더는 현재 운영 문서와 아카이브 문서를 분리해서 관리합니다. 현재 제품 동작을 확인할 때는 아래의 활성 문서만 먼저 읽어 주세요.

> 2026-04-11부로 백엔드는 Firebase에서 Supabase(Auth / PostgreSQL / Edge Functions / Storage)로 완전 이전되었습니다. Firebase 관련 레거시 문서는 `archive/firebase-legacy/`로 이동했습니다.

## 활성 문서

### Core

- `core/DEVELOPMENT_GUIDE.md`
- `core/TESTING_GUIDE.md`

### Reference

- `reference/ARCHITECTURE.md`
- `reference/API_REFERENCE.md`
- `reference/AUTHENTICATION.md`
- `reference/DATA_SCHEMA.md`
- `reference/REFACTOR_BASELINE.md`
- `reference/SUPABASE_SETUP.md`
- `reference/BUSINESS_CASE.md`

### Guides

- `guides/DEPLOYMENT.md`
- `guides/ROLLBACK_PROCEDURES.md`
- `guides/I18N_GUIDE.md`
- `guides/PERFORMANCE.md`

### Operations

- `operations/MONITORING.md`
- `operations/TROUBLESHOOTING.md`
- `operations/NOTIFICATION_OPERATIONS.md`

### User

- `user/ONBOARDING.md`
- `user/USER_MANUAL.md`
- `user/ADMIN_GUIDE.md`

### Mobile Release Docs

- `../uniqn-mobile/docs/EAS_BUILD_GUIDE.md`
- `../uniqn-mobile/docs/PUSH_NOTIFICATION_TEST_CHECKLIST.md`
- `../uniqn-mobile/README-E2E.md`

## 아카이브 문서

아래 문서군은 현재 운영 기준이 아니라 설계 기록, 이행 메모, 과거 검토 자료입니다.

- `archive/firebase-legacy/` (Firebase 시절 규칙/스펙/설계 기록)
- `archive/planning/2026-04/` (2026-04 분기 계획 아카이브)
- `../specs/react-native-app/*` — 2026-07-26 제거(내용 오염). 원본은 git `82cee067e`, 복원법은 `../specs/react-native-app/README.md` 참조
- `planning/*`
- `features/*`
- 날짜가 들어간 운영 로그/감사 대응 문서
- `archive/planning/2026-04/ROADMAP.md`
- `archive/planning/2026-04/TODO.md`
- `archive/planning/2026-04/mobile-payment-plan.md`
- `archive/planning/2026-04/refactor-PLAN.md`

아카이브 문서를 읽을 때는 현재 코드와 일치한다고 가정하지 말고, 먼저 활성 문서와 실제 구현을 확인합니다.

## 문서 작성 원칙

- 코드와 다르면 코드를 기준으로 수정합니다.
- 존재하지 않는 파일, 라우트, 스크립트, Edge Function 이름은 문서에 적지 않습니다.
- 계획 문서는 계획이라고 명시합니다.
- 운영 문서에는 실제 코드 경로와 실행 명령을 함께 적습니다.
- 제거된 워크스페이스나 외부 백업 자산을 현재 런타임 기준처럼 문서화하지 않습니다.
- Firebase 관련 표현은 레거시 문서(`archive/firebase-legacy/`)에만 사용합니다. 활성 문서는 Supabase 기준을 따릅니다.

## 빠른 탐색 순서

1. `../README.md`
2. `core/DEVELOPMENT_GUIDE.md`
3. `reference/ARCHITECTURE.md`
4. `reference/REFACTOR_BASELINE.md`
5. `guides/DEPLOYMENT.md`
