/**
 * UNIQN Mobile - 회원가입 Step 3: 프로필 정보
 *
 * @description 닉네임, 역할 선택
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
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

type UserRole = 'staff' | 'employer';

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon: string;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'staff',
    label: '스태프',
    description: '구인공고에 지원하고 일할 수 있어요',
    icon: '👤',
  },
  {
    value: 'employer',
    label: '구인자',
    description: '구인공고를 등록하고 스태프를 모집할 수 있어요',
    icon: '🏢',
  },
];

// ============================================================================
// Component
// ============================================================================

export function SignupStep3({ onNext, onBack, initialData, isLoading = false }: SignupStep3Props) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpStep3Data>({
    resolver: zodResolver(signUpStep3Schema),
    defaultValues: {
      nickname: initialData?.nickname || '',
      role: initialData?.role || undefined,
    },
  });

  const selectedRole = watch('role');

  const handleRoleSelect = (role: UserRole) => {
    setValue('role', role, { shouldValidate: true });
  };

  return (
    <View className="w-full flex-col gap-4">
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

      {/* 역할 선택 */}
      <View className="mt-4">
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          역할 선택 <Text className="text-error-500">*</Text>
        </Text>

        <View className="flex-col gap-3">
          {ROLE_OPTIONS.map((option) => {
            const isSelected = selectedRole === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => handleRoleSelect(option.value)}
                disabled={isLoading}
                className={`
                  flex-row items-center p-4 rounded-lg border-2
                  ${isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-surface-overlay bg-white dark:bg-surface'
                  }
                  ${isLoading ? 'opacity-50' : ''}
                `}
              >
                {/* 아이콘 */}
                <View
                  className={`
                    w-12 h-12 rounded-full items-center justify-center mr-4
                    ${isSelected
                      ? 'bg-primary-100 dark:bg-primary-800'
                      : 'bg-gray-100 dark:bg-surface'
                    }
                  `}
                >
                  <Text className="text-2xl">{option.icon}</Text>
                </View>

                {/* 텍스트 */}
                <View className="flex-1">
                  <Text
                    className={`
                      font-semibold text-base
                      ${isSelected
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-900 dark:text-white'
                      }
                    `}
                  >
                    {option.label}
                  </Text>
                  <Text
                    className={`
                      text-sm mt-0.5
                      ${isSelected
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 dark:text-gray-400'
                      }
                    `}
                  >
                    {option.description}
                  </Text>
                </View>

                {/* 체크 표시 */}
                {isSelected && (
                  <View className="w-6 h-6 rounded-full bg-primary-500 items-center justify-center">
                    <Text className="text-white text-sm font-bold">✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {errors.role && (
          <Text className="mt-2 text-sm text-error-500">
            {errors.role.message}
          </Text>
        )}
      </View>

      {/* 안내 문구 */}
      <View className="mt-2 p-3 bg-gray-50 dark:bg-surface/50 rounded-lg">
        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
          역할은 나중에 설정에서 변경할 수 있습니다.
        </Text>
      </View>

      {/* 버튼 영역 */}
      <View className="mt-6 flex-col gap-3">
        <Button
          onPress={handleSubmit(onNext)}
          disabled={isLoading}
          fullWidth
        >
          다음
        </Button>

        <Button
          onPress={onBack}
          variant="ghost"
          disabled={isLoading}
          fullWidth
        >
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStep3;
