# 개발 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/`

이 문서는 현재 모바일 앱과 Supabase(Auth / PostgreSQL / Edge Functions / Storage) 기준의 개발 흐름만 다룹니다.

## 우선 읽을 파일

1. `README.md`
2. `docs/reference/ARCHITECTURE.md`
3. `docs/reference/SUPABASE_SETUP.md`
4. `uniqn-mobile/src/lib/env.ts`
5. `uniqn-mobile/app/`
6. `uniqn-mobile/supabase/functions/`

## 현재 구조

### 앱 라우트

- `(public)`: 공개 화면
- `(auth)`: 로그인, 비밀번호 재설정, 회원가입
- `(app)`: 로그인 사용자 공통
- `(employer)`: 구인자 전용
- `(admin)`: 관리자 전용

### 앱 레이어

`Screen/Component -> Hook -> Service -> Repository -> Supabase`

- 화면: `uniqn-mobile/app/`
- 컴포넌트: `uniqn-mobile/src/components/`
- 훅: `uniqn-mobile/src/hooks/`
- 서비스: `uniqn-mobile/src/services/`
- 저장소: `uniqn-mobile/src/repositories/supabase/`
- 도메인: `uniqn-mobile/src/domains/`
- 공통: `uniqn-mobile/src/shared/`
- 스토어: `uniqn-mobile/src/stores/`
- 스키마: `uniqn-mobile/src/schemas/`

### Supabase 구조

- Edge Functions: `uniqn-mobile/supabase/functions/<name>/index.ts`
- 마이그레이션: `uniqn-mobile/supabase/migrations/*.sql`
- RLS 정책: 각 마이그레이션 SQL 내부에 `CREATE POLICY` 정의
- 공유 설정: `uniqn-mobile/supabase/config.toml`

## 개발 원칙

- TypeScript strict 유지
- 기존 Query key와 repository 재사용 우선
- 역할 계산은 `RoleResolver` 기준
- 인증 상태는 `useAuthStore`와 `useAuth` 기준 (Supabase Auth)
- 환경변수 검증은 `uniqn-mobile/src/lib/env.ts`
- 앱 환경 설정은 `uniqn-mobile/src/config/env.ts`
- 런타임 Supabase(PostgreSQL) 접근은 화면에서 직접 하지 않고 서비스/저장소 경로를 우선
- Supabase Auth는 `authService` 및 인증 hook만 직접 호출 허용, TanStack Query 읽기 전용 조회에 한해 Repository 직접 호출 허용

## 자주 쓰는 명령

### 앱

```bash
cd uniqn-mobile
npm install
npm start
npm run android
npm run ios
npm run quality
npm test
npm run e2e
```

### Supabase 로컬 개발

```bash
cd uniqn-mobile
npx supabase start                          # 로컬 Supabase(DB/Auth/Storage/Edge Functions)
npx supabase functions serve <name>         # Edge Function 로컬 실행
npx supabase db reset                       # 마이그레이션 재적용
npx supabase gen types typescript --local   # database.types.ts 재생성
```

## 새 작업 시작 순서

1. 동일한 화면/훅/서비스/저장소가 이미 있는지 검색합니다.
2. 기존 타입과 스키마를 확인합니다 (`database.types.ts` 포함).
3. 역할 영향이 있는지 확인합니다.
4. 앱 라우트와 deep link 영향을 확인합니다.
5. Edge Function 연계가 있으면 함수 이름과 `supabase/functions/<name>/index.ts` 엔트리를 확인합니다.
6. DB 스키마 변경이 필요하면 새 마이그레이션 SQL을 추가하고 RLS 정책도 함께 반영합니다.
7. `npm run quality` 또는 필요한 테스트로 검증합니다.

## 검색 팁

```bash
rg "검색어" uniqn-mobile/app uniqn-mobile/src uniqn-mobile/supabase/functions
rg --files uniqn-mobile/app
rg --files uniqn-mobile/src
rg --files uniqn-mobile/supabase
```

## 피해야 할 것

- 제거된 아카이브 워크스페이스 구조(구 `functions/`)를 현재 구조처럼 다시 도입하는 것
- 화면에서 Supabase 클라이언트를 직접 호출해 쿼리를 늘리는 것
- 현재 코드에 없는 운영 제어 화면이나 원격 설정 기능을 실제 구현처럼 문서화하는 것
- 미구현 결제/포인트 설계를 현재 런타임처럼 취급하는 것
- Firebase Auth/Firestore/Functions 가정하에 절차를 적는 것 (이미 Supabase로 이전 완료)
