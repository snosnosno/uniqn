# CLAUDE.md

> **⚠️ 언어 규칙 (필수): 모든 응답·설명·커밋 메시지·문서·코드 주석은 반드시 한글로 작성한다.** 영어로 답하지 말 것. 코드 식별자/라이브러리명/명령어 등 고유 기술 용어만 원문 유지.
>
> 작업 디렉토리: uniqn-mobile/ | 배포 전: `npm run quality`

## 프로젝트
홀덤펍·대회사 대상 단발 인력 매칭 앱 — Expo 55 / RN 0.83.4 / React 19.2 / TS strict / NativeWind 4.2 / Supabase
타깃: 홀덤펍 사장(상시 단발 알바) + 대회사 운영팀(대회 D-7~D-day 집중 인력). 포커룸은 비타깃.

## 핵심 규칙
| 항목 | 필수 | 금지 |
|------|------|------|
| 언어 | 응답·커밋·문서·주석 **한글** | 영어 답변 |
| 로깅 | `logger.info()` | `console.log()` (앱 런타임) |
| 다크모드 | `dark:` 항상 적용 | 라이트모드만 |
| 경로 | `@/` 절대 경로 | 시스템 절대 경로 |
| 알림 | `toast.success()` / `Alert.alert()` | 단순 `alert()` |
| 필드명 | camelCase | snake_case |
| 리스트 | FlashList (대형) / FlatList (소형) | 대형에 FlatList |
| 이미지 | expo-image | RN `<Image>` |

예외: `functions/**/*.ts` Cloudflare Pages Functions는 `console.log()` 허용

## 지식 위키
프로젝트 지식 합성 레이어는 `wiki/`. 위키 작업(ingest/query/lint) 시 `wiki/AGENTS.md` 규약 준수. 운영: `/ingest` `/query` `/lint`.

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
UserRole(앱권한) ≠ StaffRole(현장 직무: dealer/floor/serving)

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
리팩토링→`/refactor` | 성능→`/performance` | 국제화→`/i18n` | 접근성→`/a11y` | 마이그레이션→`/migration`
RLS/권한/위험 변경 전→`/guard` 먼저

## 변경 이력 / 지식 시스템
- 변경·스택 이력: `wiki/log.md`(최근 5건 `grep "^## \[" wiki/log.md | tail -5`) · `CHANGELOG.md`. CLAUDE.md는 **규칙 전용**(날짜 노트 누적 금지).
- 지식 4계층 역할분담(CLAUDE.md=규칙 / 메모리=라이브함정·진행작업 / wiki=영속합성 / 옵시디언색인=발견) + 졸업 규칙: `wiki/AGENTS.md §10`.
