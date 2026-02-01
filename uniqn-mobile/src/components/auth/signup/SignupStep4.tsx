/**
 * UNIQN Mobile - 회원가입 Step 4: 약관 동의
 *
 * @description 이용약관, 개인정보처리방침, 마케팅 동의
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { signUpStep4Schema, type SignUpStep4Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupStep4Props {
  onSubmit: (data: SignUpStep4Data) => void;
  onBack: () => void;
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
    content: `UNIQN 이용약관

제1조 (목적)
본 약관은 UNIQN(이하 "회사")이 제공하는 서비스의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 구인구직 플랫폼 서비스를 말합니다.
2. "회원"이란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.
3. "스태프"란 구인공고에 지원하는 회원을 말합니다.
4. "구인자"란 구인공고를 등록하는 회원을 말합니다.

제3조 (약관의 효력 및 변경)
1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.
2. 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 제1항과 같은 방법으로 공지함으로써 효력이 발생합니다.

(이하 생략)`,
  },
  {
    key: 'privacyAgreed',
    label: '개인정보처리방침 동의',
    required: true,
    content: `개인정보처리방침

1. 수집하는 개인정보 항목
- 필수항목: 이메일, 비밀번호, 이름, 휴대폰번호
- 선택항목: 닉네임, 프로필사진

2. 개인정보 수집 및 이용목적
- 회원 식별 및 서비스 제공
- 구인구직 매칭 서비스 제공
- 본인인증 및 연락처 확인
- 서비스 이용 통계 및 분석

3. 개인정보 보유 및 이용기간
- 회원 탈퇴 시까지
- 법령에 따른 보존기간이 있는 경우 해당 기간

4. 개인정보의 제3자 제공
- 원칙적으로 제3자에게 제공하지 않습니다.
- 단, 법령에 따른 경우 예외로 합니다.

(이하 생략)`,
  },
  {
    key: 'marketingAgreed',
    label: '마케팅 정보 수신 동의',
    required: false,
    content: `마케팅 정보 수신 동의

1. 수신 정보
- 신규 기능 안내
- 이벤트 및 프로모션 정보
- 맞춤형 구인/구직 정보

2. 수신 방법
- 앱 푸시 알림
- 이메일
- SMS/MMS

3. 동의 철회
- 앱 설정에서 언제든지 수신 동의를 철회할 수 있습니다.`,
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
            ${checked
              ? 'bg-primary-500 border-primary-500'
              : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
            }
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          {checked && <Text className="text-white text-sm font-bold">✓</Text>}
        </View>
        <View className="flex-row items-center">
          {required && (
            <Text className="text-error-500 mr-1">[필수]</Text>
          )}
          {!required && (
            <Text className="text-gray-400 mr-1">[선택]</Text>
          )}
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

export function SignupStep4({ onSubmit, onBack, initialData, isLoading = false }: SignupStep4Props) {
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
            ${allChecked
              ? 'bg-primary-500 border-primary-500'
              : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
            }
          `}
        >
          {allChecked && <Text className="text-white text-sm font-bold">✓</Text>}
        </View>
        <Text className="text-gray-900 dark:text-white font-semibold">
          전체 동의하기
        </Text>
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
      <View className="mt-6 flex-col gap-3">
        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={!requiredChecked || isLoading}
          loading={isLoading}
          fullWidth
        >
          가입 완료
        </Button>

        <Button
          onPress={onBack}
          variant="ghost"
          disabled={isLoading}
          fullWidth
        >
          이전
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
