---
title: ops 웹 분리 — ops.uniqn.app (Next.js · Vercel) 설계
date: 2026-09-27
status: 승인 대기 (opus 설계 리뷰 1회 반영)
owner: snosnosno
related:
  - wiki/architecture/ops-engine.md
  - uniqn-mobile/app/(ops)/_layout.tsx
  - uniqn-mobile/app/(public)/monitor/[token].tsx
  - uniqn-mobile/app/(public)/live/[view_token].tsx
  - uniqn-mobile/src/constants/ops.ts
  - uniqn-mobile/src/shared/navigation/authRedirect.ts
---

# ops 웹 분리 — `ops.uniqn.app` 설계

> **한 줄 요약**: 대회 운영(ops)을 **웹 전용 Next.js 앱**으로 따로 만들어 `ops.uniqn.app` 에서 연다.
> **DB·RPC·계정은 UNIQN 과 같은 Supabase 를 그대로 쓴다** — 서버 재작성 0, 새 RPC 0 이 목표.
> 공개뷰(전광판·플레이어뷰)도 포함하고, 호스팅은 Vercel, 가입 절차는 UNIQN 과 동일(UNIQN 에서 가입).

## 0. 확정된 결정 (2026-09-27 사용자)

| # | 항목 | 결정 |
|---|---|---|
| D1 | 분리 방식 | 별도 입구 `ops.uniqn.app`, DB·서버·계정 공유 |
| D2 | 플랫폼 | **웹 전용**, 모바일 반응형 |
| D3 | 스택 | Next.js(App Router) + React + TypeScript |
| D4 | 공개뷰 | 전광판(`/monitor/:token`)·플레이어뷰(`/live/:view_token`) **포함** |
| D5 | 호스팅 | **Vercel** |
| D6 | 가입 | UNIQN 과 **같은 절차**(이메일 가입 + PortOne 본인인증 + 프로필) |

## 1. 현황 실측 (2026-09-27, master `76bfa84b7`)

| 영역 | 위치 | 규모(테스트 제외) | 웹 이식 방식 |
|---|---|---|---|
| DB·RLS·RPC | `supabase/migrations/*ops*` — 클라가 호출하는 `ops_*` RPC 48개 | 서버 | **그대로 사용** |
| 순수 도메인 로직 | `src/domains/ops` | 20파일 / 782줄 | **동기화 사본**(§3.2). RN 의존 0, 런타임 의존 = `zod`·`date-fns` |
| 타입·스키마 | `src/types/ops.ts`(470줄) · `src/schemas/ops*.schema.ts` 7종 | — | 동기화 사본 |
| 공개뷰 폴링 정책 | `src/hooks/ops/publicPollingPolicy.ts` | — | 동기화 사본(토큰 무효 시 영구 정지 등 상태별 정책) |
| 인증 진입 판정 | `src/shared/navigation/authRedirect.ts` `getAuthenticatedEntryRoute` | — | 동기화 사본(§4.2) |
| Repository | `src/repositories/supabase/Ops*.ts` | 1,604줄 | 웹용으로 얇게 재작성(RPC 이름·인자 동일) |
| 서비스·훅 | `src/services/ops` · `src/hooks/ops` | 1,115 + 2,099줄 | 로직 이식(TanStack Query 동일) |
| 화면·컴포넌트 | `app/(ops)` · `src/components/ops` | 1,014 + 6,053줄 | **새로 작성**(RN 컴포넌트는 웹 불가) |
| 공개뷰 | `app/(public)/monitor` · `live` | 373 + 294줄 | 새로 작성 |

