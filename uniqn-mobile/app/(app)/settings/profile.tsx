/**
 * UNIQN Mobile - Profile Edit Screen
 * 프로필 수정 화면
 */

import { useState, useCallback, useRef } from 'react';
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
import { Card, Loading } from '@/components/ui';
import { ProfileImagePicker } from '@/components/profile';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { updateUserProfile, checkNicknameExists } from '@/services';
import { updateProfileSchema, type UpdateProfileData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';
import { formatBirthDate } from '@/utils/formatters';
import type { UserProfile } from '@/types';
import type { AuthUser } from '@/stores/authStore';

export default function ProfileEditScreen() {
  const { profile, user, isLoading } = useAuth();

  // profile이 로드될 때까지 로딩 표시
  if (isLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <Loading />
      </SafeAreaView>
    );
  }

  // profile이 확실히 존재할 때만 폼 렌더링
  return <ProfileEditForm profile={profile} user={user} />;
}

/**
 * 프로필 수정 폼 (profile이 확실히 존재할 때만 렌더링)
 *
 * profile을 defaultValues로 직접 설정하여 useEffect + reset() 타이밍 문제 방지
 */
type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken';

function ProfileEditForm({ profile, user }: { profile: UserProfile; user: AuthUser | null }) {
  const setProfile = useAuthStore((state) => state.setProfile);
  const addToast = useToastStore((state) => state.addToast);
  const [isSaving, setIsSaving] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const lastCheckedNickname = useRef(profile.nickname ?? '');

  const {
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      nickname: profile.nickname ?? '',
      region: profile.region ?? '',
      experienceYears: profile.experienceYears ?? undefined,
      career: profile.career ?? '',
      note: profile.note ?? '',
    },
  });

  /** 닉네임 blur 시 중복 검사 (SignupStepProfile 패턴 재사용) */
  const handleNicknameBlur = useCallback(
    async (formOnBlur: () => void) => {
      formOnBlur();
      const nickname = (getValues('nickname') ?? '').trim();
      const currentNickname = (profile.nickname ?? '').trim();

      // 현재 닉네임과 동일하면 검사 불필요
      if (nickname === currentNickname) {
        setNicknameStatus('idle');
        return;
      }

      if (nickname.length < 2 || nickname === lastCheckedNickname.current) return;

      setNicknameStatus('checking');
      try {
        const exists = await checkNicknameExists(nickname, user?.uid);
        lastCheckedNickname.current = nickname;
        if (exists) {
          setNicknameStatus('taken');
          setError('nickname', {
            type: 'manual',
            message: '이미 사용 중인 닉네임입니다',
          });
        } else {
          setNicknameStatus('available');
        }
      } catch (error) {
        logger.warn('닉네임 중복 확인 실패', { error });
        setNicknameStatus('idle');
      }
    },
    [getValues, setError, profile.nickname, user?.uid]
  );

  /** 닉네임 변경 시 상태 리셋 */
  const handleNicknameChange = useCallback(
    (formOnChange: (value: string) => void, text: string) => {
      formOnChange(text);
      if (nicknameStatus !== 'idle') {
        setNicknameStatus('idle');
      }
    },
    [nicknameStatus]
  );

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
      // 변경된 필드만 업데이트 (undefined와 ''를 동일하게 취급)
      const updates: Partial<UpdateProfileData> = {};
      const normalize = (v: string | undefined) => v || '';

      const nicknameChanged = normalize(data.nickname) !== normalize(profile.nickname);
      if (nicknameChanged) {
        // blur 미실행 또는 이후 재입력된 경우 제출 전 중복 검사 실행
        if (nicknameStatus !== 'available') {
          const trimmed = (data.nickname ?? '').trim();
          if (trimmed.length >= 2) {
            setNicknameStatus('checking');
            try {
              const exists = await checkNicknameExists(trimmed, user.uid);
              lastCheckedNickname.current = trimmed;
              if (exists) {
                setNicknameStatus('taken');
                setError('nickname', {
                  type: 'manual',
                  message: '이미 사용 중인 닉네임입니다',
                });
                return;
              }
              setNicknameStatus('available');
            } catch (error) {
              logger.warn('닉네임 중복 확인 실패 (저장)', { error });
              addToast({ type: 'error', message: '닉네임 확인 중 오류가 발생했습니다' });
              return;
            }
          }
        }
        updates.nickname = data.nickname;
      }
      if (normalize(data.region) !== normalize(profile.region)) {
        updates.region = data.region;
      }
      if ((data.experienceYears ?? null) !== (profile.experienceYears ?? null)) {
        updates.experienceYears = data.experienceYears;
      }
      if (normalize(data.career) !== normalize(profile.career)) {
        updates.career = data.career;
      }
      if (normalize(data.note) !== normalize(profile.note)) {
        updates.note = data.note;
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(user.uid, updates);

        // authStore의 profile 업데이트 (로컬 상태 동기화)
        // Note: updatedAt은 Firestore 서버에서 설정하므로 optimistic update에서 제외
        setProfile({
          ...profile,
          ...updates,
        });

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
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
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
              currentImageUrl={profile.photoURL ?? null}
              name={profile.name ?? user?.displayName ?? '사용자'}
              onImageUpdated={handleImageUpdated}
              size="xl"
            />
            <Text className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">
              프로필 사진을 탭하여 변경
            </Text>
          </Card>

          {/* 기본 정보 (수정 불가) */}
          <Card className="mb-4">
            <Text className="mb-3 text-sm font-medium text-secondary-500 dark:text-secondary-400">
              기본 정보 (수정 불가)
            </Text>

            {/* 이름 (읽기 전용 - 회원가입 Step2) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">이름</Text>
              <View className="rounded-lg bg-secondary-100 px-4 py-3 dark:bg-surface">
                <Text className="text-secondary-600 dark:text-secondary-300">
                  {profile.name ?? '-'}
                </Text>
              </View>
            </View>

            {/* 이메일 (읽기 전용) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
                이메일
              </Text>
              <View className="rounded-lg bg-secondary-100 px-4 py-3 dark:bg-surface">
                <Text className="text-secondary-600 dark:text-secondary-300">
                  {profile.email ?? user?.email ?? '-'}
                </Text>
                {(profile.email ?? user?.email ?? '').endsWith('@privaterelay.apple.com') && (
                  <Text className="text-xs text-secondary-400 dark:text-secondary-500 mt-1">
                    (Apple 비공개 이메일)
                  </Text>
                )}
              </View>
            </View>

            {/* 전화번호 (읽기 전용 - 회원가입 Step2) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
                전화번호
              </Text>
              <View className="rounded-lg bg-secondary-100 px-4 py-3 dark:bg-surface">
                <Text className="text-secondary-600 dark:text-secondary-300">
                  {profile.phone ?? '-'}
                </Text>
              </View>
            </View>

            {/* 생년월일 (읽기 전용 - 회원가입 Step2) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
                생년월일
              </Text>
              <View className="rounded-lg bg-secondary-100 px-4 py-3 dark:bg-surface">
                <Text className="text-secondary-600 dark:text-secondary-300">
                  {formatBirthDate(profile.birthDate)}
                </Text>
              </View>
            </View>

            {/* 성별 (읽기 전용 - 회원가입 Step2) */}
            <View>
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">성별</Text>
              <View className="rounded-lg bg-secondary-100 px-4 py-3 dark:bg-surface">
                <Text className="text-secondary-600 dark:text-secondary-300">
                  {profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '-'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 추가 정보 */}
          <Card className="mb-4">
            <Text className="mb-3 text-sm font-medium text-secondary-500 dark:text-secondary-400">
              추가 정보
            </Text>

            {/* 닉네임 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
                닉네임
              </Text>
              <Controller
                control={control}
                name="nickname"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <TextInput
                        className={`rounded-lg border px-4 py-3 text-secondary-900 dark:text-secondary-100 ${
                          errors.nickname
                            ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                            : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
                        }`}
                        value={value}
                        onChangeText={(text) => handleNicknameChange(onChange, text)}
                        onBlur={() => handleNicknameBlur(onBlur)}
                        placeholder="닉네임을 입력해주세요 (2-15자)"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        maxLength={15}
                      />
                    </View>
                    {nicknameStatus === 'checking' && (
                      <ActivityIndicator size="small" className="ml-2" />
                    )}
                  </View>
                )}
              />
              {errors.nickname && (
                <Text className="mt-1 text-sm text-error-500">{errors.nickname.message}</Text>
              )}
              {nicknameStatus === 'available' && !errors.nickname && (
                <Text className="mt-1 text-xs text-success-600 dark:text-success-400">
                  사용 가능한 닉네임입니다
                </Text>
              )}
            </View>

            {/* 지역 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">지역</Text>
              <Controller
                control={control}
                name="region"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-secondary-900 dark:text-secondary-100 ${
                      errors.region
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
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
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
                경력 (년)
              </Text>
              <Controller
                control={control}
                name="experienceYears"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-secondary-900 dark:text-secondary-100 ${
                      errors.experienceYears
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
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
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">이력</Text>
              <Controller
                control={control}
                name="career"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-secondary-900 dark:text-secondary-100 ${
                      errors.career
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
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
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
                기타사항
              </Text>
              <Controller
                control={control}
                name="note"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-secondary-900 dark:text-secondary-100 ${
                      errors.note
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
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
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">역할</Text>
              <View className="rounded-lg bg-secondary-100 px-4 py-3 dark:bg-surface">
                <Text className="text-secondary-600 dark:text-secondary-300">
                  {profile.role === 'admin'
                    ? '관리자'
                    : profile.role === 'employer'
                      ? '구인자'
                      : profile.role === 'staff'
                        ? '스태프'
                        : '-'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 저장 버튼 */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving || !isDirty || nicknameStatus === 'taken'}
            className={`rounded-lg py-4 ${
              isSaving || !isDirty || nicknameStatus === 'taken'
                ? 'bg-secondary-300 dark:bg-surface'
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
