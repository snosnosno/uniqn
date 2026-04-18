/**
 * UNIQN Mobile - Inquiry Detail Screen
 * 문의 상세 화면
 */

import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { PRIMARY_COLORS } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui';
import { InquiryStatusBadge } from '@/components/support';
import { StackHeader } from '@/components/headers';
import { useInquiryDetail } from '@/hooks/useInquiry';
import { INQUIRY_CATEGORY_LABELS } from '@/types/inquiry';
import { toDate } from '@/utils/date';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

export default function InquiryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inquiry, isLoading, isError } = useInquiryDetail(id);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="문의 상세" fallbackHref="/(app)/support/my-inquiries" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLORS[300]} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !inquiry) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="문의 상세" fallbackHref="/(app)/support/my-inquiries" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-content-muted font-sans">문의를 찾을 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  const createdDate = toDate(inquiry.createdAt);
  const respondedDate = toDate(inquiry.respondedAt);

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
      <StackHeader title="문의 상세" fallbackHref="/(app)/support/my-inquiries" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 문의 정보 */}
        <Card className="mb-4">
          {/* 헤더 */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold">
              {INQUIRY_CATEGORY_LABELS[inquiry.category]}
            </Text>
            <InquiryStatusBadge status={inquiry.status} />
          </View>

          {/* 제목 */}
          <Text
            className="mb-2 text-lg font-display-semibold text-content-primary"
            style={{ letterSpacing: -0.32 }}
          >
            {inquiry.subject}
          </Text>

          {/* 작성일 */}
          <Text
            className="mb-4 text-sm text-content-placeholder font-sans"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {createdDate ? format(createdDate, 'yyyy년 M월 d일 HH:mm', { locale: ko }) : ''}
          </Text>

          {/* 내용 */}
          <View className="rounded-lg bg-surface-page p-4 dark:bg-surface/50">
            <Text className="leading-6 text-content-secondary font-sans">{inquiry.message}</Text>
          </View>

          {/* 첨부파일 */}
          {inquiry.attachments && inquiry.attachments.length > 0 && (
            <View className="mt-4">
              <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
                첨부파일 ({inquiry.attachments.length})
              </Text>
              {inquiry.attachments.map((attachment, index) => (
                <View
                  key={index}
                  className="mb-1 rounded-lg bg-surface-card px-3 py-2 dark:bg-surface"
                >
                  <Text className="text-sm text-content-secondary font-sans">
                    {attachment.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* 답변 */}
        {inquiry.response && (
          <Card>
            <View className="mb-3 flex-row items-center">
              <View className="mr-2 h-2 w-2 rounded-sm bg-success-500" />
              <Text
                className="font-sans-medium text-content-primary"
                style={{ letterSpacing: -0.32 }}
              >
                관리자 답변
              </Text>
            </View>

            {/* 답변일 */}
            <Text
              className="mb-3 text-sm text-content-placeholder font-sans"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {respondedDate ? format(respondedDate, 'yyyy년 M월 d일 HH:mm', { locale: ko }) : ''}
              {inquiry.responderName && ` · ${inquiry.responderName}`}
            </Text>

            {/* 답변 내용 */}
            <View className="rounded-lg bg-success-50 p-4 dark:bg-success-900/20">
              <Text className="leading-6 text-content-secondary font-sans">{inquiry.response}</Text>
            </View>
          </Card>
        )}

        {/* 답변 대기 중 */}
        {!inquiry.response && (
          <Card className="items-center">
            <View className="mb-2 h-12 w-12 items-center justify-center rounded-sm bg-warning-100 dark:bg-warning-900/30">
              <Text className="text-2xl font-sans">{''}</Text>
            </View>
            <Text
              className="mb-1 font-sans-medium text-content-primary"
              style={{ letterSpacing: -0.32 }}
            >
              답변 대기 중
            </Text>
            <Text className="text-center text-sm text-content-muted font-sans">
              영업일 기준 1-2일 내 답변드립니다
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
