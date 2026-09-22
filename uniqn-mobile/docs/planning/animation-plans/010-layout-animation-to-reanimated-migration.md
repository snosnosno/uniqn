# 010 — 구형 LayoutAnimation을 Reanimated LinearTransition으로 전환

- **Status**: DONE (2026-09-22) — 한 번 보류했다가 사용자 지시로 재개해 6개 파일 전부 적용. 보류 사유와 그 판단이 어떻게 뒤집혔는지는 아래 "보류 → 재개" 절 참조.
- **Commit**: d824729
- **Severity**: MEDIUM (정책 위반은 아니나 성능·중단가능성 개선, 리팩터 규모가 커서 레버리지는 낮음 — 후순위 권장)
- **Category**: 성능 · 중단가능성 (AUDIT.md §4, §5)
- **Estimated scope**: 6 files — **선행 조건: 계획 002, 006, 009가 먼저 적용되어 있어야 충돌 없이 진행 가능**

## 보류 → 재개 (2026-09-22, 같은 날)

아래 "보류 사유"로 한 번 멈췄다가 재개해 **6개 파일 전부 적용 완료**했다. 판단을 뒤집은 근거:

- **FlashList + Reanimated layout 선례가 이 저장소에 이미 있다.** `NotificationList.tsx:189` 의 `AppFlashList` 가 `keyExtractor` + `getItemType` 과 함께 `NotificationItem` 을 렌더하고, 그 `NotificationItem` 은 `layout`/`entering`/`exiting` 을 쓴 채 프로덕션에 나가 있다. 즉 "FlashList 안에서는 쓰면 안 되는 패턴"이 아니라 **이 저장소가 이미 채택한 패턴**이었다.
- 적용 시 재활용 리스크를 줄이려고 **카드 최상단(`CardStripe`)이 아니라 그 안쪽 컨테이너에만 `layout` 을 걸었고**, `entering`/`exiting` 은 펼침 콘텐츠 블록에만 달았다(재활용되는 루트에 `entering` 을 달지 않음).

**남은 검증**: 실기기에서 지원자/정산 목록을 길게 스크롤하며 글리치가 없는지, 연타 시 끊김이 사라졌는지는 여전히 확인이 필요하다. 코드 정합성(type-check·lint·199 suites/1728 tests)만 통과한 상태다.

## 보류 사유 (재개 전 기록 — 판단 근거를 남긴다)

이 계획을 실행하려다 **계획 작성 시점에 몰랐던 제약**을 발견해 보류했다. 나머지 10개 계획은 모두 적용·검증 완료된 상태다.

1. **대상 6개 중 3개가 FlashList 재활용 뷰 안에 있다.**
   - `ApplicantCard.tsx` → `ApplicantList.tsx:375` 의 `AppFlashList`
   - `GroupedSettlementCard.tsx` → `SettlementList.tsx:203` 의 `AppFlashList`
   - `GroupedAssignmentSelector.tsx` → `ApplicantCard` 내부이므로 동일하게 재활용 대상
   FlashList 는 아이템 뷰를 재활용하는데, Reanimated 의 `entering`/`layout` 은 뷰 단위로 살아 있는 애니메이션이라 재활용된 뷰가 다른 아이템으로 쓰일 때 무관한 두 지오메트리 사이를 전이하는 글리치가 날 수 있다. 현재 `LayoutAnimation` 은 다음 레이아웃 커밋 1회에만 걸리는 일회성이라 이 실패 모드가 훨씬 약하다.
   - 참고: 이 저장소에 **선례는 있다** — `NotificationItem.tsx` 가 FlashList 안에서 `layout`/`entering` 을 쓴다. 따라서 "불가능"이 아니라 **실기기 확인이 필요한 변경**이라는 뜻이다.

2. **이 계획의 완료 기준이 실기기 검증에 묶여 있다.** Verification 절의 핵심은 "연타 시 끊김이 사라졌는지"인데, 단위 테스트로는 관측되지 않는 항목이다. 스크롤 중 글리치 여부도 마찬가지다.

3. **기대 이득이 원래 작다.** README 가 이 계획을 "후순위 권장 · 레버리지 낮음 · 체감 미세"로 분류했다. 검증 불가능한 리스크를 안고 먼저 넣을 근거가 약하다.

