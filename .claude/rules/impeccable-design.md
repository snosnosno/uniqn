---
paths:
  - "uniqn-mobile/src/components/**/*.tsx"
  - "uniqn-mobile/app/**/*.tsx"
---

# Impeccable 디자인 룰 (RN/NativeWind 적응판)

> `DESIGN.md`(Black & Gold 시스템) + `nativewind-patterns.md`를 **보강**한다.
> 중복 금지 — 토큰/색/스케일은 DESIGN.md 우선, 본 문서는 **결정 원칙과 안티패턴**.
> 출처: [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0). 웹/CSS 전제는 RN으로 번역.

## 1. 타이포그래피 — 다크모드 라인하이트 가산 (CRITICAL)

다크 배경의 밝은 텍스트는 시각적으로 **더 가벼워 보여 더 큰 호흡**이 필요하다.
DESIGN.md 스케일에 **다크모드만 lineHeight를 +5~10% 가산**한다.

```tsx
// ✅ CORRECT — 다크모드 본문 lineHeight 가산
<Text className="text-base leading-6 dark:leading-[1.625rem]">
  // light: 24px (1.5×16) / dark: 26px (1.625×16)
</Text>

// ❌ WRONG — 라이트/다크 동일 leading
<Text className="text-base leading-6">
```

기준: `lineHeight ≈ fontSize × (1.5 light, 1.6 dark)`. H1~H3는 1.1~1.2 유지.

## 2. 모듈러 스케일 검증 — 인접 사이즈는 1.2 이상 차이

현재 DESIGN.md 스케일에서 **H5 15px ↔ Body 14px** (1.07배)는 위계가 무너진다.
H5는 **본문보다 1.25배 이상** 차이나도록 사용하거나, H5 자체를 폐기하고 Body를 강조(weight)로 위계 표현.

| 현재 | 비율 | 판정 |
|------|------|------|
| H1 36 / H2 28 | 1.29 | ⭕ |
| H2 28 / H3 22 | 1.27 | ⭕ |
| H3 22 / H4 18 | 1.22 | ⭕ |
| H4 18 / H5 15 | 1.20 | ⚠️ 경계 |
| H5 15 / Body 14 | 1.07 | ❌ |
| Caption 12 / Micro 10 | 1.20 | ⚠️ 경계 |

**규칙**: H5와 Body를 같은 화면에서 인접 배치 금지. 위계 차이는 **size + weight + color** 다중 축으로 만든다.

## 3. 60-30-10 — 골드는 *드물어야* 효과적

