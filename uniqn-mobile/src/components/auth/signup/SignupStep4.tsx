/**
 * UNIQN Mobile - 회원가입 Step 1: 약관 동의
 *
 * @description 이용약관, 개인정보처리방침, 마케팅 동의 (개인정보 수집 전 동의)
 * @version 1.1.0
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { signUpStep4Schema, type SignUpStep4Data } from '@/schemas';
import { TERMS_OF_SERVICE, PRIVACY_POLICY, MARKETING_CONSENT } from './termsContent';

// ============================================================================
// Types
// ============================================================================

interface SignupStep4Props {
  onNext: (data: SignUpStep4Data) => void;
  initialData?: Partial<SignUpStep4Data>;
  isLoading?: boolean;
}

interface TermItem {
  key: 'termsAgreed' | 'privacyAgreed' | 'marketingAgreed';
  label: string;
  required: boolean;
  content: string;
}

// ============================================================================
// Constants
// ============================================================================

const TERMS: TermItem[] = [
  {
    key: 'termsAgreed',
    label: '이용약관 동의',
    required: true,
    content: TERMS_OF_SERVICE,
  },
  {
    key: 'privacyAgreed',
    label: '개인정보처리방침 동의',
    required: true,
    content: PRIVACY_POLICY,
  },
  {
    key: 'marketingAgreed',
    label: '마케팅 정보 수신 동의',
    required: false,
    content: MARKETING_CONSENT,
  },
];

// ============================================================================
// Sub Components
// ============================================================================

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  onViewContent?: () => void;
}

function Checkbox({ checked, onChange, label, required, disabled, onViewContent }: CheckboxProps) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Pressable
        onPress={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="flex-row items-center flex-1"
      >
        <View
          className={`
            w-6 h-6 rounded border-2 items-center justify-center mr-3
            ${
              checked
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
            }
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          {checked && <Text className="text-white text-sm font-bold">✓</Text>}
        </View>
        <View className="flex-row items-center">
          {required && <Text className="text-error-500 mr-1">[필수]</Text>}
          {!required && <Text className="text-gray-400 mr-1">[선택]</Text>}
          <Text className="text-gray-900 dark:text-white">{label}</Text>
        </View>
      </Pressable>

      {onViewContent && (
        <Pressable onPress={onViewContent} className="px-2">
          <Text className="text-gray-500 dark:text-gray-400 text-sm">보기</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep4({
  onNext,
  initialData,
  isLoading = false,
}: SignupStep4Props) {
  const [modalContent, setModalContent] = useState<TermItem | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpStep4Data>({
    resolver: zodResolver(signUpStep4Schema),
    defaultValues: {
      termsAgreed: initialData?.termsAgreed || false,
      privacyAgreed: initialData?.privacyAgreed || false,
      marketingAgreed: initialData?.marketingAgreed || false,
    },
  });

  const termsAgreed = watch('termsAgreed');
  const privacyAgreed = watch('privacyAgreed');
  const marketingAgreed = watch('marketingAgreed');

  const allChecked = termsAgreed && privacyAgreed && marketingAgreed;
  const requiredChecked = termsAgreed && privacyAgreed;

  const handleAllAgree = () => {
    const newValue = !allChecked;
    setValue('termsAgreed', newValue, { shouldValidate: true });
    setValue('privacyAgreed', newValue, { shouldValidate: true });
    setValue('marketingAgreed', newValue);
  };

  return (
    <View className="w-full flex-col gap-4">
      {/* 전체 동의 */}
      <Pressable
        onPress={handleAllAgree}
        disabled={isLoading}
        className={`
          flex-row items-center p-4 rounded-lg
          bg-gray-50 dark:bg-surface
          ${isLoading ? 'opacity-50' : ''}
        `}
      >
        <View
          className={`
            w-6 h-6 rounded border-2 items-center justify-center mr-3
            ${
              allChecked
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
            }
          `}
        >
          {allChecked && <Text className="text-white text-sm font-bold">✓</Text>}
        </View>
        <Text className="text-gray-900 dark:text-white font-semibold">전체 동의하기</Text>
      </Pressable>

      {/* 구분선 */}
      <View className="h-px bg-gray-200 dark:bg-surface" />

      {/* 개별 약관 */}
      <View className="px-2">
        {TERMS.map((term) => (
          <Controller
            key={term.key}
            control={control}
            name={term.key}
            render={({ field: { value, onChange } }) => (
              <Checkbox
                checked={value === true}
                onChange={onChange}
                label={term.label}
                required={term.required}
                disabled={isLoading}
                onViewContent={() => setModalContent(term)}
              />
            )}
          />
        ))}
      </View>

      {/* 에러 메시지 */}
      {(errors.termsAgreed || errors.privacyAgreed) && (
        <View className="bg-error-50 dark:bg-error-900/30 rounded-lg p-3">
          <Text className="text-error-600 dark:text-error-400 text-sm text-center">
            필수 약관에 동의해주세요.
          </Text>
        </View>
      )}

      {/* 버튼 영역 */}
      <View className="mt-6">
        <Button
          onPress={handleSubmit(onNext)}
          disabled={!requiredChecked || isLoading}
          loading={isLoading}
          fullWidth
        >
          다음
        </Button>
      </View>

      {/* 약관 상세 모달 */}
      <SheetModal
        visible={!!modalContent}
        onClose={() => setModalContent(null)}
        title={modalContent?.label || '약관'}
        footer={
          <Button onPress={() => setModalContent(null)} fullWidth>
            확인
          </Button>
        }
      >
        <View className="px-4">
          <Text className="text-gray-700 dark:text-gray-300 leading-6">
            {modalContent?.content}
          </Text>
        </View>
      </SheetModal>
    </View>
  );
}

export default SignupStep4;
