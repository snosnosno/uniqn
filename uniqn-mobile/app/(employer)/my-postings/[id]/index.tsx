/**
 * UNIQN Mobile - 공고 상세 화면
 * 구인자의 공고 상세 정보 및 관리
 */

import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobDetail } from '@/hooks/useJobDetail';
import { Card, Badge, Loading, ErrorState } from '@/components';
import {
  MapPinIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ChevronRightIcon,
  EditIcon,
  BanknotesIcon,
  XCircleIcon,
} from '@/components/icons';
import { useApplicantManagement } from '@/hooks/useApplicantManagement';

// ============================================================================
// Types
// ============================================================================

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: { label: string; variant: 'primary' | 'success' | 'warning' | 'error' };
  onPress: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

function ActionCard({ icon, title, description, badge, onPress }: ActionCardProps) {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <Card variant="elevated" padding="md" className="flex-row items-center">
        <View className="h-12 w-12 rounded-full bg-primary-50 dark:bg-primary-900/30 items-center justify-center mr-4">
          {icon}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mr-2">
              {title}
            </Text>
            {badge && (
              <Badge variant={badge.variant} size="sm">
                {badge.label}
              </Badge>
            )}
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </Text>
        </View>
        <ChevronRightIcon size={20} color="#9CA3AF" />
      </Card>
    </Pressable>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function JobPostingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { job: posting, isLoading, error, refresh } = useJobDetail(id || '');
  const { cancellationPendingCount } = useApplicantManagement(id || '');

  // 지원자 관리로 이동
  const handleApplicants = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/applicants`);
  }, [router, id]);

  // 정산 관리로 이동
  const handleSettlements = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/settlements`);
  }, [router, id]);

  // 공고 수정
  const handleEdit = useCallback(() => {
    // TODO: 공고 수정 화면으로 이동
    router.push(`/(employer)/my-postings/${id}/edit`);
  }, [router, id]);

  // 취소 요청 관리로 이동
  const handleCancellationRequests = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/cancellation-requests`);
  }, [router, id]);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error || !posting) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <ErrorState
          title="공고를 불러올 수 없습니다"
          message={error?.message || '공고 정보를 찾을 수 없습니다.'}
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    draft: { label: '임시저장', variant: 'warning' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;
  const applicantCount = posting.applicationCount || 0;
  const confirmedCount = posting.filledPositions || 0;
  const totalPositions = posting.totalPositions || 0;
  const pendingCount = applicantCount - confirmedCount;

  // 급여 표시 (salary 객체에서 추출)
  const salaryAmount = posting.salary?.amount || 0;
  const salaryTypeLabel = posting.salary?.type === 'hourly' ? '시급' :
                          posting.salary?.type === 'daily' ? '일급' :
                          posting.salary?.type === 'monthly' ? '월급' : '급여';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* 공고 정보 카드 */}
        <View className="px-4 pt-4">
          <Card variant="elevated" padding="lg">
            {/* 헤더 */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="flex-1 text-xl font-bold text-gray-900 dark:text-white" numberOfLines={2}>
                {posting.title}
              </Text>
              <Badge variant={status.variant} size="md">
                {status.label}
              </Badge>
            </View>

            {/* 장소 */}
            <View className="flex-row items-center mb-3">
              <MapPinIcon size={18} color="#2563EB" />
              <Text className="ml-2 text-base text-gray-700 dark:text-gray-300">
                {posting.location.name}
              </Text>
            </View>

            {/* 날짜/시간 */}
            <View className="flex-row items-center mb-3">
              <ClockIcon size={18} color="#2563EB" />
              <Text className="ml-2 text-base text-gray-700 dark:text-gray-300">
                {posting.workDate} {posting.timeSlot}
              </Text>
            </View>

            {/* 급여 */}
            <View className="flex-row items-center mb-4">
              <CurrencyDollarIcon size={18} color="#2563EB" />
              <Text className="ml-2 text-base text-gray-700 dark:text-gray-300">
                {salaryTypeLabel} {salaryAmount.toLocaleString()}원
              </Text>
            </View>

            {/* 모집 현황 */}
            <View className="flex-row justify-around p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {applicantCount}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">총 지원자</Text>
              </View>
              <View className="w-px bg-gray-200 dark:bg-gray-700" />
              <View className="items-center">
                <Text className="text-2xl font-bold text-success-600 dark:text-success-400">
                  {confirmedCount}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">확정</Text>
              </View>
              <View className="w-px bg-gray-200 dark:bg-gray-700" />
              <View className="items-center">
                <Text className="text-2xl font-bold text-warning-600 dark:text-warning-400">
                  {pendingCount > 0 ? pendingCount : 0}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">대기중</Text>
              </View>
              <View className="w-px bg-gray-200 dark:bg-gray-700" />
              <View className="items-center">
                <Text className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {totalPositions}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">모집인원</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* 관리 메뉴 */}
        <View className="px-4 py-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            관리
          </Text>

          <View className="space-y-3">
            {/* 지원자 관리 */}
            <ActionCard
              icon={<UsersIcon size={24} color="#2563EB" />}
              title="지원자 관리"
              description={`${pendingCount > 0 ? pendingCount : 0}명의 지원자가 대기중입니다`}
              badge={pendingCount > 0 ? { label: `${pendingCount}명`, variant: 'warning' } : undefined}
              onPress={handleApplicants}
            />

            {/* 취소 요청 관리 */}
            <ActionCard
              icon={<XCircleIcon size={24} color="#EF4444" />}
              title="취소 요청 관리"
              description="스태프의 취소 요청 검토"
              badge={cancellationPendingCount > 0 ? { label: `${cancellationPendingCount}건`, variant: 'error' } : undefined}
              onPress={handleCancellationRequests}
            />

            {/* 정산 관리 */}
            <ActionCard
              icon={<BanknotesIcon size={24} color="#10B981" />}
              title="정산 관리"
              description="스태프 근무 기록 및 정산"
              onPress={handleSettlements}
            />

            {/* 공고 수정 */}
            <ActionCard
              icon={<EditIcon size={24} color="#6B7280" />}
              title="공고 수정"
              description="공고 내용 수정 및 상태 변경"
              onPress={handleEdit}
            />
          </View>
        </View>

        {/* 공고 설명 */}
        {posting.description && (
          <View className="px-4 pb-6">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              공고 내용
            </Text>
            <Card variant="outlined" padding="md">
              <Text className="text-base text-gray-700 dark:text-gray-300 leading-6">
                {posting.description}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
