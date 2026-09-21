# 002 — LayoutAnimation 호출부에 reduceMotion 가드 추가

- **Status**: TODO
- **Commit**: d824729
- **Severity**: HIGH
- **Category**: 접근성 (impeccable-design.md §8 필수 요구사항)
- **Estimated scope**: 6 files, 각 파일 1개 호출부

## Problem

impeccable-design.md §8: "필수: `AccessibilityInfo.isReduceMotionEnabled()` 체크 후 fade로 대체" — `LayoutAnimation.configureNext`도 transform/layout 애니메이션이므로 이 요구사항 대상이다. 아래 6개 파일은 이 훅 없이 무조건 `LayoutAnimation`을 실행한다.

**같은 저장소 안에 이미 올바른 예시가 있다**: `src/components/schedule/GroupedScheduleCard.tsx:108-116`와 `app/(app)/(tabs)/schedule.tsx:269-279`는 이미 `useReduceMotion()`을 호출해 `if (!reduceMotion) { LayoutAnimation.configureNext(...) }`로 가드하고 있다 — 이번 계획은 이 패턴을 6곳에 동일하게 적용하는 것뿐이다.

1. `src/components/employer/settlement/GroupedSettlementCard.tsx:171-174`
   ```tsx
   const toggleExpanded = useCallback(() => {
     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
     setIsExpanded((prev) => !prev);
   }, []);
   ```
2. `src/components/employer/applicants/ApplicantCard/components/GroupedAssignmentSelector.tsx:105-116`
   ```tsx
   const toggleExpand = useCallback((groupId: string) => {
     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
     setExpandedGroups((prev) => { /* ... */ });
   }, []);
   ```
3. `src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:95-98`
   ```tsx
   const toggleExpand = useCallback(() => {
     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
     setIsExpanded((prev) => !prev);
   }, []);
   ```
4. `src/components/jobs/GroupedDateRequirementDisplay.tsx:130-133`
   ```tsx
   const toggleExpand = useCallback(() => {
     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
     setIsExpanded((prev) => !prev);
   }, []);
   ```
5. `src/components/ui/Accordion.tsx:55-59` (해당 부분만 — 아이콘 회전 버그는 별도 계획 009)
   ```tsx
   const handleToggle = useCallback(() => {
     if (disabled) return;
     // 애니메이션 설정
     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
     const newExpanded = !isExpanded;
     /* ... */
   }, [disabled, isExpanded, isControlled, onToggle]);
   ```
6. `src/components/support/FAQList.tsx:57-60`
   ```tsx
   const handleToggle = useCallback((id: string) => {
     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
     setExpandedId((prev) => (prev === id ? null : id));
   }, []);
   ```

## Target

각 파일에서 (예시는 GroupedSettlementCard.tsx 기준, 나머지는 동일 패턴):

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

// 컴포넌트 함수 본문 상단에 추가
const reduceMotion = useReduceMotion();

