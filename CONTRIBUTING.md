# Contributing to UNIQN

최종 업데이트: 2026-04-18  
현재 기준: 모바일 앱 `uniqn-mobile/` (백엔드: Supabase)

## 시작 전

- 저장소 전체보다 먼저 `README.md`를 읽습니다.
- 현재 제품 기준은 `uniqn-mobile/`입니다. 백엔드는 Supabase로 이전 완료(2026-04-11).
- 과거 Firebase Functions(`functions/`)와 레거시 웹앱(`app2/`)은 제거 완료되었으며 저장소에 남아있지 않습니다.

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

### Supabase Edge Functions (선택)

```bash
cd uniqn-mobile
npx supabase functions serve
```

## 코드 원칙

- TypeScript strict 유지
- 2-space indentation
- 앱 런타임 로깅은 `logger` 사용
- DB 접근은 `Service -> Repository -> Supabase` 경로를 우선
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

### Supabase (마이그레이션 변경 시)

> **❗ prod 적용은 MCP `apply_migration` 전용 — `supabase db push` 금지.**
>
> prod `supabase_migrations.schema_migrations` 의 version 컬럼은 MCP 적용 시점
> timestamp 로 등록되어 파일명 timestamp 와 디커플돼 있다. `db push` 호출 시
> registry 와 git 파일 mismatch (~10건 이상) 가 모두 미적용 마이그레이션으로
> 잡혀 재실행 시도 → 다수 충돌. 파일명 timestamp 변경 / rename 자체는 무해.

로컬 검증:

```bash
cd uniqn-mobile
supabase start                  # 로컬 부팅 (마이그레이션 자동 적용)
supabase test db                # pgTAP 테스트 (npm run test:db 도 동일)
supabase gen types typescript --local > src/types/supabase.ts
```

prod 적용:

- Claude Code 의 `mcp__supabase__apply_migration` 호출
- 또는 Supabase Dashboard SQL Editor 수동 실행
- 적용 후 `supabase gen types typescript --linked > src/types/supabase.ts` 로 타입 재생성

새 마이그레이션은 가장 최근 timestamp 로 추가하되, 더 이른 timestamp 라도 prod
영향은 CREATE OR REPLACE / IF NOT EXISTS / IF EXISTS 패턴으로 idempotent 보장 시
무해. registry 정합성은 MCP 가 자동 관리.

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
- Supabase RLS 정책, 마이그레이션, 권한 변경 여부

## 참고 문서

- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/core/TESTING_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/guides/DEPLOYMENT.md`
