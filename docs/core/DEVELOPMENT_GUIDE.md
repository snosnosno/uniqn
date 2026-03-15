# 개발 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

기본 작업 대상은 `uniqn-mobile/`입니다. 레거시 웹앱 기준 개발 절차는 현재 기본 가이드가 아닙니다.

## 시작 전 확인

### 우선 읽을 파일

1. `CLAUDE.md`
2. `README.md`
3. `uniqn-mobile/src/lib/env.ts`
4. `uniqn-mobile/app/`
5. `functions/src/index.ts`

### 기존 구현 찾기

```bash
rg "검색어" uniqn-mobile/src uniqn-mobile/app functions/src
rg --files uniqn-mobile/src
rg --files uniqn-mobile/app
```

확인 순서:

- 동일한 화면이 이미 있는지
- 동일한 훅/서비스/Repository가 있는지
- 스키마와 타입이 이미 정의돼 있는지
- 관리자/구인자/스태프 권한 영향이 있는지

## 현재 구조

### 라우팅

- `app/(public)`: 공개 접근
- `app/(auth)`: 로그인/회원가입
- `app/(app)`: 로그인 사용자 공통
- `app/(employer)`: 구인자 전용
- `app/(admin)`: 관리자 전용

### 레이어

기본 흐름:

`Screen/Component -> Hook -> Service -> Repository -> Firebase`

관련 파일:

- 화면: `uniqn-mobile/app/`
- 훅: `uniqn-mobile/src/hooks/`
- 서비스: `uniqn-mobile/src/services/`
- 저장소: `uniqn-mobile/src/repositories/`
- 상태 저장: `uniqn-mobile/src/stores/`
- 스키마: `uniqn-mobile/src/schemas/`

## 개발 원칙

- TypeScript strict 기준 유지
- 기존 Repository와 Query Key를 재사용
- 권한 분기는 `RoleResolver`, `useAuth`, `useAuthGuard` 기준으로 처리
- 환경변수는 `src/lib/env.ts` 스키마에 맞춰 추가
- 에러는 logger와 공통 에러 체계를 통해 처리

## 자주 쓰는 명령어

```bash
cd uniqn-mobile
npm install
npm start
npm run type-check
npm run lint
npm run test
npm run quality
npm run e2e
```

Functions 작업:

```bash
cd functions
npm install
npm run build
npm test
```

## 새 기능 추가 절차

1. 관련 라우트와 기존 화면을 확인합니다.
2. 필요한 타입/스키마를 먼저 정리합니다.
3. 서비스와 Repository 재사용 가능성을 먼저 검토합니다.
4. 훅에서 Query Key, 캐시, 로딩/에러 상태를 정리합니다.
5. 화면에서 접근 권한과 UX를 마무리합니다.
6. `npm run quality`로 기본 검증을 합니다.

## 피해야 할 것

- 레거시 웹 구조를 현재 구조처럼 확장하는 것
- 중복 Firebase 쿼리를 화면에서 직접 작성하는 것
- 역할 문자열을 임의 비교하는 것
- 스키마 검증 없이 새 필드를 추가하는 것
- 현재 의존성에 없는 라이브러리를 이미 사용 중인 것처럼 문서화하는 것