골드(#D4AF37)는 **CTA + 금액 + 활성 탭 전용**.
다음 위치에 사용 시 즉시 제거:
- 일반 보더, 구분선
- 비활성/보조 아이콘
- 헤딩 텍스트 (단, 환영 화면 강조 1회 한정)
- 동시에 화면에 **3곳 이상** 골드가 보이면 위반

```tsx
// ❌ 골드 남용
<View className="border border-gold dark:border-gold">  // 일반 카드 보더
<Text className="text-gold dark:text-gold">제목</Text>     // 일반 헤딩

// ✅ 절제
<View className="border border-border dark:border-border">
<Text className="text-content-primary dark:text-content-primary">제목</Text>
<Pressable className="bg-gold dark:bg-gold">  // CTA에만
```

## 4. 8가지 인터랙티브 상태 모두 정의

모든 `Pressable`/`TouchableOpacity`는 다음 상태가 시각적으로 구분되어야 한다.

| 상태 | 트리거 | RN 적용 |
|------|--------|---------|
| Default | 기본 | base className |
| Pressed | 누름 | `({ pressed }) => pressed && 'opacity-80'` |
| Focused | 키보드/외부 | `accessibilityState={{ focused }}` + ring |
| Disabled | 비활성 | `disabled` prop + `opacity-40` |
| Loading | 처리 중 | `ActivityIndicator` + 본문 숨김 (크기 유지) |
| Error | 에러 후 | border-error + 메시지 |
| Success | 완료 | 짧은 시각 피드백 후 원복 |
| Hover | (웹/마우스) | `hover:` (모바일 무관, 웹 빌드용) |

**가장 흔한 누락**: `loading` 시 버튼 사이즈가 변해 레이아웃 점프 발생.
`min-h-[44px]` + 내부만 스피너로 교체.

## 5. 터치 타깃 44px (WCAG 2.5.5 강제)

DESIGN.md는 40px이지만 **Impeccable + WCAG 2.5.5 AAA는 44px**.
시각 크기는 작아도 hitSlop으로 확장한다.

```tsx
// ✅ 시각 24px / 터치 44px
<Pressable
  hitSlop={10}
  className="w-6 h-6 items-center justify-center"
>
  <Icon size={20} />
</Pressable>

// ✅ 또는 padding으로
<Pressable className="p-2.5 min-h-[44px] min-w-[44px]">
```

**예외**: 인접 버튼 그룹 내부(탭바, 세그먼트)는 40px 허용. 단독/모달 버튼은 44px.

## 6. 카드 안에 카드 금지

위계 노이즈. 카드 내부 분할은 **여백 + 디바이더 + 타이포 위계**로.

```tsx
// ❌ 중첩 카드
<View className="bg-surface-card rounded-md p-4">
  <View className="bg-surface-overlay rounded-md p-3">
    <Text>아이템</Text>
  </View>
</View>

// ✅ 디바이더로 분리
<View className="bg-surface-card dark:bg-surface-elevated rounded-md p-4 gap-3">
  <Text>아이템 1</Text>
  <View className="h-px bg-border-subtle" />
  <Text>아이템 2</Text>
</View>
```

## 7. 여백은 **다양해야** 위계가 생긴다

모든 카드/섹션에 `p-4`만 쓰면 화면이 평탄하다. **중요도에 따라 spacing 차등**.

| 의미 | spacing |
|------|---------|
| 같은 그룹 내부 | gap-2 (8px) |
| 그룹 간 | gap-4 (16px) |
| 섹션 간 | gap-8 (32px) 이상 |
| 화면 페이지 패딩 | px-4 py-6 |

`margin` 대신 **`gap` 사용** (RN 0.71+ 지원). margin collapse + 정리 코드 불필요.

## 8. 모션 — 100/300/500 규칙 + 종료 < 시작

| Duration | 용도 |
|----------|------|
| 100~150ms | 즉시 피드백 (버튼 누름, 토글) |
| 200~300ms | 상태 변경 (메뉴 열기, 토스트) |
| 300~500ms | 레이아웃 변경 (시트, 모달) |
| 종료(exit) | **시작의 75%** |

```tsx
// ✅ Reanimated 권장 easing (cubic-bezier(0.25, 1, 0.5, 1) ≈ Easing.out(Easing.exp))
import { Easing } from 'react-native-reanimated';
withTiming(1, { duration: 300, easing: Easing.bezier(0.25, 1, 0.5, 1) });
```

**금지**: bounce/elastic. 실제 물체는 튕기지 않고 감속한다.
**필수**: `AccessibilityInfo.isReduceMotionEnabled()` 체크 후 fade로 대체.

```tsx
const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
}, []);
// reduceMotion이면 transform 애니메이션 스킵, opacity만
```

## 9. 빈 상태(Empty State) = 온보딩 기회

"데이터 없음"은 실패. **(1) 인지 (2) 가치 (3) 행동** 3단 구성.

```tsx
// ❌ BAD
<Text>지원 내역이 없습니다.</Text>

// ✅ GOOD
<View className="items-center gap-3 py-12">
  <Text className="text-h4 text-content-primary">아직 지원한 공고가 없어요</Text>
  <Text className="text-body text-content-secondary text-center">
    포커룸 공고를 둘러보고 첫 지원을 시작해보세요.
  </Text>
  <Pressable className="bg-gold px-6 py-3 rounded-md mt-2" onPress={goToJobs}>
    <Text className="text-on-gold font-semibold">공고 둘러보기</Text>
  </Pressable>
</View>
```

## 10. 에러 메시지 공식: 무엇 + 왜 + 어떻게

```
무엇이 일어났나? + 왜? + 어떻게 고칠 수 있나?
```

| ❌ Bad | ✅ Good |
|--------|---------|
| "오류가 발생했습니다" | "공고를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요." |
| "잘못된 입력" | "이메일 형식이 올바르지 않아요. 예: name@example.com" |
| "권한 없음" | "이 공고는 사업주만 수정할 수 있어요." |
| "Failed" | "정산 저장에 실패했어요. 잠시 후 다시 시도해주세요." |

**금지**: 사용자 탓 ("당신이 잘못 입력했습니다"). **필수**: 다음 행동 명시.

## 11. 버튼 라벨 — 구체 동사 + 목적어

| ❌ 모호 | ✅ 구체 |
|--------|---------|
| 확인 | 변경 저장 / 공고 등록 / 결제 진행 |
| 제출 | 지원서 보내기 / 정산 제출 |
| 네 | 공고 삭제 / 지원 취소 |
| 취소 | 계속 편집 / 닫기 |
| 클릭 | (불필요, 단독 사용 금지) |

**파괴적 액션**은 결과를 라벨에 명시: "지원자 5명 삭제" (수치 포함).

## 12. Undo > Confirm

확인 다이얼로그는 사용자가 무의식적으로 통과한다. 가능하면:
- UI에서 **즉시 제거** + 토스트에 **되돌리기** 버튼 (예: 5초)
- 토스트 만료 후 실제 삭제

확인이 필요한 경우 (계정 삭제, 결제, 일괄 작업 등)에만 다이얼로그 사용.

```tsx
// ✅ 지원 취소 — 옵티미스틱 + Undo
removeApplicationFromList(id);  // UI 즉시 제거
toast.success('지원이 취소되었어요', {
  action: { label: '되돌리기', onClick: () => restoreApplication(id) },
  duration: 5000,
});
setTimeout(() => actuallyDelete(id), 5000);
```

## 13. 위계는 다축으로 — Squint Test

화면을 흐릿하게 봤을 때 가장 중요한 요소가 1초 안에 보여야 한다.
**size 단독 의존 금지**. 다음 중 2개 이상 조합:

- size (3:1 이상)
- weight (Bold vs Regular)
- color (text-content-primary vs text-content-secondary)
- position (상/좌측이 우선)
- space (주변 여백이 많을수록 강조)

## 14. 안티 패턴 (즉시 거부)

이 패턴이 보이면 즉시 리팩토링:

| 패턴 | 이유 | 대안 |
|------|------|------|
| `border-l-4 border-${color}` 카드 강조 | AI 생성 전형 1순위 | 배경 틴트 또는 좌측 아이콘/숫자 |
| 그라디언트 텍스트 (`mask-image`) | AI 전형 2순위 | 단색 + weight/size로 강조 |
| 모든 곳에 그림자 | 평탄함 | 배경 lightness 단계로 elevation |
| `rounded-full` 일괄 | DESIGN.md 금지 | xs(4) sm(6) md(8) lg(10) |
| 보라/네온 액센트 | DESIGN.md 금지 | 골드만 |
| 회색 텍스트 위에 색 배경 | 워시드아웃 | 배경 hue를 어둡게 한 동일 색조 |
| 같은 크기 카드 6개 그리드 | 단조로움 | 우선순위에 따라 1개 큼 + 나머지 작게 |
| 모달 남발 | 게으른 선택 | 인라인 확장, 시트, 페이지 전이 |
| 이모지 상태 표시 | DESIGN.md 금지 | 텍스트 + 컬러 |

## 15. RN 미적용 (참고만)

다음은 Impeccable 원본에 있으나 **RN/NativeWind에서 사용 불가** — 무시:

- OpenType features (`font-variant-numeric`, `font-feature-settings`) — 일부 RN/플랫폼만 부분 지원
- Container queries (`@container`)
- CSS Anchor Positioning, Popover API
- `safe-area-inset` env() — RN에서는 `useSafeAreaInsets()` 사용
- `srcset`/`<picture>` — `expo-image`의 `source` 배열로 대체
- `:focus-visible` — RN은 `accessibilityState={{ focused }}` + ring 직접 그리기

---

# v2 — RN 폴리시 10룰 (2026-04-17 추가)

> v1(1~15)은 보편 UI 원칙의 RN 적응. v2(16~27)는 React Native 특화 품질 상한을
> 끌어올리는 폴리시 룰. 디자인 토큰(DESIGN.md)이 아닌 **인터랙션 질감**을 포착.

## 16. Skeleton > Spinner (로딩 상태)

리스트/상세/카드 그리드는 **Skeleton**이 기본. 스피너는 최대 2초 이내 완료 예상
액션에만(버튼 submit 등).

- **이유**: 스피너는 레이아웃을 점프시키고 콘텐츠 구조를 숨김. Skeleton은 구조
  유지로 perceived latency 감소.
- **구현**: `react-native-reanimated` shimmer(opacity 0.3↔0.5 루프, 1.2초).
  공용 프리미티브는 `src/components/ui/Skeleton.tsx`(`Skeleton`/`SkeletonText`/
  `SkeletonCircle`) — 화면별 composer는 인라인 조합.
- **예외**: pull-to-refresh는 스피너(시스템 관례).
- **Loading → Error 전환**: fetch 실패 시 skeleton 200ms fade-out → v1 Rule 10
  에러 메시지 fade-in. 종료 150ms(시작 200ms의 75%).
- **Partial loaded state**: 하이브리드 리스트는 도착한 행 = 실제 렌더, 미도착 =
  skeleton 행으로 공간 채움(layout shift 방지).
- **접근성**: `accessibilityRole="progressbar"` + `accessibilityLabel="로딩 중"`
  필수. VoiceOver가 무의미 shape를 읽지 않게.
- **Reduce Motion**: `AccessibilityInfo.isReduceMotionEnabled()` 시 shimmer 대신
  정적 배경 fade만.

## 17. Haptics — 결정적 순간에만

`expo-haptics` 설치 후, 다음 순간에만 사용:

| 순간 | Intensity |
|------|-----------|
| 승인/거절(employer) | Medium |
| 결제 완료 | Success notification |
| 토글 전환(다크모드 등) | Light |
| 삭제 확인 | Warning notification |
| 스와이프로 삭제 경계 | Light |

**금지**: 일반 탭, 스크롤, 리스트 선택, 네비게이션(남용 시 피로).
**접근성**: `AccessibilityInfo` 미체크 — OS가 시스템 햅틱 설정 자동 존중.
**Throttle(D2)**: `src/utils/haptics.ts` 에서 200ms 이내 연속 트리거 skip.
대량 액션(일괄 승인 등)은 **시작 Light 1회 + 종료 Success 1회**만, 개별 햅틱
제거.

```tsx
// src/utils/haptics.ts
let lastTrigger = 0;
export const triggerHaptic = (type: HapticType) => {
  const now = Date.now();
  if (now - lastTrigger < 200) return;
  lastTrigger = now;
  Haptics.impactAsync(type);
};
```

## 18. Image — blurhash + expo-image

모든 원격 이미지는:

```tsx
<Image
  source={{ uri }}
  placeholder={{ blurhash }}
  placeholderContentFit="cover"
  transition={200}
  contentFit="cover"
  priority={aboveFold ? 'high' : 'normal'}
/>
```

- blurhash는 **클라이언트 선계산**(D4):
  1. `expo-image-manipulator`로 32×32 축소
  2. `blurhash` npm(~15KB)으로 해시 계산
  3. 업로드 시 이미지 + `{ blurhash }` 메타 동시 저장
  4. DB 이미지 테이블에 `blurhash TEXT` 컬럼 추가
- 내부 SVG 아이콘은 예외
- 실패 시 fallback: 라이트 `bg-surface-overlay` / 다크 `bg-surface-elevated` + 아이콘

## 19. 숫자 / 날짜 포맷 일관성

| 유형 | 포맷 | 예시 |
|------|------|------|
| 금액(리스트/컬럼) | `₩1,234,567`(구분자, 원기호 붙여쓰기) | ₩100,000 |
| 금액(설명문) | 축약 허용 | "일당 10만원" |
| 상대 시간(7일 이내) | "N분/시간/일 전" | "3시간 전" |
| 절대 시간(7일 초과) | "M월 D일" 또는 "YYYY-MM-DD" | "4월 13일" |
| 기간 | "N시간 M분"(한글) | "4시간 30분" |
| 시각 | "오전/오후 H시 MM분" | "오후 2시 30분" |
| 전화번호 | `010-1234-5678`(하이픈) | |

`date-fns` + `date-fns/locale/ko`. `Intl.NumberFormat('ko-KR')` 금액.

유틸 위치: `src/utils/formatters/{currency,date,phone,duration}.ts` — 중복 구현
금지.

## 20. 키보드 UX

> **2026-07-25 전환**: 키보드 회피 단일 경로 = `react-native-keyboard-controller`.
> `react-native-keyboard-aware-scroll-view`는 **제거됨**(미유지보수) — 참조 금지.

| 맥락 | 사용할 것 |
|------|-----------|
| 모달·시트 내부 | `ModalKeyboardAvoider`(`@/components/ui`) — 이미 SheetModal/Modal에 내장 |
| 긴 폼·스크롤 화면 | `KeyboardAwareScrollView`(keyboard-controller) + `bottomOffset={20}` |
| 화면 레벨 단순 폼 | RN 기본 `KeyboardAvoidingView` 잔존 17곳은 **동작 중이라 유지**. 신규 화면은 keyboard-controller |

- **구 라이브러리 prop 금지**: `extraScrollHeight` / `enableOnAndroid` /
  `enableAutomaticScroll` / `keyboardOpeningTime`은 신 라이브러리에 없다.
  플랫폼 분기 없이 `bottomOffset` 하나로 끝난다(IME 인셋을 직접 읽으므로).
- **RNModal 안에서 RN 기본 KAV 금지**: statusBarTranslucent 다이얼로그는 별도
  윈도우라 `adjustResize`가 무시되고 KAV(height)도 `relativeKeyboardHeight=0`으로
  붕괴한다(#302 실기기 재현).
- 스크롤 영역: `keyboardDismissMode="on-drag"` + `keyboardShouldPersistTaps="handled"`
- `returnKeyType` 체인: 다음 인풋 `next`, 마지막 `done`
- **`autoFocus` 금지**: 스크린리더 혼선, 예기치 못한 키보드 팝업
- ⚠️ 루트 `KeyboardProvider`는 **세 플래그 명시 필수**
  (`statusBarTranslucent` / `navigationBarTranslucent` / `preserveEdgeToEdge`).
  생략하면 Android 네이티브가 rootView content의 layoutParams 마진을 덮어써
  `SafeAreaProvider`와 인셋 소유권이 충돌한다 — 근거는 `app/_layout.tsx` 주석.

## 21. Pressed 피드백 — 다크/라이트 반대 방향

```tsx
// ✅ CORRECT — 다크모드에서 밝아지는 방향
<Pressable
  className={({ pressed }) =>
    pressed
      ? 'bg-surface-hover dark:bg-surface-hover' // light: 어두워짐 / dark: 밝아짐
      : 'bg-surface-card dark:bg-surface-card'
  }
/>
```

- **이유**: 다크모드에서 `opacity-80`은 텍스트 대비 깨짐. 배경 톤 조정이 올바름.
- Android ripple:
  `android_ripple={{ color: colorScheme === 'dark' ? '#333' : '#e5e5e5' }}`
- **대비 검증**: Pressed 배경은 원 배경과 lightness 차 ≥10%, 텍스트 대비는
  pressed 상태에서도 WCAG AA 4.5:1 유지. tailwind.config 토큰 단계에서 검증
  (light `#222228` vs pressed `#19191D` = 충분). 새 상호작용 요소 추가 시 재확인.

## 22. Focus ring — 키보드 내비게이션

외부 키보드(iPad Magic Keyboard, 블루투스) 사용자 대응:

```tsx
<Pressable
  accessibilityRole="button"
  className={({ pressed, focused }) =>
    [
      'rounded-md',
      focused && 'border-2 border-[#2563EB]', // 포커스 시 Info 블루 링
      pressed && 'bg-surface-hover',
    ]
      .filter(Boolean)
      .join(' ')
  }
/>
```

- 터치 네비게이션에서는 invisible(`focused=false` 유지).
- **색: Info 블루 `#2563EB` 2px**(D5) — 골드 아님.
  - 골드는 CTA·금액·활성 탭 전용으로 유지(60-30-10 보호).
  - 포커스는 "현재 포인터 위치" = 기능 시그널, 시맨틱 블루 적합.
- `:focus-visible` CSS 대응 — RN은 `focused` 상태 직접 관리.
- **구현 패턴**: outset ring — container에 2px 예약 공간을 미리 할당해 layout
  shift 방지:

```tsx
const BASE = 'rounded-md p-2 m-[-2px]';
const FOCUS = 'border-2 border-[#2563EB]';

<Pressable
  className={({ focused }) =>
    `${BASE} ${focused ? FOCUS : 'border-2 border-transparent'}`
  }
/>
```

  `shadow` 방식은 RN에서 rounded 보존 불완전 → border + transparent fallback 권장.

## 23. 화면별 StatusBar

Expo Router `Stack.Screen` 옵션에 통합:

```tsx
// (app)/_layout.tsx
<Stack screenOptions={{ statusBarStyle: 'light' }}>
  <Stack.Screen name="auth/login" options={{ statusBarStyle: 'dark' }} />
</Stack>
```

- 다크 헤더: `light-content` / 라이트 헤더: `dark-content`
- 전환 깜빡임 방지: 화면 배경색을 StatusBar 영역까지 확장(SafeAreaView 안쪽까지).

## 24. Sticky 섹션 헤더 + Pull-to-refresh

긴 리스트(스케줄, 정산, 지원자) 패턴:

```tsx
<FlashList
  data={flattenedSections}
  stickyHeaderIndices={sectionHeaderIndices}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="#D4AF37" // iOS 골드 스피너
      colors={['#D4AF37']} // Android
    />
  }
  estimatedItemSize={72}
/>
```

- 섹션 구분: 날짜(스케줄) / 지역(공고) / 주(정산).
- 헤더 배경: `bg-surface-elevated/95 backdrop-blur`(스크롤 콘텐츠 살짝 비침).
- pull-to-refresh tint는 **골드**(브랜드 일관성).

## 25. Offline / Network 상태 배너

`@react-native-community/netinfo`(이미 설치) 활용:

- **연결 끊김**: 상단 슬라이드-인 배너(350ms) "오프라인 상태입니다" + warning 틴트
- **연결 복구**: "온라인으로 돌아왔어요"(2초 후 자동 dismiss)
- 오프라인 중 액션은 로컬 큐 + 복구 시 자동 재시도 토스트

**시각 spec**:

- 높이 40px, safe-area-top 위에 얹음(시스템 status bar 침범 금지)
- 배경: dark `rgba(212,160,23,0.15)` / light `rgba(161,98,7,0.15)`(warning subtle)
- 좌측 아이콘: `WifiOff` 16px, color=warning(`#D4A017` dark / `#A16207` light)
- 텍스트: 14px / weight 500 / color=content-primary, 좌측 아이콘과 `gap-2`
- 우측 padding: `pr-4`(dismiss 버튼 없음 — 연결 복구 시 "돌아왔어요"로 자동 교체)
- 애니메이션: entrance 300ms ease-out, exit 225ms ease-in(75% 규칙)

**접근성**:

- `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`
- VoiceOver/TalkBack 배너 등장 시 자동 읽기
- 연결 복구 메시지도 동일 속성(2초 dismiss 전 읽기 완료 보장)

## 26. Text truncation 전략

| 맥락 | 정책 |
|------|------|
| 타이틀(카드/리스트) | `numberOfLines={1}`, 끝 ellipsis |
| 본문 미리보기 | `numberOfLines={2}` + 탭 시 전체 펼침 |
| 이름 + 직책 컬럼 | `ellipsizeMode="middle"`(앞/뒤 유지) |
| 금액·수치 | truncation 금지(전체 표시, 폰트 축소로 대응) |
| 에러 메시지 | truncation 금지, 필요 시 두 줄 허용 |

`flex-shrink`와 `min-width: 0` 조합 주의(RN에서 한 번 더 확인 필요).

## 27. 아이콘 일관성 (Lucide 기반)

- **Stroke: 2.0**(Lucide 공식값 — 생태계 관례 일치). 커스텀 SVG도 동일.
- **Size 허용**: 14 / 16 / 18 / 20 / 24 / 28 / 32. 중간값 금지(19, 22 등).
- **Outline 기본 / Filled는 active·selected 한정**: `Heart`, `Bookmark`, `Star`만 토글.
- **색 원칙**:
  - 기본: `SECONDARY_PALETTE[500/400]`(light/dark)
  - 액티브 탭·CTA 인접: 골드 `#D4AF37`
  - 에러/경고: 시맨틱 컬러
  - **절대 금지**: 그라디언트, 다중 색(60-30-10 위반)
- **Import 경로**: `@/components/icons` 에서만 — `lucide-react-native` 직접
  import는 ESLint로 차단됨(icons/index.tsx override만 허용).
- **접근성**:
  - 독립 아이콘 버튼은 `accessibilityLabel` 필수
  - **Dynamic Type**: 텍스트에 인접한 아이콘은 `fontScale`에 비례해
    `size × min(fontScale, 1.5)`. 단독 네비게이션·CTA는 고정.

```tsx
import { PixelRatio } from 'react-native';
const scaledSize = Math.round(20 * Math.min(PixelRatio.getFontScale(), 1.5));
<Icon size={scaledSize} />; // 텍스트 인접 시
<Icon size={24} />; // 단독 네비/CTA 시
```

---

## 디자인 철학과의 연결

DESIGN.md의 **Midnight Craft**(Industrial/Utilitarian + subtle Luxury) 방향성이
룰 16~27을 통해 실체화되는 지점:

| 철학 | 구현 룰 | 어떻게 |
|------|---------|--------|
| 산업적 정밀함 | Rule 21 Pressed 역방향 | 물리적 버튼처럼 밝기 변화로 응답, 투명도 속임 없음 |
| 절제된 품격 | Rule 17 Haptics 결정적 순간만 | 햅틱은 흔해지면 싸구려. 결정의 순간에만 느끼게 |
| 유틸리티 규율 | Rule 27 Stroke·Size 고정 | 90+ 아이콘이 같은 물리 법칙으로 그려짐 |
| 깊이 있는 침묵 | Rule 16 Skeleton, Rule 25 Offline 배너 | 로딩/오프라인을 텍스트로 설명하지 않고 조용히 구조로 암시 |
| 새벽 근무자 배려 | Rule 23 StatusBar + Rule 21 Pressed 대비 | 저조명 환경에서 밝기 튐 방지, 손 흔들림 보상 |

룰은 "무엇을 하라"가 아니라 "어떤 사용자를 어떤 순간에 어떻게 대할지"의 응축.

---

## 핵심 플로우 스토리보드

룰이 현장에서 어떻게 엮이는지 3개 대표 플로우로 고정한다.

### Flow 1: Employer 새벽 2시 승인

```
0. PUSH 알림 "○○님이 지원했어요" 수신
   └ 룰 23: 배경 어둠, StatusBar light-content
1. 앱 열기, 지원자 탭으로 이동
   └ 룰 16: FlashList 로드 중 Skeleton 3행, shimmer 1.2s
   └ 룰 24: Sticky 섹션 헤더 "오늘 도착" / "어제"
2. 지원자 카드 "승인" 버튼 탭
   └ 룰 17: Haptic Medium 1회(승인은 결정적 순간)
   └ 룰 21: 버튼 bg-surface-hover로 다크 → 밝게
3. 승인 즉시 카드 리스트에서 제거(옵티미스틱)
   └ v1 룰 12: UI 즉시 반응, 토스트에 "되돌리기" 5초
4. 실패 시: 카드 복구 + 에러 배너
   └ v1 룰 10: "승인 저장에 실패했어요. 다시 시도해주세요."
   └ 룰 17: Haptic Warning 1회

정서 호흡: 알림 → 1 탭 → 완료감 ≤ 2초. 한 손 사용, 화면 중앙 집중 불필요.
```

### Flow 2: Staff 지하철 오프라인 스케줄 확인

```
0. 지하철 진입, 네트워크 끊김
   └ 룰 25: 상단 warning 배너 300ms 슬라이드-인 "오프라인 상태입니다"
   └ 룰 25 a11y: VoiceOver polite 읽기
1. 홈 열기(오프라인 중)
   └ 룰 18: 공고 썸네일 blurhash 즉시 표시(네트워크 불필요)
   └ 룰 16: 데이터는 MMKV 캐시(react-native-mmkv 이미 설치) → Skeleton 없음
2. 내 다음 근무 확인 → 근무지 상세 탭
   └ 캐시된 상세 렌더, 지도 타일은 expo-image 로컬 캐시
3. 지하철 빠져나옴, 연결 복구
   └ 룰 25: 배너 "온라인으로 돌아왔어요"(success 틴트) 2초 후 dismiss
   └ 자동 백그라운드 sync(변경 없으면 silent)

정서 호흡: "앱이 죽지 않는다"는 확신. 텍스트 없이 구조만으로 전달.
```

### Flow 3: Employer 정산 금액 저장

```
0. 정산 화면, 금액 TextInput 포커스
   └ 룰 20: 시트 내부면 ModalKeyboardAvoider가 자동 보정
   └ 룰 20: autoFocus 금지 — 사용자가 탭해서 시작
1. 숫자 키패드로 "120000" 입력
   └ 룰 19: 입력 중 raw, blur 시 ₩120,000 포맷 적용
2. "저장" 버튼 탭
   └ 룰 17: Haptic Light(submit, Medium 아님 — 결제 아님)
   └ 룰 16: 버튼에 Loader2 spinner(2초 이내 예상 → skeleton 대신 스피너 허용)
3. 성공
   └ 룰 17: Haptic Success 1회
   └ v1 룰 12: "정산이 저장되었어요" 토스트 + "편집 계속" 2초
4. 실패(네트워크 flaky)
   └ 룰 25 배너 없음(일시적 실패는 에러 메시지로 충분)
   └ v1 룰 10: "정산 저장에 실패했어요. 잠시 후 다시 시도해주세요."
   └ 룰 17: Haptic Warning

정서 호흡: 입력 → 완료 피드백 명확. 금액은 절대 truncation 없음(룰 26).
```

---

## 디자인 리뷰 체크리스트 (PR 전 자가 점검)

### v1 — 타이포·색·공간·상호작용(15항목)

- [ ] 다크모드 본문 lineHeight 가산 적용?
- [ ] H5/Body 인접 배치 없음?
- [ ] 골드가 화면당 3곳 이하?
- [ ] 모든 Pressable에 8가지 상태 중 필요한 것 모두 정의?
- [ ] 터치 타깃 ≥ 44px (단독 버튼)?
- [ ] 카드 중첩 없음?
- [ ] gap으로 spacing 다양화?
- [ ] 종료 애니메이션이 시작의 75%?
- [ ] `AccessibilityInfo.isReduceMotionEnabled()` 분기?
- [ ] 빈 상태에 가치 + 행동 포함?
- [ ] 에러 메시지에 "어떻게 고칠지" 포함?
- [ ] 버튼 라벨이 구체적 동사 + 목적어?
- [ ] 파괴적 액션은 Undo 또는 명시적 라벨?
- [ ] Squint Test 통과(가장 중요한 요소가 1초 내 보임)?
- [ ] 안티 패턴 14가지 모두 회피?

### v2 — RN 폴리시(12항목)

- [ ] 리스트/상세는 Skeleton, 2초 이내 액션만 스피너?
- [ ] Haptics는 결정적 순간 + 200ms throttle만?
- [ ] 원격 이미지에 blurhash placeholder + expo-image 적용?
- [ ] 금액/날짜/전화번호 포맷이 `utils/formatters`로 일관화?
- [ ] 신규 폼이 keyboard-controller 경로(`ModalKeyboardAvoider`/`KeyboardAwareScrollView`)이고 `autoFocus` 없음?
- [ ] Pressed 피드백이 다크/라이트 반대 방향(밝기 변화)?
- [ ] Focus ring = Info 블루 `#2563EB` 2px(골드 아님)?
- [ ] 화면별 `statusBarStyle`이 배경과 대비?
- [ ] 긴 리스트에 Sticky 헤더 + 골드 tint pull-to-refresh?
- [ ] Offline 배너 + 접근성 `accessibilityLiveRegion="polite"`?
- [ ] Text truncation 정책: 금액·에러는 truncation 금지?
- [ ] 아이콘은 Lucide(`@/components/icons`) + stroke 2.0 + Size 화이트리스트?

---

# v3 — 네이티브 출고 게이트 (2026-07-25 추가)

> v1·v2가 커버하지 못한 **출고 직전 품질 누수** 지점만 보강. 중복 룰은 의도적으로 배제했다.
> 출처: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
> `references/pro-rules.md` (MIT). 스킬 전체는 웹/랜딩 편향이라 미도입 — 네이티브 체크리스트만 발췌.

## 28. 아이콘 정렬 · 대비 · 에셋 포맷

룰 27(패밀리·스트로크·사이즈)이 다루지 않는 **배치와 가독성** 축.

- **베이스라인 정렬**: 텍스트에 인접한 아이콘은 캡 높이 중앙에 맞추고, 주변 패딩을
  좌우 동일하게. 미세 어긋남이 "완성도 낮음"의 가장 흔한 원인.

```tsx
// ✅ 아이콘-텍스트 정렬
<View className="flex-row items-center gap-2">
  <Icon size={16} />
  <Text className="text-body leading-5">지원자 3명</Text>
</View>

// ❌ items-start / gap 없이 margin 혼용 → 반 픽셀 어긋남 누적
```

- **아이콘 대비**: 작은 글리프(≤16px) **4.5:1**, 큰 UI 글리프(≥24px) **최소 3:1**.
  라이트/다크 각각 검증 — 룰 21의 pressed 대비와 별개 축이다.
- **래스터 금지**: 아이콘·로고는 SVG/벡터만. PNG는 확대 시 뭉개지고 다크모드
  틴팅이 불가능. 예외는 사진성 콘텐츠(`expo-image` + blurhash, 룰 18).

## 29. 제스처 충돌 방지

우리 앱은 근무표 그리드·스와이프 액션·바텀시트가 한 화면에 겹친다. **영역당 주
제스처 1개** 원칙.

| 충돌 유형 | 증상 | 대응 |
|---|---|---|
| 가로 스크롤 ↔ iOS back-swipe | 좌측 엣지에서 뒤로가기 오발동 | 좌측 20pt 엣지는 제스처 영역에서 제외 |
| 리스트 세로 스크롤 ↔ 행 스와이프 삭제 | 스크롤 중 삭제 액션 노출 | `activeOffsetX` 임계값 설정 |
| 바텀시트 드래그 ↔ 내부 스크롤 | 시트가 안 닫히거나 내용이 안 밀림 | `BottomSheetScrollView`/`BottomSheetFlatList` 사용 (일반 ScrollView 금지) |
| 중첩 Pressable | 부모·자식 동시 반응 | 자식에만 핸들러, 부모는 `pointerEvents` 조정 |

**금지**: 같은 방향 드래그를 처리하는 제스처를 중첩 배치.

## 30. 스크린리더 포커스 순서 = 시각 순서

룰 22(포커스 링)는 **보이는 것**, 이 룰은 **읽히는 순서**.

- `absolute`/`zIndex`로 시각 위치를 바꾼 요소는 스크린리더 순서가 DOM(JSX) 순서
  그대로 남는다 → 실제로 읽어보고 확인.
- 모달·시트 오픈 시 배경 콘텐츠는 `accessibilityElementsHidden`(iOS) +
  `importantForAccessibility="no-hide-descendants"`(Android)로 차단.
- 그룹 읽기: 카드 전체를 하나로 읽히려면 `accessible={true}` + 통합
  `accessibilityLabel`. 자식마다 label을 달면 카드 1개가 5번 읽힌다.

## 31. 양 테마 대비 패리티

룰 21은 pressed 상태 한정. 이 룰은 **정적 요소 전반**.

| 요소 | 기준 | 흔한 실패 |
|---|---|---|
| 본문 텍스트 | 양 테마 ≥ **4.5:1** | 다크에서만 회색이 배경에 묻힘 |
| 보조 텍스트 | 양 테마 ≥ **3:1** | `content-secondary`가 라이트에서만 검증됨 |
| 보더·디바이더 | 양 테마에서 **모두 보일 것** | `border-border`가 한쪽 테마에서 소실 |
| 모달·시트 스크림 | **40~60% 검정** | 스크림이 옅어 배경이 시각적으로 경쟁 |
| 상태(pressed/focus/disabled) | 양 테마 동일 구분성 | 한 테마만 정의 |

**규칙**: 새 색 토큰 추가 시 **라이트·다크 양쪽 대비를 동시에 측정**. 한쪽 값에서
다른 쪽을 추론하지 않는다.

## 32. 고정 바 ↔ 스크롤 콘텐츠 공존

하단 CTA 바·탭바·스티키 헤더가 있는 화면은 **콘텐츠 인셋**을 명시한다.

```tsx
// ✅ 마지막 아이템이 CTA 바에 가리지 않음
const insets = useSafeAreaInsets();
<FlashList
  contentContainerStyle={{ paddingBottom: CTA_HEIGHT + insets.bottom + 16 }}
/>

// ❌ 인셋 없음 → 리스트 끝 항목이 영구히 가려짐 (스크롤해도 안 나옴)
```

- 고정 헤더가 반투명이면 `paddingTop`도 동일하게 예약.
- 세이프에어리어는 **고정 UI 전부**에 적용: 헤더·탭바·하단 CTA·스낵바.
- 제스처 홈 인디케이터 영역에 탭 타깃을 두지 않는다(오작동).

## 33. 디바이스 클래스 적응

출고 전 **최소 3종**에서 확인: 소형폰(375pt) · 대형폰 · 태블릿(가로 포함).

| 축 | 규칙 |
|---|---|
| 가로 거터 | 폰 `px-4` / 태블릿·랜드스케이프는 확대(`px-6`~`px-8`) — 전 기기 동일 좁은 거터 금지 |
| 콘텐츠 최대폭 | 태블릿에서 본문이 화면 끝까지 늘어나지 않게 최대폭 제한 |
| 긴 텍스트 measure | 한 줄이 과도하게 길면 가독성 저하 — 태블릿에서 폭 제한 |
| 랜드스케이프 | 세로 공간 축소 시 고정 CTA + 키보드가 콘텐츠를 전멸시키지 않는지 확인 |
| Dynamic Type | 시스템 최대 텍스트 크기에서 레이아웃이 깨지지 않을 것(룰 27 fontScale 참조) |

---

## v3 체크리스트 — 출고 전 게이트(11항목)

### 프로세스
- [ ] **375pt 소형폰**과 **랜드스케이프**에서 확인?
- [ ] **Reduce Motion** ON + **시스템 최대 텍스트 크기**에서 레이아웃 정상?
- [ ] 다크모드를 라이트에서 추론하지 않고 **독립 검증**?

### 항목
- [ ] 텍스트 인접 아이콘이 베이스라인 정렬 + 대비 3:1(대형)/4.5:1(소형)?
- [ ] 아이콘·로고가 벡터(SVG)만? 래스터 PNG 없음?
- [ ] 한 영역에 주 제스처 1개? (스와이프×스크롤×back-swipe×시트 충돌 없음)
- [ ] 스크린리더 읽기 순서 = 시각 순서? 모달 오픈 시 배경 접근성 차단?
- [ ] 본문 4.5:1 / 보조 3:1 / 디바이더 가시성을 **양 테마** 모두 충족?
- [ ] 모달·시트 스크림이 40~60% 검정?
- [ ] 고정 바 높이만큼 `contentContainerStyle` 인셋 예약? (마지막 항목 안 가림)
- [ ] 태블릿·랜드스케이프에서 거터 확대 + 콘텐츠 최대폭 제한?