- 상세 콘솔 탭(`OpsConsoleShell`): 상태 · 참가자 · 테이블/좌석 · 블라인드/클럭 · 상금 · 스태프 · 이력.
- realtime 구독 훅 8종(`useOpsTournaments/Participants/Seats/Tables/Clock/BlindLevels/LiveStats/Staff`) — 콜백은 캐시 무효화만. 모바일은 `CHANNEL_ERROR`·`TIMED_OUT` 재구독 후 무효화 로직 보유(`src/utils/supabase.ts:591-609`).
- 공개뷰는 anon SECDEF RPC **정확히 2개**(`ops_get_monitor_snapshot`·`ops_get_player_view`) + 서버시각 offset 보정. 이 **anon=2 불변 계약은 웹에서도 유지**한다.
- UNIQN 과의 연결은 이미 DB 에 있다: `ops_set_tournament_posting` · `ops_import_staff_from_posting` · `ops_resolve_staff_work_logs`, 멤버십은 `is_ops_member`(owner / 연결 공고 워크스페이스 멤버 / admin).
- 인증(웹에서 동작하는 것): 이메일+비밀번호 로그인. Apple 로그인은 iOS 전용, Google·Kakao 는 미구현 → **ops 웹 로그인 = 이메일+비밀번호**.
- RPC actor 인자명은 `p_actor_id`(예: `OpsParticipantRepository.ts:148`).
- 공개 링크 생성처는 한 곳: `src/constants/ops.ts` `getOpsMonitorUrl`·`getOpsPlayerUrl`. 네이티브 = `EXPO_PUBLIC_OPS_URL ?? APP_WEB_ORIGIN`(`src/lib/env.ts:23` 에 이미 선언), 웹 = `window.location.origin` 우선.

## 2. 목표 / 비목표

**목표**
1. `ops.uniqn.app` 에서 로그인 → 대회 목록 → 대회 운영 콘솔 전 기능(현 앱과 기능 동등).
2. `ops.uniqn.app/monitor/:token`, `/live/:view_token` 공개뷰.
3. 폰(375) · 태블릿(768/1024) · 데스크톱(1280+) 반응형. **태블릿 가로가 1순위 화면**.
4. UNIQN 공고 연결·스태프 가져오기 등 기존 브릿지 기능 유지.

**비목표(이번 범위 밖)**
- 새 RPC·스키마 변경(필요해지면 별도 PR, 마이그 규칙 준수).
- ops 웹 안의 가입 화면, 가입 후 ops 로 자동 복귀(외부 redirect) — §4.2.
- `uniqn.app` ↔ `ops.uniqn.app` 자동 로그인 공유(SSO) — §10.
- 앱 내 `(ops)` 제거 — 동등성 확인 후 별도 결정.
- PWA·목록 가상화 — 필요가 실측된 뒤(§10).

## 3. 아키텍처

```
                ┌───────────────────────────┐
 uniqn.app      │ Expo 웹 (Cloudflare Pages) │──┐
 (앱/웹)         └───────────────────────────┘  │   같은 Supabase 프로젝트
                ┌───────────────────────────┐  ├──▶ Auth · Postgres(RLS) · ops_* RPC · Realtime
 ops.uniqn.app  │ Next.js (Vercel)           │──┘
                └───────────────────────────┘
        ops-web/src/core  ◀── 동기화 스크립트 ── uniqn-mobile/src (정본)
```

### 3.1 레포 구조

```
T-HOLDEM/
├─ uniqn-mobile/           # 기존 — 이번 작업으로 바뀌는 곳은 §7 링크 생성·_redirects 뿐
├─ ops-web/                # 신규 Next.js 앱 (Vercel Root Directory)
│  ├─ app/
│  │  ├─ (auth)/login/            # 로그인·비밀번호 찾기
│  │  ├─ (console)/tournaments/   # 목록 · new · [id]/(탭별 하위 라우트)
│  │  ├─ monitor/[token]/         # 공개 전광판 (anon)
│  │  ├─ live/[viewToken]/        # 공개 플레이어뷰 (anon, 로그인 시 claim)
│  │  └─ layout.tsx
│  ├─ src/
│  │  ├─ core/            # ⚠️ 자동 생성 사본 — 직접 수정 금지 (§3.2)
│  │  ├─ lib/supabase/{client,server,middleware}.ts   # @supabase/ssr
│  │  ├─ lib/env.ts       # 환경변수 검증 + 프리뷰→prod 차단 가드 (§8)
│  │  ├─ repositories/    # ops_* RPC 호출 (SupabaseClient 주입형)
│  │  ├─ hooks/           # TanStack Query + realtime 무효화
│  │  ├─ components/      # shadcn/ui 기반
│  │  └─ errors/          # P0001 → 한글 메시지 매핑 (mapOpsRpcError 이식)
│  └─ middleware.ts       # 세션 갱신 + (console) 보호
└─ scripts/sync-ops-core.mjs   # 정본 → ops-web/src/core 복사 + import 경로 치환 + 해시 기록
```

