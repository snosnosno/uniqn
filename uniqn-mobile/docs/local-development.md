# 로컬 Supabase 개발 매뉴얼

프로덕션 DB에 직접 작업하지 않고, 로컬 Supabase 스택에서 마이그레이션·스키마를 먼저 검증하기 위한 가이드.

> Free 플랜이라 Supabase Branching(Pro 전용)은 사용 불가 → **Docker 로컬 스택**이 개발 단계 역할을 한다.

## 1. 사전 준비

- **Docker Desktop이 실행 중**이어야 로컬 스택이 뜬다. (작업표시줄 고래 아이콘 확인)
- 이미 셋업된 것: `supabase/config.toml`, 마이그레이션, `supabase/seed.sql`, 그리고 스위치 파일 `.env.development.local`

## 2. 기본 명령

작업 디렉토리: `uniqn-mobile/`

| 명령 | 동작 |
|------|------|
| `npm run db:start` | 로컬 스택 기동 (DB / Auth / Storage / Studio / Mailpit) |
| `npm run db:stop` | 끄기 (다 쓰면 꼭 — Docker 리소스 점유) |
| `npm run db:status` | 접속 URL·키 확인 |
| `npm run db:reset` | **전체 마이그레이션 + seed 재적용** (DB 초기화) |
| `npm start` / `npm run web` | 앱을 **로컬 DB로** 실행 |

## 3. 로컬 ↔ 프로덕션 전환 (가장 중요)

스위치는 `uniqn-mobile/.env.development.local` 파일 하나다. (gitignore됨 — `.env*.local`)

Expo env 우선순위가 `.env.development.local` > `.env.local`이고, `expo start`는 NODE_ENV=development이므로 이 파일이 `.env.local`의 프로덕션 Supabase 값을 덮어쓴다.

- **파일 있음** → `npm start`가 로컬 DB(`http://127.0.0.1:54321`) 사용 (기본)
- **프로덕션 DB로 잠깐 테스트** → 파일 이름만 잠깐 바꾼다:
  ```bash
  mv .env.development.local .env.development.local.off   # prod로
  mv .env.development.local.off .env.development.local   # 다시 로컬로
  ```
- 나머지 변수(Sentry / PortOne / reCAPTCHA)는 `.env.local`에서 그대로 상속된다.
- ⚠️ `expo export`·EAS·`deploy-cloudflare.js`(배포)는 NODE_ENV=production이라 이 파일을 **무시** → 배포물은 항상 prod 사용. 안전하다.

> env 파일은 dev 서버 **시작 시 1회만** 로딩된다. 전환 후에는 서버를 완전히 재시작할 것.

## 4. 데이터 GUI — Studio

브라우저: **http://127.0.0.1:54323**

테이블 편집기, SQL 에디터, Auth 사용자 관리까지 프로덕션 Dashboard와 동일한 UI. 여기서 데이터를 바꿔도 prod에 영향 없음.

## 5. 인증/회원가입 메일 — Mailpit

브라우저: **http://127.0.0.1:54324**

로컬은 실제 메일을 보내지 않고 전부 여기로 모은다. 회원가입 확인 메일·비밀번호 재설정 링크를 여기서 확인.

## 6. 테스트 계정 (seed로 자동 생성)

`npm run db:reset` 시 항상 새로 만들어진다.

| 이메일 | 비밀번호 | 권한 |
|--------|----------|------|
| `qa-admin@uniqn.test` | `TestPass1!` | admin |
| `qa-employer@uniqn.test` | `TestPass1!` | employer |
| `qa-staff@uniqn.test` | `TestPass1!` | staff |
| `qa-collaborator@uniqn.test` | `TestPass1!` | employer (협업자) |
| `review-admin@uniqn.app` | `Review2026!` | admin |
| `review-employer@uniqn.app` | `Review2026!` | employer |
| `review-staff@uniqn.app` | `Review2026!` | staff |
| `review-collaborator@uniqn.app` | `Review2026!` | employer (협업자) |

## 7. 스키마 변경 / 마이그레이션 작업 흐름

```
1) 로컬에서 SQL 반복 실험 (Studio SQL 에디터 또는 psql)
   → 만족할 때까지 자유롭게 깨먹기

2) 확정되면 마이그레이션 파일로 굳히기
   npx supabase migration new my_change   # 파일 생성 (파일명 직접 짓지 말 것)
   # SQL 작성
   npm run db:reset                        # 로컬에 깨끗하게 재적용 검증

3) 로컬 통과 → 그때만 프로덕션 적용
   MCP apply_migration 으로 prod 반영
```

- 프로덕션 적용은 **MCP `apply_migration` 전용**. `supabase db push` 금지 (프로젝트 규칙).
- 파괴적 DDL(`DROP`, `DELETE`)은 prod 적용 전 백업 스냅샷 확인.
- DDL dry-run만으로는 함수 schema-mismatch를 못 잡는다 → RPC는 `SELECT * FROM rpc() LIMIT 0` 호출까지 검증.

## 8. DB에 직접 SQL 실행

```bash
# psql 대화형 접속 (컨테이너명 supabase_db_uniqn)
docker exec -it supabase_db_uniqn psql -U postgres -d postgres

# 한 줄 실행
docker exec supabase_db_uniqn psql -U postgres -d postgres -c "select count(*) from public.users;"
```

접속 문자열: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## 9. 트러블슈팅

| 증상 | 해결 |
|------|------|
| `db:start` 실패 / "cannot connect to docker" | Docker Desktop 미실행 → 실행 후 재시도 |
| 앱이 여전히 prod를 봄 | `.env.development.local` 존재 확인 + dev 서버 **완전 재시작** |
| 데이터가 꼬임 | `npm run db:reset` (초기 상태로) |
| 포트 충돌(54321 등) | 다른 supabase 인스턴스 종료 `npm run db:stop` |
| 마이그레이션 에러 | 해당 SQL 파일 수정 후 `npm run db:reset` |

## 10. 포트 요약

| 포트 | 용도 |
|------|------|
| 54321 | API (REST / Auth / Realtime / Storage) |
| 54322 | PostgreSQL |
| 54323 | Studio (DB GUI) |
| 54324 | Mailpit (메일함) |
