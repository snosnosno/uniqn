/**
 * UNIQN Mobile - Admin Inquiry Detail Screen
 * 관리자 문의 상세 + 답변 화면
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/components/ui';
import { InquiryStatusBadge, InquiryResponseForm } from '@/components/support';
import { useInquiryDetail, useRespondInquiry } from '@/hooks/useInquiry';
import { INQUIRY_CATEGORY_LABELS, toDate } from '@/types';
import type { RespondInquiryInput } from '@/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50 dark:bg-surface-dark">
        <ActivityIndicator size="large" color="#A855F7" />
      </SafeAreaView>
    );
  }

  if (isError || !inquiry) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50 dark:bg-surface-dark">
        <Text className="text-gray-500 dark:text-gray-400">문의를 찾을 수 없습니다</Text>
      </SafeAreaView>
    );
  }

  const createdDate = toDate(inquiry.createdAt);
  const respondedDate = toDate(inquiry.respondedAt);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 문의자 정보 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            문의자 정보
          </Text>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-medium text-gray-900 dark:text-gray-100">
                {inquiry.userName}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{inquiry.userEmail}</Text>
            </View>
            <InquiryStatusBadge status={inquiry.status} />
          </View>
        </Card>

        {/* 문의 내용 */}
        <Card className="mb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {INQUIRY_CATEGORY_LABELS[inquiry.category]}
            </Text>
            <Text className="text-sm text-gray-400 dark:text-gray-500">
              {createdDate ? format(createdDate, 'yyyy.MM.dd HH:mm', { locale: ko }) : ''}
            </Text>
          </View>

          <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {inquiry.subject}
          </Text>

          <View className="rounded-lg bg-gray-50 p-4 dark:bg-surface/50">
            <Text className="leading-6 text-gray-700 dark:text-gray-300">{inquiry.message}</Text>
          </View>

          {/* 첨부파일 */}
          {inquiry.attachments && inquiry.attachments.length > 0 && (
            <View className="mt-4">
              <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                첨부파일 ({inquiry.attachments.length})
              </Text>
              {inquiry.attachments.map((attachment, index) => (
                <View key={index} className="mb-1 rounded-lg bg-gray-100 px-3 py-2 dark:bg-surface">
                  <Text className="text-sm text-gray-700 dark:text-gray-300">
                    {attachment.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* 기존 답변 (있는 경우) */}
        {inquiry.response && (
          <Card className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                <Text className="font-medium text-gray-900 dark:text-gray-100">답변 완료</Text>
              </View>
              <Text className="text-sm text-gray-400 dark:text-gray-500">
                {respondedDate ? format(respondedDate, 'yyyy.MM.dd HH:mm', { locale: ko }) : ''}
              </Text>
            </View>

            {inquiry.responderName && (
              <Text className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                답변자: {inquiry.responderName}
              </Text>
            )}

            <View className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <Text className="leading-6 text-gray-700 dark:text-gray-300">{inquiry.response}</Text>
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
