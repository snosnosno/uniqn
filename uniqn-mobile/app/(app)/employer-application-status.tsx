/**
 * UNIQN Mobile - 구인자 신청 현황 화면
 *
 * @description 신청 제출 후 또는 현황 확인 시 진입하는 화면
 * - loading / no-application / pending / approved / rejected 상태 처리
 */

import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Button, Card, Loading } from '@/components';
import { useEmployerApplication } from '@/hooks/auth/useEmployerApplication';
import { toDate } from '@/utils/date';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  duplicate: '중복 계정',
  dummy: '더미/테스트 계정',
  identity_mismatch: '본인인증 불일치',
  other: '기타',
};

// ============================================================================
// Helpers
// ============================================================================

function formatSubmittedAt(iso: string): string {
  const date = toDate(iso);
  if (!date) return '-';
  return format(date, 'yyyy.MM.dd HH:mm', { locale: ko });
}

// ============================================================================
// Status Badge
// ============================================================================

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styleMap = {
    pending: 'bg-warning-100 dark:bg-warning-900/30',
    approved: 'bg-success-50 dark:bg-success-900/30',
    rejected: 'bg-secondary-100 dark:bg-surface-elevated',
  };

  const textMap = {
    pending: 'text-warning-700 dark:text-warning-300',
    approved: 'text-success-700 dark:text-success-300',
    rejected: 'text-content-muted dark:text-secondary-300',
  };

  const labelMap = {
    pending: '심사 중',
    approved: '승인됨',
    rejected: '거부됨',
  };

  return (
    <View className={`self-start rounded-sm px-3 py-1 ${styleMap[status]}`}>
      <Text className={`text-sm font-sans-medium ${textMap[status]}`}>{labelMap[status]}</Text>
    </View>
  );
}

// ============================================================================
// State Screens
// ============================================================================

function NoApplicationScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="구인자 신청" fallbackHref="/(app)/(tabs)/home-jobs" />
      <View className="flex-1 justify-center px-4">
        <Card variant="outlined" padding="lg" className="items-center">
          <Text className="mb-6 text-center text-base text-content-muted dark:text-secondary-400 font-sans">
            아직 구인자 신청 내역이 없습니다.
          </Text>
          <Button
            variant="primary"
            onPress={() => router.replace('/(app)/employer-register')}
            className="w-full"
          >
            <Text className="font-sans-semibold text-content-onGold">구인자 신청하기</Text>
          </Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}

function PendingScreen({ submittedAt }: { submittedAt: string }) {
  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="구인자 신청 현황" fallbackHref="/(app)/(tabs)/home-jobs" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" padding="md" className="mb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              신청 현황
            </Text>
            <StatusBadge status="pending" />
          </View>

          <Text className="mb-2 text-sm text-content-primary dark:text-off-white font-sans">
            구인자 신청이 접수되었습니다.
          </Text>
          <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
            관리자 검토 후 승인 시 알림이 발송됩니다. 평균 1-2시간, 최대 24시간 내 처리됩니다.
          </Text>
        </Card>

        <Card variant="filled" padding="md">
          <View className="flex-row justify-between">
            <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
              신청 일시
            </Text>
            <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
              {formatSubmittedAt(submittedAt)}
            </Text>
          </View>

          <View className="mt-3 rounded-md bg-warning-50 px-3 py-2 dark:bg-warning-900/20">
            <Text className="text-xs text-warning-700 dark:text-warning-300 font-sans">
              심사가 완료될 때까지 재신청이 불가합니다.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ApprovedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="구인자 신청 현황" fallbackHref="/(app)/(tabs)/home-jobs" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" padding="md" className="mb-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              신청 현황
            </Text>
            <StatusBadge status="approved" />
          </View>

          <Text className="text-sm text-content-primary dark:text-off-white font-sans">
            구인자로 승인되었습니다. 공고를 등록하고 스태프를 채용해보세요.
          </Text>
        </Card>

        <Button
          variant="primary"
          onPress={() => router.replace('/(app)/(tabs)/employer')}
          className="w-full"
        >
          <Text className="font-sans-semibold text-content-onGold">공고 관리</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function RejectedScreen({
  rejectionCategory,
  rejectionReason,
}: {
  rejectionCategory: string | null;
  rejectionReason: string | null;
}) {
  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="구인자 신청 현황" fallbackHref="/(app)/(tabs)/home-jobs" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" padding="md" className="mb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              신청 현황
            </Text>
            <StatusBadge status="rejected" />
          </View>

          <Text className="mb-3 text-sm text-content-primary dark:text-off-white font-sans">
            구인자 신청이 거부되었습니다.
          </Text>

          {rejectionCategory ? (
            <View className="mb-2 flex-row">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                거부 사유:{' '}
              </Text>
              <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                {CATEGORY_LABELS[rejectionCategory] ?? rejectionCategory}
              </Text>
            </View>
          ) : null}

          {rejectionReason ? (
            <View className="rounded-md bg-secondary-50 px-3 py-2 dark:bg-surface">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                {rejectionReason}
              </Text>
            </View>
          ) : null}
        </Card>

        <Button
          variant="primary"
          onPress={() => router.replace('/(app)/employer-register')}
          className="mb-3 w-full"
        >
          <Text className="font-sans-semibold text-content-onGold">재신청하기</Text>
        </Button>

        <Text className="text-center text-xs text-content-muted dark:text-secondary-400 font-sans">
          재신청 후 동일한 검토 절차가 진행됩니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Main Screen
// ============================================================================

export default function EmployerApplicationStatusScreen() {
  const { data: application, isLoading } = useEmployerApplication();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="구인자 신청 현황" fallbackHref="/(app)/(tabs)/home-jobs" />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return <NoApplicationScreen />;
  }

  if (application.status === 'pending') {
    return <PendingScreen submittedAt={application.submittedAt} />;
  }

  if (application.status === 'approved') {
    return <ApprovedScreen />;
  }

  return (
    <RejectedScreen
      rejectionCategory={application.rejectionCategory ?? null}
      rejectionReason={application.rejectionReason ?? null}
    />
  );
}
