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

| 명령                 | 설명                                               |
| -------------------- | -------------------------------------------------- |
| `npm run quality`    | typecheck + lint(oxlint) + format:check + test     |
| `npm run build`      | 로컬(development 모드) 빌드                        |
| `npm run build:prod` | 운영 빌드 — CI 전용                                |
| `npm run cf:dev`     | wrangler 로컬 서버(SPA fallback·`_headers` 확인용) |

## 안전장치

- **빌드 가드**(`config/envGuard.ts`): 운영이 아닌 빌드·dev 서버가 prod Supabase 를 가리키거나,
  운영 빌드가 prod 가 **아닌** 곳을 가리키면(허용 목록) **실패**한다. 원격 프리뷰 배포는 두지 않는다(설계 §8).
- 로컬에서 `wrangler deploy` 하지 않는다 — 배포 스크립트를 일부러 두지 않았다. 배포는 CI 만.
- 쓰기는 기존 `ops_*` SECDEF RPC 로만 한다. 테이블 직접 DML 금지.
- 배포는 master 머지 + 저장소 변수 `OPS_WEB_DEPLOY_ENABLED=true` 일 때만(`.github/workflows/ops-web.yml`).

## 개통 런북 (W8)

코드 쪽 전환(링크 생성처·옛 링크 302·검색 노출)은 저장소에 들어가 있다. 아래는 **사람이 콘솔에서 하는 일**이고, **순서가 중요하다** — ops 도메인이 열리기 전에 uniqn.app 을 배포하거나 OTA 를 내면 이미 나간 전광판·플레이어 QR 링크가 죽는다.

1. **GitHub** → Settings → Environments → `ops-web-production` 에 시크릿 4종(`VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`·`CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`) 확인 → 저장소 변수 `OPS_WEB_DEPLOY_ENABLED=true`.
2. **ops-web 배포**: master 에 ops-web 변경이 머지되면 `ops-web deploy` 잡이 돈다(수동 재실행도 가능). `wrangler.jsonc` 의 `custom_domain` 이 `ops.uniqn.app` 레코드·인증서를 만든다.
3. **Supabase** → Auth → URL Configuration → Redirect URLs 에 `https://ops.uniqn.app/**` 추가(비밀번호 재설정 메일).
4. **Cloudflare Access** 가 걸려 있다면 해제(일반 사용자·TV·선수 폰이 로그인 없이 공개뷰를 열어야 한다).
5. **실측**: `https://ops.uniqn.app/` 200, `/monitor/<실토큰>`·`/live/<실토큰>` 이 화면을 띄우는지, 로그인·비밀번호 재설정 메일 왕복.
6. **uniqn.app 웹 배포**(`npm run deploy:cloudflare -- --branch=master`, uniqn-mobile). 배포 스크립트의 Step 3.6 이 `_redirects` 외부 대상(`ops.uniqn.app`)을 실측해 **안 열려 있으면 배포를 막는다**.
   - 확인: `curl -sI https://uniqn.app/monitor/x` → `302` + `location: https://ops.uniqn.app/monitor/x`.
7. **OTA**(`eas update`, `/deploy` 스킬 절차) — 네이티브 앱이 새로 만드는 링크가 `ops.uniqn.app` 으로 바뀐다(코드 기본값이라 `EXPO_PUBLIC_OPS_URL` 설정 불필요).
8. **실기기 QA** — 폰(375)·태블릿(768/1024)·TV 3종, 라이트·다크.

되돌리기: uniqn.app 은 직전 Cloudflare Pages 배포로 롤백하면 302 가 사라지고 옛 경로가 다시 SPA 로 서빙된다(앱의 공개뷰 라우트는 그대로 있다). 앱 링크는 `EXPO_PUBLIC_OPS_URL=https://uniqn.app` 로 OTA 하면 옛 주소로 돌아간다.

W9(안정화 후): `_redirects` 302 → 301 승격, 앱 내 `(ops)` 진입점 전환 여부 결정.