### 3.2 공유 전략 — **동기화 사본 + CI 파리티** (리뷰 C1 반영)

`packages/ops-core` 공유 패키지안은 **기각**한다. 근거(실측): `src/domains/ops` 가 `zod`(`opsHubFlag.ts:8`)·`date-fns`(`opsEventDate.ts:13`)를 런타임 import 하는데, 레포 루트엔 `node_modules` 가 없어(`uniqn-mobile/node_modules` 뿐) 레포 루트 쪽 패키지에서 모듈 해석이 실패한다. 풀려면 루트 npm workspaces 나 Metro `watchFolders`+`nodeModulesPaths`·Jest `roots`/`moduleDirectories` 개조가 필요한데, 라이브 앱 빌드를 건드리는 위험이 이득보다 크다.

대신:
- **정본은 `uniqn-mobile/src`**. 대상 = `domains/ops/**`, `types/ops.ts`, `schemas/ops*.schema.ts` + 그 의존(`utils/security` 의 `xssValidation`, `types/role` 의 `VALID_STAFF_ROLES`·`StaffRole`, `schemas/common` 의 `uuidLikeSchema`), `hooks/ops/publicPollingPolicy.ts`, `shared/navigation/authRedirect.ts` 의 판정 함수.
- `@/types/supabase` 의 `Constants`(자동 생성 파일)는 **ops enum 만 발췌**해 `core/opsEnums.ts` 로 생성한다 — 생성 타입 파일 자체를 옮기면 `supabase gen types` 경로가 깨진다.
- `scripts/sync-ops-core.mjs` 가 복사 + `@/` import 를 `@/core/` 로 치환 + 각 파일 상단에 "자동 생성 — 정본 경로" 헤더 + 해시 매니페스트 기록.
- **CI 게이트**: `node scripts/sync-ops-core.mjs --check` 가 정본과 사본이 다르면 실패. 모바일에서 ops 도메인을 고친 PR 은 동기화 커밋을 같이 넣어야 머지된다.
- 웹은 `zod`·`date-fns` 를 **모바일과 같은 메이저 버전으로 고정**(버전 드리프트 방지, CI 에서 두 `package.json` 비교).
- Repository 는 공유하지 않는다 — 모바일 쪽은 `@/lib/supabase` 싱글턴·AppError·logger 에 묶여 있다.

## 4. 인증

