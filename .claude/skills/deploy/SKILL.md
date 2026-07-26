---
name: deploy
description: UNIQN 배포 자동화 (Cloudflare Pages + Supabase + EAS). 배포, deploy, 배포해줘, 프로덕션 요청 시 활성화
allowed-tools: Bash, Read, Grep, Glob, mcp__supabase__apply_migration, mcp__supabase__deploy_edge_function, mcp__supabase__list_migrations, mcp__supabase__list_edge_functions
---

# UNIQN 배포 스킬

> 작업 디렉토리: `uniqn-mobile/` | Firestore·Firebase Auth·Firebase Hosting 제거됨 (2026-04-11, FCM 푸시는 유지) | 백엔드: Supabase + Cloudflare Pages

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 웹 호스팅 | Cloudflare Pages (`uniqn-app.pages.dev`) |
| 커스텀 도메인 | `uniqn.app` / `www.uniqn.app` (Proxied, SSL) |
| 백엔드 | Supabase (Auth + PostgreSQL + Realtime + Edge Functions) |
| 모바일 | Expo / EAS Build (iOS / Android) |

## 배포 대상

| 서비스 | 도구 | 명령어 / MCP |
|--------|------|--------------|
| Web (Cloudflare Pages) | wrangler | `node scripts/deploy-cloudflare.js [--force]` |
| Edge Functions | Supabase MCP | `mcp__supabase__deploy_edge_function` |
| DB Migrations | Supabase MCP | `mcp__supabase__apply_migration` |
| iOS / Android | EAS | `eas build --platform ios\|android` |

## CRITICAL 규칙

- **`supabase db push` 금지** — 항상 `mcp__supabase__apply_migration` 사용 (메모리: `feedback_supabase_migration_workflow`)
- **모든 명령은 `uniqn-mobile/`에서 실행** — 루트에서 실행 금지
- **Cloudflare 배포는 `node scripts/deploy-cloudflare.js`** — `npm run deploy:cloudflare`로 호출 시 `--force` 가 npm 에 먹힘
- **배포 전 `npm run quality` 필수** — type-check + lint + format:check
- **EAS 빌드는 사용자가 명시적으로 요청한 경우에만** — 시간/크레딧 소모 큼

## 배포 전 체크리스트

```bash
cd uniqn-mobile

# 1. 품질 게이트 (필수)
npm run quality

# 2. 테스트 (선택, 변경 영역에 따라)
npm test

# 3. Git 상태 확인
git status
git branch --show-current
```

품질 게이트 실패 시: 사용자에게 보고 후 수정 여부 확인. 배포 강행 금지.

## 1. Cloudflare Pages (Web)

### 정상 배포
```bash
cd uniqn-mobile
node scripts/deploy-cloudflare.js
```

### 커밋되지 않은 변경 포함 (긴급 시)
```bash
cd uniqn-mobile
node scripts/deploy-cloudflare.js --force
```

### 스크립트가 하는 일
1. Git status 검사 (커밋 안 된 변경 있으면 `--force` 없이는 중단)
2. `expo export -p web` 빌드
3. `dist/assets/node_modules` → `dist/assets/vendors` 폴더명 변경 (Wrangler가 node_modules 무시 우회)
4. `wrangler pages deploy` 호출

### 배포 후 확인
- https://uniqn.app
- https://www.uniqn.app
- https://uniqn-app.pages.dev (Pages 직링크)
- 콘솔 에러 / 주요 라우트 / 다크모드

## 2. Supabase Edge Functions

### 현재 함수 목록 (2026-04-19 기준)
approve-job-posting, cleanup-orphan-accounts, decrement-unread-counter, initialize-unread-counter, process-scheduled-deletions, reject-job-posting, resubmit-job-posting, revoke-apple-token, send-job-posting-announcement, send-push-notification, send-system-announcement, sync-schedule-board-outbox, verify-and-save-portone-profile, verify-portone-identity, reset-unread-counter

### 배포 (MCP 권장)
```
mcp__supabase__list_edge_functions          # 현재 배포 상태 확인
mcp__supabase__deploy_edge_function         # 변경된 함수만 선택 배포
```

배포 전:
1. `uniqn-mobile/supabase/functions/<name>/index.ts` 코드 검토
2. 호출 측(앱) 변경과 동시 배포 시 순서 결정 — DB/함수 먼저, 앱 나중

