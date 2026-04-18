# 테스트 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/`

## 테스트 스택

- 앱 단위/통합 테스트: Jest + `jest-expo`
- 앱 E2E: Playwright + Expo Web export + Supabase 로컬 스택(`npx supabase start`)
- Edge Functions: 각 함수 폴더 단위로 Deno 런타임에서 실행, 로컬 검증은 `npx supabase functions serve` 사용
- (레거시) `functions/test/` Mocha + Firebase Emulator 구성은 Supabase 이전(2026-04-11) 시점에 제거되어 더 이상 운영되지 않습니다.

## 공통 요구사항

```bash
Node.js 22
Supabase CLI (`npx supabase` 또는 `brew install supabase/tap/supabase`)
Docker Desktop (supabase 로컬 스택용)
```

## 앱 기본 검증

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
```

공유 로직이나 스키마를 크게 건드렸다면:

```bash
npm run test:coverage
```

## 앱 E2E

필수 env 예시:

```env
EXPO_PUBLIC_RELEASE_CHANNEL=development
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_USE_LOCAL_SUPABASE=true
```

실행 순서:

```bash
# 루트 또는 uniqn-mobile에서
cd uniqn-mobile
npx supabase start       # 로컬 Auth/DB/Storage/Edge Functions 기동

# 별도 터미널
cd uniqn-mobile
npm run build:web
npm run e2e
```

보조 명령:

```bash
npm run e2e:ui
npm run e2e:headed
npm run e2e:report
```

## Edge Functions 검증

```bash
cd uniqn-mobile
npx supabase functions serve <name>        # 로컬에서 함수 실행
npx supabase functions deploy <name> --dry-run  # 배포 전 번들 검증
```

## 반드시 확인할 계약

- 로컬 모드에서는 Auth / PostgreSQL / Storage / Edge Functions가 모두 `npx supabase start`로 기동한 로컬 endpoint를 사용해야 합니다.
- `uniqn-mobile/.env.local`과 CI/EAS env 이름이 일치해야 합니다 (`EXPO_PUBLIC_SUPABASE_*`).
- 문서에 적힌 스크립트는 `package.json` 실제 스크립트와 일치해야 합니다.
- 새 마이그레이션을 추가하면 `npx supabase db reset`으로 로컬 스키마를 재적용한 뒤 테스트를 실행합니다.
