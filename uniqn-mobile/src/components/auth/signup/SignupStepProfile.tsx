/**
 * UNIQN Mobile - 회원가입 Step 3: 프로필 정보
 *
 * @description 닉네임(필수) + 지역/경력/이력/기타사항(선택) 입력
 *              "나중에 입력하기" 버튼으로 선택 필드 건너뛰기 가능
 * @version 1.2.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { checkNicknameExists } from '@/services/auth';
import { signUpProfileSchema, type SignUpProfileData } from '@/schemas';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface SignupStepProfileProps {
  onNext: (data: SignUpProfileData) => void;
  onBack: () => void;
  initialData?: Partial<SignUpProfileData>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken';

export function SignupStepProfile({
  onNext,
  onBack,
  initialData,
  isLoading = false,
}: SignupStepProfileProps) {
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const lastCheckedNickname = useRef('');

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    setError,
    formState: { errors },
  } = useForm<SignUpProfileData>({
    resolver: zodResolver(signUpProfileSchema),
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

  // 닉네임 중복 검사 (onBlur 시 호출)
  const handleNicknameBlur = useCallback(
    async (formOnBlur: () => void) => {
      formOnBlur();
      const nickname = getValues('nickname').trim();

      if (nickname.length < 2 || nickname === lastCheckedNickname.current) return;

      setNicknameStatus('checking');
      try {
        const exists = await checkNicknameExists(nickname);
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
    [getValues, setError]
  );

  // 닉네임 변경 시 상태 리셋
  const handleNicknameChange = useCallback(
    (formOnChange: (value: string) => void, text: string) => {
      formOnChange(text);
      if (nicknameStatus !== 'idle') {
        setNicknameStatus('idle');
      }
    },
    [nicknameStatus]
  );

  // 닉네임 중복 서버 검사 공통 로직
  const ensureNicknameAvailable = useCallback(
    async (nickname: string): Promise<boolean> => {
      if (nicknameStatus === 'taken') return false;
      if (nicknameStatus === 'available') return true;

      // blur 미실행(idle/checking) 시 서버 중복 검사 수행
      if (nickname.length >= 2) {
        setNicknameStatus('checking');
        try {
          const exists = await checkNicknameExists(nickname);
          lastCheckedNickname.current = nickname;
          if (exists) {
            setNicknameStatus('taken');
            setError('nickname', { type: 'manual', message: '이미 사용 중인 닉네임입니다' });
            return false;
          }
          setNicknameStatus('available');
          return true;
        } catch (error) {
          logger.warn('닉네임 중복 확인 실패', { error });
          // 서버 에러 시 진행 허용 — CF Transaction에서 최종 검증
          return true;
        }
      }
      return true;
    },
    [nicknameStatus, setError]
  );

  // 가입 완료: 전체 폼 검증 + 중복 확인 후 제출
  const handleComplete = useCallback(
    async (data: SignUpProfileData) => {
      const available = await ensureNicknameAvailable(data.nickname.trim());
      if (!available) return;
      onNext(data);
    },
    [ensureNicknameAvailable, onNext]
  );

  // 나중에 입력하기: 닉네임만 검증 후 선택 필드 없이 진행
  const handleSkipOptional = useCallback(async () => {
    const isValid = await trigger('nickname');
    if (!isValid) return;

    const nickname = getValues('nickname').trim();
    const available = await ensureNicknameAvailable(nickname);
    if (available) {
      onNext({ nickname, role: 'staff' as const });
    }
  }, [trigger, getValues, onNext, ensureNicknameAvailable]);

  return (
    <View className="w-full flex-col gap-4">
      {/* 필수 항목 */}
      <View>
        <Text className="mb-3 text-sm font-sans-semibold text-secondary-800 dark:text-secondary-200">
          필수 항목
        </Text>

        {/* 닉네임 입력 */}
        <View>
          <Text className="mb-2 text-sm font-sans-medium text-content-secondary">
            닉네임 <Text className="text-error-500 font-sans">*</Text>
          </Text>
          <Controller
            control={control}
            name="nickname"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Input
                      placeholder="닉네임을 입력하세요 (2-15자)"
                      value={value}
                      onChangeText={(text) => handleNicknameChange(onChange, text)}
                      onBlur={() => handleNicknameBlur(onBlur)}
                      autoCapitalize="none"
                      error={errors.nickname?.message}
                      editable={!isLoading}
                      maxLength={15}
                    />
                  </View>
                  {nicknameStatus === 'checking' && (
                    <View className="ml-2">
                      <ActivityIndicator size="small" />
                    </View>
                  )}
                </View>
                {nicknameStatus === 'available' && !errors.nickname && (
                  <Text className="mt-1 text-xs text-success-600 dark:text-success-400 font-sans">
                    사용 가능한 닉네임입니다
                  </Text>
                )}
              </View>
            )}
          />
          <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            다른 사용자에게 보여지는 이름입니다.
          </Text>
        </View>
      </View>

      {/* 선택 항목 */}
      <View className="mt-2">
        <Text className="mb-1 text-sm font-sans-semibold text-secondary-800 dark:text-secondary-200">
          선택 항목
        </Text>
        <Text className="mb-3 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          나중에 프로필 설정에서 입력할 수 있습니다.
        </Text>

        {/* 지역 */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-sans-medium text-content-secondary">지역</Text>
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
          <Text className="mb-2 text-sm font-sans-medium text-content-secondary">경력 (년)</Text>
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
          <Text className="mb-2 text-sm font-sans-medium text-content-secondary">이력</Text>
          <Controller
            control={control}
            name="career"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={`rounded-lg border px-4 py-3 text-content-primary dark:text-secondary-100 ${
                  errors.career
                    ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                    : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
                }`}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="경력 및 이력을 입력해주세요"
                placeholderTextColor={SECONDARY_PALETTE[400]}
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
            <Text className="mt-1 text-sm text-error-500 font-sans">{errors.career.message}</Text>
          )}
        </View>

        {/* 기타사항 */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-sans-medium text-content-secondary">기타사항</Text>
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={`rounded-lg border px-4 py-3 text-content-primary dark:text-secondary-100 ${
                  errors.note
                    ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                    : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
                }`}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="기타 참고사항을 입력해주세요"
                placeholderTextColor={SECONDARY_PALETTE[400]}
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
            <Text className="mt-1 text-sm text-error-500 font-sans">{errors.note.message}</Text>
          )}
        </View>
      </View>

      {/* 안내 문구 */}
      <View className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
        <Text className="text-sm font-sans-medium text-primary-700 dark:text-primary-300 mb-1">
          구인자로 활동하고 싶으신가요?
        </Text>
        <Text className="text-xs text-primary-600 dark:text-primary-400 font-sans">
          회원가입 후 &apos;내 공고&apos; 탭에서 구인자로 등록할 수 있습니다.
        </Text>
      </View>

      {/* 버튼 영역 */}
      <View className="mt-4 flex-col gap-3">
        <Button
          onPress={handleSubmit(handleComplete)}
          disabled={isLoading || nicknameStatus === 'taken' || nicknameStatus === 'checking'}
          fullWidth
        >
          가입 완료
        </Button>

        <Button onPress={handleSkipOptional} variant="outline" disabled={isLoading} fullWidth>
          나중에 입력하기
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStepProfile;
