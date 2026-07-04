# 배포 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/app.config.ts`, `uniqn-mobile/eas.json`, `uniqn-mobile/supabase/config.toml`

현재 저장소는 출시 우선 정책을 사용합니다. 모바일 앱은 EAS Build, 백엔드는 Supabase(PostgreSQL + Edge Functions), 웹 export는 Cloudflare 배포 스크립트를 기준으로 관리합니다.

## 환경 모델

- `development`: 로컬 개발 + `npx supabase start` 로컬 스택
- `preview`: 내부 검수용 profile (원격 Supabase preview/스테이징 프로젝트)
- `production`: 실제 출시용 (원격 Supabase 프로덕션 프로젝트)

## 설정 자산 기준

- 푸시 알림용 네이티브 설정 파일 (EAS 네이티브 빌드에서만 사용):
  - `uniqn-mobile/google-services.json` (FCM)
  - `uniqn-mobile/GoogleService-Info.plist` (APNs)
- 저장소 루트의 키/설정 파일은 개인 로컬 자산이며, 현재 개발 및 배포 기준에 포함하지 않습니다.
- `app.config.ts`는 profile/platform과 푸시 설정 식별자 불일치 시 빌드를 차단합니다.
- Supabase 프로젝트 참조는 `uniqn-mobile/supabase/config.toml` 및 `EXPO_PUBLIC_SUPABASE_*` env 로 관리합니다.

## 앱 배포

### 사전 검증

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
```

### 필수 공개 env

```env
EXPO_PUBLIC_RELEASE_CHANNEL=production
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

선택 env:

```env
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_USE_LOCAL_SUPABASE=false
EXPO_PUBLIC_ENABLE_APPLE_LOGIN=true
```

### EAS Build

```bash
cd uniqn-mobile
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```

### 스토어 제출

```bash
cd uniqn-mobile
eas submit --platform ios --latest
eas submit --platform android --latest
```

## 웹 export

```bash
cd uniqn-mobile
npm run build:web
npm run deploy:cloudflare
```

> 기준 명령은 `node scripts/deploy-cloudflare.js --force` 입니다. `npm run deploy:cloudflare`는 이를 감싼 래퍼입니다.

## Supabase 배포

### 프로젝트 링크 (최초 1회)

```bash
cd uniqn-mobile
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

### 마이그레이션 (PostgreSQL 스키마 + RLS)

> **❗ prod 적용은 MCP `apply_migration` 전용 — `npx supabase db push` 금지.** 자세한 사유는 `CONTRIBUTING.md` 참조.

```bash
cd uniqn-mobile
npx supabase db diff -f <name>               # 새 마이그레이션 초안 생성 (선택)
```

- Claude Code의 `mcp__supabase__apply_migration` 호출로 prod에 적용합니다.
- 또는 Supabase Dashboard SQL Editor에서 수동 실행합니다.

RLS 정책은 각 마이그레이션 SQL 안에 `CREATE POLICY` 형태로 포함되어 있으므로, 별도 명령 없이 MCP `apply_migration` 하나로 반영됩니다.

### Edge Functions

```bash
cd uniqn-mobile
npx supabase functions deploy <name>         # 특정 함수만 배포
npx supabase functions deploy                # 모든 함수 배포
npx supabase secrets set KEY=VALUE           # 함수 환경 변수 설정
```

### Storage

Storage 버킷 및 정책도 마이그레이션 SQL을 통해 관리합니다. 새 버킷/정책을 추가할 때는 마이그레이션 파일에 포함시킨 뒤 MCP `apply_migration`으로 반영합니다.

## 로컬 스택 계약

```bash
cd uniqn-mobile
npx supabase start
```

앱은 로컬 모드에서 Auth, PostgreSQL, Storage, Edge Functions가 모두 로컬 Supabase 스택(`http://127.0.0.1:54321`)을 사용해야 합니다.

## 출시 체크리스트

- `cd uniqn-mobile && npm run quality`
- `cd uniqn-mobile && npm test`
- `cd uniqn-mobile && npm run build:web`
- 적용 예정 마이그레이션이 MCP `apply_migration`으로 모두 반영됐는지 확인 (`db push` 사용 금지)
- env 이름이 `lib/env.ts`, `.env.example`, EAS/CI와 일치하는지 확인 (`EXPO_PUBLIC_SUPABASE_*`)
- 푸시 알림 네이티브 설정 파일(`google-services.json`, `GoogleService-Info.plist`)이 현재 bundle/package와 일치하는지 확인
- 루트의 로컬 키 파일이 아닌 `uniqn-mobile/` 기준 자산을 사용하고 있는지 확인
- Apple 로그인 검증은 실기기 기준인지 확인
