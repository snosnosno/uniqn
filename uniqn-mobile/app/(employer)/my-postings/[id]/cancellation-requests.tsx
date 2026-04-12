/**
 * UNIQN Mobile - 취소 요청 관리 화면
 *
 * @description 구인자가 스태프의 취소 요청을 검토하는 화면
 * @version 1.1.0 - 웹호환성을 위해 Alert 대신 Modal 변경
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { CancellationRequestCard } from '@/components/employer';
import { EmptyState, ErrorState, Loading } from '@/components';
import { InboxIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useApplicantManagement } from '@/hooks/applicant';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useThemeStore } from '@/stores';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import type { Application } from '@/types';

interface StatsHeaderProps {
  pendingCount: number;
}

function StatsHeader({ pendingCount }: StatsHeaderProps) {
  return (
    <View className="flex-row justify-between border-b border-secondary-100 bg-white px-4 py-3 dark:border-surface-overlay dark:bg-surface">
      <View className="flex-row items-center">
        <Badge variant="warning" size="sm" dot>
          대기 {pendingCount}
        </Badge>
      </View>
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">
        검토 대기 요청만 표시됩니다
      </Text>
    </View>
  );
}

export default function CancellationRequestsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode } = useThemeStore();
  const { job: posting, isLoading: isLoadingPosting } = useJobDetail(jobPostingId || '');

  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);

  const {
    cancellationRequests,
    isLoadingCancellationRequests,
    isRefetchingCancellationRequests,
    refreshCancellationRequests,
    reviewCancellation,
    isReviewingCancellation,
    error,
  } = useApplicantManagement(jobPostingId || '', { realtime: true });

  const pendingCount = useMemo(
    () =>
      cancellationRequests.filter((app) => app.cancellationRequest?.status === 'pending').length,
    [cancellationRequests]
  );

  const handleRefresh = useCallback(() => {
    refreshCancellationRequests();
  }, [refreshCancellationRequests]);

  const handleApprove = useCallback((applicationId: string) => {
    setPendingApproveId(applicationId);
    setApproveModalVisible(true);
  }, []);

  const handleConfirmApprove = useCallback(() => {
    if (pendingApproveId) {
      reviewCancellation({
        applicationId: pendingApproveId,
        approved: true,
      });
    }
    setApproveModalVisible(false);
    setPendingApproveId(null);
  }, [pendingApproveId, reviewCancellation]);

  const handleCancelApprove = useCallback(() => {
    setApproveModalVisible(false);
    setPendingApproveId(null);
  }, []);

  const handleReject = useCallback(
    (applicationId: string, reason: string) => {
      reviewCancellation({
        applicationId,
        approved: false,
        rejectionReason: reason,
      });
    },
    [reviewCancellation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Application }) => (
      <View className="px-4 py-2">
        <CancellationRequestCard
          application={item}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={isReviewingCancellation}
        />
      </View>
    ),
    [handleApprove, handleReject, isReviewingCancellation]
  );

  const keyExtractor = useCallback((item: Application) => item.id, []);

  if (isLoadingPosting) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400">
            공고 정보를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (posting && !isCanonicalDatedPosting(posting)) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <ErrorState
          title="지원하지 않는 화면입니다"
          message="고정공고는 1차 범위에서 취소 요청 관리를 지원하지 않습니다."
        />
      </SafeAreaView>
    );
  }

  if (isLoadingCancellationRequests && cancellationRequests.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400">
            취소 요청을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <ErrorState
          title="취소 요청을 불러올 수 없습니다"
          message={error.message}
          onRetry={handleRefresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
      <StatsHeader pendingCount={pendingCount} />

      {cancellationRequests.length === 0 ? (
        <EmptyState
          title="취소 요청이 없습니다"
          description="스태프의 취소 요청이 들어오면 여기에 표시됩니다"
          icon={<InboxIcon size={48} color="#A89C84" />}
          variant="content"
        />
      ) : (
        <FlashList
          data={cancellationRequests}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={200}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingCancellationRequests}
              onRefresh={handleRefresh}
              tintColor={isDarkMode ? '#A89C84' : '#9A9078'}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="취소 요청이 없습니다"
              description="스태프의 취소 요청이 들어오면 여기에 표시됩니다"
              icon={<InboxIcon size={48} color="#A89C84" />}
              variant="content"
            />
          }
        />
      )}

      <Modal
        visible={approveModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleCancelApprove}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 p-4"
          onPress={handleCancelApprove}
        >
          <Pressable
            className="w-full max-w-sm rounded-lg bg-white p-5 dark:bg-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-2 text-lg font-display-semibold text-secondary-900 dark:text-off-white">
              취소 요청 승인
            </Text>
            <Text className="mb-6 text-sm text-secondary-500 dark:text-secondary-400">
              이 취소 요청을 승인하시겠습니까?
              {'\n'}
              승인 시 해당 스태프의 확정은 취소됩니다.
            </Text>

            <View className="flex-row gap-3">
              <Button onPress={handleCancelApprove} variant="outline" className="flex-1">
                취소
              </Button>
              <Button
                onPress={handleConfirmApprove}
                variant="primary"
                className="flex-1 bg-error-500"
                disabled={isReviewingCancellation}
              >
                {isReviewingCancellation ? '처리 중...' : '승인'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