const toggleExpanded = useCallback(() => {
  if (!reduceMotion) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }
  setIsExpanded((prev) => !prev);
}, [reduceMotion]);
```

## Repo conventions to follow

- **직접 경로 import만**: `@/hooks/useReduceMotion` (배럴 `@/hooks` 금지 — 순환 참조로 모듈스코프 값이 `undefined`가 되는 함정이 3회 재발했다고 훅 파일 주석에 명시됨).
- **예시 파일**: `src/components/schedule/GroupedScheduleCard.tsx:108,110-116`와 `app/(app)/(tabs)/schedule.tsx:269-279` — 이 두 파일을 그대로 베낀다. 특히 `useCallback`의 deps 배열에 `reduceMotion`을 반드시 추가한다(누락 시 stale closure로 최신 reduceMotion 값을 못 읽음 — 실제로 두 예시 파일 모두 deps에 포함).
- Accordion.tsx는 `AccordionItem` 함수형 컴포넌트 내부이므로 `useReduceMotion()` 호출은 컴포넌트 본문 최상단(다른 `useState`/`useCallback`보다 위 또는 인접)에 둔다.

## Steps

1. `GroupedSettlementCard.tsx`: 파일 상단 import 블록에 `import { useReduceMotion } from '@/hooks/useReduceMotion';` 추가. 컴포넌트 본문에 `const reduceMotion = useReduceMotion();`를 `toggleExpanded` 정의 이전에 추가. `toggleExpanded` 콜백 내부를 Target대로 수정하고 deps 배열에 `reduceMotion` 추가.
2. `GroupedAssignmentSelector.tsx`: 동일 패턴. `toggleExpand` 콜백은 `(groupId: string) => {...}` 형태이므로 시그니처는 유지하고 내부 `LayoutAnimation.configureNext(...)` 호출만 `if (!reduceMotion) { ... }`로 감싼다. deps 배열에 `reduceMotion` 추가.
3. `ApplicantCard.tsx`: 동일 패턴, `toggleExpand`.
4. `GroupedDateRequirementDisplay.tsx`: 동일 패턴, `toggleExpand`. 이 파일은 `GroupItem`이라는 내부 컴포넌트 안에 있으므로 해당 함수 컴포넌트 본문에 훅을 추가한다.
5. `Accordion.tsx`: `AccordionItem` 컴포넌트 본문에 `useReduceMotion()` 추가. `handleToggle` 내부의 `LayoutAnimation.configureNext(...)` 한 줄만 `if (!reduceMotion) { ... }`로 감싼다. deps 배열(`[disabled, isExpanded, isControlled, onToggle]`)에 `reduceMotion` 추가. **주의**: 같은 파일의 아이콘 회전 버그(라인 104-109)는 건드리지 않는다(계획 009 담당).
6. `FAQList.tsx`: 동일 패턴, `handleToggle`.

## Boundaries

- `LayoutAnimation` 자체를 Reanimated로 교체하지 않는다 — 그건 계획 010(LayoutAnimation→Reanimated 전환)의 범위다. 이 계획은 **현재 메커니즘 유지 + 가드만 추가**.
- Accordion.tsx의 아이콘 회전 버그(`transition-transform` 죽은 클래스)는 건드리지 않는다(계획 009).
- 각 파일의 다른 로직·스타일은 손대지 않는다.
- import 순서는 기존 파일의 import 그룹 관례(react-native 계열 → 프로젝트 절대경로 `@/` 순)를 따른다 — 각 파일에서 기존 `@/` import들이 모여 있는 블록 마지막에 추가.
- 코드가 위 인용과 다르면(라인 번호·내용 불일치) 멈추고 보고한다.

## Verification

- **Mechanical**:
  - `cd uniqn-mobile && npm run type-check`
  - `npx eslint src/components/employer/settlement/GroupedSettlementCard.tsx src/components/employer/applicants/ApplicantCard/components/GroupedAssignmentSelector.tsx src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx src/components/jobs/GroupedDateRequirementDisplay.tsx src/components/ui/Accordion.tsx src/components/support/FAQList.tsx`
  - `npx jest src/components/employer src/components/jobs src/components/ui src/components/support` (디렉터리 단위 — 파일명 패턴으로 좁히면 같은 문구를 검증하는 다른 이름 테스트를 놓친다는 것이 이 저장소의 알려진 함정)
  - PR 전 `npm run quality`
- **Feel check**: 기기 접근성 설정에서 "동작 줄이기"(iOS) / "애니메이션 제거"(Android)를 켠 상태로:
  - 정산 카드, 지원자 카드, 배정 선택기, 공고 날짜 그룹, 아코디언, FAQ 항목을 각각 펼치기/접기 — 레이아웃이 애니메이션 없이 즉시 전환되는지(점프처럼 보여도 정상) 확인.
  - 설정을 끈 상태로 동일 조작 시 기존처럼 부드러운 펼침/접힘 애니메이션이 그대로 재생되는지 확인(회귀 없음).
- **Done when**: 6개 파일 모두 코드가 Target 패턴과 일치하고, 동작 줄이기 ON/OFF 양쪽에서 위 feel-check를 통과한다.
