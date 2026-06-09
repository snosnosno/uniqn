# UNIQN 전체 UI/UX 디자인 리뷰·개선 루프 — 핸드오프 지침

> 작성 2026-06-10 · `/loop` 세션 전용. **매 회차 이 파일과 `STATE.md`를 먼저 읽고 시작할 것.**
> 1회차는 [부트스트랩](#부트스트랩-1회차만) 수행 후 배치 A부터 시작.

## 목표

전체 앱 화면(~80개)을 배치 단위로 순회하며:
1. **디자인 룰 위반 적발·수정** — 27룰 + 안티패턴 기준
2. **화면 간 일관성 통일** — 토큰·간격·타이포·아이콘·카피 톤·로딩/빈/에러 상태
3. **UX 개선** — 즉시 가능한 폴리시는 수정, 동선/정보구조급은 P3 백로그에 기록만

모든 배치 완료 + 횡단 일관성 패스(Z) 후 루프 종료.

## 디자인 기준 (SSOT — 이 우선순위로)

1. `.claude/rules/impeccable-design.md` — 27룰 + 14 안티패턴 + 27항목 PR 체크리스트. **회차마다 정독.**
2. `.claude/rules/nativewind-patterns.md` — FlashList `dark:bg-surface` 필수, 시맨틱 토큰, CSS var 웹 주입
3. `CLAUDE.md` 핵심 규칙 — `dark:` 항상, `toast.success()`/`Alert.alert()`, expo-image, FlashList(대형)/FlatList(소형), `logger` (console.log 금지)
4. 테마: **Black & Gold** (2026-04-13 완료) — 골드는 60-30-10의 "10", 남용 = 안티패턴
5. 타깃 사용자: **홀덤펍 사장(단발 알바 구인) + 대회사 운영팀(D-7~D-day 집중 인력)** — 포커룸 시나리오는 배제하고 판단
6. 기존 적발 참고: 프로젝트 메모리 `project_screen_audit_20260605`(35에이전트 감사, P2 17건·P3 ~40건 검증완료) — 중복 적발 방지용 참조

## 작업 범위

| | 내용 |
|---|---|
| **허용** | `app/` 화면, `src/components/`, 디자인 토큰(`tailwind.config` 등 스타일 상수), 사용자 노출 카피 |
| **금지** | DB/마이그레이션/RPC/Edge Function, 비즈니스 로직·Service/Repository 레이어 변경 |
| **금지** | `src/constants/legal/` 본문 및 약관/정책 화면 본문 직접 수정 (단일 소스 규칙 — 레이아웃 컨테이너만 허용) |
| **금지** | `push` / PR 생성 — **로컬 커밋만**. push는 사용자 명시 요청 시에만 |
| **금지** | 기능 동작 변경 — 시각/UX 폴리시만. 동선·정보구조 변경급 제안은 `STATE.md` P3 백로그에 기록 |

## 부트스트랩 (1회차만)

1. `git status` 확인 — 내가 만들지 않은 미커밋 변경이 있으면(`marketing/iap-review/` untracked는 무시) **워크트리 + 새 브랜치로 격리** (`mklink /J uniqn-mobile\node_modules <메인repo경로>`로 npm install 절약). 깨끗하면 메인 체크아웃 사용.
2. `master` 기준 새 브랜치 **`design/ui-ux-consistency-loop`** 생성 (현재 `fix/wallet-p1-money-and-ui`는 별도 세션의 미머지 작업 — 손대지 말 것).
3. `docs/design-loop/` 두 파일(이 파일 + STATE.md)을 첫 커밋으로: `docs(design): UI/UX 일관성 루프 핸드오프 문서`.
4. ⚠️ `app/(app)/wallet/`은 master에 **없음**(`fix/wallet-p1-money-and-ui` 미머지) — 배치 W는 `deferred` 유지, 건드리지 말 것.

## 매 회차 프로토콜

1. **읽기**: `docs/design-loop/STATE.md` → 첫 `pending` 배치 선택, `in-progress`로 마킹.
2. **리뷰**: 배치의 화면 파일 + 사용하는 공용 컴포넌트를 정독. 27항목 체크리스트로 적발:
   - **P1** = 깨짐·다크모드 미적용·터치타깃 44px 미달·접근성 위반·텍스트 잘림
   - **P2** = 일관성 위반 (토큰 직접색상, 간격 불일치, 아이콘 혼용, 카피 톤 불일치, Skeleton 부재, 빈/에러 상태 미흡, Pressed 피드백 부재)
   - **P3** = 개선 아이디어 (동선/정보구조 포함) — 기록만
3. **수정**: P1·P2를 코드로 수정 (행동 보존). 공용 컴포넌트 수정 시 사용처 전수 grep 후 영향 확인. 큰 배치는 서브에이전트/워크플로 병렬 리뷰 활용 가능 — 단, 수정·커밋은 메인 세션이 검증 후 수행.
4. **검증** (증거 없는 완료 선언 금지):
   - `cd uniqn-mobile && npm run quality` → exit 0
   - 수정 화면 관련 jest 통과 (전체 jest는 최종 패스 Z에서 1회)
   - 시각적으로 위험한 변경(레이아웃/토큰)은 웹 dev 서버에서 라이트/다크 모두 스크린샷 확인 (테스트 계정: `docs/analysis/review-test-accounts.md`)
5. **커밋**: 배치당 1커밋 — `style(<scope>): <배치명> UI/UX 일관성 정비` (동작에 닿는 수정이 섞이면 `fix`). 커밋 컨벤션 `<type>(<scope>): <한글>`.
6. **장부 갱신**: STATE.md에 done 마킹 + 발견/수정/P3 기록 → 같은 배치 커밋에 포함하거나 직후 `docs(design): ...` 커밋.
7. **페이싱**: 남은 `pending` 배치 있으면 ScheduleWakeup **60초**로 다음 회차 예약 (연속 작업이므로 짧게). 전부 done이면 → 최종 패스 Z 수행 → 종료 보고 후 **스케줄하지 않음** (루프 종료).

## 컨텍스트 규칙

- **회차당 배치 1개만.** 컨텍스트 50% 넘기 전에 커밋·장부 갱신까지 끝낼 것. 배치가 크면 화면 단위로 쪼개 STATE.md에 분할 기록 후 다음 회차로.
- 각 회차는 자기완결: STATE.md만 믿고 시작하고, STATE.md에 다 남기고 끝낼 것.

## 최종 패스 Z (모든 배치 done 후)

1. 횡단 일관성 검증: 동일 의미 요소(버튼/카드/모달/EmptyState/Skeleton/배지/금액·날짜 포맷)가 화면 간 동일한가 — 다르면 통일
2. `npm run quality` exit 0 + **전체 jest** green 증거 확보
3. 종료 보고: 수정 N건(P1/P2 분류)·커밋 목록·P3 백로그 요약·push/PR 여부는 사용자 결정 사항으로 안내

## 절대 금지 (재확인)

- `mcp__supabase__*` 호출, 기존 마이그레이션 수정, prod 접근
- master 직접 커밋, push, PR 생성
- `fix/wallet-p1-money-and-ui` 브랜치·`marketing/iap-review/` 접촉
- 증거(명령 출력) 없는 "완료" 선언