**다시 집을 때의 권고**: 6개를 한 덩어리로 보지 말고 둘로 나눈다.
- **비재활용 3개**(`Accordion.tsx` · `FAQList.tsx` · `GroupedDateRequirementDisplay.tsx`) → 리스크 낮음. 단 `FAQList` 의 `LayoutAnimation` 은 자기 콘텐츠가 아니라 `AccordionItem` 바깥의 형제 리플로우만 담당하므로 `Accordion` 전환과 함께 묶어 판단해야 하고, `GroupedDateRequirementDisplay` 는 grep 상 **프로덕션 사용처가 없다**(테스트에서만 참조) → 이득도 0 에 가깝다.
- **재활용 3개** → 실기기(또는 최소한 시뮬레이터)에서 긴 목록 스크롤 + 연타 확인을 통과한 뒤에만 머지한다.

또한 이 계획은 `reduceMotion` 변수가 이미 있다고 전제하는데, **계획 002 가 6개 파일 전부에 적용 완료**됐으므로 그 전제는 이제 충족된 상태다. 즉 접근성 결함 자체는 002 로 이미 해소됐고, 010 은 순수하게 "메커니즘 현대화"만 남은 작업이다.

## Problem

`LayoutAnimation.configureNext(...)`은 RN 코어의 구형 API로, 다음 레이아웃 커밋을 통째로 애니메이션한다 — height/padding 같은 레이아웃 속성을 프레임마다 재계산(layout+paint)하며, UI 스레드 worklet이 아니라 브릿지 기반이다(New Architecture에서도 transform/opacity 전용 최적화 경로를 타지 않음). 또한 **연타 시 중단 불가**: 진행 중인 LayoutAnimation 도중 새 `configureNext`가 호출되면 이전 것을 매끄럽게 이어받지 못하고 끊긴다(AUDIT.md §4 "빠르게 토글되는 UI에 keyframes류 사용" 결함과 동일 성격).

영향 파일 6개(계획 002에서 이미 reduceMotion 가드가 추가됐다고 가정):
1. `src/components/ui/Accordion.tsx` (계획 009에서 셰브론은 이미 Reanimated로 전환됨 — 본체만 남음)
2. `src/components/support/FAQList.tsx`
3. `src/components/jobs/GroupedDateRequirementDisplay.tsx`
4. `src/components/employer/settlement/GroupedSettlementCard.tsx`
5. `src/components/employer/applicants/ApplicantCard/components/GroupedAssignmentSelector.tsx`
6. `src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx`

또한 계획 006에서 보류한 항목 — `GroupedScheduleCard.tsx`/`app/(app)/(tabs)/schedule.tsx`/`GroupedDateRequirementDisplay.tsx`의 "펼침/접힘 동일 프리셋이라 75% 비율 미준수" 문제는 `LayoutAnimation.Presets`가 입장/퇴장 duration을 분리 지정할 수 없기 때문이었다 — Reanimated `LinearTransition`으로 전환하면 이 제약이 자연히 해소된다.

## Target

각 파일에서 `View`를 `Animated.View`로, 조건부 렌더 `{isExpanded && <View>...</View>}`는 그대로 유지하되(마운트/언마운트 자체는 콘텐츠 표시 방식이므로 유지) 부모 컨테이너에 `layout` prop을 추가하고, 자식 콘텐츠에 `entering`/`exiting`을 추가한다. `Accordion.tsx` 기준 예시:

```tsx
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { MOTION_DURATION, MOTION_EASING } from '@/constants/motion';

// handleToggle에서 LayoutAnimation.configureNext(...) 호출 제거 (더 이상 불필요)
const handleToggle = useCallback(() => {
  if (disabled) return;
  const newExpanded = !isExpanded;
  if (isControlled) {
    onToggle?.(newExpanded);
  } else {
    setInternalExpanded(newExpanded);
    onToggle?.(newExpanded);
  }
}, [disabled, isExpanded, isControlled, onToggle]);

// JSX — 바깥 컨테이너에 layout 추가
<Animated.View
  layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base).easing(MOTION_EASING.enter)}
  className={`overflow-hidden ${className}`}
  accessibilityRole="button"
  accessibilityState={{ expanded: isExpanded, disabled }}
>
  {/* ...Header 동일... */}
  {isExpanded && (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(MOTION_DURATION.base)}
      exiting={reduceMotion ? undefined : FadeOut.duration(MOTION_DURATION.fast)}
      className="pb-3"
    >
      {children}
    </Animated.View>
  )}
</Animated.View>
```