### 4.1 로그인
- `@supabase/ssr` **쿠키 세션**. `middleware.ts` 에서 매 요청 세션을 갱신하고 `(console)` 은 비로그인이면 `/login?redirect=<경로>` 로 보낸다.
- redirect 는 **내부 경로만** 허용(`/` 로 시작, `//`·`\` 금지 — 모바일 `normalizePostAuthRedirect` 와 같은 규칙, 테스트로 고정).
- 비밀번호 찾기: Supabase `resetPasswordForEmail(redirectTo: https://ops.uniqn.app/reset-password)` — ops 웹에 재설정 화면 1개 둔다.

### 4.2 가입 = UNIQN 에서 (리뷰 H1·H2 반영)
- ops 웹 로그인 화면의 "회원가입" = `https://uniqn.app/signup` **단순 링크**(새 탭). 가입 후 ops 로 자동 복귀하는 외부 redirect 는 **만들지 않는다**.
  - 이유: 현재 redirect 는 `/(app)`·`/(employer)`·`/(admin)` 접두 내부 경로만 허용(`authRedirect.ts:14`)하고 가입→로그인→profile-setup→가드 4단계를 거쳐 매번 재정규화된다. 외부 origin 을 끼우면 4곳을 고쳐야 하고 오픈 리다이렉트 면이 생긴다. 게다가 ops 웹에서 로그인된 미완성 사용자는 uniqn.app 에선 로그아웃 상태라 가입 화면이 "이미 가입된 계정" 안내로 빠진다(`signup.tsx:48-56`).
  - 결과: **모바일 인증 코드 변경 0**.
- 로그인 후 진입 판정: `users` 에서 `social_provider`·`phone_verified`·`identity_verified`·`profile_completed` 4컬럼을 읽어 **동기화 사본 `getAuthenticatedEntryRoute`** 로 판정한다(profile 행 부재 케이스 포함, `useAuthGuard.ts:133-143,218-233` 과 동일). 미완성이면 콘솔 대신 "UNIQN 앱/웹에서 가입을 마무리한 뒤 다시 로그인해 주세요" + `uniqn.app` 링크 화면.

### 4.3 외부 콘솔 설정 (사람 작업)
- Supabase Auth → Redirect URLs 에 `https://ops.uniqn.app/**` 추가(비밀번호 재설정 메일 링크용).
- ⚠️ Redirect URLs 는 **이메일 링크만** 제한한다. 비밀번호 로그인 자체는 어느 origin 에서든 된다 → 프리뷰 방어는 §8 의 환경 분리로 한다.

## 5. 데이터 계층

- **읽기**: TanStack Query, 클라이언트 컴포넌트에서 조회(운영 화면은 실시간성이 핵심이라 SSR 이득이 작다). 서버 컴포넌트는 인증 확인·레이아웃에만.
- **쓰기**: 전부 기존 `ops_*` SECDEF RPC. 테이블 직접 DML 금지. actor 는 `p_actor_id = auth.uid()`.
- **realtime**: 모바일과 같은 테이블 필터로 구독, 콜백은 `invalidateQueries` 만. 추가로 웹 전용 처리:
  - `CHANNEL_ERROR`·`TIMED_OUT`·재접속 시 해당 쿼리 전체 무효화.
  - `visibilitychange`(탭 복귀)·`online` 이벤트 시 무효화 — 백그라운드 탭 스로틀링으로 놓친 변경 보정.
  - 세션 토큰 갱신이 realtime 소켓에 반영되는지(`realtime.setAuth`) W4 에서 1시간 이상 방치 후 검증.
- **클럭 보정**(리뷰 M4): 현재 운영자 클럭은 `serverOffsetMs=0`(`useOpsClock.ts:6,61`) — 기기 시계를 믿는다. 브라우저 태블릿은 시계 오차가 흔하므로 **웹 콘솔은 공개뷰와 같은 서버시각 offset 보정을 적용**한다. 새 RPC 없이 기존 스냅샷 응답의 서버시각을 쓰는 방법을 W4 착수 시 확인, 불가하면 결정 재요청.
- **에러**: RPC `P0001` 코드를 `mapOpsRpcError` 이식본으로 한글 변환. 사용자 문구는 동기화 사본에서 가져와 드리프트 방지.
- **공개뷰**: 동기화된 `publicPollingPolicy` 그대로(상태별 간격·토큰 무효 시 정지) + 서버시각 offset 보정. 전광판은 Wake Lock API 로 화면 꺼짐 방지.

## 6. UI · 반응형

- **스택**: Tailwind CSS + shadcn/ui(Radix) · `next-themes`(다크모드 필수, 전광판은 항상 다크) · `lucide-react`. 대량 목록 표는 TanStack Table(가상화는 실측 후).
- **브레이크포인트**

| 폭 | 레이아웃 |
|---|---|
| < 640 (폰) | 하단 탭바 + 단일 컬럼, 시트는 바텀시트(Drawer) |
| 640–1023 (태블릿 세로) | 상단 탭 + 단일 컬럼, 시트는 우측 Sheet |
| ≥ 1024 (태블릿 가로·노트북) **1순위** | 좌측 탭 레일 + 본문 + 우측 상세 패널(2-pane), 클럭 스트립 상단 고정 |

- 터치 타깃 최소 44px, 등록데스크 키보드 단축키, 포커스 링, `prefers-reduced-motion` 준수.

## 7. 공개뷰 URL 이전 (D4)

- 새 정본: `https://ops.uniqn.app/monitor/:token`, `https://ops.uniqn.app/live/:view_token`.
- **옛 링크 유지**: uniqn.app(Cloudflare Pages) `public/_redirects` 에 `/monitor/*`·`/live/*` → `https://ops.uniqn.app/...:splat` 를 추가한다. **반드시 `/* /index.html 200` 줄보다 위**(`_redirects:18` — 아래에 두면 SPA 규칙이 먼저 매칭). 안정화 전까진 **302**, 안정화 확인 후 301 로 승격(301 은 브라우저가 영구 캐시).
- **링크 생성처 전환**: ① `EXPO_PUBLIC_OPS_URL=https://ops.uniqn.app` 를 **`eas update` 실행 환경과 EAS 빌드 환경 모두**에 설정 → 네이티브는 코드 변경 0, OTA 로 반영 ② 웹 분기(`getOpsWebOrigin`)가 `EXPO_PUBLIC_OPS_URL` 을 우선하도록 수정.
- 1.0.6 함대는 OTA 를 못 받아 옛 링크를 계속 만든다 → `_redirects` 규칙은 **영구 유지**.
- **플레이어 claim UX**(리뷰 M3): 지금은 uniqn.app 에 로그인된 선수가 바로 claim 한다. ops 도메인에선 한 번 더 로그인해야 한다 → claim 버튼이 ops 로그인으로 보냈다가 `/live/:token` 으로 돌아오는 흐름을 W7 완료 기준에 넣는다.
- App Links/AASA 는 이미 `/monitor`·`/live` 를 가로채지 않는다(확인됨) → 변경 없음.

## 8. 보안 · 운영

- **프리뷰 → prod 쓰기 차단**(리뷰 C2):
  - Vercel **Production** 환경에만 prod Supabase URL·anon 키. **Preview·Development** 환경엔 로컬 또는 Supabase 브랜치 URL.
  - `src/lib/env.ts` 부팅 가드: `NEXT_PUBLIC_SUPABASE_URL` 이 prod 프로젝트(`ygfxukhktpqymahfrvbz`)인데 `VERCEL_ENV !== 'production'` 이면 **즉시 throw**. 단위 테스트로 고정.
- service_role 키는 ops 웹에 두지 않는다. 필요한 변수 미설정 시 부팅 실패.
- anon=2 계약·RLS 는 서버 쪽이라 불변. 새 RPC 가 생기면 anon REVOKE + 카탈로그 카운트 테스트 갱신 필수.
- 보안 헤더: CSP(Supabase·Vercel 도메인 허용), `X-Frame-Options: DENY`, HSTS. 개통 전(W0~W7) 도메인은 `X-Robots-Tag: noindex`.
- 사용자 입력은 동기화된 zod 스키마(xss refine 포함)로 검증 후 RPC 호출.
- 로깅: `console.log` 금지. 에러 수집 도구는 W0 에서 모바일과 같은 조직 사용 여부 확인 후 결정.
- 퍼널 계측은 기존 `trackOpsFunnel` 이벤트명 유지(🔑 `CHECK`↔`PersistedAnalyticsEvent`↔`CORE_FUNNEL_EVENTS` 1:1 규약을 건드리지 않는 범위).
- DNS: uniqn.app 은 Cloudflare DNS → `ops` CNAME `cname.vercel-dns.com`, **프록시 끔(DNS only)**.

## 9. 진행 슬라이스 (각 슬라이스 = PR 1개, 전용 워크트리)

| 슬라이스 | 내용 | 완료 기준(검증) |
|---|---|---|
| **W0** 기반 | `ops-web/` Next 스캐폴드, Tailwind·shadcn, ESLint/Prettier/TS strict, Vitest, GitHub Actions(경로 필터 `ops-web/**`), Vercel 연결, **`ops.uniqn.app` 도메인 연결(noindex, 로그인 필수)**, 환경 분리 + 프리뷰 가드 | `build`·`lint`·`typecheck`·`test` 통과, 프리뷰가 prod URL 로 뜨면 부팅 실패하는 테스트 통과, `ops.uniqn.app` 200 |
| **W1** 동기화 | `scripts/sync-ops-core.mjs` + `--check` CI, `core/` 생성, 동기화 사본 단위 테스트(모바일 테스트 일부 이식) | `--check` 통과 · 정본 1줄 바꾸면 `--check` 실패(레드-그린) |
| **W2** 인증 | 로그인·로그아웃·비밀번호 찾기/재설정, middleware 보호, 진입 판정 + 미완성 안내 화면 | Playwright: 비로그인 → 로그인 → 원래 경로 복귀, `//evil`·`\` redirect 거부, 미완성 계정 → 안내 화면 |
| **W3** 목록·생성 | 대회 목록(보관 포함)·생성·복제·공고 연결 + 기능 동등성 체크리스트(`docs/qa/ops-web-parity.md`) 작성 | 스테이징 DB 에서 생성 → 모바일 앱 목록에 같은 대회 표시 |
| **W4** 콘솔 1 | 콘솔 셸(반응형 3단), 상태 탭, 클럭 스트립(offset 보정), 참가자(등록·리바이·애드온·탈락·재입장·칩) | 두 브라우저 realtime 반영, 탭 백그라운드 후 복귀 동기화, 1시간 방치 후 realtime 유지. 이후 슬라이스부터 375/768/1280 스크린샷(라이트·다크) 첨부 |
| **W5** 콘솔 2 | 테이블/좌석(좌석표·이동·재배치·웨이팅), 블라인드/프리셋 | 좌석 이동 후 모바일 화면 동기화 |
| **W6** 콘솔 3 | 상금 구조·지급 장부·보정, 스태프(공고 가져오기·출퇴근 연결), 이력 | 동등성 체크리스트 100% |
| **W7** 공개뷰 | 전광판(프리셋 3종·슬롯·신고 링크), 플레이어뷰(claim → ops 로그인 → 복귀) | 비로그인 접근, claim 왕복 흐름, 토큰 무효 시 폴링 정지 |
| **W8** 개통 | noindex 해제, Supabase Redirect URL, uniqn.app `_redirects` 302 추가, `EXPO_PUBLIC_OPS_URL` 설정 + 웹 origin 분기 수정 → OTA·웹 배포 | 옛 URL → 새 URL 302 실측, 새로 발급된 링크가 ops 도메인, 실기기 3종 화면 크기 QA |
| **W9** 안정화 | 302 → 301 승격, 앱 내 `(ops)` 진입점 전환 여부 결정 | — |

## 10. 후속 과제 (범위 밖, 기록만)

- **SSO**: `uniqn.app` 웹도 쿠키 세션(`Domain=.uniqn.app`)으로 바꾸면 두 도메인이 로그인을 공유하고 가입 후 복귀도 자연스러워진다. Expo 웹 세션 저장소 교체라 별도 설계.
- PWA(태블릿 홈 화면 설치), 목록 가상화 — 실사용에서 필요가 확인되면.
- 소셜 로그인(Google·Kakao) — 모바일도 미구현이라 함께 결정.
- 앱 내 `(ops)` 폐기 or 웹 링크 전환.

## 11. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 정본·사본 드리프트 | 계산·검증 불일치 | `--check` CI 게이트, 사본 직접 수정 금지 헤더 |
| 두 UI 동시 유지 기간의 동작 드리프트 | 운영자 혼란 | 동등성 체크리스트, 문구는 사본에서 공유 |
| 프리뷰가 prod 에 쓰기 | 실데이터 오염 | 환경 분리 + 부팅 가드(§8) |
| 도메인별 로그인 분리 | 가입 후·claim 시 재로그인 | 안내 문구, claim 복귀 흐름, §10 SSO |
| 1.0.6 함대가 옛 공개뷰 링크 생성 | 링크 깨짐 | `_redirects` 영구 유지 |
| 태블릿 시계 오차 | 클럭 표시 어긋남 | 서버시각 offset 보정(§5) |
| 백그라운드 탭에서 realtime 누락 | 오래된 화면 | 복귀·재접속 시 무효화(§5) |

## 12. 착수 시 확인할 것 (미확인 항목)

- Next.js·`@supabase/ssr`·shadcn/ui·Tailwind **최신 안정판 버전과 설치법** — 문서 작성 시 문서 조회 도구(context7)가 연결되지 않아 미확인. W0 에서 공식 문서로 확인 후 고정.
- 스테이징용 Supabase(브랜치 or 로컬) 방식과 비용.
- 운영자 클럭 서버시각 보정을 새 RPC 없이 할 수 있는지(§5).

## 13. 리뷰 이력

- 2026-09-27 opus 설계 리뷰 1회: CRITICAL 2(모듈 해석·프리뷰 prod 쓰기) · HIGH 3(가입 위임 규모·판정 4필드·슬라이스 순서) · MEDIUM 6 · LOW 3 — 전부 반영. C1·H1·H2·M1·`p_actor_id` 는 코드 대조로 사실 확인.
