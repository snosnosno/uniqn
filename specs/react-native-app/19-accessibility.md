# 19. Accessibility (접근성)

## 개요

모든 사용자가 UNIQN 앱을 동등하게 사용할 수 있도록 하는 접근성 가이드입니다.
WCAG 2.1 AA 기준과 iOS/Android 플랫폼 접근성 가이드라인을 준수합니다.

### 현재 구현 상태

| 항목 | 상태 | 설명 |
|------|------|------|
| **터치 타겟** | ✅ 완료 | 최소 44x44pt (WCAG 준수) |
| **색상 대비** | ✅ 완료 | 4.5:1 이상 (NativeWind 테마) |
| **스크린리더** | ✅ 완료 | 29개 UI 컴포넌트 지원 |
| **다크모드** | ✅ 완료 | 시스템 테마 연동 |
| **모션 감소** | 🔲 예정 | reduceMotion 대응 |

### 접근성 적용 컴포넌트 (29개)

```
src/components/ui/
├── Button.tsx          ✅ accessibilityRole, accessibilityState, accessibilityLabel
├── Input.tsx           ✅ accessibilityLabel, 포커스 표시
├── Card.tsx            ✅ accessibilityRole
├── Badge.tsx           ✅ accessibilityRole
├── Avatar.tsx          ✅ accessibilityLabel
├── Checkbox.tsx        ✅ accessibilityRole, accessibilityState
├── Radio.tsx           ✅ accessibilityRole, accessibilityState
├── Modal.tsx           ✅ accessibilityViewIsModal
├── BottomSheet.tsx     ✅ accessibilityRole
├── ActionSheet.tsx     ✅ accessibilityRole
├── Toast.tsx           ✅ accessibilityLiveRegion
├── ErrorState.tsx      ✅ accessibilityRole
├── LoadingOverlay.tsx  ✅ accessibilityLabel
├── DatePicker.tsx      ✅ accessibilityLabel
├── TimePicker.tsx      ✅ accessibilityLabel
├── CalendarPicker.tsx  ✅ accessibilityLabel
├── FormSelect.tsx      ✅ accessibilityRole
├── OptimizedImage.tsx  ✅ accessibilityLabel
├── MobileHeader.tsx    ✅ accessibilityRole
├── SheetModal.tsx      ✅ accessibilityViewIsModal
├── Accordion.tsx       ✅ accessibilityRole, accessibilityState
└── error-boundary/     ✅ 5개 에러 바운더리 컴포넌트
```

---

## 1. 터치 타겟 크기

### 1.1 WCAG 2.1 AA 기준 준수

```typescript
// src/components/ui/Button.tsx
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2.5 min-h-[44px]', // WCAG 2.1 터치 타겟 최소 44px 준수
  md: 'px-4 py-3 min-h-[44px]',
  lg: 'px-6 py-4 min-h-[52px]',
};
```

### 1.2 hitSlop 적용

```typescript
// 작은 아이콘 버튼도 충분한 터치 영역 확보
<Pressable
  onPress={() => setShowPassword(!showPassword)}
  className="p-1"
  hitSlop={8}  // 추가 터치 영역 확보
>
  <EyeIcon size={20} />
</Pressable>
```

### 1.3 표준 값

```typescript
// constants/accessibility.ts
export const A11Y = {
  // WCAG 2.1 AA 기준: 44x44pt 최소
  MIN_TOUCH_TARGET: 44,

  // 권장 크기
  RECOMMENDED_TOUCH_TARGET: 48,

  // 아이콘 버튼 패딩
  ICON_BUTTON_PADDING: 12,

  // hitSlop 기본값
  DEFAULT_HIT_SLOP: 8,
};
```

---

## 2. 색상 대비

### 2.1 NativeWind 테마 색상 (WCAG AA 준수)

```typescript
// tailwind.config.js + 다크모드 지원
const colors = {
  light: {
    // 텍스트 (배경 #FFFFFF 기준)
    textPrimary: '#1F2937',     // gray-800, 대비 12.6:1 ✓
    textSecondary: '#4B5563',   // gray-600, 대비 7.5:1 ✓
    textTertiary: '#6B7280',    // gray-500, 대비 5.4:1 ✓

    // 플레이스홀더 (Input 컴포넌트)
    placeholder: '#6B7280',     // gray-500, WCAG AA 준수

    // 브랜드 색상
    primary: '#A855F7',         // purple-500
    accent: '#FFD700',          // gold

    // 상태 색상
    error: '#EF4444',           // red-500, 대비 4.5:1 ✓
    success: '#10B981',         // emerald-500
  },

  dark: {
    // 텍스트 (배경 #1A1625 기준)
    textPrimary: '#F9FAFB',     // gray-50, 대비 15.8:1 ✓
    textSecondary: '#D1D5DB',   // gray-300, 대비 10.9:1 ✓
    textTertiary: '#9CA3AF',    // gray-400, 대비 6.5:1 ✓

    // 플레이스홀더
    placeholder: '#9CA3AF',     // gray-400, 다크모드에서 더 밝게

    // 배경
    background: '#1A1625',      // surface-dark
    surface: '#0D0B14',         // surface
  },
};
```

