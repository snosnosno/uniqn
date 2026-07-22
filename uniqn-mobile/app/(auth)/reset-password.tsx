/**
 * UNIQN Mobile - Reset Password Screen
 * 비밀번호 재설정 화면 (메일 링크 복구 경로)
 *
 * 진입 경로: 재설정 메일 → GoTrue /verify → `<origin>/reset-password#access_token=...`
 * 복구 세션이 인증을 대신하므로 현재 비밀번호를 묻지 않는다.
 */

import { useCallback, useEffect, useState } from 'react';
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
import { SECONDARY_PALETTE } from '@/constants/colors';
import { Card } from '@/components/ui';
import { PasswordStrength } from '@/components/settings';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useThemeStore } from '@/stores/themeStore';
import { completePasswordReset, hasRecoverySession } from '@/services';
import { extractUserMessage } from '@/errors';
import { passwordResetSchema, type PasswordResetData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';

type LinkStatus = 'checking' | 'ready' | 'invalid';

/**
 * GoTrue 는 검증 실패를 리다이렉트 URL 해시에 실어 보낸다.
 * 예: `#error=access_denied&error_code=otp_expired&error_description=...`
 */
function hasLinkErrorInUrl(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  const hash = window.location?.hash ?? '';

  return hash.includes('error=') || hash.includes('error_code=');
}

export default function ResetPasswordScreen() {
  const addToast = useToastStore((state) => state.addToast);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const [status, setStatus] = useState<LinkStatus>('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordResetData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      if (hasLinkErrorInUrl()) {
        logger.warn('비밀번호 재설정 링크 오류 해시로 진입');
        if (!cancelled) {
          setStatus('invalid');
        }
        return;
      }

      const recovered = await hasRecoverySession();

      if (!cancelled) {
        setStatus(recovered ? 'ready' : 'invalid');
      }
    };

    void detect();

    return () => {
      cancelled = true;
    };
  }, []);

  const goToForgotPassword = useCallback(() => {
    router.replace('/(auth)/forgot-password');
  }, []);

  const onSubmit = async (data: PasswordResetData) => {
    setIsSubmitting(true);
    try {
      await completePasswordReset(data.newPassword);
      addToast({ type: 'success', message: '비밀번호가 변경되었어요' });
      router.replace('/');
    } catch (error) {
      logger.error('비밀번호 재설정 실패', error as Error);
      addToast({
        type: 'error',
        message:
          extractUserMessage(error) || '비밀번호 변경에 실패했어요. 잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = (hasError: boolean) =>
    `rounded-lg border px-4 py-3 pr-12 text-content-primary ${hasError ? 'border-error-500 bg-error-50 dark:bg-error-900/20' : 'border-divider bg-surface-card dark:bg-surface-elevated'}`;

  if (status === 'checking') {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-surface-page dark:bg-surface"
        edges={['top', 'bottom']}
      >
        <ActivityIndicator
          color={isDarkMode ? '#FFFFFF' : '#09090B'}
          accessibilityRole="progressbar"
          accessibilityLabel="재설정 링크 확인 중"
        />
      </SafeAreaView>
    );
  }

  if (status === 'invalid') {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-h4 font-display-semibold text-content-primary dark:text-off-white text-center">
            링크가 만료되었어요
          </Text>
          <Text className="text-sm leading-6 dark:leading-[1.625rem] text-content-muted font-sans text-center">
            비밀번호 재설정 링크는 한 번만 쓸 수 있고, 일정 시간이 지나면 만료돼요.{'\n'}
            비밀번호 찾기를 다시 요청해주세요.
          </Text>
          <Pressable
            onPress={goToForgotPassword}
            className="mt-2 min-h-[44px] justify-center rounded-lg bg-primary-600 px-6 py-3 active:bg-primary-700"
            accessibilityRole="button"
          >
            <Text className="text-center text-base font-sans-semibold text-content-onGold">
              재설정 링크 다시 받기
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text className="mb-2 mt-6 text-h3 font-display-semibold text-content-primary dark:text-off-white">
            새 비밀번호 설정
          </Text>
          <Text className="mb-6 text-sm leading-6 dark:leading-[1.625rem] text-content-muted font-sans">
            새로 사용할 비밀번호를 입력해주세요.{'\n'}
            8자 이상, 대소문자·숫자·특수문자를 포함해야 해요.
          </Text>

          <Card className="mb-4">
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
                      textContentType="newPassword"
                      returnKeyType="next"
                    />
                  )}
                />
                <Pressable
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3"
                  hitSlop={10}
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
                      textContentType="newPassword"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                  )}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3"
                  hitSlop={10}
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

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className={`min-h-[44px] justify-center rounded-lg py-4 ${isSubmitting ? 'bg-secondary-300 dark:bg-surface' : 'bg-primary-600 active:bg-primary-700'}`}
            accessibilityRole="button"
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
