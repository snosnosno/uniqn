/**
 * UNIQN Mobile - 취소 요청 관리 화면
 *
 * @description 구인자가 스태프의 취소 요청을 검토하는 화면
 * @version 1.1.0 - 웹호환성을 위해 Alert 대신 Modal 변경
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { CancellationRequestCard } from '@/components/employer';
import { EmptyState, ErrorState, Loading } from '@/components';
import { StackHeader } from '@/components/headers';
import { InboxIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ScreenSkeleton } from '@/components/ui';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { useApplicantManagement } from '@/hooks/applicant';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useSubmitGate } from '@/hooks/useSubmitGate';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import type { Application } from '@/types';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';

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
      <Text className="text-sm text-content-secondary font-sans">검토 대기 요청만 표시됩니다</Text>
    </View>
  );
}

export default function CancellationRequestsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { job: posting, isLoading: isLoadingPosting } = useJobDetail(jobPostingId || '');
  const { job: contextJob, isFixed, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${jobPostingId ?? ''}`;
  const headerJobTitle = posting?.title ?? contextJob?.title ?? null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={headerJobTitle} />;
  // 고정 공고는 QR 진입점을 노출하지 않는다 (work_log 행 수명 미해결 — _layout.tsx 주석 참고).
  const headerRightAction = !isFixed ? <HeaderQRAction onPress={handleShowQR} /> : null;

  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);

  const {
    cancellationRequests,
    isLoadingCancellationRequests,
    isRefetchingCancellationRequests,
    refreshCancellationRequests,
    reviewCancellationAsync,
    reviewingCancellationId,
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

  const handleCancelApprove = useCallback(() => {
    setApproveModalVisible(false);
    setPendingApproveId(null);
  }, []);

  // 승인 (CANCEL-14 의 실제 원인) — 결과를 보고 성공에서만 닫는다.
  // 옛 코드는 mutate 직후 동기적으로 닫아, 확인 다이얼로그의 '처리 중...' 라벨이 렌더될 일이
  // 없는 죽은 코드였다. 실패하면 다이얼로그만 사라지고 요청은 그대로 남았다.
  const approveGate = useSubmitGate({
    action: () =>
      reviewCancellationAsync({ applicationId: pendingApproveId ?? '', approved: true }),
    onSuccess: handleCancelApprove,
    errorMessage: '취소 요청 승인 실패',
  });

  const handleConfirmApprove = useCallback(() => {
    if (!pendingApproveId) return;
    void approveGate.submit();
  }, [pendingApproveId, approveGate]);

  const handleReject = useCallback(
    async (applicationId: string, reason: string) => {
      await reviewCancellationAsync({
        applicationId,
        approved: false,
        rejectionReason: reason,
      });
    },
    [reviewCancellationAsync]
  );

  const renderItem = useCallback(
    ({ item }: { item: Application }) => (
      <View className="px-4 py-2">
        <CancellationRequestCard
          application={item}
          onApprove={handleApprove}
          onReject={handleReject}
          // 전역 isPending 을 모든 카드에 뿌리면 1건 처리 중에 목록 전체가 잠긴다(CANCEL-15).
          // 진행 중인 mutation 의 대상 id 와 대조해 **그 카드만** 잠근다.
          isProcessing={reviewingCancellationId === item.id}
        />
      </View>
    ),
    [handleApprove, handleReject, reviewingCancellationId]
  );

  const keyExtractor = useCallback((item: Application) => item.id, []);

  if (isLoadingPosting) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="취소 요청"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-content-secondary font-sans">공고 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (posting && !isCanonicalDatedPosting(posting)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="취소 요청"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <ErrorState
          title="지원하지 않는 화면입니다"
          message="고정공고는 1차 범위에서 취소 요청 관리를 지원하지 않습니다."
        />
      </SafeAreaView>
    );
  }

  if (isLoadingCancellationRequests && cancellationRequests.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="취소 요청"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <ScreenSkeleton type="applicantList" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="취소 요청"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <ErrorState title="취소 요청을 불러올 수 없습니다" error={error} onRetry={handleRefresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="취소 요청"
        titleSuffix={headerTitleSuffix}
        fallbackHref={headerBackHref}
        rightAction={headerRightAction}
      />
      <StatsHeader pendingCount={pendingCount} />

      {cancellationRequests.length === 0 ? (
        <EmptyState
          title="취소 요청이 없습니다"
          description="스태프의 취소 요청이 들어오면 여기에 표시됩니다"
          icon={<InboxIcon size={48} color={SECONDARY_PALETTE[400]} />}
          variant="content"
        />
      ) : (
        <AppFlashList
          data={cancellationRequests}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={200}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingCancellationRequests}
              onRefresh={handleRefresh}
              {...PTR_REFRESH_PROPS}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="취소 요청이 없습니다"
              description="스태프의 취소 요청이 들어오면 여기에 표시됩니다"
              icon={<InboxIcon size={48} color={SECONDARY_PALETTE[400]} />}
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
            <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
              취소 요청 승인
            </Text>
            <Text className="mb-6 text-sm text-content-secondary font-sans">
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
                className="flex-1"
                disabled={approveGate.isSubmitting}
              >
                {approveGate.isSubmitting ? '처리 중...' : '승인'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
