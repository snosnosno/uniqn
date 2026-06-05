import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STATUS_COLORS } from '@/constants/colors';
import { StackHeader } from '@/components/headers';
import { Avatar, Button, Card, EmptyState, Loading } from '@/components/ui';
import { ApprovalModal } from '@/components/admin/ApprovalModal';
import { CheckCircleIcon, ExclamationCircleIcon } from '@/components/icons';
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
import { formatE164ToDisplay } from '@/utils/phone';

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

const STATUS_CLASSNAMES = {
  approved: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  rejected: 'bg-secondary-100 text-content-muted dark:bg-surface-elevated dark:text-secondary-300',
  pending: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
} as const;

function getStatusClassName(status: EmployerApplication['status']): string {
  if (status === 'approved') return STATUS_CLASSNAMES.approved;
  if (status === 'rejected') return STATUS_CLASSNAMES.rejected;
  return STATUS_CLASSNAMES.pending;
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
  const [showRejectModal, setShowRejectModal] = useState(false);

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
    mutationFn: (reason?: string) => rejectEmployerApplication({ applicationId, reason }),
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
    // 거부 사유 입력 모달 — 기존엔 confirmAction 단순 확인이라 reason이 항상 빈 값으로
    // 전송돼 신청자가 거부 이유를 알 수 없었다.
    setShowRejectModal(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청 상세" fallbackHref="/(admin)/employer-applications" />
        <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface">
          <Loading size="large" message="신청 정보를 불러오는 중..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !app) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청 상세" fallbackHref="/(admin)/employer-applications" />
        <View className="flex-1 bg-surface-page dark:bg-surface">
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
  const applicant = app.applicant;
  const reviewer = app.reviewer;
  // 본인인증 완료 기준 = identity_verified (phone_verified 가 아님)
  const identityVerified = applicant?.identityVerified === true;
  const primaryName = applicant?.nickname || applicant?.name || `신청자 ${app.userId.slice(0, 8)}`;
  const reviewerName = reviewer?.nickname || reviewer?.name;

  const handleCallPhone = () => {
    if (!applicant?.phone) return;
    const digits = applicant.phone.replace(/[^\d+]/g, '');
    void Linking.openURL(`tel:${digits}`);
  };

  const handleSendEmail = () => {
    if (!applicant?.email) return;
    void Linking.openURL(`mailto:${applicant.email}`);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page dark:bg-surface">
      <StackHeader title="구인자 신청 상세" fallbackHref="/(admin)/employer-applications" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Card 1 — 신청자 헤더 (상태 + 아바타 + 표시명) */}
        <Card className="mb-4">
          <View className="mb-3 flex-row flex-wrap items-center gap-2">
            <View className={`rounded-sm px-2.5 py-1 ${getStatusClassName(app.status)}`}>
              <Text className="text-xs font-sans-medium">{getStatusLabel(app.status)}</Text>
            </View>
            {!identityVerified && applicant ? (
              <View className="rounded-sm bg-error-50 px-2.5 py-1 dark:bg-error-900/30">
                <Text className="text-xs font-sans-medium text-error-700 dark:text-error-300">
                  본인인증 미완료
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row items-center gap-3">
            <Avatar size="lg" name={primaryName} source={applicant?.photoURL ?? undefined} />
            <View className="flex-1">
              <Text
                className="text-lg font-sans-semibold text-content-primary dark:text-off-white"
                numberOfLines={1}
              >
                {primaryName}
              </Text>
              <Text className="text-xs text-content-placeholder font-sans">
                ID: {app.userId.slice(0, 8)}…
              </Text>
            </View>
          </View>

          <View className="mt-3 border-t border-divider pt-3">
            <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              신청 시각: {formatTimestamp(app.submittedAt)}
            </Text>

            {app.reviewedAt ? (
              <Text className="mb-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                처리 시각: {formatTimestamp(app.reviewedAt)}
                {reviewerName ? ` (처리자: ${reviewerName})` : ''}
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
          </View>
        </Card>

        {/* Card 2 — 본인인증 정보 */}
        {applicant ? (
          <Card className="mb-4">
            <View className="mb-3 flex-row items-center">
              {identityVerified ? (
                <CheckCircleIcon size={20} color={STATUS_COLORS.success} />
              ) : (
                <ExclamationCircleIcon size={20} color={STATUS_COLORS.error} />
              )}
              <Text className="ml-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
                본인인증 정보
              </Text>
            </View>

            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                이름
              </Text>
              <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                {applicant.name || '-'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                연락처
              </Text>
              {applicant.phone ? (
                <Pressable
                  onPress={handleCallPhone}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatE164ToDisplay(applicant.phone)}로 전화`}
                >
                  <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400 underline">
                    {formatE164ToDisplay(applicant.phone)}
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  -
                </Text>
              )}
            </View>

            <View
              className={`mt-2 rounded-md px-3 py-2 ${
                identityVerified
                  ? 'bg-success-50 dark:bg-success-900/20'
                  : 'bg-error-50 dark:bg-error-900/20'
              }`}
            >
              <Text
                className={`text-sm font-sans ${
                  identityVerified
                    ? 'text-success-700 dark:text-success-400'
                    : 'text-error-700 dark:text-error-400'
                }`}
              >
                {identityVerified
                  ? '본인인증이 완료된 신청자입니다'
                  : '본인인증이 완료되지 않았습니다'}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Card 3 — 프로필 정보 */}
        {applicant ? (
          <Card className="mb-4">
            <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
              프로필 정보
            </Text>

            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                닉네임
              </Text>
              <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                {applicant.nickname || '-'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                이메일
              </Text>
              {applicant.email ? (
                <Pressable
                  onPress={handleSendEmail}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`${applicant.email}로 이메일`}
                >
                  <Text
                    className="text-sm font-sans-medium text-primary-600 dark:text-primary-400 underline"
                    numberOfLines={1}
                  >
                    {applicant.email}
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  -
                </Text>
              )}
            </View>
          </Card>
        ) : null}

        {/* Card — 구인 소개 */}
        <Card className="mb-4">
          <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
            구인 소개
          </Text>
          <Text className="text-sm leading-5 text-content-primary dark:text-off-white font-sans">
            {app.intro && app.intro.trim().length > 0 ? app.intro : '-'}
          </Text>
        </Card>

        {/* Card 2 — 약관 동의 스냅샷 */}
        <Card className="mb-4">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-3">
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

      <ApprovalModal
        visible={showRejectModal}
        mode="reject"
        postingTitle={`${primaryName} 구인자 신청`}
        isProcessing={rejectMutation.isPending}
        onCancel={() => setShowRejectModal(false)}
        onConfirm={(reason) => {
          setShowRejectModal(false);
          void rejectMutation.mutateAsync(reason);
        }}
      />
    </SafeAreaView>
  );
}
