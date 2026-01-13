/**
 * UNIQN Mobile - 취소 요청 관리 화면
 *
 * @description 구인자가 스태프의 취소 요청을 검토하는 화면
 * @version 1.0.0
 */

import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { CancellationRequestCard } from '@/components/employer';
import { Loading, ErrorState, EmptyState } from '@/components';
import { Badge } from '@/components/ui/Badge';
import { InboxIcon } from '@/components/icons';
import { useApplicantManagement } from '@/hooks/useApplicantManagement';
import { useThemeStore } from '@/stores';
import type { Application } from '@/types';

// ============================================================================
// Stats Header Component
// ============================================================================

interface StatsHeaderProps {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

function StatsHeader({ pendingCount, approvedCount, rejectedCount }: StatsHeaderProps) {
  return (
    <View className="flex-row justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
      <View className="flex-row items-center">
        <Badge variant="warning" size="sm" dot>
          대기 {pendingCount}
        </Badge>
      </View>
      <View className="flex-row items-center gap-2">
        <Badge variant="success" size="sm">
          승인 {approvedCount}
        </Badge>
        <Badge variant="error" size="sm">
          거절 {rejectedCount}
        </Badge>
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CancellationRequestsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode } = useThemeStore();
  const [refreshing, setRefreshing] = useState(false);

  const {
    cancellationRequests,
    isLoadingCancellationRequests,
    refreshCancellationRequests,
    reviewCancellation,
    isReviewingCancellation,
    error,
  } = useApplicantManagement(jobPostingId || '');

  // 상태별 카운트 계산
  const stats = useMemo(() => {
    const pending = cancellationRequests.filter(
      (app) => app.cancellationRequest?.status === 'pending'
    ).length;
    const approved = cancellationRequests.filter(
      (app) => app.cancellationRequest?.status === 'approved'
    ).length;
    const rejected = cancellationRequests.filter(
      (app) => app.cancellationRequest?.status === 'rejected'
    ).length;

    return { pending, approved, rejected };
  }, [cancellationRequests]);

  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshCancellationRequests();
    setRefreshing(false);
  }, [refreshCancellationRequests]);

  // 승인 핸들러
  const handleApprove = useCallback(
    (applicationId: string) => {
      Alert.alert(
        '취소 요청 승인',
        '이 취소 요청을 승인하시겠습니까?\n승인 시 해당 스태프의 확정이 취소됩니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '승인',
            style: 'destructive',
            onPress: () => {
              reviewCancellation({
                applicationId,
                approved: true,
              });
            },
          },
        ]
      );
    },
    [reviewCancellation]
  );

  // 거절 핸들러
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

  // 카드 렌더 함수
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

  // 키 추출 함수
  const keyExtractor = useCallback((item: Application) => item.id, []);

  // 로딩 상태
  if (isLoadingCancellationRequests && cancellationRequests.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            취소 요청을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
        <ErrorState
          title="취소 요청을 불러올 수 없습니다"
          message={error.message}
          onRetry={handleRefresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      {/* 통계 헤더 */}
      <StatsHeader
        pendingCount={stats.pending}
        approvedCount={stats.approved}
        rejectedCount={stats.rejected}
      />

      {/* 취소 요청 목록 */}
      {cancellationRequests.length === 0 ? (
        <EmptyState
          title="취소 요청이 없습니다"
          description="스태프의 취소 요청이 들어오면 여기에 표시됩니다."
          icon={<InboxIcon size={48} color="#9CA3AF" />}
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
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="취소 요청이 없습니다"
              description="스태프의 취소 요청이 들어오면 여기에 표시됩니다."
              icon={<InboxIcon size={48} color="#9CA3AF" />}
              variant="content"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
