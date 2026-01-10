/**
 * UNIQN Mobile - 공고 상세 화면
 * 구인자의 공고 상세 정보 및 관리
 *
 * @description v2.0 - dateSpecificRequirements, roleSalaries 지원
 * @version 2.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
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
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  BanknotesIcon,
  XCircleIcon,
  DocumentIcon,
} from '@/components/icons';
import { useApplicantManagement } from '@/hooks/useApplicantManagement';
import {
  PostingTypeBadge,
  DateRequirementDisplay,
  RoleSalaryDisplay,
} from '@/components/jobs';
import type { PostingType, Allowances } from '@/types';

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
// Constants
// ============================================================================

/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

// ============================================================================
// Helpers
// ============================================================================

/**
 * 수당 정보 문자열 배열 생성
 */
const getAllowanceItems = (allowances?: Allowances): string[] => {
  if (!allowances) return [];
  const items: string[] = [];

  // 보장시간
  if (allowances.guaranteedHours && allowances.guaranteedHours > 0) {
    items.push(`보장 ${allowances.guaranteedHours}시간`);
  }

  // 식비
  if (allowances.meal === PROVIDED_FLAG) {
    items.push('식사제공');
  } else if (allowances.meal && allowances.meal > 0) {
    items.push(`식비 ${allowances.meal.toLocaleString()}원`);
  }

  // 교통비
  if (allowances.transportation === PROVIDED_FLAG) {
    items.push('교통비제공');
  } else if (allowances.transportation && allowances.transportation > 0) {
    items.push(`교통비 ${allowances.transportation.toLocaleString()}원`);
  }

  // 숙박비
  if (allowances.accommodation === PROVIDED_FLAG) {
    items.push('숙박제공');
  } else if (allowances.accommodation && allowances.accommodation > 0) {
    items.push(`숙박비 ${allowances.accommodation.toLocaleString()}원`);
  }

  return items;
};

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

  // 정보 섹션 펼치기/접기 상태 (기본: 접힌 상태)
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  // 정보 섹션 토글
  const handleToggleInfo = useCallback(() => {
    setIsInfoExpanded(prev => !prev);
  }, []);

  // 수당 정보 (v2.0) - hooks는 조건부 반환 전에 호출해야 함
  const allowanceItems = useMemo(
    () => getAllowanceItems(posting?.allowances),
    [posting?.allowances]
  );

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

  // 안전한 값 추출
  const safeTitle = String(posting.title || '제목 없음');
  const safeLocationName = typeof posting.location === 'string'
    ? posting.location
    : (posting.location?.name || '장소 미정');

  // dateSpecificRequirements 유무 확인 (v2.0)
  const hasDateRequirements = posting.dateSpecificRequirements && posting.dateSpecificRequirements.length > 0;

  // 사전질문 개수 (v2.0)
  const preQuestionCount = posting.usesPreQuestions && posting.preQuestions ? posting.preQuestions.length : 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* 공고 정보 카드 */}
        <View className="px-4 pt-4">
          <Card variant="elevated" padding="lg">
            {/* 공고 타입 뱃지 (v2.0) - regular가 아닌 경우만 표시 */}
            {posting.postingType && posting.postingType !== 'regular' && (
              <View className="mb-2">
                <PostingTypeBadge
                  type={posting.postingType as PostingType}
                  size="sm"
                />
              </View>
            )}

            {/* 헤더: 제목 + 상태뱃지 + 접기버튼 */}
            <View className="flex-row items-start justify-between mb-4">
              {/* 제목 */}
              <Text className="flex-1 text-xl font-bold text-gray-900 dark:text-white mr-3" numberOfLines={2}>
                {safeTitle}
              </Text>
              {/* 상태뱃지 + 접기/펼치기 버튼 */}
              <View className="flex-row items-center">
                <Badge variant={status.variant} size="sm" className="mr-2">
                  {status.label}
                </Badge>
                <Pressable
                  onPress={handleToggleInfo}
                  className="flex-row items-center px-2 py-1 rounded-lg active:bg-gray-100 dark:active:bg-gray-700"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                    {isInfoExpanded ? '접기' : '상세'}
                  </Text>
                  {isInfoExpanded ? (
                    <ChevronUpIcon size={16} color="#9CA3AF" />
                  ) : (
                    <ChevronDownIcon size={16} color="#9CA3AF" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* 정보 섹션 (접기/펼치기 가능) */}
            {isInfoExpanded && (
              <>
                {/* 장소 */}
            <View className="flex-row items-center mb-3">
              <MapPinIcon size={18} color="#2563EB" />
              <Text className="ml-2 text-base text-gray-700 dark:text-gray-300">
                {safeLocationName}
              </Text>
            </View>

            {/* 날짜/시간 (v2.0: 날짜별 요구사항) */}
            {hasDateRequirements ? (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <ClockIcon size={18} color="#2563EB" />
                  <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                    근무 일정
                  </Text>
                </View>
                <View className="ml-6">
                  {posting.dateSpecificRequirements!.map((req, idx) => (
                    <DateRequirementDisplay
                      key={idx}
                      requirement={req}
                      index={idx}
                      showFilledCount={true}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View className="flex-row items-center mb-3">
                <ClockIcon size={18} color="#2563EB" />
                <Text className="ml-2 text-base text-gray-700 dark:text-gray-300">
                  {`${posting.workDate || ''} ${posting.timeSlot || ''}`.trim() || '일정 미정'}
                </Text>
              </View>
            )}

            {/* 급여 (v2.0: 역할별 급여) */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <CurrencyDollarIcon size={18} color="#2563EB" />
                <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                  급여
                </Text>
              </View>
              <View className="ml-6">
                <RoleSalaryDisplay
                  roleSalaries={posting.roleSalaries}
                  useSameSalary={posting.useSameSalary}
                  salary={posting.salary}
                  compact={false}
                />
              </View>
            </View>

            {/* 수당 (v2.0) */}
            {allowanceItems.length > 0 && (
              <View className="flex-row flex-wrap mb-4 ml-6">
                {allowanceItems.map((item, idx) => (
                  <Badge key={idx} variant="default" size="sm" className="mr-2 mb-1">
                    {item}
                  </Badge>
                ))}
              </View>
            )}

            {/* 사전질문 설정 (v2.0) */}
            {preQuestionCount > 0 && (
              <View className="flex-row items-center mb-4">
                <DocumentIcon size={18} color="#2563EB" />
                <Text className="ml-2 text-base text-gray-700 dark:text-gray-300">
                  사전질문 {preQuestionCount}개 설정됨
                </Text>
              </View>
            )}
              </>
            )}

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

          <View className="gap-3">
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
        {posting.description && String(posting.description).length > 0 && (
          <View className="px-4 pb-6">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              공고 내용
            </Text>
            <Card variant="outlined" padding="md">
              <Text className="text-base text-gray-700 dark:text-gray-300 leading-6">
                {String(posting.description)}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
