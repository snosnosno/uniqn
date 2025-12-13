# 11. UI/UX 가이드라인

## 목차
1. [디자인 원칙](#1-디자인-원칙)
2. [회원가입 UX](#2-회원가입-ux)
3. [로그인 UX](#3-로그인-ux)
4. [설정 화면 UX](#4-설정-화면-ux)
5. [폼 디자인 패턴](#5-폼-디자인-패턴)
6. [피드백 시스템](#6-피드백-시스템)
7. [네비게이션 패턴](#7-네비게이션-패턴)
8. [접근성](#8-접근성)
9. [모션 & 애니메이션](#9-모션--애니메이션)
10. [다크모드](#10-다크모드)

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
// src/constants/typography.ts
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

// src/constants/spacing.ts
export const Spacing = {
  xs: 4,   // 4px  - 아이콘 내부
  sm: 8,   // 8px  - 요소 내부
  md: 16,  // 16px - 기본 간격
  lg: 24,  // 24px - 섹션 간격
  xl: 32,  // 32px - 화면 패딩
  xxl: 48, // 48px - 대형 간격
};
```

### 터치 타겟 가이드라인

```typescript
// 최소 터치 영역: 44x44 pt (Apple HIG) / 48x48 dp (Material)
export const TouchTargets = {
  /** 최소 터치 영역 */
  minimum: 44,

  /** 권장 버튼 높이 */
  button: 48,

  /** 리스트 아이템 높이 */
  listItem: 56,

  /** 탭바 아이템 */
  tabBarItem: 64,

  /** 아이콘 버튼 */
  iconButton: 44,
};

// 사용 예
<Pressable
  className="min-h-[44px] min-w-[44px] items-center justify-center"
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Icon />
</Pressable>
```

---

## 2. 회원가입 UX

### 3단계 마법사 플로우

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Sign Up Flow (3 Steps)                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Step 1: 계정 정보        Step 2: 프로필        Step 3: 완료          │
│   ┌─────────────────┐     ┌─────────────────┐   ┌─────────────────┐    │
│   │ [●]───[○]───[○] │     │ [✓]───[●]───[○] │   │ [✓]───[✓]───[●] │    │
│   │                 │     │                 │   │                 │    │
│   │ 이메일          │     │ 이름            │   │    🎉           │    │
│   │ ┌─────────────┐ │     │ ┌─────────────┐ │   │  가입 완료!     │    │
│   │ │             │ │     │ │             │ │   │                 │    │
│   │ └─────────────┘ │     │ └─────────────┘ │   │  로그인 하기    │    │
│   │                 │     │                 │   │  ┌───────────┐  │    │
│   │ 비밀번호        │     │ 전화번호        │   │  │           │  │    │
│   │ ┌─────────────┐ │     │ ┌─────────────┐ │   │  └───────────┘  │    │
│   │ │ ●●●●●●●●    │ │     │ │010-    -    │ │   │                 │    │
│   │ └─────────────┘ │     │ └─────────────┘ │   │                 │    │
│   │                 │     │                 │   │                 │    │
│   │ 비밀번호 확인   │     │ 역할 선택       │   │                 │    │
│   │ ┌─────────────┐ │     │ ○ 스태프       │   │                 │    │
│   │ │ ●●●●●●●●    │ │     │ ○ 구인자       │   │                 │    │
│   │ └─────────────┘ │     │                 │   │                 │    │
│   │                 │     │                 │   │                 │    │
│   │    [  다음  ]   │     │    [  다음  ]   │   │                 │    │
│   └─────────────────┘     └─────────────────┘   └─────────────────┘    │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 회원가입 화면 구현

```typescript
// src/app/(auth)/signup/index.tsx
import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { StepIndicator } from '@/components/signup/StepIndicator';
import { AccountStep } from '@/components/signup/AccountStep';
import { ProfileStep } from '@/components/signup/ProfileStep';
import { CompleteStep } from '@/components/signup/CompleteStep';
import { signupSchema, SignupFormData } from '@/schemas/signup';

const STEPS = ['계정 정보', '프로필', '완료'];

export default function SignupScreen() {
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      phone: '',
      role: undefined,
    },
  });

  const goNext = () => setCurrentStep((prev) => Math.min(prev + 1, 2));
  const goBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <AccountStep form={form} onNext={goNext} />;
      case 1:
        return <ProfileStep form={form} onNext={goNext} onBack={goBack} />;
      case 2:
        return <CompleteStep />;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      {/* 상단 헤더 */}
      <View className="px-6 pt-4">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={currentStep}
        />
      </View>

      {/* 스텝 컨텐츠 */}
      <Animated.View
        key={currentStep}
        entering={FadeInRight.duration(300)}
        exiting={FadeOutLeft.duration(200)}
        className="flex-1 px-6 pt-8"
      >
        {renderStep()}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
```

### 스텝 인디케이터

```typescript
// src/components/signup/StepIndicator.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { CheckIcon } from '@heroicons/react/24/solid';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps: number;
}

export function StepIndicator({ steps, currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <View className="flex-row items-center justify-center">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          {/* 스텝 원 */}
          <View className="items-center">
            <View
              className={`
                w-8 h-8 rounded-full items-center justify-center
                ${index < completedSteps
                  ? 'bg-green-500'
                  : index === currentStep
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }
              `}
            >
              {index < completedSteps ? (
                <CheckIcon width={16} height={16} color="white" />
              ) : (
                <Text
                  className={`
                    text-sm font-bold
                    ${index === currentStep ? 'text-white' : 'text-gray-500'}
                  `}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              className={`
                text-xs mt-1
                ${index === currentStep
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}
            >
              {step}
            </Text>
          </View>

          {/* 연결선 */}
          {index < steps.length - 1 && (
            <View
              className={`
                flex-1 h-0.5 mx-2 mt-[-16px]
                ${index < completedSteps
                  ? 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-700'
                }
              `}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}
```

### 계정 정보 스텝

```typescript
// src/components/signup/AccountStep.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/form/FormField';
import { PasswordStrength } from '@/components/form/PasswordStrength';
import { Button } from '@/components/ui/Button';

interface AccountStepProps {
  form: UseFormReturn<SignupFormData>;
  onNext: () => void;
}

export function AccountStep({ form, onNext }: AccountStepProps) {
  const { control, watch, trigger } = form;
  const password = watch('password');

  const handleNext = async () => {
    const isValid = await trigger(['email', 'password', 'confirmPassword']);
    if (isValid) onNext();
  };

  return (
    <View className="flex-1">
      {/* 제목 */}
      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        계정 만들기
      </Text>
      <Text className="text-gray-600 dark:text-gray-400 mb-8">
        이메일과 비밀번호를 입력해주세요
      </Text>

      {/* 이메일 */}
      <FormField
        name="email"
        control={control}
        label="이메일"
        placeholder="example@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      {/* 비밀번호 */}
      <FormField
        name="password"
        control={control}
        label="비밀번호"
        placeholder="8자 이상 입력해주세요"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {/* 비밀번호 강도 표시 */}
      {password && <PasswordStrength password={password} />}

      {/* 비밀번호 확인 */}
      <FormField
        name="confirmPassword"
        control={control}
        label="비밀번호 확인"
        placeholder="비밀번호를 다시 입력해주세요"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {/* 다음 버튼 */}
      <View className="mt-auto pb-8">
        <Button onPress={handleNext} size="lg" fullWidth>
          다음
        </Button>

        {/* 로그인 링크 */}
        <View className="flex-row justify-center mt-4">
          <Text className="text-gray-600 dark:text-gray-400">
            이미 계정이 있으신가요?{' '}
          </Text>
          <Link href="/login" className="text-blue-600 dark:text-blue-400 font-medium">
            로그인
          </Link>
        </View>
      </View>
    </View>
  );
}
```

### 비밀번호 강도 표시

```typescript
// src/components/form/PasswordStrength.tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    return Math.min(score, 4);
  }, [password]);

  const getStrengthConfig = () => {
    const configs = [
      { label: '매우 약함', color: 'bg-red-500', textColor: 'text-red-500' },
      { label: '약함', color: 'bg-orange-500', textColor: 'text-orange-500' },
      { label: '보통', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
      { label: '강함', color: 'bg-green-500', textColor: 'text-green-500' },
      { label: '매우 강함', color: 'bg-green-600', textColor: 'text-green-600' },
    ];
    return configs[strength];
  };

  const config = getStrengthConfig();

  return (
    <View className="mb-4">
      {/* 강도 바 */}
      <View className="flex-row gap-1 mb-1">
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            className={`
              flex-1 h-1 rounded-full
              ${index < strength ? config.color : 'bg-gray-200 dark:bg-gray-700'}
            `}
          />
        ))}
      </View>

      {/* 강도 텍스트 */}
      <Text className={`text-xs ${config.textColor}`}>
        비밀번호 강도: {config.label}
      </Text>
    </View>
  );
}
```

---

## 3. 로그인 UX

### 로그인 화면 플로우

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Login Screen                                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │                                                         │        │
│     │                      로고                               │        │
│     │                     UNIQN                               │        │
│     │                                                         │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│     이메일                                                              │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │ 📧 example@email.com                            [저장됨]│        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│     비밀번호                                                            │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │ 🔒 ●●●●●●●●                                        👁   │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│     ☑ 자동 로그인                          비밀번호를 잊으셨나요?       │
│                                                                         │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │                      로그인                             │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│     ────────────────── 또는 ──────────────────                         │
│                                                                         │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  🍎  Apple로 계속하기                                   │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  G  Google로 계속하기                                   │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│              계정이 없으신가요? 회원가입                                │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 로그인 화면 구현

```typescript
// src/app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Divider } from '@/components/ui/Divider';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, isLoading, error } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    await signIn(data.email, data.password, rememberMe);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerClassName="flex-grow px-6 pt-12 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* 로고 */}
        <Animated.View
          entering={FadeIn.delay(100).duration(500)}
          className="items-center mb-12"
        >
          <Logo width={120} height={40} />
          <Text className="text-gray-600 dark:text-gray-400 mt-2">
            홀덤 스태프 매칭 플랫폼
          </Text>
        </Animated.View>

        {/* 로그인 폼 */}
        <Animated.View entering={FadeIn.delay(200).duration(500)}>
          {/* 에러 메시지 */}
          {error && (
            <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">
              <Text className="text-red-600 dark:text-red-400 text-center">
                {error}
              </Text>
            </View>
          )}

          <FormField
            name="email"
            control={form.control}
            label="이메일"
            placeholder="이메일을 입력해주세요"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            leftIcon={<EnvelopeIcon width={20} color="#9CA3AF" />}
          />

          <FormField
            name="password"
            control={form.control}
            label="비밀번호"
            placeholder="비밀번호를 입력해주세요"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            leftIcon={<LockClosedIcon width={20} color="#9CA3AF" />}
            showPasswordToggle
          />

          {/* 자동 로그인 & 비밀번호 찾기 */}
          <View className="flex-row justify-between items-center mb-6">
            <Checkbox
              checked={rememberMe}
              onChange={setRememberMe}
              label="자동 로그인"
            />
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 dark:text-blue-400"
            >
              비밀번호를 잊으셨나요?
            </Link>
          </View>

          {/* 로그인 버튼 */}
          <Button
            onPress={form.handleSubmit(onSubmit)}
            loading={isLoading}
            size="lg"
            fullWidth
          >
            로그인
          </Button>
        </Animated.View>

        {/* 소셜 로그인 */}
        <Animated.View entering={FadeIn.delay(300).duration(500)}>
          <Divider text="또는" className="my-6" />
          <SocialLoginButtons />
        </Animated.View>

        {/* 회원가입 링크 */}
        <Animated.View
          entering={FadeIn.delay(400).duration(500)}
          className="mt-auto pt-8"
        >
          <View className="flex-row justify-center">
            <Text className="text-gray-600 dark:text-gray-400">
              계정이 없으신가요?{' '}
            </Text>
            <Link
              href="/signup"
              className="text-blue-600 dark:text-blue-400 font-medium"
            >
              회원가입
            </Link>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

### 소셜 로그인 버튼

```typescript
// src/components/auth/SocialLoginButtons.tsx
import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export function SocialLoginButtons() {
  const { signInWithApple, signInWithGoogle, isLoading } = useAuth();

  return (
    <View className="gap-3">
      {/* Apple 로그인 (iOS only) */}
      {Platform.OS === 'ios' && (
        <Pressable
          onPress={signInWithApple}
          disabled={isLoading}
          className="
            flex-row items-center justify-center
            bg-black dark:bg-white
            py-3 px-4 rounded-lg
            active:opacity-80
          "
        >
          <AppleIcon width={20} height={20} color={isDark ? 'black' : 'white'} />
          <Text className="text-white dark:text-black font-medium ml-2">
            Apple로 계속하기
          </Text>
        </Pressable>
      )}

      {/* Google 로그인 */}
      <Pressable
        onPress={signInWithGoogle}
        disabled={isLoading}
        className="
          flex-row items-center justify-center
          bg-white dark:bg-gray-800
          border border-gray-300 dark:border-gray-600
          py-3 px-4 rounded-lg
          active:bg-gray-50 dark:active:bg-gray-700
        "
      >
        <GoogleIcon width={20} height={20} />
        <Text className="text-gray-900 dark:text-white font-medium ml-2">
          Google로 계속하기
        </Text>
      </Pressable>
    </View>
  );
}
```

---

## 4. 설정 화면 UX

### 설정 화면 구조

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Settings Screen                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👤 프로필                                                       │   │
│  │  ────────────────────────────────────────────────────────────── │   │
│  │  🔔 알림 설정                                              >    │   │
│  │  🌙 다크모드                                          [Switch]  │   │
│  │  🌐 언어                                               한국어 > │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  계정                                                            │   │
│  │  ────────────────────────────────────────────────────────────── │   │
│  │  📧 이메일 변경                                             >    │   │
│  │  🔒 비밀번호 변경                                           >    │   │
│  │  📱 연락처 변경                                             >    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  앱 정보                                                         │   │
│  │  ────────────────────────────────────────────────────────────── │   │
│  │  📄 이용약관                                                >    │   │
│  │  🔐 개인정보처리방침                                        >    │   │
│  │  📋 오픈소스 라이선스                                       >    │   │
│  │  ℹ️  앱 버전                                         v1.0.0     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🗑️ 캐시 삭제                                               >    │   │
│  │  🚪 로그아웃                                                 >    │   │
│  │  ⚠️ 회원 탈퇴                                                >    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 설정 화면 구현

```typescript
// src/app/(app)/settings/index.tsx
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { router } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { useAppInfo } from '@/hooks/useAppInfo';

import { SettingSection } from '@/components/settings/SettingSection';
import { SettingRow } from '@/components/settings/SettingRow';
import { Switch } from '@/components/ui/Switch';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function SettingsScreen() {
  const { isDark, toggleTheme } = useThemeStore();
  const { signOut, deleteAccount } = useAuth();
  const { version } = useAppInfo();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    router.replace('/login');
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* 프로필 섹션 */}
      <SettingSection title="프로필">
        <SettingRow
          icon="bell"
          title="알림 설정"
          onPress={() => router.push('/settings/notifications')}
          showArrow
        />
        <SettingRow
          icon="moon"
          title="다크모드"
          rightElement={
            <Switch value={isDark} onValueChange={toggleTheme} />
          }
        />
        <SettingRow
          icon="globe"
          title="언어"
          value="한국어"
          onPress={() => router.push('/settings/language')}
          showArrow
        />
      </SettingSection>

      {/* 계정 섹션 */}
      <SettingSection title="계정">
        <SettingRow
          icon="envelope"
          title="이메일 변경"
          onPress={() => router.push('/settings/email')}
          showArrow
        />
        <SettingRow
          icon="lock"
          title="비밀번호 변경"
          onPress={() => router.push('/settings/password')}
          showArrow
        />
        <SettingRow
          icon="phone"
          title="연락처 변경"
          onPress={() => router.push('/settings/phone')}
          showArrow
        />
      </SettingSection>

      {/* 앱 정보 섹션 */}
      <SettingSection title="앱 정보">
        <SettingRow
          icon="document"
          title="이용약관"
          onPress={() => router.push('/settings/terms')}
          showArrow
        />
        <SettingRow
          icon="shield"
          title="개인정보처리방침"
          onPress={() => router.push('/settings/privacy')}
          showArrow
        />
        <SettingRow
          icon="code"
          title="오픈소스 라이선스"
          onPress={() => router.push('/settings/licenses')}
          showArrow
        />
        <SettingRow
          icon="info"
          title="앱 버전"
          value={`v${version}`}
        />
      </SettingSection>

      {/* 위험 영역 */}
      <SettingSection>
        <SettingRow
          icon="trash"
          title="캐시 삭제"
          onPress={handleClearCache}
        />
        <SettingRow
          icon="logout"
          title="로그아웃"
          onPress={() => setShowLogoutConfirm(true)}
          titleStyle="text-red-500"
        />
        <SettingRow
          icon="warning"
          title="회원 탈퇴"
          onPress={() => setShowDeleteConfirm(true)}
          titleStyle="text-red-500"
        />
      </SettingSection>

      {/* 로그아웃 확인 모달 */}
      <ConfirmModal
        visible={showLogoutConfirm}
        title="로그아웃"
        message="정말 로그아웃 하시겠습니까?"
        confirmText="로그아웃"
        confirmVariant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* 회원 탈퇴 확인 모달 */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="회원 탈퇴"
        message="탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다. 정말 탈퇴하시겠습니까?"
        confirmText="탈퇴하기"
        confirmVariant="danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </ScrollView>
  );
}
```

### 설정 행 컴포넌트

```typescript
// src/components/settings/SettingRow.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Icon } from '@/components/ui/Icon';

interface SettingRowProps {
  icon: string;
  title: string;
  value?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showArrow?: boolean;
  titleStyle?: string;
}

export function SettingRow({
  icon,
  title,
  value,
  rightElement,
  onPress,
  showArrow,
  titleStyle,
}: SettingRowProps) {
  const content = (
    <View className="flex-row items-center py-4 px-4">
      {/* 아이콘 */}
      <View className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 items-center justify-center mr-3">
        <Icon name={icon} size={18} color="#6B7280" />
      </View>

      {/* 제목 */}
      <Text
        className={`flex-1 text-base text-gray-900 dark:text-white ${titleStyle}`}
      >
        {title}
      </Text>

      {/* 우측 요소 */}
      {rightElement}

      {/* 값 또는 화살표 */}
      {value && (
        <Text className="text-gray-500 dark:text-gray-400 mr-2">
          {value}
        </Text>
      )}
      {showArrow && (
        <ChevronRightIcon width={20} height={20} color="#9CA3AF" />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="active:bg-gray-50 dark:active:bg-gray-800"
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
```

---

## 5. 폼 디자인 패턴

### 폼 필드 컴포넌트

```typescript
// src/components/form/FormField.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, TextInputProps } from 'react-native';
import { useController, Control } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

interface FormFieldProps extends TextInputProps {
  name: string;
  control: Control<any>;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export function FormField({
  name,
  control,
  label,
  helperText,
  leftIcon,
  rightIcon,
  showPasswordToggle,
  secureTextEntry,
  ...textInputProps
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    field: { value, onChange, onBlur },
    fieldState: { error, isTouched },
  } = useController({ name, control });

  const hasError = error && isTouched;
  const showSecure = secureTextEntry && !isPasswordVisible;

  return (
    <View className="mb-4">
      {/* 레이블 */}
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </Text>
      )}

      {/* 입력 필드 */}
      <Animated.View
        layout={Layout.springify()}
        className={`
          flex-row items-center
          px-4 py-3 rounded-lg
          border-2
          ${hasError
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : isFocused
              ? 'border-blue-500 bg-white dark:bg-gray-800'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }
        `}
      >
        {/* 왼쪽 아이콘 */}
        {leftIcon && <View className="mr-2">{leftIcon}</View>}

        {/* 텍스트 입력 */}
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur();
          }}
          onFocus={() => setIsFocused(true)}
          secureTextEntry={showSecure}
          className="flex-1 text-base text-gray-900 dark:text-white"
          placeholderTextColor="#9CA3AF"
          {...textInputProps}
        />

        {/* 비밀번호 토글 */}
        {showPasswordToggle && (
          <Pressable
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isPasswordVisible ? (
              <EyeSlashIcon width={20} height={20} color="#9CA3AF" />
            ) : (
              <EyeIcon width={20} height={20} color="#9CA3AF" />
            )}
          </Pressable>
        )}

        {/* 오른쪽 아이콘 */}
        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </Animated.View>

      {/* 에러 메시지 */}
      {hasError && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text className="text-sm text-red-500 mt-1.5">
            {error.message}
          </Text>
        </Animated.View>
      )}

      {/* 도움말 텍스트 */}
      {helperText && !hasError && (
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          {helperText}
        </Text>
      )}
    </View>
  );
}
```

### 선택 필드

```typescript
// src/components/form/SelectField.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { useController, Control } from 'react-hook-form';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

interface Option {
  label: string;
  value: string;
}

interface SelectFieldProps {
  name: string;
  control: Control<any>;
  label?: string;
  options: Option[];
  placeholder?: string;
}

export function SelectField({
  name,
  control,
  label,
  options,
  placeholder = '선택해주세요',
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    field: { value, onChange },
    fieldState: { error, isTouched },
  } = useController({ name, control });

  const selectedOption = options.find((opt) => opt.value === value);
  const hasError = error && isTouched;

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setIsOpen(true)}
        className={`
          flex-row items-center justify-between
          px-4 py-3 rounded-lg border-2
          ${hasError
            ? 'border-red-500'
            : 'border-gray-200 dark:border-gray-700'
          }
          bg-gray-50 dark:bg-gray-800
        `}
      >
        <Text
          className={`
            text-base
            ${selectedOption
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500'
            }
          `}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDownIcon width={20} height={20} color="#9CA3AF" />
      </Pressable>

      {hasError && (
        <Text className="text-sm text-red-500 mt-1.5">{error.message}</Text>
      )}

      {/* 선택 모달 */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 rounded-t-2xl max-h-[60%]">
            {/* 헤더 */}
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                {label || '선택'}
              </Text>
              <Pressable onPress={() => setIsOpen(false)}>
                <Text className="text-blue-600 dark:text-blue-400">완료</Text>
              </Pressable>
            </View>

            {/* 옵션 목록 */}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700"
                >
                  <Text className="text-base text-gray-900 dark:text-white">
                    {item.label}
                  </Text>
                  {value === item.value && (
                    <CheckIcon width={20} height={20} color="#3B82F6" />
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

---

## 6. 피드백 시스템

### 토스트 메시지

```typescript
// src/components/ui/Toast.tsx
import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';

import { ToastData, useToastStore } from '@/stores/toastStore';

interface ToastProps {
  toast: ToastData;
}

const TOAST_CONFIG = {
  success: {
    icon: CheckCircleIcon,
    bgColor: 'bg-green-500',
    iconColor: 'white',
  },
  error: {
    icon: XCircleIcon,
    bgColor: 'bg-red-500',
    iconColor: 'white',
  },
  warning: {
    icon: ExclamationCircleIcon,
    bgColor: 'bg-yellow-500',
    iconColor: 'white',
  },
  info: {
    icon: InformationCircleIcon,
    bgColor: 'bg-blue-500',
    iconColor: 'white',
  },
};

export function Toast({ toast }: ToastProps) {
  const { removeToast } = useToastStore();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    // 등장 애니메이션
    translateY.value = withTiming(0, { duration: 300 });
    opacity.value = withTiming(1, { duration: 300 });

    // 자동 닫기
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration || 3000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(removeToast)(toast.id);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={`
        mx-4 mb-2 p-4 rounded-xl
        flex-row items-center
        ${config.bgColor}
        shadow-lg
      `}
    >
      {/* 아이콘 */}
      <Icon width={24} height={24} color={config.iconColor} />

      {/* 메시지 */}
      <View className="flex-1 mx-3">
        <Text className="text-white font-medium">
          {toast.message}
        </Text>
      </View>

      {/* 액션 버튼 */}
      {toast.action && (
        <Pressable
          onPress={() => {
            toast.action?.onPress();
            handleDismiss();
          }}
          className="mr-2"
        >
          <Text className="text-white font-bold underline">
            {toast.action.label}
          </Text>
        </Pressable>
      )}

      {/* 닫기 버튼 */}
      <Pressable onPress={handleDismiss} hitSlop={10}>
        <XMarkIcon width={20} height={20} color="white" />
      </Pressable>
    </Animated.View>
  );
}

// 토스트 컨테이너
export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <View className="absolute top-0 left-0 right-0 z-50 pt-safe">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </View>
  );
}
```

### 로딩 상태

```typescript
// src/components/ui/LoadingOverlay.tsx
import React from 'react';
import { View, Text, ActivityIndicator, Modal } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal transparent visible={visible}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        className="flex-1 items-center justify-center bg-black/50"
      >
        <View className="bg-white dark:bg-gray-800 px-8 py-6 rounded-2xl items-center shadow-xl">
          <ActivityIndicator size="large" color="#4F46E5" />
          {message && (
            <Text className="text-gray-700 dark:text-gray-300 mt-4 text-center">
              {message}
            </Text>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

// 스켈레톤 로딩
export function Skeleton({ className }: { className?: string }) {
  return (
    <Animated.View
      entering={FadeIn}
      className={`bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    >
      <SkeletonAnimation />
    </Animated.View>
  );
}
```

### 빈 상태

```typescript
// src/components/ui/EmptyState.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      {/* 아이콘 */}
      {icon && (
        <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-4">
          {icon}
        </View>
      )}

      {/* 제목 */}
      <Text className="text-lg font-semibold text-gray-900 dark:text-white text-center">
        {title}
      </Text>

      {/* 설명 */}
      {description && (
        <Text className="text-gray-500 dark:text-gray-400 text-center mt-2 max-w-[280px]">
          {description}
        </Text>
      )}

      {/* 액션 버튼 */}
      {action && (
        <Button
          variant="outline"
          onPress={action.onPress}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </View>
  );
}
```

---

## 7. 네비게이션 패턴

### 헤더 스타일

```typescript
// src/constants/navigation.ts
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const defaultScreenOptions: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerTitleAlign: 'center',
  headerBackTitleVisible: false,
  headerTintColor: '#111827', // dark mode에서 자동 변경
  headerStyle: {
    backgroundColor: 'transparent',
  },
  headerTitleStyle: {
    fontSize: 17,
    fontWeight: '600',
  },
  animation: 'slide_from_right',
};

export const modalScreenOptions: NativeStackNavigationOptions = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
  headerShown: true,
  headerLeft: () => null,
  headerRight: () => <CloseButton />,
};
```

### 탭 네비게이션

```typescript
// src/app/(app)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import {
  HomeIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  CalendarIcon as CalendarIconSolid,
  UserIcon as UserIconSolid,
} from '@heroicons/react/24/solid';

export default function TabLayout() {
  const { isDark } = useThemeStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderTopColor: isDark ? '#374151' : '#E5E7EB',
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused, color }) =>
            focused ? (
              <HomeIconSolid width={24} height={24} color={color} />
            ) : (
              <HomeIcon width={24} height={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="job-board"
        options={{
          title: '구인구직',
          tabBarIcon: ({ focused, color }) =>
            focused ? (
              <MagnifyingGlassIconSolid width={24} height={24} color={color} />
            ) : (
              <MagnifyingGlassIcon width={24} height={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '내 스케줄',
          tabBarIcon: ({ focused, color }) =>
            focused ? (
              <CalendarIconSolid width={24} height={24} color={color} />
            ) : (
              <CalendarIcon width={24} height={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ focused, color }) =>
            focused ? (
              <UserIconSolid width={24} height={24} color={color} />
            ) : (
              <UserIcon width={24} height={24} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
```

---

## 8. 접근성

### 접근성 가이드라인

```typescript
// src/utils/accessibility.ts
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * 접근성 공지
 */
export function announceForAccessibility(message: string) {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(message);
  } else {
    // Android: 접근성 서비스가 활성화된 경우에만 동작
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (enabled) {
        AccessibilityInfo.announceForAccessibility(message);
      }
    });
  }
}

/**
 * 접근성 레이블 생성 헬퍼
 */
export function createAccessibilityLabel(parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(', ');
}

// 사용 예
<Pressable
  accessible
  accessibilityRole="button"
  accessibilityLabel={createAccessibilityLabel([
    job.title,
    job.location,
    `시급 ${job.hourlyRate}원`,
  ])}
  accessibilityHint="공고 상세 페이지로 이동합니다"
>
```

### 접근성 컴포넌트

```typescript
// src/components/ui/AccessibleButton.tsx
import React from 'react';
import { Pressable, PressableProps, Text } from 'react-native';

interface AccessibleButtonProps extends PressableProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function AccessibleButton({
  label,
  hint,
  children,
  disabled,
  ...props
}: AccessibleButtonProps) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      {...props}
    >
      {children}
    </Pressable>
  );
}

// 접근성 헤딩
export function AccessibleHeading({
  level,
  children,
  className,
}: {
  level: 1 | 2 | 3 | 4;
  children: string;
  className?: string;
}) {
  return (
    <Text
      accessible
      accessibilityRole="header"
      // iOS specific
      accessibilityLevel={level}
      className={className}
    >
      {children}
    </Text>
  );
}
```

---

## 9. 모션 & 애니메이션

### 애니메이션 가이드라인

```typescript
// src/constants/animation.ts
export const AnimationDuration = {
  instant: 100,    // 즉각적인 피드백
  fast: 200,       // 빠른 전환
  normal: 300,     // 일반 전환
  slow: 500,       // 강조된 전환
};

export const AnimationEasing = {
  // 기본 이징
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  // 들어오는 요소
  enter: Easing.bezier(0, 0, 0.2, 1),
  // 나가는 요소
  exit: Easing.bezier(0.4, 0, 1, 1),
  // 강조
  emphasis: Easing.bezier(0.4, 0, 0.6, 1),
};
```

### 애니메이션 프리셋

```typescript
// src/utils/animations.ts
import { FadeIn, FadeOut, SlideInRight, SlideOutLeft, ZoomIn, ZoomOut, withSpring, withTiming } from 'react-native-reanimated';

// 화면 전환
export const screenEntering = SlideInRight.duration(300);
export const screenExiting = SlideOutLeft.duration(200);

// 모달
export const modalEntering = FadeIn.duration(200).springify();
export const modalExiting = FadeOut.duration(150);

// 리스트 아이템
export const listItemEntering = FadeIn.delay(index * 50).duration(200);

// 버튼 프레스
export function usePressAnimation() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return { animatedStyle, onPressIn, onPressOut };
}

// Pull to Refresh 애니메이션
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const translateY = useSharedValue(0);
  const isRefreshing = useSharedValue(false);

  // ... 구현
}
```

---

## 10. 다크모드

### 테마 시스템

```typescript
// src/stores/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Appearance, ColorSchemeName } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDark: Appearance.getColorScheme() === 'dark',

      setMode: (mode) => {
        const isDark =
          mode === 'system'
            ? Appearance.getColorScheme() === 'dark'
            : mode === 'dark';
        set({ mode, isDark });
      },

      toggleTheme: () => {
        const currentMode = get().mode;
        const newMode = currentMode === 'dark' ? 'light' : 'dark';
        set({ mode: newMode, isDark: newMode === 'dark' });
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

// 시스템 테마 변경 감지
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode, setMode } = useThemeStore.getState();
  if (mode === 'system') {
    setMode('system'); // 재계산
  }
});
```

### 테마 프로바이더

```typescript
// src/providers/ThemeProvider.tsx
import React, { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </>
  );
}
```

### 다크모드 색상 팔레트

```typescript
// src/constants/colors.ts
export const Colors = {
  light: {
    // 배경
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    backgroundTertiary: '#F3F4F6',

    // 텍스트
    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',

    // 보더
    border: '#E5E7EB',
    borderSecondary: '#D1D5DB',

    // 브랜드
    primary: '#4F46E5',
    primaryHover: '#4338CA',

    // 상태
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  dark: {
    // 배경
    background: '#111827',
    backgroundSecondary: '#1F2937',
    backgroundTertiary: '#374151',

    // 텍스트
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',

    // 보더
    border: '#374151',
    borderSecondary: '#4B5563',

    // 브랜드
    primary: '#6366F1',
    primaryHover: '#818CF8',

    // 상태
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
};
```

---

## 요약

### UI/UX 체크리스트

#### 회원가입
- [ ] 3단계 마법사 플로우
- [ ] 단계별 진행 표시
- [ ] 비밀번호 강도 표시
- [ ] 실시간 유효성 검증
- [ ] 애니메이션 전환

#### 로그인
- [ ] 자동 로그인 옵션
- [ ] 소셜 로그인 (Apple, Google)
- [ ] 비밀번호 표시/숨기기
- [ ] 에러 메시지 표시
- [ ] 로딩 상태 표시

#### 설정
- [ ] 그룹화된 섹션
- [ ] 명확한 아이콘
- [ ] 토글 스위치
- [ ] 확인 모달 (위험 작업)

#### 전반적인 UX
- [ ] 최소 44px 터치 타겟
- [ ] 즉각적인 피드백
- [ ] 로딩 상태
- [ ] 빈 상태
- [ ] 에러 상태
- [ ] 접근성 지원
- [ ] 다크모드 완벽 지원
- [ ] 일관된 애니메이션
