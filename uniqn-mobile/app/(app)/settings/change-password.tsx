/**
 * UNIQN Mobile - Change Password Screen
 * 비밀번호 변경 화면
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StackHeader } from '@/components/headers';
import { Card } from '@/components/ui';
import { PasswordStrength } from '@/components/settings';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useThemeStore } from '@/stores/themeStore';
import { changePassword } from '@/services';
import { extractUserMessage } from '@/errors';
import { passwordChangeSchema, type PasswordChangeData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';

export default function ChangePasswordScreen() {
  const addToast = useToastStore((state) => state.addToast);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  // 입력 필드 스타일
  const getInputClassName = (hasError: boolean) =>
    `rounded-lg border px-4 py-3 pr-12 text-content-primary ${hasError ? 'border-error-500 bg-error-50 dark:bg-error-900/20' : 'border-divider bg-surface-card dark:bg-surface-elevated'}`;

  // 비밀번호 변경 핸들러
  const onSubmit = async (data: PasswordChangeData) => {
    setIsSubmitting(true);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      addToast({ type: 'success', message: '비밀번호가 변경되었습니다' });
      router.back();
    } catch (error) {
      logger.error('비밀번호 변경 실패', error as Error);

      // 백엔드는 Supabase Auth — 기존 Firebase 에러코드(wrong-password 등) 분기는 절대
      // 매칭되지 않아 항상 generic 문구만 떴다. AppError userMessage(예: "현재 비밀번호가
      // 올바르지 않습니다")를 그대로 노출한다.
      addToast({
        type: 'error',
        message: extractUserMessage(error) || '비밀번호 변경에 실패했습니다',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="비밀번호 변경" fallbackHref="/(app)/settings" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* 안내 문구 */}
          <Card className="mb-4">
            <Text className="text-sm leading-5 text-content-muted font-sans">
              보안을 위해 비밀번호를 주기적으로 변경해주세요.{'\n'}
              비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.
            </Text>
          </Card>

          {/* 비밀번호 입력 폼 */}
          <Card className="mb-4">
            {/* 현재 비밀번호 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">현재 비밀번호</Text>
              <View className="relative">
                <Controller
                  control={control}
                  name="currentPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={getInputClassName(!!errors.currentPassword)}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="현재 비밀번호를 입력해주세요"
                      placeholderTextColor={SECONDARY_PALETTE[400]}
                      secureTextEntry={!showCurrentPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  )}
                />
                <Pressable
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-3"
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showCurrentPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showCurrentPassword ? (
                    <EyeSlashIcon size={20} color={SECONDARY_PALETTE[400]} />
                  ) : (
                    <EyeIcon size={20} color={SECONDARY_PALETTE[400]} />
                  )}
                </Pressable>
              </View>
              {errors.currentPassword && (
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.currentPassword.message}
                </Text>
              )}
            </View>

            {/* 새 비밀번호 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">새 비밀번호</Text>
              <View className="relative">
                <Controller
                  control={control}
                  name="newPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={getInputClassName(!!errors.newPassword)}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="새 비밀번호를 입력해주세요"
                      placeholderTextColor={SECONDARY_PALETTE[400]}
                      secureTextEntry={!showNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  )}
                />
                <Pressable
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3"
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showNewPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showNewPassword ? (
                    <EyeSlashIcon size={20} color={SECONDARY_PALETTE[400]} />
                  ) : (
                    <EyeIcon size={20} color={SECONDARY_PALETTE[400]} />
                  )}
                </Pressable>
              </View>
              {errors.newPassword && (
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.newPassword.message}
                </Text>
              )}

              {/* 비밀번호 강도 표시 */}
              {newPassword && (
                <View className="mt-2">
                  <PasswordStrength password={newPassword} />
                </View>
              )}
            </View>

            {/* 비밀번호 확인 */}
            <View>
              <Text className="mb-1 text-sm text-content-muted font-sans">새 비밀번호 확인</Text>
              <View className="relative">
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={getInputClassName(!!errors.confirmPassword)}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="새 비밀번호를 다시 입력해주세요"
                      placeholderTextColor={SECONDARY_PALETTE[400]}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  )}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3"
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon size={20} color={SECONDARY_PALETTE[400]} />
                  ) : (
                    <EyeIcon size={20} color={SECONDARY_PALETTE[400]} />
                  )}
                </Pressable>
              </View>
              {errors.confirmPassword && (
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>
          </Card>

          {/* 비밀번호 정책 안내 */}
          <Card className="mb-4">
            <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
              비밀번호 정책
            </Text>
            <View className="flex-col gap-1">
              <Text className="text-xs text-content-muted font-sans">{'\u2022'} 최소 8자 이상</Text>
              <Text className="text-xs text-content-muted font-sans">
                {'\u2022'} 대문자 1개 이상 포함
              </Text>
              <Text className="text-xs text-content-muted font-sans">
                {'\u2022'} 소문자 1개 이상 포함
              </Text>
              <Text className="text-xs text-content-muted font-sans">
                {'\u2022'} 숫자 1개 이상 포함
              </Text>
              <Text className="text-xs text-content-muted font-sans">
                {'\u2022'} 특수문자 1개 이상 포함 (!@#$%^&*)
              </Text>
            </View>
          </Card>

          {/* 변경 버튼 */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className={`rounded-lg py-4 ${isSubmitting ? 'bg-secondary-300 dark:bg-surface' : 'bg-primary-600 active:bg-primary-700'}`}
          >
            {isSubmitting ? (
              <ActivityIndicator color={isDarkMode ? '#FFFFFF' : '#09090B'} />
            ) : (
              <Text className="text-center text-base font-sans-semibold text-content-onGold">
                비밀번호 변경
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
