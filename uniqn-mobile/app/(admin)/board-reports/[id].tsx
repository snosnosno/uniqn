import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import { useAdminBoardReportDetail, useReviewBoardReport } from '@/hooks/useAdminBoardReports';
import { BOARD_TYPE_LABELS, type BoardReportResolutionStatus } from '@/types/board';
import { confirmAction } from '@/utils/confirmAction';
import { toDate, type DateInput } from '@/utils/date';

function formatTimestamp(value: DateInput): string {
  const date = toDate(value);
  if (!date) {
    return '-';
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function getStatusVariant(status: string): 'warning' | 'success' | 'secondary' {
  switch (status) {
    case 'resolved':
      return 'success';
    case 'dismissed':
      return 'secondary';
    default:
      return 'warning';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'resolved':
      return '해결';
    case 'dismissed':
      return '기각';
    default:
      return '대기';
  }
}

export default function AdminBoardReportDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = id ?? '';
  const { data, isLoading, error, refetch } = useAdminBoardReportDetail(reportId);
  const reviewMutation = useReviewBoardReport(reportId);

  const handleReview = (status: BoardReportResolutionStatus) => {
    const label = status === 'resolved' ? '해결' : '기각';

    confirmAction({
      title: '게시판 신고 검토',
      message: `이 게시판 신고를 ${label} 처리할까요?`,
      confirmText: label,
      onConfirm: async () => {
        await reviewMutation.mutateAsync(status);
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '게시판 신고 상세' }} />
        <View className="flex-1 items-center justify-center bg-secondary-50 dark:bg-surface-dark">
          <Loading size="large" message="게시판 신고를 불러오는 중..." />
        </View>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Stack.Screen options={{ title: '게시판 신고 상세' }} />
        <View className="flex-1 bg-secondary-50 dark:bg-surface-dark">
          <EmptyState
            title="게시판 신고를 확인할 수 없습니다"
            description="잠시 후 다시 시도해 주세요."
            icon="error"
            actionLabel="다시 시도"
            onAction={() => refetch()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '게시판 신고 상세' }} />
      <SafeAreaView edges={['bottom']} className="flex-1 bg-secondary-50 dark:bg-surface-dark">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Card className="mb-4">
            <View className="mb-3 flex-row flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(data.report.status)} size="sm">
                {getStatusLabel(data.report.status)}
              </Badge>
              <Badge variant="error" size="sm">
                {data.report.targetType === 'comment' ? '댓글 신고' : '게시글 신고'}
              </Badge>
              {data.post ? (
                <Badge variant="primary" size="sm">
                  {BOARD_TYPE_LABELS[data.post.boardType]}
                </Badge>
              ) : null}
            </View>

            <Text className="mb-2 text-lg font-display-semibold text-secondary-900 dark:text-off-white">
              {data.post?.title ?? '원본 게시글이 삭제되었거나 접근할 수 없습니다.'}
            </Text>
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
              신고자: {data.reporterName}
            </Text>
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400">
              대상 작성자: {data.targetAuthorName ?? '확인 필요'}
            </Text>
            <Text className="text-sm text-secondary-500 dark:text-secondary-400">
              접수 시각: {formatTimestamp(data.report.createdAt)}
            </Text>
          </Card>

          <Card className="mb-4">
            <Text className="mb-2 text-base font-semibold text-secondary-900 dark:text-off-white">
              신고 사유
            </Text>
            <Text className="text-sm leading-6 text-secondary-700 dark:text-secondary-300">
              {data.report.reason}
            </Text>

            {data.report.details ? (
              <>
                <Text className="mb-2 mt-4 text-base font-semibold text-secondary-900 dark:text-off-white">
                  상세 설명
                </Text>
                <Text className="text-sm leading-6 text-secondary-700 dark:text-secondary-300">
                  {data.report.details}
                </Text>
              </>
            ) : null}
          </Card>

          {data.post ? (
            <Card className="mb-4">
              <Text className="mb-2 text-base font-semibold text-secondary-900 dark:text-off-white">
                게시글 본문
              </Text>
              <Text className="text-sm leading-6 text-secondary-700 dark:text-secondary-300">
                {data.post.body}
              </Text>
            </Card>
          ) : null}

          {data.targetComment ? (
            <Card className="mb-4">
              <Text className="mb-2 text-base font-semibold text-secondary-900 dark:text-off-white">
                신고 대상 댓글
              </Text>
              <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400">
                작성자: {data.targetComment.authorName}
              </Text>
              <Text className="text-sm leading-6 text-secondary-700 dark:text-secondary-300">
                {data.targetComment.body}
              </Text>
            </Card>
          ) : null}

          {data.report.status === 'pending' ? (
            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                loading={reviewMutation.isPending}
                onPress={() => handleReview('resolved')}
              >
                해결 처리
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={reviewMutation.isPending}
                onPress={() => handleReview('dismissed')}
              >
                기각
              </Button>
            </View>
          ) : (
            <Card>
              <Text className="text-sm font-medium text-secondary-900 dark:text-off-white">
                처리 상태: {getStatusLabel(data.report.status)}
              </Text>
              <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
                처리 시각: {formatTimestamp(data.report.resolvedAt)}
              </Text>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
