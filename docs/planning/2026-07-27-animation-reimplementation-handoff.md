# 애니메이션 모션 시스템 재구현 — 다음 세션 핸드오프 (2026-07-27)

> ## ✅ A 묶음 완료 — PR #350 (`ab097c0fc`)
> 2026-07-27, master 위에서 재구현 완료. 남은 것은 **B 묶음(§5)뿐**이다.
> §2 A 묶음 내용은 이제 **완료 기록**으로 읽을 것(재실행 금지 — 이미 존재하는 파일과 충돌한다).
> 계획 파일 Status: 001 DONE · 002 DONE · 003 PARTIAL · 004 PARTIAL · 005/006 TODO.

> `feat/animation-motion-polish` 브랜치는 **폐기**됐다(판정 `REWORK_ON_MASTER`).
> 사양과 코드는 태그 `archive/2026-07-27/feat-animation-motion-polish`(13커밋)에 보존돼 있다.
> 이 문서는 그 작업을 **master 위에서 다시 구현**하기 위한 착수점이다.

---

## 0. 새 세션에 붙여넣을 프롬프트 (B 묶음용)

```
docs/planning/2026-07-27-animation-reimplementation-handoff.md 를 읽고
B 묶음(SheetModal 드래그 dismiss)을 구현해줘. A 묶음은 PR #350 으로 이미 끝났다.

먼저 §5 B-2 의 선행 게이트를 해소해야 한다:
1) 계획 006 (실기기 관찰 선행 — 퇴장이 '팝 소멸'로 보이는지 / 짧은 시트 드래그 체감)
2) jest.setup.js 에 react-native-gesture-handler mock 추가 (현재 부재, 20+ 스위트 영향)

폐기된 브랜치의 코드는 태그 archive/2026-07-27/feat-animation-motion-polish 에 있고,
사양서는 docs/planning/animation-plans/004~006 에 있다.
브랜치를 체크아웃하거나 머지하지 말 것 — 파일을 골라 옮기는 방식으로만 작업한다.

§3 "절대 건드리지 말 것" 목록을 먼저 확인할 것.
이 작업은 네이티브 제스처라 OTA 로 회수되지 않는다 — 실기기 QA 없이 머지 금지.
```

---

## 1. 왜 브랜치를 버렸나 (재구현 전 반드시 이해할 것)

브랜치는 2026-07-17 하루 새벽에 계획001~005를 몰아서 구현했다. 그 뒤 master 가 **같은 파일들을
계속 다시 썼다**. `SheetModal.tsx` 하나만 봐도 브랜치 분기점 이후 **7커밋**이 지나갔다:

```bash
git log --oneline cb825815e..master -- uniqn-mobile/src/components/ui/SheetModal.tsx
```

| PR | 무엇을 고쳤나 | 되돌리면 |
|---|---|---|
| #280 `47f133346` | 실기기 QA UI 결함 6뿌리 — 안전영역·시트높이·라벨증발·다크모드·탭바여백·테두리대비 | 시트 푸터가 홈 인디케이터에 잘림 |
| #302 `a125612ba` | Android 키보드가 모달/시트를 가리는 문제 — IME 인셋 직접 보정 | Android 키보드 가림 재발 |
| #306~#308 | 주문서 연쇄 진입 `contentOpacity`·`onShow` early-return | 연쇄 진입 연출 깨짐 |
| #313 `b76668b5e` | ops 콘솔 | — |
| #332 | 시트 높이 `flex:1` → `flexShrink:1` + 상태바 인셋 상한 | 짧은 시트가 화면을 가득 채움 |
| #335 | KAV → `ModalKeyboardAvoider`(keyboard-controller) | Android 모달 키보드 회피 붕괴 |

즉 브랜치 hunk 를 채택하면 **실기기에서만 발견됐던 수정 5건이 한꺼번에 되돌아간다**.
반대로 master hunk 를 채택하면 SheetModal 에 남는 브랜치 기여가 0이다 — 중간 지대가 없다.

⚠️ **"머지하고 충돌만 풀면 된다"는 착각의 함정**: git 이 브랜치 전용 식별자
(`reduceMotion`·`MOTION_DURATION`·`MOTION_EASING`)를 충돌 마커 **밖으로** 자동머지한다.
master 쪽으로 충돌을 풀면 결과는 "브랜치 기여 0"이 아니라 **미정의 참조가 남은 컴파일 불가 파일**이다.

또 하나: 계획001의 첫 소비처였던 `LoadingOverlay.tsx` 는 **#263 `cbeaad9dd`(2026-07-17)에서
죽은 코드로 삭제**됐다(master 전체 참조 0건). 토대가 사라졌으므로 계획001의 검증 시나리오
("첫 소비처 확인")는 그대로 성립하지 않는다.

---

## 2. A 묶음 — 이번에 할 것 (저위험 · 실기기 QA 불필요 · 1세션)

### A-1. 모션 토큰을 **새 모듈**로 신설 — `src/constants/motion.ts`

