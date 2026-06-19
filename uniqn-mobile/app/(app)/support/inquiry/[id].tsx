/**
 * UNIQN Mobile - Inquiry Detail Screen
 * 문의 상세 화면
 */

import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { PRIMARY_COLORS, STATUS_COLORS } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Card, NumericText, Button } from '@/components/ui';
import { ClockIcon } from '@/components/icons';
import { InquiryStatusBadge, InquiryAttachmentGallery } from '@/components/support';
import { StackHeader } from '@/components/headers';
import { useInquiryDetail } from '@/hooks/useInquiry';
import { INQUIRY_CATEGORY_LABELS } from '@/types/inquiry';
import { toDate } from '@/utils/date';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

export default function InquiryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inquiry, isLoading, isError, refetch, isRefetching } = useInquiryDetail(id);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/support/my-inquiries');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="문의 상세" fallbackHref="/(app)/support/my-inquiries" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLORS[300]} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !inquiry) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="문의 상세" fallbackHref="/(app)/support/my-inquiries" />
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="mb-2 text-center text-lg font-display-semibold text-content-primary dark:text-secondary-100">
            문의를 불러오지 못했어요
          </Text>
          <Text className="mb-6 text-center text-sm text-content-secondary font-sans">
            일시적인 네트워크 문제일 수 있어요. 잠시 후 다시 시도해주세요.
          </Text>
          <View className="flex-row gap-3">
            <Button variant="outline" onPress={handleGoBack}>
              목록으로
            </Button>
            <Button onPress={() => refetch()} loading={isRefetching}>
              다시 시도
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const createdDate = toDate(inquiry.createdAt);
  const respondedDate = toDate(inquiry.respondedAt);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="문의 상세" fallbackHref="/(app)/support/my-inquiries" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 문의 정보 */}
        <Card className="mb-4">
          {/* 헤더 */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold">
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
          <NumericText className="mb-4 text-sm text-content-placeholder font-sans">
            {createdDate ? format(createdDate, 'yyyy년 M월 d일 HH:mm', { locale: ko }) : ''}
          </NumericText>

          {/* 내용 */}
          <View className="rounded-lg bg-surface-page dark:bg-surface p-4">
            <Text className="leading-6 text-content-secondary font-sans">{inquiry.message}</Text>
          </View>

          {/* 첨부파일 */}
          <InquiryAttachmentGallery attachments={inquiry.attachments ?? []} />
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
            <NumericText className="mb-3 text-sm text-content-placeholder font-sans">
              {respondedDate ? format(respondedDate, 'yyyy년 M월 d일 HH:mm', { locale: ko }) : ''}
              {inquiry.responderName && ` · ${inquiry.responderName}`}
            </NumericText>

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
              <ClockIcon size={24} color={STATUS_COLORS.warning} />
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
