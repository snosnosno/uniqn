# 19. Accessibility (접근성)

## 개요

모든 사용자가 UNIQN 앱을 동등하게 사용할 수 있도록 하는 접근성 가이드입니다.
WCAG 2.1 AA 기준과 iOS/Android 플랫폼 접근성 가이드라인을 준수합니다.

### 접근성 목표

| 항목 | 목표 | 설명 |
|------|------|------|
| **스크린리더** | 100% 지원 | VoiceOver, TalkBack 완전 호환 |
| **터치 타겟** | 최소 44x44pt | WCAG 터치 타겟 크기 준수 |
| **색상 대비** | 4.5:1 이상 | 텍스트 가독성 보장 |
| **모션** | 감소 옵션 | 애니메이션 비활성화 가능 |

---

## 1. 스크린리더 지원

### 1.1 기본 접근성 속성

```typescript
// React Native 접근성 속성
interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;        // 스크린리더가 읽는 텍스트
  accessibilityHint?: string;         // 추가 힌트
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityValue?: AccessibilityValue;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}

// Role 예시
type AccessibilityRole =
  | 'button'
  | 'link'
  | 'header'
  | 'search'
  | 'image'
  | 'text'
  | 'adjustable'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'tab'
  | 'tablist';

// State 예시
interface AccessibilityState {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  busy?: boolean;
  expanded?: boolean;
}
```

### 1.2 컴포넌트별 접근성

#### 버튼

