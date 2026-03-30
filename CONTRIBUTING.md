# Contributing to UNIQN

최종 업데이트: 2026-03-30  
현재 기준: 모바일 앱 `uniqn-mobile/`, 배포 Functions `functions/`

## 시작 전

- 저장소 전체보다 먼저 `README.md`와 `docs/README.md`를 읽습니다.
- 현재 제품 기준은 `uniqn-mobile/`과 `functions/`입니다.
- `app2/`는 레거시 참고용이며 새 제품 기능 기준으로 사용하지 않습니다.

## 개발 환경

```powershell
git clone <repository-url>
cd T-HOLDEM
```

### 앱

```powershell
cd uniqn-mobile
npm install
Copy-Item .env.example .env.local
npm start
```

### Functions

```powershell
cd functions
npm install
Copy-Item .env.example .env
npm run build
```

## 코드 원칙

- TypeScript strict 유지
- 2-space indentation
- 앱 런타임 로깅은 `logger` 사용
- Firestore 접근은 `Service -> Repository` 경로를 우선
- 역할 분기는 `RoleResolver`, `useAuth`, `useAuthGuard` 기준 사용
- `@/types`는 type-only barrel로 사용

## 문서 원칙

- 문서가 코드와 다르면 문서를 고칩니다.
- 존재하지 않는 파일/스크립트/함수는 문서에 적지 않습니다.
- 설계/기록 문서는 아카이브로 분리합니다.

## 검증

### 앱

```bash
cd uniqn-mobile
npm run quality
npm test
```

필요 시:

```bash
npm run test:coverage
npm run e2e
```

### Functions

```bash
cd functions
npm run build
npm test
```

## 커밋 규칙

형식:

```text
<type>(<scope>): <한글 제목>
```

예시:

```text
fix(mobile): 로그인 예외 처리 수정
docs(repo): 운영 문서 최신화
```

자주 쓰는 타입:

- `feat`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`
- `perf`

## Pull Request

- 요약
- 관련 이슈 또는 스펙
- 영향 범위
- UI 변경 시 스크린샷 또는 녹화
- Firebase 규칙, 트랜잭션, 권한 변경 여부

## 참고 문서

- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/core/TESTING_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/guides/DEPLOYMENT.md`
