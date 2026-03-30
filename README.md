# UNIQN Project

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/`, `functions/`

이 저장소의 현재 실행 기준은 모바일 앱 `uniqn-mobile/`과 배포용 Firebase Functions `functions/`입니다. `app2/`는 레거시 참고용이며 현재 제품 개발의 source of truth가 아닙니다.

## 현재 워크스페이스

- `uniqn-mobile/`: Expo + React Native 앱
- `functions/`: Firebase Functions 배포 엔트리
- `docs/`: 현재 운영/개발 문서 허브
- `specs/`: 설계 및 이행 기록 보관
- `app2/`: 레거시 웹앱 참고 자료

## 빠른 시작

### 모바일 앱

```powershell
cd uniqn-mobile
npm install
Copy-Item .env.example .env.local
npm run quality
npm start
```

### Functions

```powershell
cd functions
npm install
Copy-Item .env.example .env
npm run build
npm test
```

## 주요 명령

### `uniqn-mobile/`

- `npm start`: Expo 개발 서버
- `npm run android`: Android 네이티브 실행
- `npm run ios`: iOS 네이티브 실행
- `npm run quality`: type-check + lint + format:check
- `npm test`: Jest
- `npm run test:coverage`: Jest coverage
- `npm run e2e`: Playwright E2E
- `npm run build:web`: Expo Web export

### `functions/`

- `npm run build`: TypeScript 빌드
- `npm test`: Firestore emulator 기반 Mocha 테스트
- `npm run serve`: Functions emulator 실행
- `npm run deploy`: Functions 배포

## 구조 기준

### 앱

- 라우트: `uniqn-mobile/app/`
- UI 컴포넌트: `uniqn-mobile/src/components/`
- 훅: `uniqn-mobile/src/hooks/`
- 서비스: `uniqn-mobile/src/services/`
- 저장소: `uniqn-mobile/src/repositories/`
- 도메인 로직: `uniqn-mobile/src/domains/`
- 공통 모듈: `uniqn-mobile/src/shared/`
- 상태 저장소: `uniqn-mobile/src/stores/`

### 백엔드

- 진입점: `functions/src/index.ts`
- callable / HTTP: `functions/src/api/`
- Firestore 트리거: `functions/src/triggers/`
- 스케줄 작업: `functions/src/scheduled/`

## 현재 아키텍처 원칙

- 기본 흐름: `Screen -> Hook -> Service -> Repository -> Firebase`
- 권한 체계: `admin`, `employer`, `staff`
- 역할 계산 단일 소스: `uniqn-mobile/src/shared/role/RoleResolver.ts`
- 상태 canonical 모듈:
  - `@/shared/status`
  - `@/constants/statusConfig`
  - `@/domains/settlement`
  - `@/shared/realtime`
  - `@/types`는 type-only barrel

## 문서 시작점

- `docs/README.md`
- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/core/TESTING_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/reference/API_REFERENCE.md`
- `docs/guides/DEPLOYMENT.md`

## 주의

- 문서보다 코드가 우선입니다.
- 현재 구현이 없는 결제/포인트/레거시 웹 설계는 운영 문서가 아니라 아카이브 문서로 취급합니다.
- 출시 전 확인은 `uniqn-mobile/`의 `npm run quality`와 `functions/`의 `npm run build`, `npm test`를 기준으로 합니다.
