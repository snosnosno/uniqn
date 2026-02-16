/**
 * UNIQN Mobile - 회원가입 Step 3: 프로필 정보
 *
 * @description 닉네임(필수) + 지역/경력/이력/기타사항(선택) 입력
 *              "나중에 입력하기" 버튼으로 선택 필드 건너뛰기 가능
 * @version 1.2.0
 */

import React, { useCallback } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signUpStep3Schema, type SignUpStep3Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupStep3Props {
  onNext: (data: SignUpStep3Data) => void;
  onBack: () => void;
  initialData?: Partial<SignUpStep3Data>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep3({ onNext, onBack, initialData, isLoading = false }: SignupStep3Props) {
  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<SignUpStep3Data>({
    resolver: zodResolver(signUpStep3Schema),
    mode: 'onBlur',
    defaultValues: {
      nickname: initialData?.nickname || '',
      role: 'staff' as const,
      region: initialData?.region || '',
      experienceYears: initialData?.experienceYears ?? undefined,
      career: initialData?.career || '',
      note: initialData?.note || '',
    },
  });

  // 나중에 입력하기: 닉네임만 검증 후 선택 필드 없이 진행
  const handleSkipOptional = useCallback(async () => {
    const isValid = await trigger('nickname');
    if (isValid) {
      onNext({ nickname: getValues('nickname'), role: 'staff' as const });
    }
  }, [trigger, getValues, onNext]);

  return (
    <View className="w-full flex-col gap-4">
      {/* 필수 항목 */}
      <View>
        <Text className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
          필수 항목
        </Text>

        {/* 닉네임 입력 */}
        <View>
          <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            닉네임 <Text className="text-error-500">*</Text>
          </Text>
          <Controller
            control={control}
            name="nickname"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="닉네임을 입력하세요 (2-15자)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                error={errors.nickname?.message}
                editable={!isLoading}
                maxLength={15}
              />
            )}
          />
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            다른 사용자에게 보여지는 이름입니다.
          </Text>
        </View>
      </View>

      {/* 선택 항목 */}
      <View className="mt-2">
        <Text className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
          선택 항목
        </Text>
        <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          나중에 프로필 설정에서 입력할 수 있습니다.
        </Text>

        {/* 지역 */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">지역</Text>
          <Controller
            control={control}
            name="region"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="예: 서울 강남구"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                error={errors.region?.message}
                editable={!isLoading}
                maxLength={50}
              />
            )}
          />
        </View>

        {/* 경력 (년) */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            경력 (년)
          </Text>
          <Controller
            control={control}
            name="experienceYears"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="예: 3"
                value={value?.toString() ?? ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  onChange(isNaN(num) ? undefined : num);
                }}
                onBlur={onBlur}
                keyboardType="number-pad"
                error={errors.experienceYears?.message}
                editable={!isLoading}
                maxLength={2}
              />
            )}
          />
        </View>

        {/* 이력 */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">이력</Text>
          <Controller
            control={control}
            name="career"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                  errors.career
                    ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                    : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
                }`}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="경력 및 이력을 입력해주세요"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 100 }}
                maxLength={500}
                editable={!isLoading}
              />
            )}
          />
          {errors.career && (
            <Text className="mt-1 text-sm text-error-500">{errors.career.message}</Text>
          )}
        </View>

        {/* 기타사항 */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            기타사항
          </Text>
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                  errors.note
                    ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                    : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
                }`}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="기타 참고사항을 입력해주세요"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
                maxLength={300}
                editable={!isLoading}
              />
            )}
          />
          {errors.note && (
            <Text className="mt-1 text-sm text-error-500">{errors.note.message}</Text>
          )}
        </View>
      </View>

      {/* 안내 문구 */}
      <View className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
        <Text className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          💼 구인자로 활동하고 싶으신가요?
        </Text>
        <Text className="text-xs text-primary-600 dark:text-primary-400">
          회원가입 후 '내 공고' 탭에서 구인자로 등록할 수 있습니다.
        </Text>
      </View>

      {/* 버튼 영역 */}
      <View className="mt-4 flex-col gap-3">
        <Button onPress={handleSubmit(onNext)} disabled={isLoading} fullWidth>
          다음
        </Button>

        <Button
          onPress={handleSkipOptional}
          variant="outline"
          disabled={isLoading}
          fullWidth
        >
          나중에 입력하기
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStep3;