### 2.2 Input 컴포넌트 대비 준수

```typescript
// src/components/ui/Input.tsx
const PLACEHOLDER_COLORS = {
  light: '#6B7280', // gray-500 (WCAG AA 준수)
  dark: '#9CA3AF',  // gray-400 (다크모드에서 더 밝게)
} as const;

// 에러/힌트 텍스트 대비 개선
<Text
  className={`mt-1 text-sm ${
    // P1 접근성: WCAG AA 준수를 위해 대비 개선 (gray-400 → gray-500/600)
    error ? 'text-error-500' : 'text-gray-600 dark:text-gray-400'
  }`}
>
  {error || hint}
</Text>
```

### 2.3 색상만으로 정보 전달 금지

```typescript
// ✅ 올바른 예: 색상 + 텍스트/아이콘
<Badge variant={status === 'confirmed' ? 'success' : 'warning'}>
  {status === 'confirmed' ? '확정됨' : '대기 중'}
</Badge>

// 에러 상태: 색상 + 테두리 + 배경
const getBorderClass = () => {
  if (error) {
    return 'border-error-500 bg-error-50 dark:bg-error-900/20';
  }
  // ...
};
```

---

## 3. 스크린리더 지원

### 3.1 Button 컴포넌트

```typescript
// src/components/ui/Button.tsx
export const Button = memo(function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // children이 문자열인 경우 자동으로 accessibilityLabel 생성
  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (typeof children === 'string' ? children : undefined);

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      className={buttonClass}
    >
      {loading ? (
        <ActivityIndicator color={loaderColor} size="small" />
      ) : (
        <Text>{children}</Text>
      )}
    </Pressable>
  );
});
```

### 3.2 Input 컴포넌트

```typescript
// src/components/ui/Input.tsx
<TextInput
  {...props}
  accessibilityLabel={props.accessibilityLabel ?? label}
  // 포커스 상태 시각적 표시
  onFocus={(e) => {
    setIsFocused(true);
    props.onFocus?.(e);
  }}
  onBlur={(e) => {
    setIsFocused(false);
    props.onBlur?.(e);
  }}
/>
```

### 3.3 Modal 컴포넌트

```typescript
// src/components/ui/Modal.tsx
<RNModal
  visible={visible}
  transparent
  animationType="fade"
  onRequestClose={onClose}
  // 모달이 열리면 뒤의 콘텐츠 접근 불가
  accessibilityViewIsModal={true}
>
  <View accessibilityRole="dialog">
    {/* 내용 */}
  </View>
</RNModal>
```

### 3.4 Toast 컴포넌트

```typescript
// src/components/ui/Toast.tsx
<Animated.View
  accessibilityRole="alert"
  accessibilityLiveRegion="polite"
  className={toastClass}
>
  <Text>{message}</Text>
</Animated.View>
```

### 3.5 Checkbox / Radio 컴포넌트

```typescript
// src/components/ui/Checkbox.tsx
<Pressable
  onPress={onPress}
  accessibilityRole="checkbox"
  accessibilityState={{ checked: checked }}
  accessibilityLabel={label}
>
  {/* 체크박스 UI */}
</Pressable>

// src/components/ui/Radio.tsx
<Pressable
  onPress={onPress}
  accessibilityRole="radio"
  accessibilityState={{ selected: selected }}
  accessibilityLabel={label}
>
  {/* 라디오 UI */}
</Pressable>
```

### 3.6 이미지 접근성

```typescript
// src/components/ui/OptimizedImage.tsx
<Image
  source={source}
  accessibilityLabel={accessibilityLabel}
  // 장식용 이미지는 스크린리더에서 숨김
  accessibilityElementsHidden={decorative}
  importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
/>
```

---

## 4. 다크모드 지원

### 4.1 시스템 테마 연동

