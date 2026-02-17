/**
 * UNIQN Mobile - 회원가입 Step 2: 본인인증
 *
 * @description 이름/생년월일/성별 입력 + Firebase Phone Auth(SMS OTP) 전화번호 인증
 * @version 4.0.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { signUpStep2Schema } from '@/schemas';
import type { SignUpStep2Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupStep2Props {
  onNext: (data: SignUpStep2Data) => void;
  onBack: () => void;
  initialData?: Partial<SignUpStep2Data>;
  isLoading?: boolean;
  /** PhoneVerification 모드: signIn(기본)=새 계정 생성, link=기존 계정에 링크 */
  phoneMode?: 'signIn' | 'link';
}

// ============================================================================
// Sub-components
// ============================================================================

/** 생년월일 입력 (년/월/일 3칸) */
function BirthDateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [year, setYear] = useState(value ? value.substring(0, 4) : '');
  const [month, setMonth] = useState(value ? value.substring(4, 6) : '');
  const [day, setDay] = useState(value ? value.substring(6, 8) : '');

  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  const updateValue = (y: string, m: string, d: string) => {
    if (y.length === 4 && m.length === 2 && d.length === 2) {
      onChange(`${y}${m}${d}`);
    } else if (y === '' && m === '' && d === '') {
      onChange('');
    }
  };

  const handleYearChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    setYear(cleaned);
    if (cleaned.length === 4) {
      monthRef.current?.focus();
    }
    updateValue(cleaned, month, day);
  };

  const handleMonthChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 2);
    setMonth(cleaned);
    if (cleaned.length === 2) {
      dayRef.current?.focus();
    }
    updateValue(year, cleaned, day);
  };

  const handleDayChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 2);
    setDay(cleaned);
    updateValue(year, month, cleaned);
  };

  return (
    <View className="flex-row gap-2">
      <View className="flex-[2]">
        <Input
          placeholder="YYYY"
          value={year}
          onChangeText={handleYearChange}
          keyboardType="number-pad"
          maxLength={4}
          editable={!disabled}
          accessibilityLabel="출생 연도"
        />
      </View>
      <View className="flex-1">
        <TextInput
          ref={monthRef}
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 dark:border-gray-700 dark:bg-surface dark:text-gray-100"
          placeholder="MM"
          placeholderTextColor="#9CA3AF"
          value={month}
          onChangeText={handleMonthChange}
          keyboardType="number-pad"
          maxLength={2}
          editable={!disabled}
          accessibilityLabel="출생 월"
        />
      </View>
      <View className="flex-1">
        <TextInput
          ref={dayRef}
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 dark:border-gray-700 dark:bg-surface dark:text-gray-100"
          placeholder="DD"
          placeholderTextColor="#9CA3AF"
          value={day}
          onChangeText={handleDayChange}
          keyboardType="number-pad"
          maxLength={2}
          editable={!disabled}
          accessibilityLabel="출생 일"
        />
      </View>
    </View>
  );
}

/** 성별 선택 (남성/여성 버튼) */
function GenderSelector({
  value,
  onChange,
  disabled,
}: {
  value?: 'male' | 'female';
  onChange: (value: 'male' | 'female') => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={() => !disabled && onChange('male')}
        className={`flex-1 py-3 rounded-xl items-center border ${
          value === 'male'
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
            : 'bg-white dark:bg-surface border-gray-200 dark:border-gray-700'
        }`}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'male' }}
        accessibilityLabel="남성"
      >
        <Text
          className={`text-base font-medium ${
            value === 'male'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          남성
        </Text>
      </Pressable>
      <Pressable
        onPress={() => !disabled && onChange('female')}
        className={`flex-1 py-3 rounded-xl items-center border ${
          value === 'female'
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
            : 'bg-white dark:bg-surface border-gray-200 dark:border-gray-700'
        }`}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'female' }}
        accessibilityLabel="여성"
      >
        <Text
          className={`text-base font-medium ${
            value === 'female'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          여성
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep2({
  onNext,
  onBack,
  initialData,
  isLoading = false,
  phoneMode = 'signIn',
}: SignupStep2Props) {
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    initialData?.verifiedPhone || null
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignUpStep2Data>({
    resolver: zodResolver(signUpStep2Schema),
    defaultValues: {
      name: initialData?.name || '',
      birthDate: initialData?.birthDate || '',
      gender: initialData?.gender,
      phoneVerified: initialData?.phoneVerified || (false as unknown as true),
      verifiedPhone: initialData?.verifiedPhone || '',
    },
  });

  const handleVerified = useCallback(
    (phone: string) => {
      setVerifiedPhone(phone);
      setValue('phoneVerified', true);
      setValue('verifiedPhone', phone);
    },
    [setValue]
  );

  const onSubmit = useCallback(
    (data: SignUpStep2Data) => {
      onNext(data);
    },
    [onNext]
  );

  return (
    <View className="w-full flex-col gap-5">
      {/* 이름 입력 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          이름 (실명)
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="실명을 입력해주세요"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!isLoading}
              accessibilityLabel="이름 입력"
              error={errors.name?.message}
            />
          )}
        />
      </View>

      {/* 생년월일 입력 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">생년월일</Text>
        <Controller
          control={control}
          name="birthDate"
          render={({ field: { onChange, value } }) => (
            <BirthDateInput value={value} onChange={onChange} disabled={isLoading} />
          )}
        />
        {errors.birthDate && (
          <Text className="text-sm text-error-500 mt-1">{errors.birthDate.message}</Text>
        )}
      </View>

      {/* 성별 선택 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">성별</Text>
        <Controller
          control={control}
          name="gender"
          render={({ field: { onChange, value } }) => (
            <GenderSelector value={value} onChange={onChange} disabled={isLoading} />
          )}
        />
        {errors.gender && (
          <Text className="text-sm text-error-500 mt-1">{errors.gender.message}</Text>
        )}
      </View>

      {/* 전화번호 인증 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          전화번호 인증
        </Text>
        <PhoneVerification
          onVerified={handleVerified}
          initialPhone={verifiedPhone || initialData?.verifiedPhone}
          disabled={isLoading}
          compact
          mode={phoneMode}
        />
      </View>
      {errors.phoneVerified && !verifiedPhone && (
        <Text className="text-sm text-error-500 -mt-2">{errors.phoneVerified.message}</Text>
      )}

      {/* 버튼 영역 */}
      <View className="mt-4 flex-col gap-3">
        <Button onPress={handleSubmit(onSubmit)} disabled={isLoading} fullWidth>
          다음
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStep2;
