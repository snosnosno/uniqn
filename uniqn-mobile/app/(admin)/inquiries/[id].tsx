/**
 * UNIQN Mobile - Admin Inquiry Detail Screen
 * 관리자 문의 상세 + 답변 화면
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { PRIMARY_COLORS } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Card } from '@/components/ui';
import {
  InquiryStatusBadge,
  InquiryResponseForm,
  InquiryAttachmentGallery,
} from '@/components/support';
import { useInquiryDetail, useRespondInquiry } from '@/hooks/useInquiry';
import { INQUIRY_CATEGORY_LABELS } from '@/types/inquiry';
import type { RespondInquiryInput } from '@/types';
import { toDate } from '@/utils/date';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

export default function AdminInquiryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inquiry, isLoading, isError } = useInquiryDetail(id);
  const { mutate: respondInquiry, isPending } = useRespondInquiry();

  const handleSubmitResponse = useCallback(
    (input: RespondInquiryInput) => {
      if (!id) return;

      respondInquiry(
        { inquiryId: id, input },
        {
          onSuccess: () => {
            // 목록으로 돌아가기
            router.back();
          },
        }
      );
    },
    [id, respondInquiry]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="문의 상세" fallbackHref="/(admin)/inquiries" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLORS[300]} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !inquiry) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="문의 상세" fallbackHref="/(admin)/inquiries" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-secondary-500 dark:text-secondary-400 font-sans">
            문의를 찾을 수 없습니다
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const createdDate = toDate(inquiry.createdAt);
  const respondedDate = toDate(inquiry.respondedAt);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="문의 상세" fallbackHref="/(admin)/inquiries" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 문의자 정보 */}
        <Card className="mb-4">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            문의자 정보
          </Text>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-sans-medium text-content-primary dark:text-secondary-100">
                {inquiry.userName}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {inquiry.userEmail}
              </Text>
            </View>
            <InquiryStatusBadge status={inquiry.status} />
          </View>
        </Card>

        {/* 문의 내용 */}
        <Card className="mb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              {INQUIRY_CATEGORY_LABELS[inquiry.category]}
            </Text>
            <Text className="text-sm text-content-placeholder font-sans">
              {createdDate ? format(createdDate, 'yyyy.MM.dd HH:mm', { locale: ko }) : ''}
            </Text>
          </View>

          <Text className="mb-3 text-lg font-display-semibold text-content-primary dark:text-secondary-100">
            {inquiry.subject}
          </Text>

          <View className="rounded-lg bg-surface-page dark:bg-surface p-4 dark:bg-surface/50">
            <Text className="leading-6 text-content-secondary font-sans">{inquiry.message}</Text>
          </View>

          {/* 첨부파일 */}
          <InquiryAttachmentGallery attachments={inquiry.attachments ?? []} />
        </Card>

        {/* 기존 답변 (있는 경우) */}
        {inquiry.response && (
          <Card className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-2 h-2 w-2 rounded-sm bg-success-500" />
                <Text className="font-sans-medium text-content-primary dark:text-secondary-100">
                  답변 완료
                </Text>
              </View>
              <Text className="text-sm text-content-placeholder font-sans">
                {respondedDate ? format(respondedDate, 'yyyy.MM.dd HH:mm', { locale: ko }) : ''}
              </Text>
            </View>

            {inquiry.responderName && (
              <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                답변자: {inquiry.responderName}
              </Text>
            )}

            <View className="rounded-lg bg-success-50 p-4 dark:bg-success-900/20">
              <Text className="leading-6 text-content-secondary font-sans">{inquiry.response}</Text>
            </View>
          </Card>
        )}

        {/* 답변 폼 */}
        <InquiryResponseForm
          onSubmit={handleSubmitResponse}
          isSubmitting={isPending}
          existingResponse={inquiry.response}
          currentStatus={inquiry.status}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