### 배포 후 확인
```
mcp__supabase__get_logs (service: "edge-function")
```

## 3. Supabase Migrations

### 적용 방법 (MCP 전용)
```
mcp__supabase__list_migrations              # 미적용 확인
mcp__supabase__apply_migration              # 단일 마이그레이션 적용
```

**`supabase db push` / `supabase migration up` CLI 사용 금지** — 메모리 `feedback_supabase_migration_workflow` 참고. 파일명/레지스트리 타임스탬프 불일치는 무해 (false positive).

### 적용 후 필수
```bash
cd uniqn-mobile
# Supabase TypeScript 타입 재생성 (스키마 변경 시)
# MCP: mcp__supabase__generate_typescript_types
npm run type-check
```

## 4. EAS Build (Mobile) — 명시 요청 시에만

```bash
cd uniqn-mobile
eas build --platform ios          # iOS 빌드
eas build --platform android      # Android 빌드
eas build --platform all          # 둘 다
```

EAS는 시간(15~30분)과 빌드 크레딧을 소모하므로 사용자가 직접 "EAS 빌드해줘"라고 한 경우에만 실행. "다 배포해줘" 요청에는 포함하지 말 것.

## 5. EAS Update (OTA) — runtimeVersion `fingerprint` 규칙 (2026-07-25 #335 이후)

`app.config.ts` 의 `runtimeVersion.policy` 가 `sdkVersion` → **`fingerprint`** 로 바뀌었다.
fingerprint 는 **expoConfig 전체 + 네이티브 의존성**을 해시한다. 따라서:

### 규칙 1 — expoConfig 에 비결정적 값 금지 (위반 시 OTA 영구 무력화)
평가할 때마다 달라지는 값(`new Date()`, 랜덤, 실행 시각)이 `extra` 등에 있으면
빌드가 계산한 runtimeVersion 과 `eas update` 가 계산한 runtimeVersion 이 **절대 일치하지 않는다**.
2026-07-26 `extra.buildDate` 가 정확히 이 상태였고 제거했다(연속 2회 해시 불일치 실측).

### 규칙 2 — OTA 발행 시 빌드와 **같은 env** 를 명시 export
`eas update` 는 eas.json 의 `build.<profile>.env` 를 읽지 않는다(shell env 만 평가 — 메모리
`pitfall_eas_update_shell_env_not_loaded`). `APP_ENV` 하나만 달라도 fingerprint 가 갈린다(실측).

```bash
cd uniqn-mobile
# production OTA — eas.json build.production.env 와 동일하게 맞춘다
APP_ENV=production \
EXPO_PUBLIC_RELEASE_CHANNEL=production \
EXPO_PUBLIC_PORTONE_STORE_ID=store-c1b44e1c-7620-445b-bb6c-9b6b62e7ab93 \
EXPO_PUBLIC_PORTONE_INICIS_CHANNEL_KEY=channel-key-2dc155c9-46a1-4710-a687-245f45497b0c \
EXPO_PUBLIC_PORTONE_INICIS_FRGND_INFO=N \
RCT_NEW_ARCH_ENABLED=1 \
npx eas update --branch production --message "<한글 요약>"
```

### 규칙 3 — 발행 전 runtimeVersion 대조 (필수 검증)
```bash
# OTA 가 도달할 runtimeVersion 을 발행 전에 실측하고, 대상 빌드의 값과 같은지 확인
APP_ENV=production ... npx expo-updates fingerprint:generate --platform android
APP_ENV=production ... npx expo-updates fingerprint:generate --platform ios
```
값이 대상 빌드와 다르면 **OTA 는 조용한 no-op** 이다(에러 없이 아무에게도 도달하지 않음).

⚠️ 로컬 실행은 Expo CLI 가 `.env.development.local` / `.env.local` 을 **자동 로드**한다
(실행 로그의 `env: load …` 줄로 확인 가능). 이 파일들은 gitignore 라 EAS 빌더에는 없다.
따라서 로컬에서 뽑은 해시는 **참고값**이고, 권위 있는 값은 EAS 가 빌드에 기록한
runtimeVersion(`eas build:list` 출력)이다. 대조는 그 값을 기준으로 하라.

