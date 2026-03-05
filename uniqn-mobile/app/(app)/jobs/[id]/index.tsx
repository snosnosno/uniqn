/**
 * UNIQN Mobile - Job Detail Screen (Authenticated)
 * 구인공고 상세 화면 (인증 필요)
 *
 * @version 1.0.0
 *
 * @description
 * 로그인한 사용자를 위한 공고 상세 화면입니다.
 * 공개 상세 페이지(/(public)/jobs/[id])와 달리 바로 지원이 가능합니다.
 */

import { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ShareIcon } from '@/components/icons';
import { JobDetail } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui';
import { useJobDetail, useApplications, useAuth, useShare } from '@/hooks';
import { useThemeStore } from '@/stores';
import { getLayoutColor } from '@/constants/colors';
import { STATUS } from '@/constants';
import { trackJobView } from '@/services/observability';

// ============================================================================
// Custom Header Component
// ============================================================================

interface CustomHeaderProps {
  title?: string;
  onShare?: () => void;
  isSharing?: boolean;
}

function CustomHeader({ title, onShare, isSharing }: CustomHeaderProps) {
  const { isDarkMode } = useThemeStore();

  return (
    <View className="flex-row items-center px-4 py-3 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-surface-overlay">
      <Pressable
        onPress={() => router.back()}
        className="p-2 -ml-2 mr-2"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronLeftIcon size={24} color={isDarkMode ? '#ffffff' : '#1A1625'} />
      </Pressable>
      <Text className="text-base font-semibold text-gray-900 dark:text-white">공고 상세</Text>
      {title && (
        <>
          <Text className="mx-2 text-gray-400 dark:text-gray-500">|</Text>
          <Text className="flex-1 text-base text-gray-600 dark:text-gray-400" numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
      {/* 공유 버튼 */}
      {onShare && (
        <Pressable
          onPress={onShare}
          disabled={isSharing}
          className="p-2 -mr-2 ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="공고 공유하기"
          accessibilityRole="button"
        >
          <ShareIcon size={22} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
        </Pressable>
      )}
    </View>
  );
}

// ============================================================================
// Loading Component
// ============================================================================

function LoadingState() {
  return <Loading variant="layout" message="공고 정보를 불러오는 중..." />;
}

// ============================================================================
// Error Component
// ============================================================================

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-surface-dark">
      <Text className="text-4xl mb-4">😢</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        오류가 발생했습니다
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">{message}</Text>
      <Button onPress={onRetry} variant="outline">
        다시 시도
      </Button>
    </View>
  );
}

// ============================================================================
// Screen Component
// ============================================================================

export default function AuthenticatedJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((s) => s.isDarkMode);
  const { user } = useAuth();
  const { hasApplied, getApplicationStatus } = useApplications();
  const { shareJob, isSharing } = useShare();

  const { job, isLoading, isRefreshing, error, refresh } = useJobDetail(id ?? '');

  // 공유 버튼 핸들러
  const handleShare = useCallback(() => {
    if (job) {
      // location이 객체인 경우 name 추출, 문자열인 경우 그대로 사용
      const locationStr =
        typeof job.location === 'string' ? job.location : (job.location?.name ?? '');

      shareJob({
        id: job.id,
        title: job.title,
        location: locationStr,
        workDate: job.workDate,
      });
    }
  }, [job, shareJob]);

  // 공고 조회 추적
  useEffect(() => {
    if (job && user) {
      trackJobView(job.id, job.title);
    }
  }, [job, user]);

  // 지원하기 버튼 핸들러 (로그인 상태이므로 바로 지원 페이지로)
  const handleApply = useCallback(() => {
    router.push(`/(app)/jobs/${id}/apply`);
  }, [id]);

  // 지원 취소 핸들러 (취소 요청 페이지로 이동)
  const handleCancelRequest = useCallback(() => {
    const application = getApplicationStatus(id ?? '');
    if (application) {
      router.push(`/(app)/applications/${application.id}/cancel`);
    }
  }, [id, getApplicationStatus]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <CustomHeader />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <CustomHeader />
        <ErrorState message={error?.message ?? '공고를 찾을 수 없습니다'} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  // 지원 상태 확인
  const alreadyApplied = hasApplied(job.id);
  const applicationStatus = getApplicationStatus(job.id);

  // 지원 상태별 메시지
  const getStatusMessage = () => {
    if (!applicationStatus) return null;

    switch (applicationStatus.status) {
      case STATUS.APPLICATION.APPLIED:
      case STATUS.APPLICATION.PENDING:
        return '지원 완료 - 검토 중';
      case STATUS.APPLICATION.CONFIRMED:
        return '지원 승인됨';
      case STATUS.APPLICATION.REJECTED:
        return '지원이 거절되었습니다';
      case STATUS.APPLICATION.CANCELLED:
        return '지원이 취소되었습니다';
      default:
        return null;
    }
  };

  // 취소 요청 가능 여부 (확정된 지원만)
  const canRequestCancel =
    applicationStatus?.status === STATUS.APPLICATION.CONFIRMED &&
    !applicationStatus?.cancellationRequest;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <CustomHeader title={job.title} onShare={handleShare} isSharing={isSharing} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={getLayoutColor(isDark, 'refreshTint')}
          />
        }
      >
        <JobDetail job={job} />
      </ScrollView>

      {/* 하단 액션 버튼 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-surface border-t border-gray-200 dark:border-surface-overlay p-4">
        <SafeAreaView edges={['bottom']}>
          {alreadyApplied ? (
            <View className="items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {getStatusMessage()}
              </Text>
              <View className="flex-row w-full">
                <View className="flex-1 mr-2">
                  <Button
                    onPress={() => router.push('/(app)/(tabs)/schedule')}
                    variant="outline"
                    fullWidth
                  >
                    내 지원 현황
                  </Button>
                </View>
                {canRequestCancel && (
                  <View className="flex-1">
                    <Button onPress={handleCancelRequest} variant="ghost" fullWidth>
                      취소 요청
                    </Button>
                  </View>
                )}
              </View>
            </View>
          ) : job.status !== STATUS.JOB_POSTING.ACTIVE ? (
            <Button disabled fullWidth>
              마감된 공고입니다
            </Button>
          ) : (
            <Button onPress={handleApply} fullWidth>
              지원하기
            </Button>
          )}
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
