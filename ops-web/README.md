# ops-web — `ops.uniqn.app`

대회 운영(ops) 웹 전용 앱. Vite + React + React Router SPA, Cloudflare Workers 정적 자산(무료)으로 배포한다.
DB·RPC·계정은 UNIQN 과 같은 Supabase 를 쓴다. 설계: `docs/planning/2026-09-27-ops-web-design.md`.

## 로컬 개발

```bash
# 1) 로컬 Supabase (레포 루트의 uniqn-mobile 에서)
cd uniqn-mobile && npx supabase start

# 2) 환경변수 — .env.example 을 .env.development.local 로 복사 후 API_URL·ANON_KEY 기입
#    값: uniqn-mobile 에서 `npx supabase status -o env`

# 3) ops-web
cd ops-web
npm install
npm run check:local-db   # 로컬 DB 연결·ops 마이그레이션 적용 확인
npm run dev              # http://localhost:5173
```

## 명령

| 명령                   | 설명                                               |
| ---------------------- | -------------------------------------------------- |
| `npm run quality`      | typecheck + lint(oxlint) + format:check + test     |
| `npm run build`        | 로컬(development 모드) 빌드                        |
| `npm run build:prod`   | 운영 빌드 — CI 전용                                |
| `npm run cf:dev`       | wrangler 로컬 서버(SPA fallback·`_headers` 확인용) |
| `npm run check:bundle` | 빌드 후 공개뷰·콘솔 첫 화면 JS gzip 예산 검사(CI)  |

## E2E (로컬 · CI)

로컬: Supabase + `npm run seed:local` + `npm run build && npx vite preview --port 4173` 후 `node e2e/<이름>.mjs`.
CI(`.github/workflows/ops-web-e2e.yml`)는 PR 마다 w4·w5·w56·w7·w9 를 돈다(ops 관련 변경이 있을 때만).
w2(메일 왕복)·w4-idle(66분 방치)은 로컬 전용이다.

## 안전장치

- **빌드 가드**(`config/envGuard.ts`): 운영이 아닌 빌드·dev 서버가 prod Supabase 를 가리키거나,
  운영 빌드가 prod 가 **아닌** 곳을 가리키면(허용 목록) **실패**한다. 원격 프리뷰 배포는 두지 않는다(설계 §8).
- 로컬에서 `wrangler deploy` 하지 않는다 — 배포 스크립트를 일부러 두지 않았다. 배포는 CI 만.
- 쓰기는 기존 `ops_*` SECDEF RPC 로만 한다. 테이블 직접 DML 금지.
- 배포는 master 머지 + 저장소 변수 `OPS_WEB_DEPLOY_ENABLED=true` 일 때만(`.github/workflows/ops-web.yml`).