### 규칙 3-1 — 네이티브 패키지 버전 고정
Expo SDK 가 기대하는 버전과 의도적으로 다른 네이티브 패키지는 `package.json` 의
`expo.install.exclude` 에 반드시 등록한다. 등록하지 않으면 누군가 `expo install --fix` 를
돌리는 순간 조용히 다운그레이드되어 기능이 회귀한다.
(현재 등록: `expo-modules-core`, `react-native-keyboard-controller`[#335 가 1.22.2 의
`ModalAttachedWatcher` 를 겨냥해 채택 — SDK 55 기대값 1.20.7 로 내려가면 #302 회귀])

### 규칙 4 — 네이티브 구성이 바뀐 릴리즈는 OTA 로 못 넘긴다
네이티브 모듈 추가/제거·플러그인 변경·SDK 업그레이드 = fingerprint 변경 = **새 빌드 필수**.
구 빌드 사용자는 OTA 를 받지 못하므로 스토어 업데이트로 유도해야 한다
(원격 `latestVersion` 상향 등). #335(react-native-keyboard-controller 도입)가 이 경우다.

## 멀티 배포 순서

여러 대상을 동시에 배포할 때 순서:

```
1. DB Migrations  →  2. Edge Functions  →  3. Web (Cloudflare)  →  4. (선택) EAS
```

DB 스키마/함수가 먼저 살아있어야 새 코드가 정상 동작.

## 롤백

### Cloudflare Pages
```bash
# Cloudflare Dashboard → Pages → uniqn-app → Deployments → 이전 버전 "Rollback"
# 또는 wrangler:
wrangler pages deployment list --project-name=uniqn-app
wrangler pages rollback <deployment-id> --project-name=uniqn-app
```

### Edge Functions
이전 버전 코드로 git revert → 다시 `mcp__supabase__deploy_edge_function`

### Migrations
**자동 롤백 불가**. 역마이그레이션 SQL을 새 마이그레이션으로 작성 → MCP 적용. 데이터 손실 위험 시 사용자 명시 승인 필요.

## "다 배포해줘" 처리 절차

사용자가 "배포할 거 다 해줘" / "배포 가능한 거 모두" 요청 시:

1. **현황 파악**
   - `git log --oneline origin/master..HEAD` — 미배포 커밋 확인
   - `mcp__supabase__list_migrations` — 미적용 마이그레이션
   - `mcp__supabase__list_edge_functions` — 함수 목록 + 최종 업데이트 시각
   - `git status` — 미커밋 변경

2. **계획 보고** — 사용자에게 무엇을 어떤 순서로 배포할지 한 번 확인

3. **순차 실행**
   - 품질 게이트 → Migrations → Edge Functions → Cloudflare Pages

4. **각 단계 검증**
   - Migration: list_migrations 재확인
   - Edge Function: get_logs로 에러 확인
   - Web: 배포 URL 응답 확인

5. **결과 요약** — 출력 형식 참고

## 출력 형식

```markdown
## 배포 결과

### 요약
| 대상 | 상태 | 비고 |
|------|------|------|
| Quality Gate | ✅/❌ | |
| Migrations | ✅/❌/N/A | N건 적용 |
| Edge Functions | ✅/❌/N/A | N개 배포 |
| Cloudflare Pages | ✅/❌/N/A | URL |
| EAS | 스킵 | 명시 요청 시에만 |

### 검증 증거
- Quality: [실제 출력]
- 배포 URL 응답: [HTTP status / 핵심 페이지 확인]
- Edge Function logs: [에러 유무]

### 후속 조치
- [ ] 프로덕션 스모크 테스트
- [ ] (스키마 변경 시) `mcp__supabase__generate_typescript_types`
- [ ] CHANGELOG / 릴리즈 노트
```

## 안티패턴 (하지 말 것)

| 금지 | 이유 |
|------|------|
| `firebase deploy *` | Firebase Hosting/Firestore 미사용 (2026-04-11 제거) — 웹은 Cloudflare Pages. FCM 푸시는 살아있지만 `firebase deploy` 대상이 아님 (앱 빌드의 `google-services.json` + Edge Function `send-push-notification` 경유) |
| `supabase db push` | 메모리 feedback_supabase_migration_workflow |
| 루트에서 `npm run *` 실행 | 작업 디렉토리는 `uniqn-mobile/` |
| 품질 게이트 스킵 | type-check 실패 그대로 프로덕션 배포 위험 |
| "다 배포" 요청에 EAS 포함 | 시간/크레딧 소모 큼, 명시 요청 필요 |
| 배포 후 검증 생략 | 메모리 verification.md 위반 |