⚠️ **`constants/animation.ts` 에 얹지 말 것.** 그 파일에 `import { Easing } from 'react-native-reanimated'`
와 모듈스코프 `Easing.bezier()` 평가가 들어가면 소비처 전부로 전파된다. 실측 소비처:

```
OrderSheetScreen.tsx · OrderSheetScreen.chain.test.tsx · schedule.tsx · ScheduleDetailModal.tsx
```

주문서 연쇄 로직과 그 테스트가 포함된다. `src/constants/motion.ts` 로 분리하면 전파가 0이고
브랜치 원본과의 충돌도 사라진다. (`constants/index.ts` 가 `animation` 을 재-export 하지 않는 것은
실측 확인됨 — 배럴 순환 위험은 없다.)

내용은 태그에서 그대로 가져온다:

```bash
git show archive/2026-07-27/feat-animation-motion-polish:uniqn-mobile/src/constants/animation.ts
# → MOTION_EASING · MOTION_DURATION 블록만 발췌해 src/constants/motion.ts 로
```

기존 `SHEET_DISMISS_ANIMATION_MS`·`sheetChainSwapMs`·`SHEET_CHAIN_DATES_SCRIM_HOLD_MS` 는
**개념이 다르다**(연출 커브 vs 네이티브 dismiss 커밋 대기). 손대지 말 것.

### A-2. 공유 `useReduceMotion` 훅

```bash
git show archive/2026-07-27/feat-animation-motion-polish:uniqn-mobile/src/hooks/useReduceMotion.ts
git show archive/2026-07-27/feat-animation-motion-polish:uniqn-mobile/src/hooks/__tests__/useReduceMotion.test.tsx
```

- 🔴 **`hooks/index.ts` 배럴에 export 하지 말 것.** 리프 UI 는 직접 경로만 쓴다
  (이 레포는 배럴 상수 순환 참조로 모듈스코프 값이 `undefined` 가 되는 함정이 **3회 재발**했다).
- 🔴 **본문 방어 비대칭을 고쳐서 이식할 것.** 원본은 모듈스코프 프리페치만
  `AccessibilityInfo.isReduceMotionEnabled?.()...catch(() => {})` 로 방어하고, **훅 본문의
  `.then(...)` 에는 옵셔널 체이닝도 catch 도 없다.** 이 메서드를 주지 않는 mock 환경에서
  throw / unhandled rejection 이 난다. 본문도 동일하게 방어하라.

### A-3. 로컬 중복 정의 제거

`Skeleton.tsx:62` · `OfflineStatusBar.tsx:63` 에 각자 `useReduceMotion` 이 따로 정의돼 있다.
삭제하고 `import { useReduceMotion } from '@/hooks/useReduceMotion'` 로 수렴한다.

🔴 master 쪽 **나머지 로직은 절대 건드리지 말 것** — 플랩 가드 · reconnected phase ·
지연 언마운트 · iOS 낭독.

### A-4. `Toast.tsx` — 실제 버그 픽스 포함

master 무변경 파일이라 브랜치 diff 를 거의 그대로 적용할 수 있다. 특히 이 둘은 **버그 픽스**다:

- `reduceMotionRef` 로 deps 에서 빼는 처리
- **완료 콜백을 opacity 에 건다** — reduce motion 에서 `translateY` 를 즉시 세팅하면
  `onDismiss` 가 유실된다

### A-5. `Modal.tsx` — NativeModal 이펙트만

토큰 치환 + reduce motion 분기까지만.

🔴 **한 줄도 건드리지 말 것**: WebModal · `footer` prop · `maxHeight '85%'/'90%'` ·
`ModalKeyboardAvoider` · insets 패딩.

---

## 3. 절대 건드리지 말 것 (되돌리면 실기기에서만 다시 발견된다)

| 파일 | 보존 대상 | 근거 PR |
|---|---|---|
| `SheetModal.tsx` | **파일 전체** — A 묶음 범위 밖 | #280·#302·#306~#308·#313·#332·#335 |
| `Modal.tsx` | WebModal · `footer` · `maxHeight` % 상한 · `ModalKeyboardAvoider` · insets | #332·#333·#335 |
| `OfflineStatusBar.tsx` | 플랩 가드 · reconnected phase · 지연 언마운트 · iOS 낭독 | #262 |
| `constants/animation.ts` | `SHEET_DISMISS_ANIMATION_MS` · `sheetChainSwapMs` · `SHEET_CHAIN_DATES_SCRIM_HOLD_MS` | #306~#308 |
| `hooks/index.ts` | 배럴에 `useReduceMotion` 추가 금지 | 배럴 순환 3회 재발 |
| `LoadingOverlay.tsx` | **부활시키지 말 것** — #263 에서 죽은 코드로 삭제됨(참조 0) | #263 |

---

## 4. 검증 게이트 (A 묶음) — ✅ 2026-07-27 통과

```bash
cd uniqn-mobile
npm run quality                          # EXIT 0 (css-vars · rpc-migrations · tsc · eslint · prettier)
npx jest                                  # 전량 green (배럴 순환 이력 때문에 전체를 돌린다)
grep -rn "Easing\." src/components/ui/{Toast,Modal}.tsx   # 0건이어야 함
```

