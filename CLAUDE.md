# CLAUDE.md

> 언어: 한글 | 작업 디렉토리: uniqn-mobile/ | 배포 전: `npm run quality`

## 프로젝트
포커룸 스태프 관리 앱 — Expo 54 / RN 0.81.5 / TS strict / NativeWind 4.2 / Supabase

## 핵심 규칙
| 항목 | 필수 | 금지 |
|------|------|------|
| 로깅 | `logger.info()` | `console.log()` (앱 런타임) |
| 다크모드 | `dark:` 항상 적용 | 라이트모드만 |
| 경로 | `@/` 절대 경로 | 시스템 절대 경로 |
| 알림 | `toast.success()` / `Alert.alert()` | 단순 `alert()` |
| 필드명 | camelCase | snake_case |
| 리스트 | FlashList (대형) / FlatList (소형) | 대형에 FlatList |
| 이미지 | expo-image | RN `<Image>` |

예외: `functions/*.js` CLI/운영 스크립트는 `console.log()` 허용

## 아키텍처
```
Presentation → Hooks → Service → Repository → Supabase
```
- DB 접근: Service → Repository → Supabase 경유 필수
- Supabase Auth: authService + 인증 hook만 직접 호출 허용
- TanStack Query 읽기 전용 조회: Repository 직접 호출 허용
- Presentation/Hooks에서 Supabase 직접 호출 금지

## 역할
`admin > employer > staff` | (public/auth)→없음 | (app)→staff | (employer)→employer | (admin)→admin
UserRole(앱권한) ≠ StaffRole(포커룸 직무: dealer/floor/serving)

## 커밋 / 보안 / 트랜잭션 / 에러
- 커밋: `<type>(<scope>): <한글>` — feat/fix/refactor/style/docs/test/chore/perf
- XSS: `z.string().refine(xssValidation)` — 모든 사용자 입력에 필수
- 다중 문서: `runTransaction` 필수 (지원/취소/출퇴근/정산/역할 변경)
- 에러: AppError (`src/errors/`) — E1~E7 (네트워크/인증/검증/DB/보안/비즈/미분류)

## 명령어
```bash
npm start       # 개발 서버
npm run quality # type-check + lint + format:check
npm test        # Jest
eas build --platform ios|android
```

## Health Stack
- typecheck: `tsc --noEmit`
- lint: `eslint . --ext .js,.jsx,.ts,.tsx`
- format: `prettier --check "src/**/*.{ts,tsx,js,jsx}" "app/**/*.{ts,tsx,js,jsx}"`
- test: `jest` | deadcode: `npx knip`

## Skill routing
Skill 요청 시 Skill tool 먼저 호출 (직접 답하지 말 것):
에러→`/investigate` | 계획→`/autoplan` | 리뷰→`/review` | 커밋→`/commit`
PR→`/pr` | 배포→`/deploy` | 보안→`/cso` | 품질→`/health` | 회고→`/retro`
디자인→`/design-review` | 타입에러→`/type-check` | 테스트→`/test`

*2026-04-13 업데이트 — Supabase 이전 완료, Black & Gold 디자인 시스템 완료*
