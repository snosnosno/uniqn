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

- `KeyboardAvoidingView`: iOS=`padding`, Android=`height`
- 스크롤 영역: `keyboardDismissMode="on-drag"` + `keyboardShouldPersistTaps="handled"`
- `returnKeyType` 체인: 다음 인풋 `next`, 마지막 `done`
- **`autoFocus` 금지**: 스크린리더 혼선, 예기치 못한 키보드 팝업
- 긴 폼: 섹션별 `ScrollView` + `scrollToInput` 대신 `KeyboardAwareScrollView`
  (`react-native-keyboard-aware-scroll-view` 이미 설치됨)

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
   └ 룰 20: KeyboardAvoidingView padding(iOS)
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
- [ ] 폼에 `KeyboardAvoidingView` + `autoFocus` 없음?
- [ ] Pressed 피드백이 다크/라이트 반대 방향(밝기 변화)?
- [ ] Focus ring = Info 블루 `#2563EB` 2px(골드 아님)?
- [ ] 화면별 `statusBarStyle`이 배경과 대비?
- [ ] 긴 리스트에 Sticky 헤더 + 골드 tint pull-to-refresh?
- [ ] Offline 배너 + 접근성 `accessibilityLiveRegion="polite"`?
- [ ] Text truncation 정책: 금액·에러는 truncation 금지?
- [ ] 아이콘은 Lucide(`@/components/icons`) + stroke 2.0 + Size 화이트리스트?
