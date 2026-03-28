import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { signUpTermsSchema, type SignUpTermsData } from '@/schemas';
import { logger } from '@/utils/logger';

interface SignupStepTermsProps {
  onNext: (data: SignUpTermsData) => void;
  initialData?: Partial<SignUpTermsData>;
  isLoading?: boolean;
}

interface TermItem {
  key: 'termsAgreed' | 'privacyAgreed' | 'marketingAgreed';
  label: string;
  required: boolean;
  contentKey: 'terms' | 'privacy' | 'marketing';
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  onViewContent?: () => void;
  viewContentTestID?: string;
}

const TERMS: TermItem[] = [
  {
    key: 'termsAgreed',
    label: '이용약관 동의',
    required: true,
    contentKey: 'terms',
  },
  {
    key: 'privacyAgreed',
    label: '개인정보처리방침 동의',
    required: true,
    contentKey: 'privacy',
  },
  {
    key: 'marketingAgreed',
    label: '마케팅 정보 수신 동의',
    required: false,
    contentKey: 'marketing',
  },
];

const TERM_CONTENT_LOAD_ERROR_MESSAGE = '약관 내용을 불러오지 못했습니다. 다시 시도해주세요.';
const TERM_CONTENT_LOADING_MESSAGE = '약관 내용을 불러오는 중입니다...';

async function loadTermContent(term: TermItem): Promise<string> {
  const { MARKETING_CONSENT, PRIVACY_POLICY, TERMS_OF_SERVICE } = await import('./termsContent');

  switch (term.contentKey) {
    case 'terms':
      return TERMS_OF_SERVICE;
    case 'privacy':
      return PRIVACY_POLICY;
    case 'marketing':
      return MARKETING_CONSENT;
    default:
      return '';
  }
}

function Checkbox({
  checked,
  onChange,
  label,
  required,
  disabled,
  onViewContent,
  viewContentTestID,
}: CheckboxProps) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Pressable
        onPress={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="flex-row flex-1 items-center"
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: !!disabled }}
        accessibilityLabel={`${required ? '필수' : '선택'} ${label}`}
      >
        <View
          className={`
            mr-3 h-6 w-6 items-center justify-center rounded border-2
            ${
              checked
                ? 'border-primary-500 bg-primary-500'
                : 'border-gray-300 bg-white dark:border-surface-overlay dark:bg-surface'
            }
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          {checked && <Text className="text-sm font-bold text-white">✓</Text>}
        </View>
        <View className="flex-row items-center">
          {required ? (
            <Text className="mr-1 text-error-500">[필수]</Text>
          ) : (
            <Text className="mr-1 text-gray-400">[선택]</Text>
          )}
          <Text className="text-gray-900 dark:text-white">{label}</Text>
        </View>
      </Pressable>

      {onViewContent ? (
        <Pressable onPress={onViewContent} className="px-2" testID={viewContentTestID}>
          <Text className="text-sm text-gray-500 dark:text-gray-400">보기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SignupStepTerms({ onNext, initialData, isLoading = false }: SignupStepTermsProps) {
  const [modalContent, setModalContent] = useState<TermItem | null>(null);
  const [modalText, setModalText] = useState('');
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentLoadError, setContentLoadError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpTermsData>({
    resolver: zodResolver(signUpTermsSchema),
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

  const handleOpenContent = async (term: TermItem) => {
    setModalContent(term);
    setModalText('');
    setContentLoadError(null);
    setIsContentLoading(true);

    try {
      setModalText(await loadTermContent(term));
    } catch (error) {
      logger.warn('Failed to load signup term content', {
        component: 'SignupStepTerms',
        contentKey: term.contentKey,
        error: error instanceof Error ? error.message : String(error),
      });
      setContentLoadError(TERM_CONTENT_LOAD_ERROR_MESSAGE);
    } finally {
      setIsContentLoading(false);
    }
  };

  const handleCloseContent = () => {
    setModalContent(null);
    setModalText('');
    setIsContentLoading(false);
    setContentLoadError(null);
  };

  return (
    <View className="w-full flex-col gap-4">
      <Pressable
        onPress={handleAllAgree}
        disabled={isLoading}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allChecked, disabled: isLoading }}
        accessibilityLabel="전체 동의하기"
        className={`
          flex-row items-center rounded-lg bg-gray-50 p-4 dark:bg-surface
          ${isLoading ? 'opacity-50' : ''}
        `}
      >
        <View
          className={`
            mr-3 h-6 w-6 items-center justify-center rounded border-2
            ${
              allChecked
                ? 'border-primary-500 bg-primary-500'
                : 'border-gray-300 bg-white dark:border-surface-overlay dark:bg-surface'
            }
          `}
        >
          {allChecked && <Text className="text-sm font-bold text-white">✓</Text>}
        </View>
        <Text className="font-semibold text-gray-900 dark:text-white">전체 동의하기</Text>
      </Pressable>

      <View className="h-px bg-gray-200 dark:bg-surface" />

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
                viewContentTestID={`view-term-content-${term.contentKey}`}
                onViewContent={() => {
                  void handleOpenContent(term);
                }}
              />
            )}
          />
        ))}
      </View>

      {(errors.termsAgreed || errors.privacyAgreed) && (
        <View className="rounded-lg bg-error-50 p-3 dark:bg-error-900/30">
          <Text className="text-center text-sm text-error-600 dark:text-error-400">
            필수 약관에 동의해주세요.
          </Text>
        </View>
      )}

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

      <SheetModal
        visible={!!modalContent}
        onClose={handleCloseContent}
        title={modalContent?.label || '약관'}
        footer={
          <Button onPress={handleCloseContent} fullWidth>
            확인
          </Button>
        }
      >
        <View className="px-4">
          {isContentLoading ? (
            <Text className="leading-6 text-gray-700 dark:text-gray-300">
              {TERM_CONTENT_LOADING_MESSAGE}
            </Text>
          ) : contentLoadError ? (
            <View className="gap-3">
              <Text className="leading-6 text-error-600 dark:text-error-400">
                {contentLoadError}
              </Text>
              <Button
                variant="outline"
                fullWidth
                testID="retry-term-content"
                onPress={() => {
                  if (modalContent) {
                    void handleOpenContent(modalContent);
                  }
                }}
              >
                다시 시도
              </Button>
            </View>
          ) : (
            <Text className="leading-6 text-gray-700 dark:text-gray-300">{modalText}</Text>
          )}
        </View>
      </SheetModal>
    </View>
  );
}

export default SignupStepTerms;
