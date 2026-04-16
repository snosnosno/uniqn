import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StackHeader } from '@/components/headers';
import { Button, Card, EmptyState, Loading } from '@/components/ui';
import { useToastStore } from '@/stores/toastStore';
import { queryKeys } from '@/lib/queryClient';
import type { EmployerApplication } from '@/repositories';
import {
  approveEmployerApplication,
  getEmployerApplication,
  rejectEmployerApplication,
} from '@/services/admin';
import { confirmAction } from '@/utils/confirmAction';
import { toDate } from '@/utils/date';

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '-';
  const date = toDate(value);
  if (!date) return '-';

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function getStatusClassName(status: EmployerApplication['status']): string {
  switch (status) {
    case 'approved':
      return 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300';
    case 'rejected':
      return 'bg-secondary-100 text-content-muted dark:bg-surface-elevated dark:text-secondary-300';
    default:
      return 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300';
  }
}

function getStatusLabel(status: EmployerApplication['status']): string {
  switch (status) {
    case 'approved':
      return '승인됨';
    case 'rejected':
      return '거부됨';
    default:
      return '대기 중';
  }
}

// ============================================================================
// Hook
// ============================================================================

function useApplicationDetail(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.employerApplications.adminDetail(applicationId),
    // Service 경유로 requireAdminUser() guard 일관 적용
    queryFn: () => getEmployerApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Page
// ============================================================================

export default function AdminEmployerApplicationDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = id ?? '';
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToastStore();

  const { data: app, isLoading, error, refetch } = useApplicationDetail(applicationId);

  const approveMutation = useMutation({
    mutationFn: () => approveEmployerApplication(applicationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.employerApplications.all });
      toastSuccess('구인자 신청을 승인했습니다.');
      router.back();
    },
    onError: (err: unknown) => {
      toastError(err instanceof Error ? err.message : '승인에 실패했습니다.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.employerApplications.all });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectEmployerApplication({ applicationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.employerApplications.all });
      toastSuccess('구인자 신청을 거부했습니다.');
      router.back();
    },
    onError: (err: unknown) => {
      toastError(err instanceof Error ? err.message : '거부에 실패했습니다.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.employerApplications.all });
    },
  });

  const handleApprove = () => {
    confirmAction({
      title: '구인자 신청 승인',
      message: '이 신청을 승인하면 즉시 구인자 권한이 부여됩니다.',
      confirmText: '승인',
      onConfirm: async () => {
        await approveMutation.mutateAsync();
      },
    });
  };

  const handleReject = () => {
    confirmAction({
      title: '구인자 신청 거부',
      message: '이 신청을 거부하시겠습니까?',
      confirmText: '거부',
      destructive: true,
      onConfirm: async () => {
        await rejectMutation.mutateAsync();
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청 상세" fallbackHref="/(admin)/employer-applications" />
        <View className="flex-1 items-center justify-center bg-surface-page">
          <Loading size="large" message="신청 정보를 불러오는 중..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !app) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청 상세" fallbackHref="/(admin)/employer-applications" />
        <View className="flex-1 bg-surface-page">
          <EmptyState
            title="신청 정보를 확인할 수 없습니다"
            description="잠시 후 다시 시도해 주세요."
            icon="error"
            actionLabel="다시 시도"
            onAction={() => refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const snapshot = app.agreementsSnapshot ?? {};
  const isSeeded = snapshot._seeded === true;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page">
      <StackHeader title="구인자 신청 상세" fallbackHref="/(admin)/employer-applications" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Card 1 — 신청자 정보 */}
        <Card className="mb-4">
          <View className="mb-3 flex-row flex-wrap items-center gap-2">
            <View className={`rounded-sm px-2.5 py-1 ${getStatusClassName(app.status)}`}>
              <Text className="text-xs font-sans-medium">{getStatusLabel(app.status)}</Text>
            </View>
          </View>

          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            신청자 ID: {app.userId.slice(0, 8)}...
          </Text>
          <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            신청 시각: {formatTimestamp(app.submittedAt)}
          </Text>

          {app.reviewedAt ? (
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              처리 시각: {formatTimestamp(app.reviewedAt)}
            </Text>
          ) : null}

          {app.rejectionReason ? (
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              거부 사유: {app.rejectionReason}
            </Text>
          ) : null}

          {app.rejectionCategory ? (
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              거부 분류: {app.rejectionCategory}
            </Text>
          ) : null}
        </Card>

        {/* Card 2 — 약관 동의 스냅샷 */}
        <Card className="mb-4">
          <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
            약관 동의 스냅샷
          </Text>

          {isSeeded ? (
            <View className="mb-3 rounded-sm bg-secondary-100 px-3 py-2 dark:bg-surface-elevated">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                시스템 시딩된 기존 계정
              </Text>
            </View>
          ) : null}

          {'termsVersion' in snapshot && snapshot.termsVersion ? (
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              이용약관 버전: {String(snapshot.termsVersion)}
            </Text>
          ) : null}

          {'termsAcceptedAt' in snapshot && snapshot.termsAcceptedAt ? (
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              이용약관 동의 시각: {formatTimestamp(String(snapshot.termsAcceptedAt))}
            </Text>
          ) : null}

          {'liabilityWaiverVersion' in snapshot && snapshot.liabilityWaiverVersion ? (
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              면책 동의 버전: {String(snapshot.liabilityWaiverVersion)}
            </Text>
          ) : null}

          {'liabilityWaiverAcceptedAt' in snapshot && snapshot.liabilityWaiverAcceptedAt ? (
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              면책 동의 시각: {formatTimestamp(String(snapshot.liabilityWaiverAcceptedAt))}
            </Text>
          ) : null}

          {!isSeeded &&
          !snapshot.termsVersion &&
          !snapshot.termsAcceptedAt &&
          !snapshot.liabilityWaiverVersion &&
          !snapshot.liabilityWaiverAcceptedAt ? (
            <Text className="text-sm text-content-placeholder font-sans">동의 정보 없음</Text>
          ) : null}
        </Card>

        {/* 하단 액션 */}
        {app.status === 'pending' ? (
          <View className="flex-row gap-3">
            <Button
              className="flex-1"
              loading={approveMutation.isPending}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              onPress={handleApprove}
            >
              승인
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={approveMutation.isPending || rejectMutation.isPending}
              onPress={handleReject}
            >
              거부
            </Button>
          </View>
        ) : (
          <Card>
            <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
              처리 상태: {getStatusLabel(app.status)}
            </Text>
            {app.reviewedAt ? (
              <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                처리 시각: {formatTimestamp(app.reviewedAt)}
              </Text>
            ) : null}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
