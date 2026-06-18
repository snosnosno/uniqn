/**
 * UNIQN Mobile - Profile Edit Screen
 * 프로필 수정 화면
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
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
import { StackHeader } from '@/components/headers';
import { Card, Loading, GenderSegment, type GenderValue } from '@/components/ui';
import { ProfileImagePicker } from '@/components/profile';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { updateUserProfile, checkNicknameExists } from '@/services';
import { updateProfileSchema, type UpdateProfileData } from '@/schemas/user.schema';
import { logger } from '@/utils/logger';
import { formatBirthDate } from '@/utils/formatters';
import { formatE164ToDisplay } from '@/utils/phone';
import type { UserProfile } from '@/types';
import type { AuthUser } from '@/stores/authStore';

export default function ProfileEditScreen() {
  const { profile, user, isLoading } = useAuth();

  // profile이 로드될 때까지 로딩 표시
  if (isLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="프로필 수정" fallbackHref="/(app)/settings" />
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
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const [isSaving, setIsSaving] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const lastCheckedNickname = useRef(profile.nickname ?? '');
  // 2026-05-16: PortOne 본인인증에서 gender 가 누락된 사용자의 set-once 보완 입력.
  // 이미 값이 있으면 read-only 섹션이 유지되고, 이 state 는 사용되지 않는다.
  const canEditGender = !profile.gender;
  const [pendingGender, setPendingGender] = useState<GenderValue | undefined>(undefined);

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
      // 2026-05-16: set-once gender 보완. canEditGender 가 true 인 동안 선택한 값만 반영.
      if (canEditGender && pendingGender) {
        updates.gender = pendingGender;
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
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="프로필 수정" fallbackHref="/(app)/settings" />
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
              currentImageBlurhash={profile.photoURLBlurhash ?? null}
              name={profile.name ?? user?.displayName ?? '사용자'}
              onImageUpdated={handleImageUpdated}
              size="xl"
            />
            <Text className="mt-3 text-sm text-content-muted font-sans">
              프로필 사진을 탭하여 변경
            </Text>
          </Card>

          {/* 기본 정보 (이름·생년월일·휴대폰은 본인인증 결과로 수정 불가, 성별은 본인인증 누락 시 최초 1회 입력 가능) */}
          <Card className="mb-4">
            <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-3">
              기본 정보
            </Text>

            {/* 이름 (읽기 전용 - 회원가입 Step2) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">이름</Text>
              <View className="rounded-lg bg-surface-card px-4 py-3 dark:bg-surface-elevated">
                <Text className="text-content-primary font-sans">{profile.name ?? '-'}</Text>
              </View>
            </View>

            {/* 이메일 (읽기 전용) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">이메일</Text>
              <View className="rounded-lg bg-surface-card px-4 py-3 dark:bg-surface-elevated">
                <Text className="text-content-primary font-sans">
                  {profile.email ?? user?.email ?? '-'}
                </Text>
                {(profile.email ?? user?.email ?? '').endsWith('@privaterelay.apple.com') && (
                  <Text className="text-xs text-content-placeholder mt-1 font-sans">
                    (Apple 비공개 이메일)
                  </Text>
                )}
              </View>
            </View>

            {/* 전화번호 (읽기 전용 - 회원가입 Step2) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">전화번호</Text>
              <View className="rounded-lg bg-surface-card px-4 py-3 dark:bg-surface-elevated">
                <Text className="text-content-primary font-sans">
                  {profile.phone ? formatE164ToDisplay(profile.phone) : '-'}
                </Text>
              </View>
            </View>

            {/* 생년월일 (읽기 전용 - 회원가입 Step2) */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">생년월일</Text>
              <View className="rounded-lg bg-surface-card px-4 py-3 dark:bg-surface-elevated">
                <Text className="text-content-primary font-sans">
                  {formatBirthDate(profile.birthDate)}
                </Text>
              </View>
            </View>

            {/* 성별 — 본인인증 결과 또는 set-once 보완 입력. 한 번 저장되면 read-only 로 고정 */}
            <View>
              <Text className="mb-1 text-sm text-content-muted font-sans">성별</Text>
              {canEditGender ? (
                <View>
                  <Text className="mb-2 text-xs text-content-muted dark:text-secondary-400 font-sans">
                    본인인증에서 자동 확인되지 않아 직접 선택이 필요합니다. 선택 후에는 변경할 수
                    없습니다.
                  </Text>
                  <GenderSegment
                    value={pendingGender}
                    onChange={setPendingGender}
                    ariaLabel="성별 (최초 1회 입력)"
                    ariaHint="본인인증에서 자동 확인되지 않아 직접 선택이 필요합니다. 선택 후에는 변경할 수 없습니다."
                  />
                </View>
              ) : (
                <View className="rounded-lg bg-surface-card px-4 py-3 dark:bg-surface-elevated">
                  <Text className="text-content-primary font-sans">
                    {profile.gender === 'male'
                      ? '남성'
                      : profile.gender === 'female'
                        ? '여성'
                        : '-'}
                  </Text>
                </View>
              )}
            </View>
          </Card>

          {/* 추가 정보 */}
          <Card className="mb-4">
            <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-3">
              추가 정보
            </Text>

            {/* 닉네임 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">닉네임</Text>
              <Controller
                control={control}
                name="nickname"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <TextInput
                        className={`rounded-lg border px-4 py-3 text-content-primary ${
                          errors.nickname
                            ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                            : 'border-divider bg-surface-card dark:bg-surface-elevated'
                        }`}
                        value={value}
                        onChangeText={(text) => handleNicknameChange(onChange, text)}
                        onBlur={() => handleNicknameBlur(onBlur)}
                        placeholder="닉네임을 입력해주세요 (2-15자)"
                        placeholderTextColor={SECONDARY_PALETTE[400]}
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
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.nickname.message}
                </Text>
              )}
              {nicknameStatus === 'available' && !errors.nickname && (
                <Text className="mt-1 text-xs text-success-600 dark:text-success-400 font-sans">
                  사용 가능한 닉네임입니다
                </Text>
              )}
            </View>

            {/* 지역 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">지역</Text>
              <Controller
                control={control}
                name="region"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-content-primary ${
                      errors.region
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-divider bg-surface-card dark:bg-surface-elevated'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="예: 서울 강남구"
                    placeholderTextColor={SECONDARY_PALETTE[400]}
                    autoCapitalize="none"
                    maxLength={50}
                  />
                )}
              />
              {errors.region && (
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.region.message}
                </Text>
              )}
            </View>

            {/* 경력 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">경력 (년)</Text>
              <Controller
                control={control}
                name="experienceYears"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-content-primary ${
                      errors.experienceYears
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-divider bg-surface-card dark:bg-surface-elevated'
                    }`}
                    value={value?.toString() ?? ''}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      onChange(isNaN(num) ? undefined : num);
                    }}
                    onBlur={onBlur}
                    placeholder="예: 3"
                    placeholderTextColor={SECONDARY_PALETTE[400]}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                )}
              />
              {errors.experienceYears && (
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.experienceYears.message}
                </Text>
              )}
            </View>

            {/* 이력 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">이력</Text>
              <Controller
                control={control}
                name="career"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-content-primary ${
                      errors.career
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-divider bg-surface-card dark:bg-surface-elevated'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="경력 및 이력을 입력해주세요"
                    placeholderTextColor={SECONDARY_PALETTE[400]}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={{ minHeight: 100 }}
                    maxLength={500}
                  />
                )}
              />
              {errors.career && (
                <Text className="mt-1 text-sm text-error-500 font-sans">
                  {errors.career.message}
                </Text>
              )}
            </View>

            {/* 기타사항 */}
            <View className="mb-4">
              <Text className="mb-1 text-sm text-content-muted font-sans">기타사항</Text>
              <Controller
                control={control}
                name="note"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`rounded-lg border px-4 py-3 text-content-primary ${
                      errors.note
                        ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'border-divider bg-surface-card dark:bg-surface-elevated'
                    }`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="기타 참고사항을 입력해주세요"
                    placeholderTextColor={SECONDARY_PALETTE[400]}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={{ minHeight: 80 }}
                    maxLength={300}
                  />
                )}
              />
              {errors.note && (
                <Text className="mt-1 text-sm text-error-500 font-sans">{errors.note.message}</Text>
              )}
            </View>

            {/* 역할 (읽기 전용) */}
            <View>
              <Text className="mb-1 text-sm text-content-muted font-sans">역할</Text>
              <View className="rounded-lg bg-surface-card px-4 py-3 dark:bg-surface-elevated">
                <Text className="text-content-primary font-sans">
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

          {/* 저장 버튼 — gender 보완 입력이 있으면 폼이 untouched 여도 활성 */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving || (!isDirty && !pendingGender) || nicknameStatus === 'taken'}
            className={`rounded-lg py-4 ${
              isSaving || (!isDirty && !pendingGender) || nicknameStatus === 'taken'
                ? 'bg-secondary-300 dark:bg-surface'
                : 'bg-primary-600 active:bg-primary-700'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color={isDarkMode ? '#FFFFFF' : '#09090B'} />
            ) : (
              <Text className="text-center text-base font-sans-semibold text-content-onGold">
                저장
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