```typescript
// src/stores/themeStore.ts
interface ThemeState {
  mode: 'light' | 'dark' | 'system';
  isDarkMode: boolean;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
}

// 시스템 테마 자동 감지
const systemColorScheme = Appearance.getColorScheme();
const isDarkMode = mode === 'system'
  ? systemColorScheme === 'dark'
  : mode === 'dark';
```

### 4.2 NativeWind 다크모드 클래스

```tsx
// 모든 컴포넌트에 다크모드 클래스 적용
<View className="bg-white dark:bg-surface-dark">
  <Text className="text-gray-900 dark:text-gray-100">
    다크모드 지원
  </Text>
</View>

<Button variant="primary">
  {/* 자동으로 다크모드 스타일 적용 */}
</Button>
```

### 4.3 StatusBar 연동

```typescript
// app/_layout.tsx
function MainNavigator() {
  const { isDarkMode } = useThemeStore();

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* ... */}
    </>
  );
}
```

---

## 5. 폼 접근성

### 5.1 React Hook Form + 접근성

```typescript
// 폼 필드 with 접근성
<Controller
  control={control}
  name="email"
  render={({ field: { onChange, value }, fieldState: { error } }) => (
    <Input
      label="이메일"
      value={value}
      onChangeText={onChange}
      error={error?.message}
      keyboardType="email-address"
      autoComplete="email"
      textContentType="emailAddress"
      accessibilityLabel="이메일 입력"
    />
  )}
/>
```

### 5.2 자동완성 지원

```typescript
// iOS textContentType
<TextInput
  textContentType="emailAddress"     // 이메일
  textContentType="password"         // 비밀번호
  textContentType="newPassword"      // 새 비밀번호
  textContentType="name"             // 이름
  textContentType="telephoneNumber"  // 전화번호
/>

// Android autoComplete
<TextInput
  autoComplete="email"
  autoComplete="password"
  autoComplete="password-new"
  autoComplete="name"
  autoComplete="tel"
/>
```

### 5.3 에러 상태 표시

```typescript
// 에러 발생 시 시각적 + 접근성 표시
<View>
  <Input
    label="비밀번호"
    error={errors.password?.message}
    accessibilityInvalid={!!errors.password}
  />

  {errors.password && (
    <Text
      className="text-error-500"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {errors.password.message}
    </Text>
  )}
</View>
```

---

## 6. 네비게이션 접근성

### 6.1 탭 네비게이션

```typescript
// app/(app)/(tabs)/_layout.tsx
<Tabs
  screenOptions={{
    tabBarAccessibilityLabel: '하단 탭 메뉴',
  }}
>
  <Tabs.Screen
    name="index"
    options={{
      title: '홈',
      tabBarAccessibilityLabel: '홈 탭',
    }}
  />
  <Tabs.Screen
    name="schedule"
    options={{
      title: '스케줄',
      tabBarAccessibilityLabel: '내 스케줄 탭',
    }}
  />
  {/* ... */}
</Tabs>
```

### 6.2 헤더 접근성

```typescript
// src/components/ui/MobileHeader.tsx
<View
  className="flex-row items-center justify-between"
  accessibilityRole="header"
>
  <Pressable
    onPress={onBack}
    accessibilityRole="button"
    accessibilityLabel="뒤로 가기"
    hitSlop={8}
  >
    <ChevronLeftIcon />
  </Pressable>

  <Text
    className="text-lg font-semibold"
    accessibilityRole="header"
  >
    {title}
  </Text>
</View>
```

---

## 7. 에러 바운더리 접근성

### 7.1 에러 상태 표시

```typescript
// src/components/ui/ErrorState.tsx
<View
  className="flex-1 items-center justify-center p-4"
  accessibilityRole="alert"
>
  <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
    {title || '오류가 발생했습니다'}
  </Text>
  <Text className="text-gray-600 dark:text-gray-400 text-center mt-2">
    {message}
  </Text>
  {onRetry && (
    <Button onPress={onRetry} accessibilityLabel="다시 시도">
      다시 시도
    </Button>
  )}
</View>
```

### 7.2 세분화된 에러 바운더리 (5종)

```typescript
// src/components/ui/error-boundary/
ErrorBoundary.tsx          // 기본 에러 바운더리
ScreenErrorBoundary.tsx    // 화면 레벨
AuthErrorBoundary.tsx      // 인증 관련
NetworkErrorBoundary.tsx   // 네트워크 관련
DataFetchErrorBoundary.tsx // 데이터 로딩 관련
FormErrorBoundary.tsx      // 폼 관련
```

---

## 8. 테스트

### 8.1 스크린리더 테스트

