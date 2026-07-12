import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, ConfirmModal } from '@/components';
import { StackHeader } from '@/components/headers';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import {
  BanknotesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentIcon,
  EditIcon,
  MapPinIcon,
  ShareIcon,
  TrashIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from '@/components/icons';
import {
  PostingCompensationContent,
  PostingScheduleContent,
  PostingStatusBadge,
  PostingSurfaceState,
  PostingTypeBadge,
  ResubmitButton,
  TournamentStatusBadge,
} from '@/components/jobs';
import { STATUS } from '@/constants';
import { useOpsTournamentsForPosting } from '@/hooks/ops';
import {
  getLayoutColor,
  PRIMARY_COLORS,
  SECONDARY_PALETTE,
  STATUS_COLORS,
} from '@/constants/colors';
import {
  buildPostingFacts,
  isPostingDeletable,
  projectPostingSurface,
} from '@/domains/job-posting';
import { useApplicantsByJobPosting } from '@/hooks/applicant';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useShare } from '@/hooks/useShare';
import { useDeleteJobPosting } from '@/hooks/useJobManagement';
import { extractPostingFilledSubmap, usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import { useThemeStore } from '@/stores/themeStore';
import type { PostingManagementViewModel, PostingType, TournamentApprovalStatus } from '@/types';

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  displayTitle?: string;
  displayDescription?: string;
  badge?: { label: string; variant: 'primary' | 'success' | 'warning' | 'error' };
  onPress: () => void;
  testID?: string;
}

function ActionCard({
  icon,
  title,
  description,
  displayTitle,
  displayDescription,
  badge,
  onPress,
  testID,
}: ActionCardProps) {
  const resolvedTitle = displayTitle ?? title;
  const resolvedDescription = displayDescription ?? description;

  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={`${resolvedTitle}, ${resolvedDescription}`}
    >
      <Card variant="elevated" padding="md" className="flex-row items-center">
        <View className="mr-4 h-12 w-12 items-center justify-center rounded-sm bg-primary-50 dark:bg-primary-900/30">
          {icon}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="mr-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
              {resolvedTitle}
            </Text>
            {badge ? (
              <Badge variant={badge.variant} size="sm">
                {badge.label}
              </Badge>
            ) : null}
          </View>
          <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            {resolvedDescription}
          </Text>
        </View>
        <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
      </Card>
    </Pressable>
  );
}

