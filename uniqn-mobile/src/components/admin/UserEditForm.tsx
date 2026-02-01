/**
 * UNIQN Mobile - 사용자 수정 폼 컴포넌트 (관리자용)
 *
 * @description 사용자 정보를 수정하는 폼 컴포넌트
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Input, FormSelect, Button, Avatar, Loading } from '@/components/ui';
import { UserIcon, PhoneIcon, ShieldIcon, CheckIcon } from '@/components/icons';
import {
  USER_ROLE_LABELS,
  COUNTRIES,
  type AdminUserProfile,
  type UserRole,
} from '@/types';

// ============================================================================
// Schema
// ============================================================================

const userEditSchema = z.object({
  name: z
    .string()
    .min(2, '이름은 2자 이상이어야 합니다')
    .max(50, '이름은 50자 이하여야 합니다'),
  phone: z
    .string()
    .regex(/^01[0-9]-?[0-9]{4}-?[0-9]{4}$/, '올바른 전화번호 형식이 아닙니다')
    .optional()
    .or(z.literal('')),
  role: z.enum(['admin', 'employer', 'staff'] as const),
  nationality: z.string().optional(),
  isActive: z.boolean(),
  adminNotes: z.string().max(500, '메모는 500자 이하여야 합니다').optional(),
});

type UserEditFormData = z.infer<typeof userEditSchema>;

// ============================================================================
// Types
// ============================================================================

export interface UserEditFormProps {
  user: AdminUserProfile;
  isLoading?: boolean;
  onSubmit: (data: UserEditFormData) => Promise<void>;
  onCancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: USER_ROLE_LABELS.admin },
  { value: 'employer', label: USER_ROLE_LABELS.employer },
  { value: 'staff', label: USER_ROLE_LABELS.staff },
];

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name}`,
}));

// ============================================================================
// Component
// ============================================================================

export const UserEditForm = React.memo(function UserEditForm({
  user,
  isLoading = false,
  onSubmit,
  onCancel,
}: UserEditFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      nationality: user.nationality || '',
      isActive: user.isActive,
      adminNotes: user.adminNotes || '',
    },
  });

  // 사용자 변경 시 폼 리셋
  useEffect(() => {
    reset({
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      nationality: user.nationality || '',
      isActive: user.isActive,
      adminNotes: user.adminNotes || '',
    });
  }, [user, reset]);

  // 폼 제출
  const handleFormSubmit = useCallback(
    async (data: UserEditFormData) => {
      await onSubmit(data);
    },
    [onSubmit]
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Loading size="large" message="저장 중..." />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-surface-dark"
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* 프로필 헤더 */}
      <View className="bg-white dark:bg-surface px-4 py-6 items-center border-b border-gray-100 dark:border-surface-overlay">
        <Avatar
          name={user.name}
          source={user.photoURL}
          size="xl"
          className="mb-3"
        />
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {user.email}
        </Text>
      </View>

      <View className="p-4">
        {/* 기본 정보 */}
        <View className="bg-white dark:bg-surface rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            기본 정보
          </Text>

          {/* 이름 */}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="이름"
                placeholder="이름을 입력하세요"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                leftIcon={<UserIcon size={18} color="#9CA3AF" />}
                autoCapitalize="words"
              />
            )}
          />

          {/* 연락처 */}
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="연락처"
                placeholder="010-0000-0000"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phone?.message}
                leftIcon={<PhoneIcon size={18} color="#9CA3AF" />}
                keyboardType="phone-pad"
                className="mt-3"
              />
            )}
          />

          {/* 국적 */}
          <Controller
            control={control}
            name="nationality"
            render={({ field: { onChange, value } }) => (
              <View className="mt-3">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  국적
                </Text>
                <FormSelect
                  value={value || ''}
                  onValueChange={onChange}
                  options={[{ value: '', label: '선택 안함' }, ...COUNTRY_OPTIONS]}
                  placeholder="국적 선택"
                />
              </View>
            )}
          />
        </View>

        {/* 권한 설정 */}
        <View className="bg-white dark:bg-surface rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            권한 설정
          </Text>

          {/* 역할 */}
          <Controller
            control={control}
            name="role"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  역할
                </Text>
                <FormSelect
                  value={value}
                  onValueChange={onChange}
                  options={ROLE_OPTIONS}
                  placeholder="역할 선택"
                />
                {errors.role?.message && (
                  <Text className="text-xs text-red-500 mt-1">
                    {errors.role.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* 활성 상태 */}
          <Controller
            control={control}
            name="isActive"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
                <View className="flex-row items-center">
                  <ShieldIcon size={18} color="#9CA3AF" />
                  <Text className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    계정 활성화
                  </Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: '#D1D5DB', true: '#A855F7' }}
                  thumbColor={value ? '#fff' : '#fff'}
                />
              </View>
            )}
          />
        </View>

        {/* 관리자 메모 */}
        <View className="bg-white dark:bg-surface rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            관리자 메모
          </Text>

          <Controller
            control={control}
            name="adminNotes"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="관리자 메모를 입력하세요 (선택)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.adminNotes?.message}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          />
        </View>

        {/* 액션 버튼 */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            onPress={onCancel}
            className="flex-1 py-3 bg-gray-200 dark:bg-surface rounded-xl items-center active:opacity-70"
            disabled={isSubmitting}
          >
            <Text className="font-semibold text-gray-700 dark:text-gray-300">
              취소
            </Text>
          </Pressable>

          <Button
            onPress={handleSubmit(handleFormSubmit)}
            disabled={!isDirty || isSubmitting}
            loading={isSubmitting}
            className="flex-1"
          >
            <CheckIcon size={18} color="#fff" />
            <Text className="ml-2 text-white font-semibold">저장</Text>
          </Button>
        </View>

        {/* 변경 사항 안내 */}
        {isDirty && (
          <View className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
            <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
              저장하지 않은 변경 사항이 있습니다.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
});

export default UserEditForm;