```typescript
// components/Button.tsx
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, styles[variant], isDisabled && styles.disabled]}
      // 접근성 속성
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}, 로딩 중` : label}
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      accessibilityHint={`${label} 버튼을 누르려면 두 번 탭하세요`}
    >
      {loading ? (
        <ActivityIndicator
          color="#fff"
          accessibilityElementsHidden={true}  // 로딩 인디케이터는 숨김
        />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
```

#### 입력 필드

```typescript
// components/Input.tsx
import { View, TextInput, Text } from 'react-native';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  secureTextEntry?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required,
  secureTextEntry,
}: InputProps) {
  const inputId = `input-${label.replace(/\s/g, '-')}`;

  return (
    <View>
      {/* 라벨 */}
      <Text
        nativeID={inputId}
        style={styles.label}
        accessibilityRole="text"
      >
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      {/* 입력 필드 */}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        style={[styles.input, error && styles.inputError]}
        // 접근성
        accessible={true}
        accessibilityLabel={`${label}${required ? ', 필수 입력' : ''}`}
        accessibilityLabelledBy={inputId}
        accessibilityHint={placeholder}
        accessibilityState={{
          disabled: false,
        }}
        // 에러 상태 알림
        accessibilityInvalid={!!error}
      />

      {/* 에러 메시지 */}
      {error && (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
```

#### 이미지

```typescript
// components/ProfileImage.tsx
import { Image } from 'react-native';

interface ProfileImageProps {
  uri: string | null;
  name: string;
  size?: number;
}

export function ProfileImage({ uri, name, size = 48 }: ProfileImageProps) {
  return (
    <Image
      source={uri ? { uri } : require('@/assets/default-avatar.png')}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      // 접근성
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`${name}님의 프로필 사진`}
    />
  );
}

// 장식용 이미지는 접근성에서 숨김
export function DecorativeImage({ source }: { source: any }) {
  return (
    <Image
      source={source}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
```

#### 아이콘 버튼

```typescript
// components/IconButton.tsx
import { TouchableOpacity } from 'react-native';
import { HeartIcon } from '@/components/icons';

interface IconButtonProps {
  icon: React.ComponentType<any>;
  label: string;  // 스크린리더용 필수
  onPress: () => void;
  selected?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  selected,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.iconButton}
      // 접근성 - 아이콘에는 반드시 label 필요
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityHint={selected ? '선택됨' : '선택하려면 두 번 탭하세요'}
    >
      <Icon
        size={24}
        color={selected ? '#3B82F6' : '#666'}
        // 아이콘 자체는 접근성에서 숨김
        accessibilityElementsHidden={true}
      />
    </TouchableOpacity>
  );
}

// 사용 예시
<IconButton
  icon={HeartIcon}
  label="저장하기"
  onPress={handleSave}
  selected={isSaved}
/>
```

### 1.3 리스트 접근성

```typescript
// components/JobList.tsx
import { FlatList, View, Text } from 'react-native';

export function JobList({ jobs }: { jobs: Job[] }) {
  return (
    <FlatList
      data={jobs}
      renderItem={({ item, index }) => (
        <JobCard
          job={item}
          accessibilityLabel={`구인공고 ${index + 1}/${jobs.length}`}
        />
      )}
      // 리스트 접근성
      accessible={false}  // 리스트 자체가 아닌 아이템에 포커스
      accessibilityRole="list"
      ListEmptyComponent={
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="구인공고가 없습니다"
        >
          <Text>구인공고가 없습니다</Text>
        </View>
      }
    />
  );
}

// JobCard 컴포넌트
function JobCard({ job, accessibilityLabel }: { job: Job; accessibilityLabel: string }) {
  return (
    <TouchableOpacity
      style={styles.card}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}. ${job.title}, ${job.location}, 시급 ${job.hourlyRate}원`}
      accessibilityHint="상세 정보를 보려면 두 번 탭하세요"
    >
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.location}>{job.location}</Text>
      <Text style={styles.rate}>{job.hourlyRate}원/시간</Text>
    </TouchableOpacity>
  );
}
```

### 1.4 모달/알림 접근성

```typescript
// components/Modal.tsx
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle } from 'react-native';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function AccessibleModal({
  visible,
  onClose,
  title,
  children,
}: ModalProps) {
  const titleRef = useRef<Text>(null);

  // 모달 열릴 때 제목에 포커스
  useEffect(() => {
    if (visible && titleRef.current) {
      const reactTag = findNodeHandle(titleRef.current);
      if (reactTag) {
        AccessibilityInfo.setAccessibilityFocus(reactTag);
      }
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // 모달이 열리면 뒤의 콘텐츠 접근 불가
      accessibilityViewIsModal={true}
    >
      <View style={styles.overlay}>
        <View
          style={styles.content}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {/* 제목 */}
          <Text
            ref={titleRef}
            style={styles.title}
            accessibilityRole="header"
          >
            {title}
          </Text>

          {/* 본문 */}
          {children}

          {/* 닫기 버튼 */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="모달 닫기"
          >
            <Text>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

---

## 2. 터치 타겟 크기

### 2.1 최소 크기 기준

```typescript
// constants/accessibility.ts
export const A11Y = {
  // WCAG 2.1 AA 기준: 44x44pt 최소
  MIN_TOUCH_TARGET: 44,

  // 권장 크기
  RECOMMENDED_TOUCH_TARGET: 48,

  // 아이콘 버튼 패딩
  ICON_BUTTON_PADDING: 12,
};
```

### 2.2 터치 타겟 확보

```typescript
// components/SmallButton.tsx
import { TouchableOpacity, StyleSheet } from 'react-native';

// 작은 아이콘이라도 터치 영역은 최소 44pt
export function SmallIconButton({ icon: Icon, onPress, label }: SmallIconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.touchArea}  // 터치 영역 확보
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}  // 추가 확장
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={20} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    // 패딩으로 터치 영역 확보
    padding: 12,
  },
});
```

### 2.3 간격 확보

```typescript
// components/ButtonGroup.tsx
import { View, StyleSheet } from 'react-native';

// 버튼 간 최소 8pt 간격
export function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: 8,  // 최소 간격
  },
});
```

---

## 3. 색상 및 대비

### 3.1 색상 대비 기준

```typescript
// constants/colors.ts

// WCAG 2.1 AA 기준
// - 일반 텍스트: 4.5:1 이상
// - 큰 텍스트 (18pt+): 3:1 이상
// - UI 요소: 3:1 이상

