/**
 * UNIQN Mobile - Create Inquiry Screen
 * 1:1 문의하기 화면
 */

import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { InquiryForm } from '@/components/support';
import { useCreateInquiry } from '@/hooks/useInquiry';
import type { CreateInquiryInput } from '@/types';

export default function CreateInquiryScreen() {
  const { mutate: createInquiry, isPending } = useCreateInquiry();

  const handleSubmit = useCallback(
    (data: CreateInquiryInput) => {
      createInquiry(data, {
        onSuccess: () => {
          // 문의 내역 화면으로 이동
          router.replace('/(app)/support/my-inquiries');
        },
      });
    },
    [createInquiry]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <InquiryForm
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
}