나머지 5개 파일도 동일 패턴(부모 `layout`, 자식 콘텐츠 `entering`/`exiting`, `LayoutAnimation.configureNext` 호출 제거)을 적용한다. `reduceMotion` 변수는 계획 002에서 이미 각 파일에 추가되어 있으므로 재사용한다.

## Repo conventions to follow

- `MOTION_DURATION.base`(200, "상태 변경" 구간)를 콘텐츠 fade에, `MOTION_DURATION.fast`(150)를 exit에 사용 — AUDIT.md 듀레이션표 + §8 exit=75% 규칙(200×0.75=150) 동시 충족.
- `LinearTransition`은 형제 요소의 위치 이동(다른 카드가 밀리는 것)을 부드럽게 만드는 용도 — `ScheduleConditionCard.tsx:109`에서 이미 `LinearTransition.duration(MOTION_DURATION.base)`를 쓰고 있어 이 저장소의 기존 관례와 일치한다(exemplar).
- import는 각 파일의 기존 `react-native-reanimated` import 여부 확인 후 병합.

## Steps

각 파일에 대해 동일 절차 반복(파일별로 개별 커밋 권장 — 6개 파일 규모라 리뷰 단위를 작게 유지):

1. `Accordion.tsx`: `LayoutAnimation` import가 이 용도로만 쓰였다면 제거. `handleToggle`에서 `LayoutAnimation.configureNext(...)` 호출 삭제. 바깥 `View`를 `Animated.View` + `layout` prop으로, `{isExpanded && <View className="pb-3">{children}</View>}`를 `{isExpanded && <Animated.View entering={...} exiting={...} className="pb-3">{children}</Animated.View>}`로 교체.
2. `FAQList.tsx`: 동일 패턴 (`handleToggle`에서 `LayoutAnimation.configureNext` 제거, 아코디언 컨테이너에 `layout`, 콘텐츠에 `entering`/`exiting`).
3. `GroupedDateRequirementDisplay.tsx`: 동일 패턴.
4. `GroupedSettlementCard.tsx`: 동일 패턴.
5. `GroupedAssignmentSelector.tsx`: 동일 패턴 (그룹별 `Set<string>` 상태이므로 각 그룹 아이템 레벨에 적용).
6. `ApplicantCard.tsx`: 동일 패턴.

각 파일 수정 후 즉시 `npm run type-check`로 타입 에러가 없는지 확인하고 다음 파일로 진행.

## Boundaries

- **선행 조건 미충족 시 중단**: 이 6개 파일에 계획 002(reduceMotion 가드)가 아직 적용되지 않았다면, 이 계획의 `reduceMotion` 참조가 존재하지 않아 즉시 컴파일 에러가 난다 — 002를 먼저 확인하고 진행한다.
- 각 컴포넌트의 펼침/접힘 **상태 로직**(`useState`, `Set` 관리 등)은 변경하지 않는다 — 애니메이션 메커니즘만 교체.
- `overflow-hidden` 클래스가 있는 컨테이너는 `LinearTransition` 적용 후에도 유지한다(콘텐츠가 넘칠 때 잘림 유지).
- 6개 파일을 한 번에 다 바꾸지 않아도 된다 — 하나씩 적용하고 검증 후 다음으로 넘어가는 점진적 방식을 권장(Boundaries 위반 아님, Steps의 권장 순서).
- 코드가 위 인용과 다르면 해당 파일만 멈추고 보고한 뒤 나머지 파일은 계속 진행한다.

## Verification

- **Mechanical**: 파일별 `npm run type-check` + `npx eslint <파일>`, 전체 완료 후 `npx jest src/components/ui src/components/support src/components/jobs src/components/employer`(디렉터리 단위). PR 전 `npm run quality`.
- **Feel check**: 각 컴포넌트를 빠르게 연타(펼침→접힘→펼침 연속)해 애니메이션이 끊기지 않고 매끄럽게 이어지는지(중단 가능성 개선 확인) — 이전 `LayoutAnimation`은 연타 시 버벅였던 지점. "동작 줄이기" ON/OFF 양쪽에서 정상 동작 확인.
- **Done when**: 6개 파일에서 `LayoutAnimation` import/호출이 완전히 제거되고, Reanimated 기반 전환이 reduceMotion 가드와 함께 동작하며, 연타 테스트에서 끊김이 없다.
