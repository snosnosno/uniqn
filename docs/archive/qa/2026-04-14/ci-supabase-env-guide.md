# CI Supabase Secrets 설정 가이드

## 필요한 GitHub Secrets

| Secret 이름 | 용도 | 값 출처 |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 앱 런타임 익명 키 | Supabase Dashboard → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | E2E seed/cleanup용 service_role 키 | Supabase Dashboard → Project Settings → API → service_role |

## 추가 방법

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **"New repository secret"** 클릭
3. 각 Secret 이름과 값 입력 후 저장

## Supabase 값 확인 위치

[Supabase Dashboard](https://app.supabase.com) →
`[프로젝트 선택]` → **Project Settings** → **API** 탭

| 항목 | Secret 이름 |
|---|---|
| Project URL | `EXPO_PUBLIC_SUPABASE_URL` |
| anon public | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| service_role | `SUPABASE_SERVICE_ROLE_KEY` |

## 워크플로우에서의 사용 위치

`.github/workflows/e2e.yml`에서 세 곳에 주입됩니다:

1. **Create .env.test for E2E** step — global-setup.ts가 `e2e/.env.test`를 `dotenv`로 로드
2. **Build Web** step `env` — Expo 번들 빌드 시 `EXPO_PUBLIC_*` 변수 내장
3. **Run E2E Tests** step `env` — 테스트 런타임 및 supabase-admin 헬퍼

`E2E_SUPABASE_SERVICE_ROLE_KEY`는 service_role 클라이언트가 필요한 seed/cleanup step에서만 사용됩니다.
미설정 시 해당 테스트는 `test.skip`으로 건너뜁니다 (e2e/helpers/supabase-admin.ts 참고).

## 주의사항

- `SUPABASE_SERVICE_ROLE_KEY`는 **서버사이드 전용**. 앱 번들에 포함 금지 (`EXPO_PUBLIC_` prefix 사용 금지).
- E2E 테스트는 seed 데이터를 생성하고 삭제하므로 **prod project 사용 시 데이터 오염 위험**이 있습니다.
- 가능하면 E2E 전용 Supabase project를 별도 생성하여 prod 데이터와 격리하는 것을 권장합니다.
- Secrets 미설정 상태에서 workflow가 실행되면 **Run E2E Tests** step이 실패하며 PR이 block됩니다.
  (이전 `continue-on-error: true` 제거됨 — CI 신뢰성 확보 목적)

## 이전 Firebase 설정 제거 내역

다음 GitHub Secrets는 Supabase 이전 완료로 더 이상 사용되지 않습니다:

| 제거된 Secret | 사유 |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase 제거 (W5 Supabase 이전) |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase 제거 (W5 Supabase 이전) |

기존에 설정된 경우 GitHub Actions Secrets에서 삭제해도 무방합니다.
