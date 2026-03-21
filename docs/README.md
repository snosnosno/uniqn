# 문서 인덱스

현재 문서 기준은 `uniqn-mobile/`과 `functions/`입니다. 레거시 웹앱 문서는 `docs/legacy/` 또는 별도 참고 문서로 취급합니다.

## 핵심 문서

- `core/DEVELOPMENT_GUIDE.md`
- `core/TESTING_GUIDE.md`
- `reference/ARCHITECTURE.md`
- `reference/API_REFERENCE.md`
- `guides/DEPLOYMENT.md`
- `guides/ROLLBACK_PROCEDURES.md`
- `operations/MONITORING.md`
- `operations/TROUBLESHOOTING.md`
- `user/ONBOARDING.md`
- `user/USER_MANUAL.md`
- `user/ADMIN_GUIDE.md`

## 카테고리

### core

- 개발, 테스트, 기본 워크플로우

### features

- 현재 기능 설명 문서
- 결제/포인트 하위 문서는 구현 완료 문서가 아니라 설계/계획 문서가 섞여 있을 수 있으므로 코드와 함께 검토해야 합니다.

### guides

- 배포, 롤백, 성능, 국제화 관련 운영 가이드

### operations

- 모니터링, 보안, 트러블슈팅, 알림 운영

### reference

- 아키텍처, API, 인증, 데이터 스키마, 제품 범위 참고

### user

- 사용자, 관리자, 온보딩 문서

### legacy

- 더 이상 현재 기본 기준이 아닌 과거 문서

## 문서 검토 원칙

- 현재 구현 여부는 항상 코드로 재확인합니다.
- 존재하지 않는 스크립트, 라우트, Functions 이름은 문서에 남기지 않습니다.
- 계획 문서는 계획이라고 명시하고, 구현 문서는 실제 코드 경로를 함께 적습니다.
# Canonical Source Of Truth
Current runtime and API contracts for job postings live in `uniqn-mobile/` and `functions/`.
`app2/` is kept only as a legacy reference archive and must not be used as the source of truth for V3 canonical schemas.
