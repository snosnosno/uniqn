/**
 * UNIQN Mobile - 공고 상세 화면
 * 구인자의 공고 상세 정보 및 관리
 *
 * @description v2.0 - dateSpecificRequirements, roleSalaries 지원
 * @version 2.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeleteJobPosting } from '@/hooks/useJobManagement';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobDetail } from '@/hooks/useJobDetail';
import { Card, Badge, Loading, ErrorState, ConfirmModal } from '@/components';
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
  TrashIcon,
} from '@/components/icons';
import { useApplicantManagement } from '@/hooks/useApplicantManagement';
import {
  PostingTypeBadge,
  GroupedDateRequirementDisplay,
  FixedScheduleDisplay,
  RoleSalaryDisplay,
  TournamentStatusBadge,
  ResubmitButton,
} from '@/components/jobs';
import type { PostingType, Allowances, TournamentApprovalStatus } from '@/types';

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
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${description}`}
    >
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
  const { cancellationPendingCount, stats: applicantStats } = useApplicantManagement(id || '');
  const { mutate: deleteJobPosting, isPending: isDeleting } = useDeleteJobPosting();

  // 삭제 확인 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    router.push(`/(employer)/my-postings/${id}/edit`);
  }, [router, id]);

  // 취소 요청 관리로 이동
  const handleCancellationRequests = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/cancellation-requests`);
  }, [router, id]);

  // 삭제 확인 모달 열기 (웹: aria-hidden 충돌 방지를 위해 포커스 해제)
  const handleDeletePress = useCallback(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    setShowDeleteModal(true);
  }, []);

  // 공고 삭제 실행
  const handleDeleteConfirm = useCallback(() => {
    if (!id) return;
    deleteJobPosting(id, {
      onSuccess: () => {
        setShowDeleteModal(false);
        router.back();
      },
    });
  }, [id, deleteJobPosting, router]);

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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error || !posting) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
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
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;

  // 지원자 기준 통계 (사람 수) - applicantStats에서 가져옴
  const totalApplicants = applicantStats?.total || posting.applicationCount || 0;
  const confirmedApplicants = applicantStats?.confirmed || 0;
  const pendingApplicants = (applicantStats?.applied || 0) + (applicantStats?.pending || 0);

  // 배정 기준 통계 (슬롯 수) - posting에서 가져옴
  const filledPositions = posting.filledPositions || 0;
  const totalPositions = posting.totalPositions || 0;

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
        <View className="px-4 pt-3">
          <Card variant="elevated" padding="md">
            {/* 공고 타입 뱃지 (v2.0) - regular가 아닌 경우만 표시 */}
            {posting.postingType && posting.postingType !== 'regular' && (
              <View className="flex-row items-center flex-wrap mb-1.5">
                <PostingTypeBadge
                  type={posting.postingType as PostingType}
                  size="sm"
                />
                {/* 대회공고 승인 상태 뱃지 */}
                {posting.postingType === 'tournament' && posting.tournamentConfig?.approvalStatus && (
                  <View className="ml-2">
                    <TournamentStatusBadge
                      status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
                      rejectionReason={posting.tournamentConfig.rejectionReason}
                      size="sm"
                    />
                  </View>
                )}
              </View>
            )}

            {/* 헤더: 제목 + 상태뱃지 + 접기버튼 */}
            <View className="flex-row items-start justify-between mb-2">
              {/* 제목 */}
              <Text className="flex-1 text-lg font-bold text-gray-900 dark:text-white mr-3" numberOfLines={2}>
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
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                    {isInfoExpanded ? '접기' : '상세'}
                  </Text>
                  {isInfoExpanded ? (
                    <ChevronUpIcon size={14} color="#9CA3AF" />
                  ) : (
                    <ChevronDownIcon size={14} color="#9CA3AF" />
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

            {/* 날짜/시간 (v2.0: 날짜별 요구사항 또는 고정공고 일정) */}
            {posting.postingType === 'fixed' ? (
              // 고정공고: FixedScheduleDisplay 사용
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <ClockIcon size={18} color="#2563EB" />
                  <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                    근무 일정
                  </Text>
                </View>
                <View className="ml-6">
                  <FixedScheduleDisplay
                    daysPerWeek={posting.daysPerWeek}
                    startTime={posting.timeSlot?.split(/[-~]/)[0]?.trim()}
                    roles={posting.requiredRolesWithCount?.map((r) => ({
                      role: r.role,
                      count: r.count,
                    }))}
                    showRoles={true}
                    showFilledCount={true}
                  />
                </View>
              </View>
            ) : hasDateRequirements ? (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <ClockIcon size={18} color="#2563EB" />
                  <Text className="ml-2 text-base font-medium text-gray-700 dark:text-gray-300">
                    근무 일정
                  </Text>
                </View>
                <View className="ml-6">
                  <GroupedDateRequirementDisplay
                    requirements={posting.dateSpecificRequirements!}
                    showFilledCount={true}
                  />
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
                  roles={posting.roles}
                  useSameSalary={posting.useSameSalary}
                  defaultSalary={posting.defaultSalary}
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

            {/* 모집 현황 - 지원자(사람) + 배정(슬롯) 구분 표시 */}
            <View className="px-3 pt-3 pb-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {/* 지원자 현황 (사람 수) */}
              <View className={`flex-row justify-around ${posting.postingType === 'tournament' ? 'mb-2 pb-2 border-b border-gray-200 dark:border-gray-700' : ''}`}>
                <View className="items-center flex-1">
                  <Text className="text-xl font-bold text-primary-600 dark:text-primary-400">
                    {totalApplicants}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">지원자</Text>
                </View>
                <View className="w-px bg-gray-200 dark:bg-gray-700" />
                <View className="items-center flex-1">
                  <Text className="text-xl font-bold text-success-600 dark:text-success-400">
                    {confirmedApplicants}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">확정</Text>
                </View>
                <View className="w-px bg-gray-200 dark:bg-gray-700" />
                <View className="items-center flex-1">
                  <Text className="text-xl font-bold text-warning-600 dark:text-warning-400">
                    {pendingApplicants}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">대기중</Text>
                </View>
              </View>
              {/* 배정 현황 (슬롯 수) - 대회공고 타입만 표시 */}
              {posting.postingType === 'tournament' && (
                <View className="flex-row justify-center items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mr-1.5">배정현황</Text>
                  <Text className="text-base font-bold text-gray-900 dark:text-white">
                    {filledPositions}
                  </Text>
                  <Text className="text-base text-gray-400 dark:text-gray-500 mx-0.5">/</Text>
                  <Text className="text-base font-bold text-gray-600 dark:text-gray-400">
                    {totalPositions}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">건</Text>
                </View>
              )}
            </View>
          </Card>
        </View>

        {/* 관리 메뉴 */}
        <View className="px-4 pt-3 pb-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            관리
          </Text>

          <View className="gap-3">
            {/* 지원자 관리 */}
            <ActionCard
              icon={<UsersIcon size={24} color="#2563EB" />}
              title="지원자 관리"
              description={`${pendingApplicants}명의 지원자가 대기중입니다`}
              badge={pendingApplicants > 0 ? { label: `${pendingApplicants}명`, variant: 'warning' } : undefined}
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

            {/* 스태프/정산 관리 */}
            <ActionCard
              icon={<BanknotesIcon size={24} color="#10B981" />}
              title="스태프/정산 관리"
              description="확정 스태프 관리 및 정산"
              badge={filledPositions > 0 ? { label: `${filledPositions}건`, variant: 'success' } : undefined}
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

        {/* 대회공고 거부 안내 및 재제출 (거부된 경우에만 표시) */}
        {posting.postingType === 'tournament' &&
         posting.tournamentConfig?.approvalStatus === 'rejected' && (
          <View className="px-4 pb-4">
            <Card variant="outlined" padding="md" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <View className="flex-row items-start mb-3">
                <XCircleIcon size={20} color="#EF4444" />
                <Text className="ml-2 text-base font-semibold text-red-700 dark:text-red-400">
                  승인이 거부되었습니다
                </Text>
              </View>

              {posting.tournamentConfig.rejectionReason && (
                <View className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    거부 사유
                  </Text>
                  <Text className="text-base text-gray-700 dark:text-gray-300">
                    {posting.tournamentConfig.rejectionReason}
                  </Text>
                </View>
              )}

              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                공고 내용을 수정한 후 재제출하시면 다시 검토됩니다.
              </Text>

              <View className="flex-row">
                <Pressable
                  onPress={handleEdit}
                  className="flex-1 mr-2 py-3 rounded-xl border border-blue-600 dark:border-blue-500 items-center justify-center"
                >
                  <Text className="text-base font-medium text-blue-600 dark:text-blue-400">
                    수정하기
                  </Text>
                </Pressable>
                <View className="flex-1 ml-2">
                  <ResubmitButton
                    postingId={posting.id}
                    size="md"
                    fullWidth
                    onSuccess={refresh}
                  />
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* 공고 삭제 버튼 */}
        <View className="px-4 pb-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Pressable
            onPress={handleDeletePress}
            disabled={isDeleting}
            className="flex-row items-center justify-center py-4 rounded-xl bg-red-50 dark:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30"
            accessibilityRole="button"
            accessibilityLabel="공고 삭제"
            accessibilityState={{ disabled: isDeleting }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <TrashIcon size={20} color="#EF4444" />
                <Text className="ml-2 text-base font-medium text-red-600 dark:text-red-400">
                  공고 삭제
                </Text>
              </>
            )}
          </Pressable>
          <Text className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
            확정된 지원자가 있는 공고는 삭제할 수 없습니다
          </Text>
        </View>
      </ScrollView>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="공고 삭제"
        message="정말 이 공고를 삭제하시겠습니까? 삭제된 공고는 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        isDestructive
      />
    </SafeAreaView>
  );
}
