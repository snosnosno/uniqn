/**
 * UNIQN Mobile - Profile Edit Screen
 * 프로필 수정 화면
 */

import { useState, useEffect } from 'react';
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
import { useAuthStore, useHasHydrated } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { updateUserProfile } from '@/services';
import { updateProfileSchema, type UpdateProfileData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';

export default function ProfileEditScreen() {
  const { profile, user } = useAuth();
  const setProfile = useAuthStore((state) => state.setProfile);
  const addToast = useToastStore((state) => state.addToast);
  const hasHydrated = useHasHydrated();
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      nickname: '',
      region: '',
      experienceYears: undefined,
      career: '',
      note: '',
    },
  });

  // profile이 로드되면 form 값을 업데이트
  // hasHydrated를 확인하여 MMKV rehydration 완료 후에만 초기화
  useEffect(() => {
    if (hasHydrated && profile) {
      reset({
        nickname: profile.nickname ?? '',
        region: profile.region ?? '',
        experienceYears: profile.experienceYears ?? undefined,
        career: profile.career ?? '',
        note: profile.note ?? '',
      });
    }
  }, [hasHydrated, profile, reset]);

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

      if (data.nickname !== profile?.nickname) {
        updates.nickname = data.nickname;
      }
      if (data.region !== profile?.region) {
        updates.region = data.region;
      }
      if (data.experienceYears !== profile?.experienceYears) {
        updates.experienceYears = data.experienceYears;
      }
      if (data.career !== profile?.career) {
        updates.career = data.career;
      }
      if (data.note !== profile?.note) {
        updates.note = data.note;
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(user.uid, updates);

        // authStore의 profile 업데이트 (로컬 상태 동기화)
        if (profile) {
          setProfile({
            ...profile,
            ...updates,
            updatedAt: new Date(),
          });
        }

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

          {/* 기본 정보 (본인인증 후 자동 입력) */}
          <Card className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                기본 정보
              </Text>
              {/* 본인인증 SDK 연동 후 인증 버튼 추가 */}
              {/* <Pressable className="rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900/30">
                <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                  본인인증
                </Text>
              </Pressable> */}
            </View>

            {/* 이름 (읽기 전용 - 본인인증 정보) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">이름</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-surface">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.name ?? user?.displayName ?? '본인인증 후 자동 입력'}
                </Text>
              </View>
            </View>

            {/* 이메일 (읽기 전용) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">이메일</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-surface">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.email ?? user?.email ?? '-'}
                </Text>
              </View>
            </View>

            {/* 전화번호 (읽기 전용 - 본인인증 정보) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">전화번호</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-surface">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.phone ?? '본인인증 후 자동 입력'}
                </Text>
              </View>
            </View>

            {/* 생년월일 (읽기 전용 - 본인인증 정보) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">생년월일</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-surface">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.birthYear ? `${profile.birthYear}년` : '본인인증 후 자동 입력'}
                </Text>
              </View>
            </View>

            {/* 성별 (읽기 전용 - 본인인증 정보) */}
            <View>
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">성별</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-surface">
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.gender === 'male'
                    ? '남성'
                    : profile?.gender === 'female'
                      ? '여성'
                      : '본인인증 후 자동 입력'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 추가 정보 */}
          <Card className="mb-4">
            <Text className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              추가 정보
            </Text>

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
                        : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
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

            {/* 지역 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">지역</Text>
              <Controller
                control={control}
                name="region"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                      errors.region
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="예: 서울 강남구"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    maxLength={50}
                  />
                )}
              />
              {errors.region && (
                <Text className="mt-1 text-sm text-error-500">{errors.region.message}</Text>
              )}
            </View>

            {/* 경력 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">경력 (년)</Text>
              <Controller
                control={control}
                name="experienceYears"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-gray-900 dark:text-gray-100 ${
                      errors.experienceYears
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
                    }`}
                    value={value?.toString() ?? ''}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      onChange(isNaN(num) ? undefined : num);
                    }}
                    onBlur={onBlur}
                    placeholder="예: 3"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                )}
              />
              {errors.experienceYears && (
                <Text className="mt-1 text-sm text-error-500">
                  {errors.experienceYears.message}
                </Text>
              )}
            </View>

            {/* 이력 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">이력</Text>
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
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="경력 및 이력을 입력해주세요"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={{ minHeight: 100 }}
                    maxLength={500}
                  />
                )}
              />
              {errors.career && (
                <Text className="mt-1 text-sm text-error-500">{errors.career.message}</Text>
              )}
            </View>

            {/* 기타사항 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">기타사항</Text>
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
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="기타 참고사항을 입력해주세요"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={{ minHeight: 80 }}
                    maxLength={300}
                  />
                )}
              />
              {errors.note && (
                <Text className="mt-1 text-sm text-error-500">{errors.note.message}</Text>
              )}
            </View>

            {/* 역할 (읽기 전용) */}
            <View>
              <Text className="mb-1 text-sm text-gray-500 dark:text-gray-400">역할</Text>
              <View className="rounded-lg bg-gray-100 px-4 py-3 dark:bg-surface">
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

          {/* 저장 버튼 */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving || !isDirty}
            className={`rounded-lg py-4 ${
              isSaving || !isDirty
                ? 'bg-gray-300 dark:bg-surface'
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
