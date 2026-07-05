# 저장소 가이드라인 (AGENTS.md)

> 모든 AI 에이전트/하네스 공용 규약. Claude Code 전용 규칙·스킬 라우팅은 `CLAUDE.md`, 세션 오케스트레이션(에이전트 분담·병렬 디스패치·훅)은 `.claude/rules/orchestration.md`가 단일 진실원이다.

## 프로젝트 구조
주 개발은 `uniqn-mobile/`. `app/`은 Expo Router 그룹: `(public)`, `(auth)`, `(app)`, `(employer)`, `(admin)`. UI는 `src/components/`, 훅은 `src/hooks/`, 비즈니스 로직은 `src/services/`, Supabase 접근은 `src/repositories/`, 에러는 `src/errors/`. Supabase Edge Functions는 `uniqn-mobile/supabase/functions/`, DB 마이그레이션은 `uniqn-mobile/supabase/migrations/`, 문서는 `docs/`, 지식 위키는 `wiki/`. 루트 `functions/`(Firebase Functions)는 레거시 — 신규 작업 금지.

## 빌드·테스트·개발 명령
모바일 명령은 `uniqn-mobile/`에서 실행: `npm start`(Expo), `npm run android`/`npm run ios`(로컬 빌드), `npm run quality`(type-check + lint + format:check), `npm test`(Jest), `npm run e2e`(Playwright). Edge Functions 로컬 서빙은 `npx supabase functions serve`. 릴리스 전 `npm run quality` 필수.

**DB 마이그레이션: MCP `apply_migration` 전용 — `npx supabase db push` 금지.** 마이그레이션 파일 타임스탬프 불일치는 무해. 기존 마이그레이션 파일 수정 금지(신규 파일로만).

## 코딩 스타일·네이밍
strict TypeScript, 명시적 타입, 2칸 들여쓰기, 기존 Prettier 규칙. `uniqn-mobile/src` 내부는 `@/` 임포트(같은 폴더만 `./`). 필드 camelCase, 컴포넌트 PascalCase, 라우트/에셋 파일명 kebab-case. 런타임 코드는 `console.log()` 대신 `logger.info()`(CLI 스크립트만 console 허용). 상태 피드백은 `toast.success()`, 확인 다이얼로그는 `Alert.alert`/`window.confirm`(RN Web에서는 `confirmAction` 유틸 경유 — RN Web `Alert`는 no-op). 이미지는 `expo-image`, 새 UI는 `dark:` 스타일 필수, 대형 리스트는 `FlashList`(피커·고정 그리드는 `FlatList` 허용).

## 테스트
앱 테스트는 Jest(`jest-expo`). 테스트는 `*.test.ts(x)` 또는 `__tests__/` 아래. 커버리지 임계값은 `uniqn-mobile/jest.config.js`에서 강제 — 공유 로직 변경 시 `npm run test:coverage`도 실행. E2E는 `uniqn-mobile/e2e/`. DB 회귀는 pgTAP(`supabase/tests/`). 루트 `functions/test/`는 레거시(Firebase) — 신규 테스트 금지.

## 커밋·PR
`<type>(<scope>): <한글 제목>` — 예: `fix(mobile): 로그인 예외 처리 수정`. 타입: feat/fix/refactor/docs/test/chore/perf. PR에는 요약, 연결 이슈/스펙, 영향 영역, UI 변경 시 스크린샷/녹화 포함. RLS·트랜잭션(RPC)·역할 변경은 명시적으로 언급.

## 아키텍처·보안
`Presentation → Hooks → Service → Repository → Supabase` 흐름 유지. 도메인 DB 읽기/쓰기는 Service·Repository 경유. 인증 훅은 `authService`/인증 훅 직접 호출 허용, TanStack Query 읽기 전용 훅은 Repository 직접 호출 허용. 다중 문서 갱신은 Supabase RPC(클라이언트 다단계 뮤테이션 금지). 사용자 입력은 `@/utils/security`의 `xssValidation`으로 검증, 에러는 `src/errors/`의 `AppError`. RLS 앱 역할 체크: `(auth.jwt() -> 'app_metadata' ->> 'role')` (`auth.jwt() ->> 'role'` 아님).

`uniqn-mobile/src` 내 정식 소유권(canonical ownership):
- `@/shared/status`: 상태 타입·라벨·흐름·매퍼의 정본
- `@/constants/statusConfig`: UI 상태 variant·색·표시 설정
- `@/domains/settlement`: 정산 계산기 + 기본 급여/세금 상수
- `@/shared/realtime`: 지원되는 realtime 표면(`RealtimeManager`, `useRealtimeSubscription`)
- `@/types`: 타입 전용 배럴 — 런타임 헬퍼/상수는 원 모듈에서 임포트

Supabase 배치:
- Edge Functions: `uniqn-mobile/supabase/functions/`
- 마이그레이션: `uniqn-mobile/supabase/migrations/`
- DB 타입: `uniqn-mobile/src/types/supabase.ts` (`npx supabase gen types typescript`로 재생성)

## 에이전트 작업 규약 (요약)
- 구현 전 `git status` — 내가 만들지 않은 미커밋 변경 존재 시 새 워크트리+브랜치 격리
- 신규 기능 3+ 파일 = 설계/계획 먼저. 코드 작성 직후 코드 리뷰. 완료 주장 전 실행 증거(테스트/빌드 출력) 필수
- 독립 작업은 병렬 처리. 지식 검색은 옵시디언 색인/`wiki/`(`/query`)를 지도로 활용 — 상세: `.claude/rules/orchestration.md`, 지식 계층 계약: `wiki/AGENTS.md` §10
