# 11. UI/UX 가이드라인

## 목차
1. [디자인 원칙](#1-디자인-원칙)
2. [컴포넌트 시스템](#2-컴포넌트-시스템)
3. [테마 및 다크모드](#3-테마-및-다크모드)
4. [피드백 시스템](#4-피드백-시스템)
5. [폼 디자인 패턴](#5-폼-디자인-패턴)
6. [네비게이션 패턴](#6-네비게이션-패턴)
7. [접근성](#7-접근성)
8. [모션 및 애니메이션](#8-모션-및-애니메이션)
9. [화면별 UX 가이드](#9-화면별-ux-가이드)

---

## 1. 디자인 원칙

### 핵심 원칙

```
┌──────────────────────────────────────────────────────────────────────┐
│                      UX Design Principles                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Clarity    │  │ Efficiency  │  │  Feedback   │  │ Forgiveness │  │
│  │   명확성    │  │   효율성    │  │   피드백    │  │   관용성    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│        │               │                │                │            │
│        ▼               ▼                ▼                ▼            │
│  - 직관적 레이블  - 최소 탭 수     - 즉각적 응답   - 실수 방지       │
│  - 명확한 계층    - 자동완성       - 상태 표시     - 쉬운 수정       │
│  - 일관된 패턴    - 기본값 제공    - 진행률 표시   - 되돌리기        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 시각적 계층

```typescript
// src/constants/typography.ts (실제 구현)
export const Typography = {
  // 제목
  h1: 'text-3xl font-bold',      // 28px - 화면 제목
  h2: 'text-2xl font-bold',      // 24px - 섹션 제목
  h3: 'text-xl font-semibold',   // 20px - 카드 제목
  h4: 'text-lg font-semibold',   // 18px - 서브 제목

  // 본문
  body: 'text-base',             // 16px - 일반 텍스트
  bodySmall: 'text-sm',          // 14px - 보조 텍스트
  caption: 'text-xs',            // 12px - 캡션, 메타데이터

  // 특수
  label: 'text-sm font-medium',  // 14px - 폼 레이블
  button: 'text-base font-semibold', // 16px - 버튼
};
```

### 터치 타겟 가이드라인

```typescript
// 최소 터치 영역: 44x44 pt (Apple HIG) / 48x48 dp (Material)
// 실제 구현: src/components/ui/Button.tsx
export const TouchTargets = {
  minimum: 44,      // 최소 터치 영역
  button: 48,       // 권장 버튼 높이
  buttonSm: 44,     // 작은 버튼 (min-h-[44px])
  buttonLg: 52,     // 큰 버튼 (min-h-[52px])
  listItem: 56,     // 리스트 아이템 높이
  tabBarItem: 64,   // 탭바 아이템
  iconButton: 44,   // 아이콘 버튼
};

// 사용 예 (실제 구현)
<Pressable
  className="min-h-[44px] min-w-[44px] items-center justify-center"
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Icon />
</Pressable>
```

---

## 2. 컴포넌트 시스템

### 컴포넌트 구조 (실제 구현 기준)

```
src/components/
├── ui/                    # 기본 UI (48개)
│   ├── Button.tsx         # 다크모드, 로딩, 아이콘 지원
│   ├── Input.tsx          # 텍스트, 비밀번호, 검색 타입
│   ├── Card.tsx           # 3가지 variant
│   ├── Badge.tsx          # 6가지 variant
│   ├── Avatar.tsx         # 프로필 이미지
│   ├── Divider.tsx
│   ├── Loading.tsx
│   ├── LoadingOverlay.tsx
│   ├── EmptyState.tsx     # 3가지 variant
│   ├── ErrorState.tsx
│   ├── ErrorBoundary.tsx  # 5가지 세분화
│   ├── Skeleton.tsx       # shimmer 애니메이션
│   ├── Toast.tsx
│   ├── ToastManager.tsx
│   ├── Modal.tsx          # 웹/네이티브 분리 구현
│   ├── SheetModal.tsx
│   ├── BottomSheet.tsx
│   ├── ActionSheet.tsx
│   ├── ModalManager.tsx
│   ├── FormField.tsx
│   ├── FormSection.tsx
│   ├── FormSelect.tsx
│   ├── Checkbox.tsx
│   ├── Radio.tsx
│   ├── DatePicker.tsx
│   ├── TimePicker.tsx
│   ├── CalendarPicker.tsx
│   ├── CircularProgress.tsx
│   ├── OptimizedImage.tsx # expo-image + Blurhash
│   ├── MobileHeader.tsx
│   ├── Accordion.tsx
│   ├── InAppBanner.tsx
│   ├── InAppModal.tsx
│   ├── InAppMessageManager.tsx
│   └── OfflineBanner.tsx  # 네트워크 상태
│
├── auth/                  # 인증 (15개)
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   ├── BiometricButton.tsx
│   ├── PasswordStrength.tsx
│   ├── SocialLoginButtons.tsx
│   ├── StepIndicator.tsx
│   └── IdentityVerification.tsx
│
├── jobs/                  # 구인공고 (19개)
├── employer/              # 구인자 (62개) ⭐ 가장 많음
├── schedule/              # 스케줄 (11개)
├── qr/                    # QR 코드 (4개)
├── notifications/         # 알림 (8개)
├── admin/                 # 관리자 (15개)
└── support/               # 고객지원 (7개)

총 컴포넌트: 192개 (.tsx)
```

### Button 컴포넌트 (실제 구현)

```typescript
// src/components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  onPress?: () => void;
}

// 다크모드 지원 스타일
const variantStyles = {
  primary: 'bg-primary-600 dark:bg-primary-500 active:bg-primary-700 dark:active:bg-primary-600',
  secondary: 'bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600',
  outline: 'border-2 border-primary-600 dark:border-primary-400 bg-transparent',
  ghost: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
  danger: 'bg-red-600 dark:bg-red-500 active:bg-red-700',
};

// 사이즈별 터치 타겟
const sizeStyles = {
  sm: 'min-h-[44px] px-4 text-sm',    // 최소 44px
  md: 'min-h-[48px] px-6 text-base',  // 권장 48px
  lg: 'min-h-[52px] px-8 text-lg',    // 큰 버튼 52px
};

// 접근성 자동 지원
const resolvedAccessibilityLabel =
  accessibilityLabel ?? (typeof children === 'string' ? children : undefined);
```

### ErrorBoundary 세분화

```typescript
// src/components/ui/ErrorBoundary/ (5가지 에러 바운더리)
├── AuthErrorBoundary.tsx      // 인증 에러 처리
├── DataFetchErrorBoundary.tsx // 데이터 조회 에러
├── FormErrorBoundary.tsx      // 폼 에러 처리
├── NetworkErrorBoundary.tsx   // 네트워크 에러
└── CompositeErrorBoundary.tsx // 복합 에러 처리
```

### Skeleton 프리셋

```typescript
// src/components/ui/Skeleton.tsx
// shimmer 애니메이션 + 10+ 프리셋 포함
<Skeleton />                    // 기본 박스
<SkeletonJobCard />             // 공고 카드 스켈레톤
<SkeletonScheduleCard />        // 스케줄 카드
<SkeletonNotificationItem />    // 알림 아이템
<SkeletonProfileHeader />       // 프로필 헤더
// ...
```

---

## 3. 테마 및 다크모드

### 테마 스토어 (실제 구현)

```typescript
// src/stores/themeStore.ts (195줄)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Appearance } from 'react-native';
import { colorScheme } from 'nativewind';
import { storage } from '@/lib/mmkvStorage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDarkMode: boolean;
  _hasHydrated: boolean;  // Hydration 추적
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDarkMode: Appearance.getColorScheme() === 'dark',
      _hasHydrated: false,

      setMode: (mode) => {
        const isDarkMode =
          mode === 'system'
            ? Appearance.getColorScheme() === 'dark'
            : mode === 'dark';

        // NativeWind colorScheme 연동
        colorScheme.set(mode === 'system' ? 'system' : mode);

        set({ mode, isDarkMode });
      },

      toggleTheme: () => {
        const currentMode = get().mode;
        const newMode = currentMode === 'dark' ? 'light' : 'dark';
        get().setMode(newMode);
      },
    }),
    {
      name: 'uniqn-theme',  // MMKV 스토리지 키
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => (state) => {
        // 복원 후 NativeWind 동기화
        if (state) {
          colorScheme.set(state.mode === 'system' ? 'system' : state.mode);
          state._hasHydrated = true;
        }
      },
    }
  )
);

// 시스템 테마 변경 자동 감지
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode, setMode } = useThemeStore.getState();
  if (mode === 'system') {
    setMode('system'); // 재계산
  }
});

// 초기화 완료 대기 함수
export const waitForThemeHydration = (): Promise<void> => {
  return new Promise((resolve) => {
    if (useThemeStore.getState()._hasHydrated) {
      resolve();
      return;
    }
    const unsubscribe = useThemeStore.subscribe((state) => {
      if (state._hasHydrated) {
        unsubscribe();
        resolve();
      }
    });
  });
};
```

### 다크모드 색상 팔레트

```typescript
// tailwind.config.js + NativeWind
// 실제 사용 예시
const darkModeClasses = {
  // 배경색
  background: 'bg-white dark:bg-gray-900',
  backgroundSecondary: 'bg-gray-50 dark:bg-gray-800',
  surface: 'bg-white dark:bg-surface-dark',

  // 텍스트
  text: 'text-gray-900 dark:text-gray-100',
  textSecondary: 'text-gray-600 dark:text-gray-400',

  // 보더
  border: 'border-gray-200 dark:border-gray-700',

  // 브랜드 컬러
  primary: 'bg-primary-600 dark:bg-primary-500',

  // 상태 컬러
  success: 'bg-green-600 dark:bg-green-700',
  error: 'bg-red-600 dark:bg-red-700',
  warning: 'bg-yellow-500 dark:bg-yellow-600',
  info: 'bg-blue-600 dark:bg-blue-700',
};
```

### 다크모드 적용 패턴

```tsx
// 모든 컴포넌트에서 dark: 접두사 사용
<View className="bg-white dark:bg-gray-900">
  <Text className="text-gray-900 dark:text-gray-100">
    다크모드 지원 텍스트
  </Text>
  <Button className="bg-primary-600 dark:bg-primary-500 active:bg-primary-700 dark:active:bg-primary-600">
    버튼
  </Button>
</View>

// Toast 예시
<View className="bg-green-600 dark:bg-green-700 rounded-xl p-4">
  <Text className="text-white">성공 메시지</Text>
</View>
```

---

## 4. 피드백 시스템

### Toast 시스템 (실제 구현)

```typescript
// src/stores/toastStore.ts
interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;  // 기본 3초, 에러 5초
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastState {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
}

// 최대 3개 토스트 관리
// 자동 제거 타이머

// 편의 메서드
export const toast = {
  success: (message: string) => addToast({ type: 'success', message }),
  error: (message: string) => addToast({ type: 'error', message, duration: 5000 }),
  warning: (message: string) => addToast({ type: 'warning', message }),
  info: (message: string) => addToast({ type: 'info', message }),
};
```

```typescript
// src/components/ui/Toast.tsx
// Reanimated 애니메이션 사용
const translateY = useSharedValue(-100);
const opacity = useSharedValue(0);

useEffect(() => {
  // 등장 애니메이션
  translateY.value = withTiming(0, { duration: 300 });
  opacity.value = withTiming(1, { duration: 300 });

  // 자동 닫기
  if (toast.duration !== 0) {
    const timer = setTimeout(() => handleDismiss(), toast.duration || 3000);
    return () => clearTimeout(timer);
  }
}, []);

const handleDismiss = () => {
  translateY.value = withTiming(-100, { duration: 200 });
  opacity.value = withTiming(0, { duration: 200 }, () => {
    runOnJS(removeToast)(toast.id);
  });
};
```

### Modal 시스템 (실제 구현)

```typescript
// src/components/ui/Modal.tsx
// 웹/네이티브 분리 구현
interface ModalProps {
  visible: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'full';
  position?: 'center' | 'bottom';
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

// 웹: react-dom Portal로 렌더링
// 네이티브: React Native Modal 사용
// Reanimated 애니메이션 지원

export function Modal({ visible, onClose, size = 'md', ...props }: ModalProps) {
  // 배경 페이드인/아웃
  // 모달 슬라이드 애니메이션
}
```

```typescript
// src/components/ui/ModalManager.tsx
// 전역 모달 관리
interface ModalStore {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}
```

### 로딩 상태

```typescript
// src/components/ui/LoadingOverlay.tsx
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

// Reanimated FadeIn/FadeOut
// 중앙 정렬 ActivityIndicator + 메시지
```

### 빈 상태 (3가지 variant)

```typescript
// src/components/ui/EmptyState.tsx
interface EmptyStateProps {
  variant?: 'default' | 'search' | 'error';
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}
```

### 네트워크 상태 표시

```typescript
// src/components/ui/OfflineBanner.tsx
// useNetworkStatus 훅과 연동
// 오프라인 시 화면 상단에 배너 표시
<OfflineBanner />
```

---

## 5. 폼 디자인 패턴

### FormField 컴포넌트

```typescript
// src/components/ui/FormField.tsx
interface FormFieldProps extends TextInputProps {
  name: string;
  control: Control<any>;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

// React Hook Form + Zod 연동
// 실시간 유효성 검증
// 에러 상태 시각화 (border-red-500)
// 포커스 상태 시각화 (border-blue-500)
```

### 비밀번호 강도 표시

```typescript
// src/components/auth/PasswordStrength.tsx
interface PasswordStrengthProps {
  password: string;
}

// 5단계 강도 표시
// - 매우 약함 (빨강)
// - 약함 (주황)
// - 보통 (노랑)
// - 강함 (초록)
// - 매우 강함 (진한 초록)

// 검증 기준:
// - 길이 8자 이상
// - 길이 12자 이상
// - 대소문자 혼합
// - 숫자 포함
// - 특수문자 포함
```

### 날짜/시간 선택

```typescript
// src/components/ui/DatePicker.tsx
// src/components/ui/DateRangePicker.tsx
// src/components/ui/TimePicker.tsx
// src/components/ui/TimeWheelPicker.tsx
// src/components/ui/CalendarPicker.tsx

// 접근성 지원
accessibilityLabel={format(day.date, 'yyyy년 M월 d일 EEEE', { locale: ko })}
```

---

## 6. 네비게이션 패턴

### 탭 네비게이션 (5개 탭)

```typescript
// app/(app)/(tabs)/_layout.tsx
// Expo Router 파일 기반 라우팅

const tabs = [
  { name: 'index', title: '구인구직', icon: HomeIcon },
  { name: 'schedule', title: '내 스케줄', icon: CalendarIcon },
  { name: 'qr', title: 'QR', icon: QrCodeIcon },
  { name: 'employer', title: '내 공고', icon: BriefcaseIcon },  // 구인자용
  { name: 'profile', title: '프로필', icon: UserIcon },
];

// 탭바 스타일
tabBarStyle: {
  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
  borderTopColor: isDark ? '#374151' : '#E5E7EB',
  height: Platform.OS === 'ios' ? 88 : 64,
  paddingBottom: Platform.OS === 'ios' ? 28 : 8,
}
```

### 라우트 그룹별 권한

| 그룹 | 권한 | 화면 |
|------|------|------|
| `(public)` | 없음 | jobs/index, jobs/[id] |
| `(auth)` | 비로그인 | login, signup, forgot-password |
| `(app)` | staff+ | tabs/*, applications, notifications, settings |
| `(employer)` | employer+ | my-postings/*, applicants, settlements |
| `(admin)` | admin | users, reports, announcements, tournaments |

### 헤더 스타일

```typescript
// src/components/ui/MobileHeader.tsx
// src/components/ui/LargeHeader.tsx

// 기본 옵션
const defaultScreenOptions = {
  headerShadowVisible: false,
  headerTitleAlign: 'center',
  headerBackTitleVisible: false,
  animation: 'slide_from_right',
};

// 모달 옵션
const modalScreenOptions = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
};
```

---

## 7. 접근성

### WCAG 2.1 준수 (실제 구현)

```typescript
// 최소 터치 타겟: 44px × 44px
// Button.tsx
className="min-h-[44px]"  // sm/md
className="min-h-[52px]"  // lg

// 접근성 라벨 자동 생성
const resolvedAccessibilityLabel =
  accessibilityLabel ??
  (typeof children === 'string' ? children : undefined);

<Pressable
  accessible={true}
  accessibilityLabel={resolvedAccessibilityLabel}
  accessibilityRole="button"
  accessibilityState={{ disabled }}
>
```

### 컴포넌트별 접근성 구현

```typescript
// Avatar.tsx
accessibilityLabel={name ? `${name} 프로필 사진` : '프로필 사진'}

// CalendarPicker.tsx
accessibilityLabel={format(day.date, 'yyyy년 M월 d일 EEEE', { locale: ko })}

// Badge.tsx
accessibilityLabel={typeof children === 'string' ? children : undefined}
```

### 접근성 공지

```typescript
// src/utils/accessibility.ts
import { AccessibilityInfo, Platform } from 'react-native';

export function announceForAccessibility(message: string) {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(message);
  } else {
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (enabled) {
        AccessibilityInfo.announceForAccessibility(message);
      }
    });
  }
}
```

---

## 8. 모션 및 애니메이션

### 라이브러리

- **react-native-reanimated 4.1.1**: 60fps, Worklet 지원

### 애니메이션 패턴

```typescript
// Toast 애니메이션
const translateY = useSharedValue(-100);
const opacity = useSharedValue(0);

