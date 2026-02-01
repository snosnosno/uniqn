/**
 * UNIQN Mobile - Change Password Screen
 * 비밀번호 변경 화면
 */

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
import { Card } from '@/components/ui';
import { PasswordStrength } from '@/components/settings';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { changePassword } from '@/services';
import { passwordChangeSchema, type PasswordChangeData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';

export default function ChangePasswordScreen() {
  const addToast = useToastStore((state) => state.addToast);
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
    `rounded-lg border px-4 py-3 pr-12 text-gray-900 dark:text-gray-100 ${hasError ? 'border-error-500 bg-error-50 dark:bg-error-900/20' : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'}`;

  // 비밀번호 변경 핸들러
  const onSubmit = async (data: PasswordChangeData) => {
    setIsSubmitting(true);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      addToast({ type: 'success', message: '비밀번호가 변경되었습니다' });
      router.back();
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('비밀번호 변경 실패', error as Error);

      // 에러 메시지 분기 처리
      if (errorMessage.includes('wrong-password') || errorMessage.includes('invalid-credential')) {
        addToast({ type: 'error', message: '현재 비밀번호가 올바르지 않습니다' });
      } else if (errorMessage.includes('requires-recent-login')) {
        addToast({
          type: 'error',
          message: '보안을 위해 다시 로그인 후 시도해주세요',
        });
      } else if (errorMessage.includes('weak-password')) {
        addToast({ type: 'error', message: '비밀번호가 너무 약합니다' });
      } else {
        addToast({ type: 'error', message: '비밀번호 변경에 실패했습니다' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
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
            <Text className="text-sm leading-5 text-gray-600 dark:text-gray-400">
              보안을 위해 비밀번호를 주기적으로 변경해주세요.{'\n'}
              비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.
            </Text>
          </Card>

          {/* 비밀번호 입력 폼 */}
          <Card className="mb-4">
            {/* 현재 비밀번호 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">현재 비밀번호</Text>
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
                      placeholderTextColor="#9CA3AF"
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
                >
                  {showCurrentPassword ? (
                    <EyeSlashIcon size={22} color="#9CA3AF" />
                  ) : (
                    <EyeIcon size={22} color="#9CA3AF" />
                  )}
                </Pressable>
              </View>
              {errors.currentPassword && (
                <Text className="mt-1 text-sm text-error-500">
                  {errors.currentPassword.message}
                </Text>
              )}
            </View>

            {/* 새 비밀번호 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">새 비밀번호</Text>
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
                      placeholderTextColor="#9CA3AF"
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
                >
                  {showNewPassword ? (
                    <EyeSlashIcon size={22} color="#9CA3AF" />
                  ) : (
                    <EyeIcon size={22} color="#9CA3AF" />
                  )}
                </Pressable>
              </View>
              {errors.newPassword && (
                <Text className="mt-1 text-sm text-error-500">{errors.newPassword.message}</Text>
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
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                새 비밀번호 확인
              </Text>
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
                      placeholderTextColor="#9CA3AF"
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
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon size={22} color="#9CA3AF" />
                  ) : (
                    <EyeIcon size={22} color="#9CA3AF" />
                  )}
                </Pressable>
              </View>
              {errors.confirmPassword && (
                <Text className="mt-1 text-sm text-error-500">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>
          </Card>

          {/* 비밀번호 정책 안내 */}
          <Card className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              비밀번호 정책
            </Text>
            <View className="flex-col gap-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {'\u2022'} 최소 8자 이상
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {'\u2022'} 대문자 1개 이상 포함
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {'\u2022'} 소문자 1개 이상 포함
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {'\u2022'} 숫자 1개 이상 포함
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {'\u2022'} 특수문자 1개 이상 포함 (!@#$%^&*)
              </Text>
            </View>
          </Card>

          {/* 변경 버튼 */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className={`rounded-lg py-4 ${isSubmitting ? 'bg-gray-300 dark:bg-surface' : 'bg-primary-600 active:bg-primary-700'}`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-center text-base font-semibold text-white">
                비밀번호 변경
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