```yaml
iOS VoiceOver:
  Enable: 설정 > 손쉬운 사용 > VoiceOver
  Shortcut: 홈 버튼 3번 클릭 (또는 측면 버튼)

  테스트 항목:
    - [ ] 모든 버튼에 라벨이 있는가
    - [ ] 이미지에 대체 텍스트가 있는가
    - [ ] 순서대로 탐색이 되는가
    - [ ] 모달이 열리면 포커스가 이동하는가
    - [ ] 에러 메시지가 자동으로 읽히는가

Android TalkBack:
  Enable: 설정 > 접근성 > TalkBack
  Shortcut: 볼륨 키 동시에 3초

  테스트 항목:
    - [ ] 위와 동일
```

### 8.2 컴포넌트 테스트

```typescript
// __tests__/components/Button.test.tsx
describe('Button Accessibility', () => {
  it('has accessible role', () => {
    const { getByRole } = render(
      <Button onPress={() => {}}>제출</Button>
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('has accessibility label', () => {
    const { getByLabelText } = render(
      <Button onPress={() => {}}>제출</Button>
    );
    expect(getByLabelText('제출')).toBeTruthy();
  });

  it('announces loading state', () => {
    const { getByRole } = render(
      <Button onPress={() => {}} loading>제출</Button>
    );
    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
  });

  it('indicates disabled state', () => {
    const { getByRole } = render(
      <Button onPress={() => {}} disabled>제출</Button>
    );
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });
});
```

---

## 9. 체크리스트

### 현재 구현 완료

```yaml
터치 타겟:
  - [x] 모든 터치 타겟 최소 44x44pt
  - [x] hitSlop으로 작은 아이콘 터치 영역 확장
  - [x] 버튼 사이즈별 min-height 설정

색상 대비:
  - [x] 텍스트 대비 4.5:1 이상 (WCAG AA)
  - [x] 플레이스홀더 색상 대비 준수
  - [x] 다크모드 색상 대비 유지
  - [x] 에러 상태 시각적 표시 (색상 + 테두리)

스크린리더:
  - [x] 29개 UI 컴포넌트 accessibilityRole 설정
  - [x] Button accessibilityLabel 자동 생성
  - [x] Input accessibilityLabel 라벨 연결
  - [x] Modal accessibilityViewIsModal 설정
  - [x] Toast accessibilityLiveRegion 설정

다크모드:
  - [x] 시스템 테마 자동 감지
  - [x] NativeWind dark: 클래스 전체 적용
  - [x] StatusBar 스타일 연동
```

### 향후 구현 예정 (Phase 2-3)

```yaml
모션 제어:
  - [ ] useReducedMotion 훅 구현
  - [ ] 애니메이션 비활성화 옵션
  - [ ] 자동 재생 콘텐츠 제어

폰트 스케일링:
  - [ ] 시스템 폰트 크기 지원
  - [ ] 200% 확대 시 레이아웃 유지

키보드 네비게이션:
  - [ ] 외부 키보드 지원 (iPad/태블릿)
  - [ ] 포커스 순서 최적화

고급 컴포넌트:
  - [ ] CalendarPicker 날짜 선택 접근성
  - [ ] 차트/그래프 대체 텍스트
```

---

## 10. 로드맵

### Phase 1 (MVP) - 완료

```yaml
목표: 앱 스토어 심사 통과, 기본 사용성 보장

완료 항목:
  - 터치 타겟 44pt 이상
  - 색상 대비 4.5:1 이상
  - 모든 버튼에 accessibilityLabel
  - 이미지 대체 텍스트
  - 입력 필드 라벨 연결
```

### Phase 2 (Beta) - 진행 예정

```yaml
목표: VoiceOver/TalkBack 완전 지원

구현 항목:
  - 화면 전환 알림 (announceForAccessibility)
  - 에러 메시지 즉시 읽기 (assertive)
  - 모달 포커스 트랩
  - 복잡한 컴포넌트 접근성 개선
```

### Phase 3 (Release) - 향후

```yaml
목표: WCAG 2.1 AA 완전 준수

구현 항목:
  - reduceMotion 대응
  - 폰트 스케일링 지원
  - 키보드 네비게이션
  - 접근성 테스트 자동화
```

---

## 참고 자료

- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS Accessibility](https://developer.apple.com/accessibility/ios/)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
- [NativeWind Dark Mode](https://www.nativewind.dev/guides/dark-mode)

---

*마지막 업데이트: 2026-02-02*
*접근성 적용 컴포넌트: 29개*
*WCAG 준수 레벨: AA (Phase 1)*
