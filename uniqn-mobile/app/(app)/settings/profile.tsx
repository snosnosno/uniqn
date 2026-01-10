/**
 * UNIQN Mobile - Profile Edit Screen
 * 프로필 수정 화면
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
import { ProfileImagePicker } from '@/components/profile';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/stores/toastStore';
import { updateUserProfile } from '@/services';
import { updateProfileSchema, type UpdateProfileData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';

export default function ProfileEditScreen() {
  const { profile, user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: profile?.name ?? '',
      nickname: profile?.nickname ?? '',
      phone: profile?.phone ?? '',
    },
  });

  // 프로필 이미지 변경 핸들러 (ProfileImagePicker가 내부적으로 처리)
  const handleImageUpdated = (imageUrl: string | null) => {
    // ProfileImagePicker 컴포넌트가 이미지 업로드/삭제 및 toast 처리
    logger.info('프로필 이미지 업데이트 완료', { imageUrl: imageUrl ? '설정됨' : '삭제됨' });
  };

  // 프로필 저장 핸들러
  const onSubmit = async (data: UpdateProfileData) => {
    if (!user?.uid) return;

    setIsSaving(true);
    try {
      // 변경된 필드만 업데이트
      const updates: Partial<UpdateProfileData> = {};

      if (data.name && data.name !== profile?.name) {
        updates.name = data.name;
      }
      if (data.nickname !== profile?.nickname) {
        updates.nickname = data.nickname;
      }
      if (data.phone !== profile?.phone) {
        updates.phone = data.phone;
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(user.uid, updates);
        addToast({ type: 'success', message: '프로필이 저장되었습니다' });
        router.back();
      } else {
        addToast({ type: 'info', message: '변경된 내용이 없습니다' });
      }
    } catch (error) {
      logger.error('프로필 저장 실패', error as Error);
      addToast({ type: 'error', message: '프로필 저장에 실패했습니다' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* 프로필 이미지 */}
          <Card className="mb-4 items-center py-6">
            <ProfileImagePicker
              currentImageUrl={profile?.photoURL ?? null}
              name={profile?.name ?? user?.displayName ?? '사용자'}
              onImageUpdated={handleImageUpdated}
              size="xl"
            />
            <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              프로필 사진을 탭하여 변경
            </Text>
          </Card>

          {/* 읽기 전용 정보 */}
          <Card className="mb-4">
            <Text className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              기본 정보
            </Text>

            {/* 이메일 (읽기 전용) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">이메일</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-700">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.email ?? user?.email ?? '-'}
                </Text>
              </View>
            </View>

            {/* 역할 (읽기 전용) */}
            <View>
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">역할</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-700">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.role === 'admin'
                    ? '관리자'
                    : profile?.role === 'employer'
                      ? '구인자'
                      : profile?.role === 'staff'
                        ? '스태프'
                        : '-'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 수정 가능 정보 */}
          <Card className="mb-4">
            <Text className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              수정 가능 정보
            </Text>

            {/* 이름 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">이름</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                      errors.name
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="이름을 입력해주세요"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                  />
                )}
              />
              {errors.name && (
                <Text className="mt-1 text-sm text-error-500">{errors.name.message}</Text>
              )}
            </View>

            {/* 닉네임 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">닉네임</Text>
              <Controller
                control={control}
                name="nickname"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                      errors.nickname
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="닉네임을 입력해주세요 (2-15자)"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    maxLength={15}
                  />
                )}
              />
              {errors.nickname && (
                <Text className="mt-1 text-sm text-error-500">{errors.nickname.message}</Text>
              )}
            </View>

            {/* 전화번호 */}
            <View>
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">전화번호</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                      errors.phone
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="010-1234-5678"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                )}
              />
              {errors.phone && (
                <Text className="mt-1 text-sm text-error-500">{errors.phone.message}</Text>
              )}
            </View>
          </Card>

          {/* 저장 버튼 */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving || !isDirty}
            className={`rounded-lg py-4 ${
              isSaving || !isDirty
                ? 'bg-gray-300 dark:bg-gray-700'
                : 'bg-primary-600 active:bg-primary-700'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-center text-base font-semibold text-white">저장</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