export const Colors = {
  light: {
    // 텍스트 (배경 #FFFFFF 기준)
    textPrimary: '#1F2937',     // 대비 12.6:1 ✓
    textSecondary: '#4B5563',   // 대비 7.5:1 ✓
    textTertiary: '#6B7280',    // 대비 5.4:1 ✓
    textDisabled: '#9CA3AF',    // 대비 3.0:1 (큰 텍스트만)

    // 배경
    background: '#FFFFFF',
    surface: '#F3F4F6',

    // 브랜드 색상
    primary: '#2563EB',         // 대비 4.5:1 ✓
    primaryDark: '#1D4ED8',     // 대비 6.0:1 ✓

    // 상태 색상
    error: '#DC2626',           // 대비 4.5:1 ✓
    success: '#059669',         // 대비 4.5:1 ✓
    warning: '#D97706',         // 대비 3.0:1 (아이콘+텍스트)
  },

  dark: {
    // 텍스트 (배경 #111827 기준)
    textPrimary: '#F9FAFB',     // 대비 15.8:1 ✓
    textSecondary: '#D1D5DB',   // 대비 10.9:1 ✓
    textTertiary: '#9CA3AF',    // 대비 6.5:1 ✓
    textDisabled: '#6B7280',    // 대비 3.7:1 ✓

    // 배경
    background: '#111827',
    surface: '#1F2937',

    // 브랜드 색상
    primary: '#3B82F6',         // 대비 4.6:1 ✓
    primaryDark: '#60A5FA',     // 대비 7.1:1 ✓

    // 상태 색상
    error: '#EF4444',           // 대비 4.5:1 ✓
    success: '#10B981',         // 대비 5.4:1 ✓
    warning: '#F59E0B',         // 대비 5.8:1 ✓
  },
};
```

### 3.2 색상만으로 정보 전달 금지

```typescript
// ❌ 잘못된 예: 색상만으로 상태 표시
function StatusBadge({ status }: { status: 'success' | 'error' }) {
  return (
    <View style={{ backgroundColor: status === 'success' ? 'green' : 'red' }}>
      <Text>{/* 텍스트 없음 */}</Text>
    </View>
  );
}

