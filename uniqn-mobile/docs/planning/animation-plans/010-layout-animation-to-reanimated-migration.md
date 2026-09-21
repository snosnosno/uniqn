# 010 — 구형 LayoutAnimation을 Reanimated LinearTransition으로 전환

- **Status**: TODO
- **Commit**: d824729
- **Severity**: MEDIUM (정책 위반은 아니나 성능·중단가능성 개선, 리팩터 규모가 커서 레버리지는 낮음 — 후순위 권장)
- **Category**: 성능 · 중단가능성 (AUDIT.md §4, §5)
- **Estimated scope**: 6 files — **선행 조건: 계획 002, 006, 009가 먼저 적용되어 있어야 충돌 없이 진행 가능**

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

각 파일에 대해 동일 절차 반복(파일별로 개별 커�디트 권장 — 6개 파일 규모라 리뷰 단위를 작게 유지):

1. `Accordion.tsx`: `LayoutAnimation` import가 이 용도로만 쓰였다면 제거. `handleToggle`에서 `LayoutAnimation.configureNext(...)` 호출 삭제. 바깥 `View`를 `Animated.View` + `layout` prop으로, `{isExpanded && <View className="pb-3">{children}</View>}`를 `{isExpanded && <Animated.View entering={...} exiting={...} className="pb-3">{children}</Animated.View>}`로 교체.
2. `FAQList.tsx`: 동일 패턴 (`handleToggle`에서 `LayoutAnimation.configureNext` 제거, 아코디언 컨테이너에 `layout`, 콘텐츠에 `entering`/`exiting`).
3. `GroupedDateRequirementDisplay.tsx`: 동일 패턴.
4. `GroupedSettlementCard.tsx`: 동일 패턴.
5. `GroupedAssignmentSelector.tsx`: 동일 패턴 (그룹별 `Set<string>` 상태이므로 각 그룹 아이템 레벨에 적용).
6. `ApplicantCard.tsx`: 동일 패턴.

각 파일 수정 후 즉시 `npx tsc --noEmit`으로 해당 파일 타입 에러가 없는지 확인하고 다음 파일로 진행.

## Boundaries

- **선행 조건 미충족 시 중단**: 이 6개 파일에 계획 002(reduceMotion 가드)가 아직 적용되지 않았다면, 이 계획의 `reduceMotion` 참조가 존재하지 않아 즉시 컴파일 에러가 난다 — 002를 먼저 확인하고 진행한다.
- 각 컴포넌트의 펼침/접힘 **상태 로직**(`useState`, `Set` 관리 등)은 변경하지 않는다 — 애니메이션 메커니즘만 교체.
- `overflow-hidden` 클래스가 있는 컨테이너는 `LinearTransition` 적용 후에도 유지한다(콘텐츠가 넘칠 때 잘림 유지).
- 6개 파일을 한 번에 다 바꾸지 않아도 된다 — 하나씩 적용하고 검증 후 다음으로 넘어가는 점진적 방식을 권장(Boundaries 위반 아님, Steps의 권장 순서).
- 코드가 위 인용과 다르면 해당 파일만 멈추고 보고한 뒤 나머지 파일은 계속 진행한다.

## Verification

- **Mechanical**: 파일별 `npx tsc --noEmit` + `npx eslint <파일>`, 전체 완료 후 `jest src/components/ui src/components/support src/components/jobs src/components/employer`.
- **Feel check**: 각 컴포넌트를 빠르게 연타(펼침→접힘→펼침 연속)해 애니메이션이 끊기지 않고 매끄럽게 이어지는지(중단 가능성 개선 확인) — 이전 `LayoutAnimation`은 연타 시 버벅였던 지점. "동작 줄이기" ON/OFF 양쪽에서 정상 동작 확인.
- **Done when**: 6개 파일에서 `LayoutAnimation` import/호출이 완전히 제거되고, Reanimated 기반 전환이 reduceMotion 가드와 함께 동작하며, 연타 테스트에서 끊김이 없다.