translateY.value = withTiming(0, { duration: 300 });
opacity.value = withTiming(1, { duration: 300 });

// Modal 배경 애니메이션
const backdropOpacity = useSharedValue(0);
backdropOpacity.value = withTiming(visible ? 1 : 0, { duration: 200 });

// 버튼 프레스 애니메이션
const scale = useSharedValue(1);
const onPressIn = () => {
  scale.value = withSpring(0.95, { damping: 15 });
};
const onPressOut = () => {
  scale.value = withSpring(1, { damping: 15 });
};

// 로딩 스켈레톤 shimmer
// useAnimatedStyle로 반복 애니메이션
```

### 애니메이션 설정 값

```typescript
const AnimationDuration = {
  instant: 100,    // 즉각적인 피드백
  fast: 200,       // 빠른 전환
  normal: 300,     // 일반 전환
  slow: 500,       // 강조된 전환
};

const AnimationConfig = {
  spring: { damping: 15 },
  timing: { duration: 200, easing: Easing.ease },
};
```

---

## 9. 화면별 UX 가이드

### 회원가입 (4단계 마법사)

```
Step 1: 계정        Step 2: 본인인증      Step 3: 프로필      Step 4: 완료
┌──────────────┐   ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
│[●]─[○]─[○]─[○]│   │[✓]─[●]─[○]─[○]│     │[✓]─[✓]─[●]─[○]│   │[✓]─[✓]─[✓]─[●]│
│              │   │              │     │              │   │              │
│ 이메일       │   │ 📱 본인인증  │     │ 닉네임       │   │    🎉        │
│ 비밀번호     │   │ • PASS 인증  │     │ 역할 선택    │   │  가입 완료!  │
│ 비밀번호확인 │   │ • 카카오인증 │     │ 약관 동의    │   │              │
│              │   │  (필수)      │     │              │   │  로그인 하기 │
│   [ 다음 ]   │   │   [ 인증 ]   │     │   [ 다음 ]   │   │              │
└──────────────┘   └──────────────┘     └──────────────┘   └──────────────┘
```

> ⚠️ 이메일 인증 미사용. 휴대폰 본인인증(PASS/카카오)으로 실명 확인 및 중복가입 방지

### 로그인

```
┌─────────────────────────────────────────────────────────┐
│                      UNIQN 로고                          │
├─────────────────────────────────────────────────────────┤
│ 이메일                                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📧 example@email.com                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ 비밀번호                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔒 ●●●●●●●●                                      👁 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ☑ 자동 로그인                    비밀번호를 잊으셨나요? │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                    로그인                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ─────────────────── 또는 ────────────────────           │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  🍎  Apple로 계속하기                               │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  G  Google로 계속하기                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│            계정이 없으신가요? 회원가입                    │
└─────────────────────────────────────────────────────────┘
```

### 설정 화면

```
┌─────────────────────────────────────────────────────────┐
│ 프로필                                                   │
│ ─────────────────────────────────────────────────────── │
│ 🔔 알림 설정                                         >  │
│ 🌙 다크모드                                    [Switch] │
│ 🌐 언어                                         한국어 >│
├─────────────────────────────────────────────────────────┤
│ 계정                                                     │
│ ─────────────────────────────────────────────────────── │
│ 📧 이메일 변경                                       >  │
│ 🔒 비밀번호 변경                                     >  │
│ 📱 연락처 변경                                       >  │
├─────────────────────────────────────────────────────────┤
│ 앱 정보                                                  │
│ ─────────────────────────────────────────────────────── │
│ 📄 이용약관                                          >  │
│ 🔐 개인정보처리방침                                  >  │
│ 📋 오픈소스 라이선스                                 >  │
│ ℹ️  앱 버전                                    v1.0.0   │
├─────────────────────────────────────────────────────────┤
│ 🗑️ 캐시 삭제                                         >  │
│ 🚪 로그아웃                                          >  │
│ ⚠️ 회원 탈퇴                                         >  │
└─────────────────────────────────────────────────────────┘
```

---

## 요약

### UI/UX 구현 현황

| 항목 | 상태 | 상세 |
|------|:----:|------|
| UI 컴포넌트 | ✅ | 48개 기본 컴포넌트 |
| 기능 컴포넌트 | ✅ | 144개 (구인자 62개 포함) |
| 다크모드 | ✅ | NativeWind + Zustand persist |
| Toast/Modal | ✅ | Reanimated 애니메이션 |
| 접근성 | ✅ | 44px 터치타겟, 라벨 자동생성 |
| 애니메이션 | ✅ | react-native-reanimated 4.1 |
| 에러 처리 | ✅ | 5가지 ErrorBoundary |
| 스켈레톤 로딩 | ✅ | shimmer + 10+ 프리셋 |

### 체크리스트

#### 전반적인 UX
- [x] 최소 44px 터치 타겟
- [x] 즉각적인 피드백 (Toast, 애니메이션)
- [x] 로딩 상태 (Skeleton, LoadingOverlay)
- [x] 빈 상태 (EmptyState 3가지)
- [x] 에러 상태 (ErrorBoundary 5가지)
- [x] 접근성 라벨 자동/수동 설정
- [x] 다크모드 완벽 지원
- [x] 일관된 애니메이션 (300ms 기본)

#### 회원가입
- [x] 4단계 마법사 플로우
- [x] 휴대폰 본인인증 필수 (PASS/카카오)
- [x] 단계별 진행 표시 (StepIndicator)
- [x] 비밀번호 강도 표시
- [x] 실시간 유효성 검증

#### 로그인
- [x] 자동 로그인 옵션
- [x] 소셜 로그인 (Apple, Google)
- [x] 비밀번호 표시/숨기기
- [x] 에러 메시지 표시
- [x] 생체인증 지원 (BiometricButton)

---

*마지막 업데이트: 2026-02-02*
*모바일앱 버전: v1.0.0*
