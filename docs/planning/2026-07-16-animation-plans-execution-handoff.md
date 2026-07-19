# 핸드오프 — 애니메이션 개선 계획 5건 실행 (다음 세션 메인 프롬프트, 새 워크트리)

> 작성: 2026-07-16. 전제 세션: emilkowalski 스킬 설치 + improve-animations quick 감사 완료.
> 아래 블록을 새 세션에 그대로 붙여넣는다.

---

애니메이션 개선 계획 5건을 새 워크트리에서 끝까지 실행해줘.

## 배경 (전 세션 산출)

- `improve-animations` 감사로 실행 계획 5건이 작성됨: **메인 트리** `C:\Users\user\Desktop\T-HOLDEM\docs\planning\animation-plans\001~005 + README.md` (⚠️ **미커밋 untracked** — 새 워크트리에 자동으로 없음).
- 각 계획은 자족적(현재 코드 발췌·정확한 커브 값·검증 명령·feel check 포함). 계획에 없는 것은 하지 말 것 — 범위 밖 리팩터링 금지.
- 감사 기각 항목(재보고·수정 금지): OfflineStatusBar exit ease-in(룰 25), pressed=배경톤(룰 21), DateCalendar LayoutAnimation(룰 8 준수). 상세는 animation-plans/README.md.

## 1. 격리 셋업 (구현 전 필수)

1. `git status` 확인 — 메인 트리는 다른 세션이 점유 중일 수 있음. **메인 트리에서 작업 금지.**
2. 워크트리 생성:
   ```bash
   cd C:/Users/user/Desktop/T-HOLDEM
   git fetch origin
   git worktree add ../T-HOLDEM-anim -b feat/animation-motion-polish origin/master
   ```
3. node_modules 정션(5분 npm install 절약, 관리자 불필요):
   ```
   cmd /c mklink /J "C:\Users\user\Desktop\T-HOLDEM-anim\uniqn-mobile\node_modules" "C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules"
   ```
4. 계획 복사(메인 트리 → 워크트리, 이후 작업과 함께 커밋됨):
   ```bash
   mkdir -p ../T-HOLDEM-anim/docs/planning
   cp -r docs/planning/animation-plans ../T-HOLDEM-anim/docs/planning/
   ```
5. 이후 모든 작업은 `C:/Users/user/Desktop/T-HOLDEM-anim`에서. 절대경로 하드코딩 금지(`@/` alias만).

## 2. 실행 순서·규율

**001 → 004 → 002 → 003 → 005 순차 실행. 병렬 금지** (같은 파일 다수 접촉: Toast/Modal/SheetModal).

계획 1건마다 이 사이클을 지킨다:

1. 계획 파일 Read → 명시된 파일·행이 현재 코드와 일치하는지 확인. **드리프트면 중단하고 보고** (계획의 Boundaries 규칙).
2. 구현 (계획의 Target·Steps 그대로 — 값 임의 변경 금지).
3. 검증: `cd uniqn-mobile && npm run quality` EXIT 0 + `npx jest src/components/ui --silent` 통과. 출력 증거 없이 완료 주장 금지.
4. code-reviewer(`model: "fable"`) 리뷰 → CRITICAL/HIGH 즉시 수정.
5. 계획 파일 Status를 DONE으로 갱신 + README.md 표 갱신.
6. 커밋 (로컬만, 한글 컨벤션): `feat(ui): 모션 토큰 신설 — MOTION_EASING·MOTION_DURATION(계획001)` 형식.

## 3. 계획별 주의점

| 계획 | 주의 |
|---|---|
| 001 토큰 | 기존 `src/constants/animation.ts` **확장**(새 파일 금지). LoadingOverlay가 첫 소비처 |
| 004 시트 커브 | `SHEET_DISMISS_ANIMATION_MS`(300) 대기시간은 불변. Web 분기 범위 외 |
| 002 Toast | duration 현행 유지(200/150), 이징만 교체 |
| 003 reduce-motion | Toast 퇴장 완료 콜백을 opacity 쪽으로 이동(누락 시 onDismiss 미호출 버그). Skeleton 테스트 mock 경로 갱신 가능성 |
| 005 드래그 dismiss | Android는 RNModal 안 `GestureHandlerRootView` 필수. 헤더 한정 제스처(ScrollView 충돌 회피). **실기기 feel check는 사용자 게이트** — 구현+기계검증까지만 하고 Status는 `IMPLEMENTED(실기기 QA 대기)`로 |

시뮬레이터 feel check로 앱을 띄울 경우 워크트리+정션 함정: `EXPO_ROUTER_APP_ROOT=<워크트리>/app` 절대경로 + `--clear` 필요(없으면 라우트 0 "Welcome to Expo"). `.env.development.local`은 메인 트리에서 복사.

## 4. 금지·게이트

- push / PR / OTA는 **사용자 명시 요청 시만**. 이 세션 산출 = 로컬 커밋 5건(+수정 커밋).
- master 직접 커밋 금지, 메인 트리 파일 수정 금지, `mcp__supabase__*` 호출 불필요(서버 무관 작업).
- 계획 밖 애니메이션 "개선" 추가 금지 — 발견하면 보고만.

## 5. 완료 기준 (종료 전 자가검증)

- [ ] 5계획 Status 갱신(001~004 DONE, 005 IMPLEMENTED) + README 표 반영
- [ ] 최종 `npm run quality` EXIT 0 + ui jest 통과 — **출력 증거 포함 보고**
- [ ] `Easing.ease`/`Easing.out(Easing.ease)` 리터럴이 Toast/Modal/SheetModal/LoadingOverlay에 잔존 0건 (`grep` 증거)
- [ ] 커밋 SHA 목록 + 남은 사용자 게이트(실기기 QA 항목) 정리 보고
- [ ] 메모리 `project_emil_animation_skills_20260716.md` 진행상태 갱신