⚠️ **초판의 grep 대상 4파일은 오류였다.** `Skeleton.tsx`(shimmer `Easing.inOut`)와
`OfflineStatusBar.tsx`(배너 페이드 `Easing.out/in(quad)`)에는 **자체 애니메이션이 있고 정상이다** —
A-3 의 범위는 그 두 파일의 *중복 `useReduceMotion` 정의 제거*뿐이며, 계획 001~004 중 어디도
이 둘의 커브를 토큰화 대상으로 잡지 않았다(§2 A-3 "나머지 로직은 절대 건드리지 말 것"). 문자
그대로 실행하면 **끝난 작업을 실패로 오판하거나 범위 밖 파일을 잘못 고치게 된다.**

`npm run knip:gate` 래칫은 현재 **2212 로 이미 red**(정리 전부터). A 묶음이 그 수를
**늘리지 않는지**만 확인하면 된다.

**2026-07-27 실측 결과**: quality EXIT 0 · jest 544 스위트 / 6028 테스트 / 122 스냅샷 통과 ·
`Toast.tsx`·`Modal.tsx` `Easing.` 0건 · knip 신규 export 3종 모두 소비(래칫 미증가).

---

## 5. B 묶음 — 이번 범위 아님 (별도 브랜치 · 실기기 QA 게이트)

### B-1. SheetModal 토큰 치환 (계획004)
master 의 현재 이펙트 위에 재적용하되 **연쇄 진입 early-return · `contentOpacity` · `onShow` 를
반드시 보존**. 퇴장 250ms→225ms 는 눈에 보이는 변화라 실기기 확인 대상이다.

### B-2. 드래그 dismiss (계획005 + 006)
**계획006 을 먼저 해소해야 한다.** 브랜치 저자 본인이 미해결로 남긴 것:

1. RNModal `visible=false` 즉시 제거 때문에 퇴장이 **'팝 소멸'** 로 보일 가능성(확신도 6/10)
   → 지연 언마운트 필요
2. 거리 임계 `0.25 × windowHeight` 는 **짧은 시트에서 무의미**(시트 높이를 넘어 사실상 닫히지
   않고 백드롭만 잔존) → `onLayout` 실측 높이 기준으로 스케일

추가 선결 과제:
- `jest.setup.js` 에 **`react-native-gesture-handler` mock 이 없다**(mock 15종 전수 확인).
  `GestureDetector` 가 들어가면 SheetModal 을 렌더하는 **20+ 스위트**가 영향받는다
  (주문서 시트 10종 · OrderSheetScreen 8종 · ProfileModal · SignupStepTerms …).
- 이 제스처는 앱에서 가장 많이 쓰이는 시트(지원하기 확인형 닫기, 주문서 연쇄)에 새 표면을
  추가한다. 옳은지 판별하는 유일한 수단이 실기기 QA 이고, **2026-07-17 이후 한 번도 수행되지 않았다.**
- 네이티브 제스처 의존이라 문제가 생기면 **OTA 로 즉시 회수되지 않는다.**

### B-3. 그대로 이식 가능한 완제품 2파일
```bash
git show archive/2026-07-27/feat-animation-motion-polish:uniqn-mobile/src/components/ui/sheetModalGesture.ts
git show archive/2026-07-27/feat-animation-motion-polish:uniqn-mobile/src/components/ui/__tests__/sheetModalGesture.test.ts
```
순수 함수 + 워크렛 안전, master 와 충돌 0. 테스트 6케이스는 실제 버그(`2cec50fc7` 상향 플릭
취소)의 회귀 고정이다.

⚠️ **B-1 없이 이 파일만 먼저 넣지 말 것** — 참조처가 `SheetModal.tsx` 뿐이라
프로덕션 참조 0인 모듈이 되어 knip 부채가 된다.

---

## 6. 사양서 위치

`docs/planning/animation-plans/` (PR#348 로 master 에 회수 완료)

| 문서 | 내용 |
|---|---|
| `001-motion-tokens.md` | 모션 토큰 신설 |
| `002-toast-easing.md` | Toast 입장 이징 |
| `003-reduce-motion-core-ui.md` | 코어 UI 4종 reduce motion |
| `004-sheet-travel-curve.md` | 시트 travel 커브 + 75% 퇴장 규칙 |
| `005-sheet-drag-dismiss.md` | 드래그 dismiss (Status: `IMPLEMENTED(실기기 QA 대기)`) |
| `006-sheet-exit-render-and-thresholds.md` | **B-2 선행 게이트 명세 — 값어치 가장 큼** |
| `README.md` | 계획 인덱스 |

관련 스킬도 함께 회수됐다: `.claude/skills/{animation-vocabulary,apple-design,emil-design-eng,improve-animations,review-animations}`

출하 게이트 원본: `docs/planning/2026-07-17-animation-ship-gates-handoff.md`
