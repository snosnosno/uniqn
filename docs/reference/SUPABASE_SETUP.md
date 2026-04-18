# Supabase 설정 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/src/lib/supabase.ts`, `uniqn-mobile/supabase/`

Supabase 이전 완료(2026-04-11) 후 현재 백엔드 설정과 운영 기준을 정리합니다.

## 프로젝트 기본 정보

- **리전**: `ap-northeast-2` (Seoul)
- **기술 스택**: Supabase Auth + PostgreSQL + Realtime + Edge Functions + Storage
- **클라이언트 SDK**: `@supabase/supabase-js` (version은 `uniqn-mobile/package.json` 참고)

## 환경 변수

`uniqn-mobile/.env.local` (로컬) / EAS 환경 변수 (빌드):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

진입점: `uniqn-mobile/src/lib/supabase.ts`

## 디렉토리 구조

```
uniqn-mobile/
├── src/
│   ├── lib/
│   │   ├── supabase.ts              # 클라이언트 초기화
│   │   └── database.types.ts        # 자동 생성된 DB 타입
│   ├── repositories/
│   │   └── supabase/                # Supabase Repository 구현체
│   ├── schemas/                     # Zod 입력/도메인 스키마
│   └── services/                    # 비즈니스 로직 (Repository 경유)
└── supabase/
    ├── config.toml                  # 로컬 실행 설정
    ├── migrations/                  # DDL 마이그레이션
    ├── functions/                   # Edge Functions
    └── tests/                       # DB 통합 테스트
```

## 주요 명령어

### 로컬 개발

```bash
cd uniqn-mobile
npx supabase start               # 로컬 Supabase (Docker 필요)
npx supabase functions serve     # Edge Functions 로컬 실행
```

### 마이그레이션

```bash
npx supabase db push             # 원격 DB에 마이그레이션 적용
npx supabase db pull             # 원격 DB 스키마 내려받기
npx supabase migration new <name>  # 새 마이그레이션 파일 생성
```

### 타입 재생성

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

또는 Supabase MCP: `mcp__supabase__generate_typescript_types`

## 아키텍처 규칙

### 데이터 접근 흐름

```
Presentation → Hooks → Service → Repository → Supabase
```

- **Repository 경유 필수**: Service/TanStack Query에서만 Repository 직접 호출 허용
- **Auth 예외**: `authService` + 인증 hook은 Supabase Auth 직접 호출 가능
- **Presentation/Hooks에서 Supabase 직접 호출 금지**

### 필수 규칙 (`.claude/rules/supabase-patterns.md` 참고)

1. **null → undefined 정규화**: Repository에서 Zod 파싱 전 필수
2. **기존 레코드 조회**: UUID 컬럼에 composite string 넣지 말고 개별 컬럼 필터 사용
3. **Zod `.or()` 순서**: 더 구체적인 스키마 먼저
4. **날짜 변환**: Supabase row 날짜 필드는 `toDate()` 명시
5. **RLS app role 조회**: `(auth.jwt() -> 'app_metadata' ->> 'role')`
6. **테스트 계정 생성**: GoTrue signup API 사용, SQL 직접 INSERT 금지
7. **다중 문서 변경**: RPC 함수 사용, 클라이언트 multi-step mutation 금지
8. **upsert**: unique constraint 컬럼 지정 (`onConflict`)
9. **nullable 컬럼 추가**: 4단계 (migration → gen types → Repository TABLE_COLUMNS → 도메인 타입 `| null`)

## RLS (Row Level Security)

모든 사용자 데이터 테이블에 RLS 활성화.

### 역할 계층

```
admin > employer > staff
```

역할은 `auth.users.raw_app_meta_data.role`에 저장. RLS 정책에서:

```sql
-- ✅ CORRECT
(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

-- ❌ WRONG
auth.jwt() ->> 'role' = 'admin'
```

### 예시 정책 (owner-only)

```sql
CREATE POLICY templates_select_own ON job_posting_templates
  FOR SELECT USING (user_id = auth.uid());
```

## Edge Functions

위치: `uniqn-mobile/supabase/functions/<function-name>/index.ts`

배포:

```bash
npx supabase functions deploy <function-name>
```

또는 Supabase MCP: `mcp__supabase__deploy_edge_function`

### JWT 검증

기본적으로 `verify_jwt: true`. API Key 기반 webhook처럼 자체 인증을 구현한 경우에만 비활성화.

## 트러블슈팅

### 타입 불일치 (`column does not exist`)

`database.types.ts` 재생성 누락. `npx supabase gen types typescript` 실행.

### RLS 정책 거부 (`new row violates row-level security policy`)

1. RLS 정책이 테이블에 활성화됐는지 확인
2. `app_metadata.role` 경로 사용 확인
3. `auth.uid()` 대신 `auth.jwt() ->> 'sub'` 같은 잘못된 경로 사용 여부 확인

### 로컬 Supabase 시작 실패

Docker 데몬 실행 확인. `npx supabase stop` 후 재시작.

## 참고 문서

- Supabase 공식: https://supabase.com/docs
- 프로젝트 Rules: `.claude/rules/supabase-patterns.md`
- Repository 구현체: `uniqn-mobile/src/repositories/supabase/`
- 마이그레이션 예시: `uniqn-mobile/supabase/migrations/`