export default function JobPostingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();
  const { isFixed: contextIsFixed, handleShowQR } = useJobDetailContext();
  const {
    job: posting,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useJobDetail(id || '', {
    realtime: true,
  });
  const {
    data: applicantData,
    refetch: refreshApplicants,
    isRefetching: isRefreshingApplicants,
  } = useApplicantsByJobPosting(id || '', undefined, {
    realtime: true,
  });
  const { mutate: deleteJobPosting, isPending: isDeleting } = useDeleteJobPosting();
  const { shareJob, isSharing } = useShare();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const postingFacts = useMemo(() => (posting ? buildPostingFacts(posting) : null), [posting]);
  // 브릿지: 이 공고에 연결된 ops 대회 목록(N:1). null-safe(빈 배열, ops_* 미배포 시에도 안전).
  const { opsTournaments } = useOpsTournamentsForPosting(posting?.id);
  const managementView = useMemo(
    () =>
      postingFacts
        ? (projectPostingSurface(postingFacts, {
            audience: 'employer',
            surface: 'manage',
          }) as PostingManagementViewModel)
        : null,
    [postingFacts]
  );

  const deleteMessage = '정말 이 공고를 삭제하시겠습니까? 삭제된 공고는 복구할 수 없습니다.';

  const postingId = id || '';
  const { data: filledAll } = usePostingFilledCounts([postingId]);
  const filledCounts = useMemo(
    () => extractPostingFilledSubmap(filledAll, postingId),
    [filledAll, postingId]
  );

  const handleApplicants = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/applicants`);
  }, [id, router]);

  const handleSettlements = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/settlements`);
  }, [id, router]);

  const handleEdit = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/edit`);
  }, [id, router]);

  const handleCancellationRequests = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/cancellation-requests`);
  }, [id, router]);

  const handleCollaborators = useCallback(() => {
    router.push(`/(employer)/my-postings/${id}/collaborators`);
  }, [id, router]);

  // 인앱 전환: 외부 URL 열기 대신 (ops) 스택으로 직접 push.
  // 연결된 대회 0개 → 생성 폼(postingId 프리셋), N개 → 목록(postingId 필터).
  const handleLiveOps = useCallback(() => {
    if (opsTournaments.length > 0) {
      router.push(`/(ops)/tournaments?postingId=${id}`);
    } else {
      router.push(`/(ops)/tournaments/new?postingId=${id}`);
    }
  }, [id, opsTournaments.length, router]);

  const handleDeletePress = useCallback(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }

    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!id) {
      return;
    }

    deleteJobPosting(id, {
      onSuccess: () => {
        setShowDeleteModal(false);
        router.back();
      },
    });
  }, [deleteJobPosting, id, router]);

  const handleToggleInfo = useCallback(() => {
    setIsInfoExpanded((prev) => !prev);
  }, []);

  const handleShare = useCallback(() => {
    if (!posting) {
      return;
    }

    void shareJob(posting);
  }, [posting, shareJob]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshApplicants()]);
  }, [refresh, refreshApplicants]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)/employer" />
        <PostingSurfaceState mode="loading" scope="detail" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !posting || !managementView) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)/employer" />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          title="공고를 불러올 수 없습니다"
          message={error?.message || '공고 정보를 찾을 수 없습니다.'}
          error={error}
          onRetry={handleRefresh}
        />
      </SafeAreaView>
    );
  }

  const isFixed = posting.schedule.kind === 'fixed';
  const totalApplicants = applicantData?.stats.total ?? managementView.totalApplicants;
  const confirmedApplicants = applicantData?.stats.confirmed ?? managementView.confirmedApplicants;
  // 확정 지원자가 있으면 삭제 불가(EF-crud-4) — 하단 캡션과 동일 근거.
  const canDelete = isPostingDeletable(confirmedApplicants);
  const pendingApplicants = applicantData?.stats.applied ?? managementView.pendingApplicants;
  const cancellationPendingCount =
    applicantData?.stats.cancellationPending ?? posting.stats?.cancellationPendingApplicants ?? 0;
  const filledPositions = managementView.filledPositions;
  const totalPositions = managementView.totalPositions;
  const title = posting.title || '제목 없음';
  const locationLabel = managementView.locationLabel || posting.location?.name || '위치 미정';
  const allowanceItems = managementView.allowanceLabels ?? [];
  const questionCount = managementView.questions.length;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="공고 상세"
        titleSuffix={<JobTitleSuffix jobTitle={posting.title} />}
        fallbackHref="/(app)/(tabs)/employer"
        rightAction={
          <View className="flex-row items-center">
            <Pressable
              onPress={handleShare}
              disabled={isSharing}
              hitSlop={8}
              className="p-2"
              accessibilityRole="button"
              accessibilityLabel="공고 공유하기"
            >
              <ShareIcon size={22} color={getLayoutColor(isDark, 'headerTint')} />
            </Pressable>
            {!(contextIsFixed || isFixed) ? <HeaderQRAction onPress={handleShowQR} /> : null}
          </View>
        }
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isRefreshingApplicants}
            onRefresh={handleRefresh}
            tintColor={getLayoutColor(isDark, 'refreshTint')}
          />
        }
      >
        <View className="px-4 pt-3">
          <Card variant="elevated" padding="md">
            <View className="mb-1.5 flex-row flex-wrap items-center">
              {posting.postingType && posting.postingType !== 'regular' ? (
                <PostingTypeBadge type={posting.postingType as PostingType} size="sm" />
              ) : null}
              {posting.postingType === 'tournament' && posting.tournamentConfig?.approvalStatus ? (
                <View className="ml-2">
                  <TournamentStatusBadge
                    status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
                    rejectionReason={posting.tournamentConfig.rejectionReason}
                    size="sm"
                  />
                </View>
              ) : null}
            </View>

            <View className="mb-2 flex-row items-start justify-between">
              <Text
                className="mr-3 flex-1 text-lg font-display text-content-primary dark:text-off-white"
                numberOfLines={2}
              >
                {title}
              </Text>

              <View className="flex-row items-center">
                <PostingStatusBadge status={posting.status} size="sm" className="mr-2" />
                <Pressable
                  onPress={handleToggleInfo}
                  className="flex-row items-center rounded-lg px-2 py-1 active:bg-secondary-100 dark:active:bg-secondary-700"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                >
                  <Text className="mr-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    {isInfoExpanded ? '접기' : '상세'}
                  </Text>
                  {isInfoExpanded ? (
                    <ChevronUpIcon size={14} color={SECONDARY_PALETTE[400]} />
                  ) : (
                    <ChevronDownIcon size={14} color={SECONDARY_PALETTE[400]} />
                  )}
                </Pressable>
              </View>
            </View>

            {isInfoExpanded ? (
              <>
                <View className="mb-3 flex-row items-center">
                  <MapPinIcon size={18} color={PRIMARY_COLORS[600]} />
                  <Text className="ml-2 text-base text-content-secondary font-sans">
                    {locationLabel}
                  </Text>
                </View>

                <View className="mb-4">
                  <View className="mb-2 flex-row items-center">
                    <ClockIcon size={18} color={PRIMARY_COLORS[600]} />
                    <Text className="ml-2 text-base font-sans-medium text-content-secondary">
                      근무 일정
                    </Text>
                  </View>
                  <View className="ml-6">
                    <PostingScheduleContent
                      display="detail"
                      workflow={managementView.workflow}
                      scheduleDisplay={managementView.scheduleDisplay}
                      workDate={managementView.workDate}
                      timeSlot={managementView.timeSlot}
                      daysPerWeek={managementView.daysPerWeek}
                      startTime={managementView.startTime}
                      isStartTimeNegotiable={managementView.isStartTimeNegotiable}
                      requiredRolesWithCount={managementView.requiredRolesWithCount}
                      showFilledCount
                      filledCounts={filledCounts}
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <View className="mb-2 flex-row items-center">
                    <CurrencyDollarIcon size={18} color={PRIMARY_COLORS[600]} />
                    <Text className="ml-2 text-base font-sans-medium text-content-secondary">
                      급여
                    </Text>
                  </View>
                  <View className="ml-6">
                    <PostingCompensationContent
                      display="detail"
                      salaryDisplay={managementView.salaryDisplay}
                      defaultSalary={managementView.defaultSalary}
                      allowanceLabels={managementView.allowanceLabels}
                      taxLabel={managementView.taxLabel}
                    />
                  </View>
                </View>

                {allowanceItems.length > 0 ? (
                  <View className="mb-4 ml-6 flex-row flex-wrap">
                    {allowanceItems.map((item, index) => (
                      <Badge
                        key={`${item}-${index}`}
                        variant="default"
                        size="sm"
                        className="mb-1 mr-2"
                      >
                        {item}
                      </Badge>
                    ))}
                  </View>
                ) : null}

                {managementView.taxLabel ? (
                  <View className="mb-4 flex-row items-center">
                    <CurrencyDollarIcon size={18} color={PRIMARY_COLORS[600]} />
                    <Text className="ml-2 text-base text-content-secondary font-sans">
                      {managementView.taxLabel}
                    </Text>
                  </View>
                ) : null}

                {questionCount > 0 ? (
                  <View className="mb-4 flex-row items-center">
                    <DocumentIcon size={18} color={PRIMARY_COLORS[600]} />
                    <Text className="ml-2 text-base text-content-secondary font-sans">
                      사전질문 {questionCount}개 설정됨
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <View className="rounded-lg bg-surface-page dark:bg-surface px-3 pb-2 pt-3">
              <View className="flex-row justify-around">
                <View className="flex-1 items-center">
                  <Text className="text-xl font-display text-primary-600 dark:text-primary-400">
                    {totalApplicants}
                  </Text>
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    지원자
                  </Text>
                </View>
                <View className="w-px bg-secondary-200 dark:bg-surface" />
                <View className="flex-1 items-center">
                  <Text className="text-xl font-display text-success-600 dark:text-success-400">
                    {confirmedApplicants}
                  </Text>
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    확정
                  </Text>
                </View>
                <View className="w-px bg-secondary-200 dark:bg-surface" />
                <View className="flex-1 items-center">
                  <Text className="text-xl font-display text-warning-600 dark:text-warning-400">
                    {pendingApplicants}
                  </Text>
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    대기중
                  </Text>
                </View>
              </View>

              <View className="mt-2 flex-row items-center justify-center">
                <Text className="mr-1.5 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  배정 현황
                </Text>
                <Text className="text-base font-sans-bold text-content-primary dark:text-off-white">
                  {filledPositions}
                </Text>
                <Text className="mx-0.5 text-base text-content-placeholder font-sans">/</Text>
                <Text className="text-base font-sans-bold text-content-muted dark:text-secondary-400">
                  {totalPositions}
                </Text>
                <Text className="ml-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  명
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View className="px-4 pb-4 pt-3">
          <Text className="mb-3 text-lg font-display-semibold text-content-primary dark:text-off-white">
            관리
          </Text>

          <View className="gap-3">
            <ActionCard
              icon={<UsersIcon size={24} color={PRIMARY_COLORS[600]} />}
              title="지원자 관리"
              description={`${pendingApplicants}명의 지원자가 대기중입니다.`}
              badge={
                pendingApplicants > 0
                  ? { label: `${pendingApplicants}명`, variant: 'warning' }
                  : undefined
              }
              onPress={handleApplicants}
              testID="job-posting-manage-applicants"
            />

            {!isFixed && (
              <ActionCard
                icon={<XCircleIcon size={24} color={STATUS_COLORS.error} />}
                title="취소 요청 관리"
                description="스태프의 취소 요청을 검토합니다."
                badge={
                  cancellationPendingCount > 0
                    ? { label: `${cancellationPendingCount}건`, variant: 'error' }
                    : undefined
                }
                onPress={handleCancellationRequests}
                testID="job-posting-manage-cancellation-requests"
              />
            )}

            {!isFixed && (
              <ActionCard
                icon={<BanknotesIcon size={24} color={STATUS_COLORS.success} />}
                title="스태프 관리/정산"
                description="확정 스태프 관리와 정산을 진행합니다."
                badge={
                  filledPositions > 0
                    ? { label: `${filledPositions}명`, variant: 'success' }
                    : undefined
                }
                onPress={handleSettlements}
                testID="job-posting-manage-settlements"
              />
            )}

            {!isFixed && (
              <ActionCard
                icon={<EditIcon size={24} color={SECONDARY_PALETTE[500]} />}
                title="공고 수정"
                description="공고 내용과 상태를 수정합니다."
                badge={
                  filledPositions > 0
                    ? { label: '일정·역할 수정 제한', variant: 'warning' }
                    : undefined
                }
                onPress={handleEdit}
                testID="job-posting-edit-button"
              />
            )}

            {posting.postingType === 'tournament' &&
              posting.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.APPROVED &&
              !(['draft', 'pending', 'rejected', 'cancelled', 'expired'] as string[]).includes(
                posting.status
              ) && (
                <ActionCard
                  icon={<UsersIcon size={24} color="#8B5CF6" />}
                  title={
                    opsTournaments.length > 0
                      ? `라이브 운영 (${opsTournaments.length})`
                      : '라이브 운영 시작'
                  }
                  description={
                    opsTournaments.length > 0
                      ? '진행 중인 라이브 운영 화면으로 이동합니다.'
                      : '이 대회의 라이브 운영을 시작합니다.'
                  }
                  badge={
                    opsTournaments.length > 0
                      ? {
                          label: '진행 중',
                          variant: opsTournaments.some((t) => t.status === 'active')
                            ? 'success'
                            : 'primary',
                        }
                      : undefined
                  }
                  onPress={handleLiveOps}
                  testID="job-posting-live-ops"
                />
              )}

            <ActionCard
              icon={<UserPlusIcon size={24} color="#3B82F6" />}
              title="공유 관리"
              description="이 공고를 함께 관리할 협업자를 추가하거나 제거합니다."
              onPress={handleCollaborators}
              testID="job-posting-manage-collaborators"
            />
          </View>
        </View>

        {isFixed ? (
          <View className="px-4 pb-4">
            <ActionCard
              icon={<EditIcon size={24} color={SECONDARY_PALETTE[500]} />}
              title="공고 수정"
              description="공고 내용과 상태를 수정합니다"
              onPress={handleEdit}
              testID="job-posting-edit-button"
            />
          </View>
        ) : null}

        {posting.description && String(posting.description).length > 0 ? (
          <View className="px-4 pb-6">
            <Text className="mb-3 text-lg font-display-semibold text-content-primary dark:text-off-white">
              공고 내용
            </Text>
            <Card variant="outlined" padding="md">
              <Text className="text-base leading-6 text-content-secondary font-sans">
                {String(posting.description)}
              </Text>
            </Card>
          </View>
        ) : null}

        {!isFixed &&
        posting.postingType === 'tournament' &&
        posting.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.REJECTED ? (
          <View className="px-4 pb-4">
            <Card
              variant="outlined"
              padding="md"
              className="border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20"
            >
              <View className="mb-3 flex-row items-start">
                <XCircleIcon size={20} color={STATUS_COLORS.error} />
                <Text className="ml-2 text-base font-sans-semibold text-error-700 dark:text-error-400">
                  승인 반려되었습니다
                </Text>
              </View>

              {posting.tournamentConfig.rejectionReason ? (
                <View className="mb-4 rounded-lg bg-white p-3 dark:bg-surface">
                  <Text className="mb-1 text-sm font-sans-medium text-secondary-500 dark:text-secondary-400">
                    반려 사유
                  </Text>
                  <Text className="text-base text-content-secondary font-sans">
                    {posting.tournamentConfig.rejectionReason}
                  </Text>
                </View>
              ) : null}

              <Text className="mb-4 text-sm text-content-muted dark:text-secondary-400 font-sans">
                공고 내용을 수정한 뒤 다시 제출하면 재심사가 진행됩니다.
              </Text>

              <View className="flex-row">
                <Pressable
                  onPress={handleEdit}
                  className="mr-2 flex-1 items-center justify-center rounded-md border border-primary-600 py-3 dark:border-primary-500"
                >
                  <Text className="text-base font-sans-medium text-primary-600 dark:text-primary-400">
                    수정하기
                  </Text>
                </Pressable>
                <View className="ml-2 flex-1">
                  <ResubmitButton
                    jobPostingId={posting.id}
                    size="md"
                    fullWidth
                    onSuccess={handleRefresh}
                  />
                </View>
              </View>
            </Card>
          </View>
        ) : null}

        <View className="border-t border-secondary-200 px-4 pb-8 pt-4 dark:border-surface-overlay">
          <Pressable
            onPress={handleDeletePress}
            disabled={isDeleting || !canDelete}
            className={`flex-row items-center justify-center rounded-md bg-error-50 py-4 active:bg-error-50 dark:bg-error-900/20 dark:active:bg-error-900/30 ${
              !canDelete ? 'opacity-40' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="공고 삭제"
            accessibilityState={{ disabled: isDeleting || !canDelete }}
            testID="job-posting-delete-button"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={STATUS_COLORS.error} />
            ) : (
              <>
                <TrashIcon size={20} color={STATUS_COLORS.error} />
                <Text className="ml-2 text-base font-sans-medium text-error-600 dark:text-error-400">
                  공고 삭제
                </Text>
              </>
            )}
          </Pressable>
          <Text className="mt-2 text-center text-xs text-content-placeholder font-sans">
            확정된 지원자가 있는 공고는 삭제할 수 없습니다
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        confirmTestID="job-posting-delete-confirm"
        cancelTestID="job-posting-delete-cancel"
        title="공고 삭제"
        message={deleteMessage}
        confirmText="삭제"
        cancelText="취소"
        isDestructive
      />
    </SafeAreaView>
  );
}