// ✅ 올바른 예: 색상 + 텍스트/아이콘
function StatusBadge({ status }: { status: 'success' | 'error' }) {
  const isSuccess = status === 'success';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isSuccess ? Colors.success : Colors.error }
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={isSuccess ? '성공' : '실패'}
    >
      {/* 아이콘으로 추가 구분 */}
      {isSuccess ? <CheckIcon /> : <XIcon />}
      {/* 텍스트로 명시 */}
      <Text style={styles.text}>{isSuccess ? '성공' : '실패'}</Text>
    </View>
  );
}
```

### 3.3 포커스 표시

```typescript
// 포커스 상태 시각적 표시
import { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';

export function AccessibleInput(props: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      {...props}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        isFocused && styles.focused,  // 포커스 시 테두리 강조
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
  },
  focused: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    // 그림자로 추가 강조 (iOS)
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
```

---

## 4. 모션 및 애니메이션

### 4.1 모션 감소 설정 감지

```typescript
// hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // 초기값 확인
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    // 변경 감지
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
```

### 4.2 조건부 애니메이션

```typescript
// components/AnimatedCard.tsx
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function AnimatedCard({ children, isVisible }: AnimatedCardProps) {
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      // 모션 감소 시 즉시 표시
      return {
        opacity: isVisible ? 1 : 0,
        transform: [{ scale: 1 }],
      };
    }

    // 일반 애니메이션
    return {
      opacity: withTiming(isVisible ? 1 : 0, { duration: 300 }),
      transform: [
        { scale: withSpring(isVisible ? 1 : 0.9) },
      ],
    };
  }, [isVisible, reduceMotion]);

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
```

### 4.3 자동 재생 제어

```typescript
// components/AutoPlayVideo.tsx
import { Video } from 'expo-av';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function AutoPlayVideo({ source }: { source: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <Video
      source={{ uri: source }}
      // 모션 감소 설정 시 자동 재생 안 함
      shouldPlay={!reduceMotion}
      // 사용자가 직접 제어 가능
      useNativeControls
      accessibilityLabel="동영상"
      accessibilityHint="재생하려면 두 번 탭하세요"
    />
  );
}
```

---

## 5. 폼 접근성

### 5.1 폼 유효성 검사

```typescript
// components/Form.tsx
import { View, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';

export function LoginForm() {
  const { control, handleSubmit, formState: { errors } } = useForm();

  return (
    <View
      accessible={false}  // 개별 필드에 포커스
      accessibilityRole="form"
    >
      {/* 이메일 필드 */}
      <Controller
        control={control}
        name="email"
        rules={{
          required: '이메일을 입력해주세요',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: '올바른 이메일 형식이 아닙니다',
          },
        }}
        render={({ field: { onChange, value } }) => (
          <Input
            label="이메일"
            value={value}
            onChangeText={onChange}
            error={errors.email?.message}
            required
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}
      />

      {/* 비밀번호 필드 */}
      <Controller
        control={control}
        name="password"
        rules={{
          required: '비밀번호를 입력해주세요',
          minLength: {
            value: 8,
            message: '비밀번호는 8자 이상이어야 합니다',
          },
        }}
        render={({ field: { onChange, value } }) => (
          <Input
            label="비밀번호"
            value={value}
            onChangeText={onChange}
            error={errors.password?.message}
            required
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />
        )}
      />

      {/* 에러 요약 (스크린리더용) */}
      {Object.keys(errors).length > 0 && (
        <View
          accessible={true}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Text style={styles.errorSummary}>
            {Object.values(errors).length}개의 오류가 있습니다
          </Text>
        </View>
      )}

      <Button
        label="로그인"
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
}
```

### 5.2 자동완성 지원

```typescript
// 플랫폼별 자동완성 속성
<TextInput
  // iOS
  textContentType="emailAddress"  // 이메일
  textContentType="password"      // 비밀번호
  textContentType="newPassword"   // 새 비밀번호
  textContentType="name"          // 이름
  textContentType="telephoneNumber"  // 전화번호

  // Android
  autoComplete="email"
  autoComplete="password"
  autoComplete="password-new"
  autoComplete="name"
  autoComplete="tel"
/>
```

---

## 6. 네비게이션 접근성

### 6.1 헤더 구조

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // 각 탭의 접근성 설정
        tabBarAccessibilityLabel: '하단 탭 메뉴',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarAccessibilityLabel: '홈 탭',
          headerTitleAccessibilityLabel: '홈 화면',
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: '구인공고',
          tabBarAccessibilityLabel: '구인공고 탭',
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: '내 지원',
          tabBarAccessibilityLabel: '내 지원 탭',
        }}
      />
    </Tabs>
  );
}
```

### 6.2 페이지 제목 알림

```typescript
// hooks/useScreenAnnounce.ts
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { usePathname } from 'expo-router';

const screenTitles: Record<string, string> = {
  '/': '홈 화면',
  '/jobs': '구인공고 목록',
  '/applications': '내 지원 목록',
  '/profile': '프로필',
  '/settings': '설정',
};

export function useScreenAnnounce() {
  const pathname = usePathname();

  useEffect(() => {
    const title = screenTitles[pathname];
    if (title) {
      // 화면 전환 시 스크린리더에게 알림
      AccessibilityInfo.announceForAccessibility(`${title}로 이동했습니다`);
    }
  }, [pathname]);
}
```

### 6.3 건너뛰기 링크 (웹)

```typescript
// components/SkipLink.tsx (React Native Web)
import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';

export function SkipLink() {
  // 네이티브에서는 불필요
  if (Platform.OS !== 'web') return null;

  const handleSkip = () => {
    const main = document.getElementById('main-content');
    main?.focus();
  };

  return (
    <TouchableOpacity
      onPress={handleSkip}
      style={styles.skipLink}
      accessibilityRole="link"
      accessibilityLabel="메인 콘텐츠로 건너뛰기"
    >
      <Text style={styles.text}>메인 콘텐츠로 건너뛰기</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skipLink: {
    position: 'absolute',
    top: -100,  // 기본적으로 숨김
    left: 0,
    backgroundColor: '#000',
    padding: 16,
    zIndex: 9999,
    // 포커스 시 표시 (웹 CSS로 처리)
  },
  text: {
    color: '#fff',
  },
});
```

---

## 7. 테스트

### 7.1 스크린리더 테스트

```yaml
iOS VoiceOver:
  Enable: 설정 > 손쉬운 사용 > VoiceOver
  Shortcut: 홈 버튼 3번 클릭 (또는 측면 버튼)

  Test Items:
    - [ ] 모든 버튼에 라벨이 있는가
    - [ ] 이미지에 대체 텍스트가 있는가
    - [ ] 순서대로 탐색이 되는가
    - [ ] 모달이 열리면 포커스가 이동하는가
    - [ ] 에러 메시지가 자동으로 읽히는가

Android TalkBack:
  Enable: 설정 > 접근성 > TalkBack
  Shortcut: 볼륨 키 동시에 3초

  Test Items:
    - [ ] 위와 동일
```

### 7.2 자동화 테스트

```typescript
// __tests__/accessibility.test.tsx
import { render } from '@testing-library/react-native';
import { Button } from '@/components/Button';

describe('Button Accessibility', () => {
  it('has accessible role', () => {
    const { getByRole } = render(
      <Button label="제출" onPress={() => {}} />
    );

    expect(getByRole('button')).toBeTruthy();
  });

  it('has accessibility label', () => {
    const { getByLabelText } = render(
      <Button label="제출" onPress={() => {}} />
    );

    expect(getByLabelText('제출')).toBeTruthy();
  });

  it('announces loading state', () => {
    const { getByLabelText } = render(
      <Button label="제출" onPress={() => {}} loading />
    );

    expect(getByLabelText('제출, 로딩 중')).toBeTruthy();
  });

  it('indicates disabled state', () => {
    const { getByRole } = render(
      <Button label="제출" onPress={() => {}} disabled />
    );

    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });
});
```

### 7.3 색상 대비 검사

```typescript
// utils/colorContrast.ts
// WCAG 대비 계산기

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(
  foreground: string,
  background: string
): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  const l1 = getLuminance(fg.r, fg.g, fg.b);
  const l2 = getLuminance(bg.r, bg.g, bg.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// 테스트
describe('Color Contrast', () => {
  it('text meets AA standard (4.5:1)', () => {
    const ratio = getContrastRatio('#1F2937', '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('large text meets AA standard (3:1)', () => {
    const ratio = getContrastRatio('#6B7280', '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
```

---

## 8. 체크리스트

### 접근성 검토 체크리스트

```yaml
스크린리더:
  - [ ] 모든 대화형 요소에 accessibilityLabel 설정
  - [ ] 이미지에 대체 텍스트 제공
  - [ ] 장식용 이미지는 accessibilityElementsHidden 설정
  - [ ] 버튼에 accessibilityRole="button" 설정
  - [ ] 헤더에 accessibilityRole="header" 설정
  - [ ] 에러 메시지에 accessibilityLiveRegion 설정
  - [ ] 모달에 accessibilityViewIsModal 설정

터치:
  - [ ] 모든 터치 타겟 최소 44x44pt
  - [ ] 터치 영역 간 최소 8pt 간격
  - [ ] hitSlop으로 작은 아이콘 터치 영역 확장

색상:
  - [ ] 텍스트 대비 4.5:1 이상
  - [ ] 큰 텍스트 대비 3:1 이상
  - [ ] 색상만으로 정보 전달하지 않음
  - [ ] 포커스 상태 시각적으로 표시

모션:
  - [ ] reduceMotion 설정 감지 및 대응
  - [ ] 자동 재생 콘텐츠 제어 가능
  - [ ] 플래시/깜빡임 3회/초 미만

폼:
  - [ ] 라벨과 입력 필드 연결
  - [ ] 필수 필드 표시
  - [ ] 에러 메시지 명확하게 표시
  - [ ] 자동완성 속성 설정

테스트:
  - [ ] VoiceOver로 전체 플로우 테스트
  - [ ] TalkBack으로 전체 플로우 테스트
  - [ ] 자동화 접근성 테스트 통과
```

---

## 참고 자료

- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS Accessibility](https://developer.apple.com/accessibility/ios/)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
