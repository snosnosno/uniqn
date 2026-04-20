/**
 * UNIQN Mobile - Create Inquiry Screen
 * 1:1 문의하기 화면
 *
 * 전체 롤백 정책:
 * - 텍스트 제출 → 성공 시 inquiry 생성
 * - 첨부파일 있음: 업로드 시도 → 실패 시 문의 DELETE 후 폼 유지
 * - 첨부파일 없음: 생성 즉시 완료
 * - Toast는 최종 성공 시점에만 표시 (중간 상태 숨김)
 */

import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { InquiryForm } from '@/components/support';
import { StackHeader } from '@/components/headers';
import { useCreateInquiry, useAttachInquiryFiles, useDeleteMyInquiry } from '@/hooks/useInquiry';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { CreateInquiryInput, LocalInquiryAttachment } from '@/types';

const COMPONENT = 'CreateInquiryScreen';

export default function CreateInquiryScreen() {
  // silent=true: 오케스트레이션이 최종 토스트를 담당
  const { mutateAsync: createInquiryAsync, isPending: isCreating } = useCreateInquiry({
    silent: true,
  });
  const { mutateAsync: attachFilesAsync, isPending: isAttaching } = useAttachInquiryFiles();
  const { mutateAsync: deleteInquiryAsync } = useDeleteMyInquiry();
  const addToast = useToastStore((state) => state.addToast);

  const isSubmitting = isCreating || isAttaching;

  const handleSubmit = useCallback(
    async (data: CreateInquiryInput, attachments: LocalInquiryAttachment[]) => {
      let inquiryId: string;

      // 1. 문의 생성
      try {
        inquiryId = await createInquiryAsync(data);
      } catch (error) {
        logger.warn('inquiry.create.failed', { component: COMPONENT, error });
        addToast({ type: 'error', message: '문의 접수에 실패했습니다' });
        return;
      }

      // 2. 첨부 없으면 바로 성공
      if (attachments.length === 0) {
        addToast({ type: 'success', message: '문의가 접수되었어요' });
        router.replace(`/(app)/support/inquiry/${inquiryId}`);
        return;
      }

      // 3. 첨부 업로드 시도
      try {
        await attachFilesAsync({ inquiryId, files: attachments });
        addToast({ type: 'success', message: '문의가 접수되었어요' });
        router.replace(`/(app)/support/inquiry/${inquiryId}`);
      } catch (attachError) {
        // 4. 전체 롤백 — 문의 DELETE (Storage 정리는 service가 수행)
        logger.warn('inquiry.attach.failed.rollback', {
          component: COMPONENT,
          inquiryId,
          attachError,
        });
        try {
          await deleteInquiryAsync(inquiryId);
          logger.info('inquiry.rollback.success', { component: COMPONENT, inquiryId });
        } catch (rollbackError) {
          // 롤백 실패 — 고아 문의 남음. 로깅만.
          logger.error('inquiry.rollback.failed', {
            component: COMPONENT,
            inquiryId,
            rollbackError,
          });
        }
        // 폼 상태 유지 (router.push 안 함) — 사용자가 재시도 가능
        addToast({
          type: 'error',
          message: '이미지 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.',
        });
      }
    },
    [addToast, attachFilesAsync, createInquiryAsync, deleteInquiryAsync]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="1:1 문의하기" fallbackHref="/(app)/support" />
      <InquiryForm onSubmit={handleSubmit} isSubmitting={isSubmitting} onCancel={handleCancel} />
    </SafeAreaView>
  );
}
