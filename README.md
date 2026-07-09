# UNIQN Project

최종 업데이트: 2026-06-19  
현재 기준 코드: `uniqn-mobile/`

이 저장소의 현재 source of truth는 모바일 앱 `uniqn-mobile/`입니다. 백엔드는 Supabase(Auth + PostgreSQL + Realtime)로 이전 완료(2026-04-11). 과거 Firebase Functions는 제거 완료되었으며 저장소 루트에 남아있지 않습니다. 과거 웹 실험물과 이관 참고 자료는 저장소 밖 백업 또는 아카이브 문서로만 관리합니다.

## 현재 워크스페이스

- `uniqn-mobile/`: Expo + React Native 앱 (Supabase 백엔드)
- `uniqn-mobile/supabase/`: Supabase Edge Functions, 마이그레이션, 설정
- `docs/`: 현재 운영/개발 문서 허브
- `wiki/`: LLM 지식 합성 레이어 (architecture/decisions/domain/sources). 규약 `wiki/AGENTS.md`, 운영 `/ingest`·`/query`·`/lint`
- `specs/`: 설계 기록 및 이행 아카이브

## 빠른 시작

### 모바일 앱

```powershell
cd uniqn-mobile
npm install
Copy-Item .env.example .env.local
npm run quality
npm start
```

### Supabase Functions (로컬)

```bash
cd uniqn-mobile
npx supabase functions serve  # Edge Functions 로컬 실행
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

### Supabase Edge Functions

- `npx supabase functions serve`: Edge Functions 로컬 실행
- 마이그레이션 적용: MCP `apply_migration` 전용 (`npx supabase db push` 금지 — CONTRIBUTING.md 참조)
- `npx supabase gen types typescript`: DB 타입 재생성

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

### 백엔드 (Supabase)

- Edge Functions: `uniqn-mobile/supabase/functions/`
- 마이그레이션: `uniqn-mobile/supabase/migrations/`
- DB 타입: `uniqn-mobile/src/types/supabase.ts`

## 현재 아키텍처 원칙

- 기본 흐름: `Screen -> Hook -> Service -> Repository -> Supabase`
- 권한 체계: `admin`, `employer`, `staff`
- 역할 계산 단일 소스: `uniqn-mobile/src/shared/role/RoleResolver.ts`
- 상태 canonical 모듈:
  - `@/shared/status`
  - `@/constants/statusConfig`
  - `@/domains/settlement`
  - `@/shared/realtime`
  - `@/types`는 type-only barrel

## 보안 및 설정 기준

- 네이티브 Firebase 설정의 기준 파일은 `uniqn-mobile/google-services.json`, `uniqn-mobile/GoogleService-Info.plist`입니다.
- 저장소 루트의 로컬 키/설정 파일은 개발자 개인 자산이며 현재 배포 기준에 포함하지 않습니다.
- 배포와 실행 설정은 `uniqn-mobile/app.config.ts`, `uniqn-mobile/eas.json`, `uniqn-mobile/supabase/config.toml`을 기준으로 검증합니다.

## 문서 시작점

- `docs/README.md`
- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/core/TESTING_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/reference/REFACTOR_BASELINE.md`
- `docs/guides/DEPLOYMENT.md`

## 주의

- 문서보다 코드가 우선입니다.
- 아카이브 문서는 현재 구현을 설명하지 않습니다.
- 게시판 작업 영역은 별도 진행 중이므로, 구조 정리 시 보호 범위로 취급합니다.
- 출시 전 검증 기준은 `uniqn-mobile/`의 `npm run quality` 단독입니다.
