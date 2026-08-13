import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { ActionSheet, type ActionSheetOption } from '@/components/ui';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { useToastStore } from '@/stores/toastStore';
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
  EyeIcon,
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
  SeatFillSummary,
  TournamentStatusBadge,
} from '@/components/jobs';
import { STATUS } from '@/constants';
import { useOpsTournamentsForPosting } from '@/hooks/ops';
import {
  getLayoutColor,
  PRIMARY_COLORS,
  SECONDARY_PALETTE,
  STATUS_COLORS,
  TEXT_COLORS,
} from '@/constants/colors';
import {
  buildPostingFacts,
  getPostingStatusActionHint,
  isPostingDeletable,
  POSTING_STATUS_ACTION_TEXT,
  projectPostingSurface,
  selectPostingStatusActions,
  selectPrimaryAction,
} from '@/domains/job-posting';
import { UNDO_TOAST_DURATION_MS, UNDO_TOAST_LABEL } from '@/constants/undoToast';
import { useApplicantsByJobPosting } from '@/hooks/applicant';
import { useShare } from '@/hooks/useShare';
import {
  useCloseJobPosting,
  useDeleteJobPosting,
  useReopenJobPosting,
} from '@/hooks/useJobManagement';
import { extractPostingFilledSubmap, usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import { useThemeStore } from '@/stores/themeStore';
import type { PostingManagementViewModel, PostingType, TournamentApprovalStatus } from '@/types';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useWorkLogsByJobPosting } from '@/hooks/useSettlement';
import { selectPendingSettlementCount } from '@/features/employer/settlements/settlementCalc';
import { TodayOpsStrip } from '@/features/employer/settlements/TodayOpsStrip';

/**
 * 통계 한 칸 — 숫자 자체가 목적지가 된다.
 *
 * 그룹 accessibilityLabel 로 세 숫자를 한 덩어리로 묶던 것을 풀었다. 각 칸이 버튼이 된
 * 이상 개별로 초점을 받아야 하고, 묶어 두면 스크린리더가 "지원자 5명, 확정 2명..." 한 줄만
 * 읽고 각 칸을 누를 수 있다는 사실을 전달하지 못한다.
 */
function StatColumn({
  value,
  label,
  valueClassName,
  onPress,
  testID,
}: {
  value: number;
  label: string;
  valueClassName: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[44px] flex-1 items-center justify-center active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}명, 목록에서 보기`}
      testID={testID}
    >
      <Text className={`text-xl font-display ${valueClassName}`}>{value}</Text>
      <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">{label}</Text>
    </Pressable>
  );
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  displayTitle?: string;
  displayDescription?: string;
  badge?: { label: string; variant: 'primary' | 'success' | 'warning' | 'error' };
  onPress: () => void;
  testID?: string;
  /**
   * 'row'(기본) = 강등된 목록 행 / 'primary' = "지금 할 일" 한 장.
   *
   * 카드 6장이 전부 같은 크기라 우선순위 표현이 0이었다 — 사장이 매번 여섯 장을 읽고
   * 무엇이 급한지 스스로 판단해야 했다. 위계는 **크기와 골드**로만 준다.
   */
  emphasis?: 'row' | 'primary';
  /** primary 일 때 골드 버튼에 쓸 라벨 */
  actionLabel?: string;
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
  emphasis = 'row',
  actionLabel,
}: ActionCardProps) {
  const resolvedTitle = displayTitle ?? title;
  const resolvedDescription = displayDescription ?? description;
  // 배지가 라벨에서 빠지면 스크린리더 사용자는 "대기 3명" 같은 처리할 일 개수를 듣지 못한다 —
  // 이 화면에서 가장 행동을 부르는 정보가 시각 사용자에게만 전달되고 있었다.
  const accessibilityLabel = badge
    ? `${resolvedTitle}, ${badge.label}, ${resolvedDescription}`
    : `${resolvedTitle}, ${resolvedDescription}`;

  if (emphasis === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        className="active:opacity-70"
        accessibilityRole="button"
        testID={testID}
        // "지금 할 일"이라는 맥락은 시각적 위치로만 전달됐다 — 라벨에도 담는다.
        accessibilityLabel={`지금 할 일. ${accessibilityLabel}`}
      >
        <Card
          variant="elevated"
          padding="md"
          className="border border-primary-200 dark:border-primary-800"
        >
          <Text className="mb-2 text-xs font-sans-semibold text-primary-600 dark:text-primary-400">
            지금 할 일
          </Text>
          <View className="flex-row items-center">
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-sm bg-primary-50 dark:bg-primary-900/30">
              {icon}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="mr-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
                  {resolvedTitle}
                </Text>
                {badge ? (
                  <Badge variant={badge.variant} size="sm">
                    {badge.label}
                  </Badge>
                ) : null}
              </View>
              <Text className="mt-1 text-sm text-content-secondary font-sans">
                {resolvedDescription}
              </Text>
            </View>
          </View>
          {/* 골드는 이 버튼에만 쓴다 — 강조가 여러 곳이면 아무것도 강조되지 않는다. */}
          <View className="mt-4 min-h-[44px] items-center justify-center rounded-md bg-primary-600 py-3">
            <Text className="text-base font-sans-semibold text-content-onGold">
              {actionLabel ?? '바로 가기'}
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="min-h-[56px] flex-row items-center px-4 py-3 active:bg-secondary-50 dark:active:bg-surface-overlay"
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {/* 강등된 행의 아이콘 배경은 중립이다. 골드를 여기까지 쓰면 "지금 할 일"이 묻힌다. */}
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-sm bg-secondary-100 dark:bg-surface-overlay">
        {icon}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="mr-2 text-base font-sans-medium text-content-primary dark:text-off-white">
            {resolvedTitle}
          </Text>
          {badge ? (
            <Badge variant={badge.variant} size="sm">
              {badge.label}
            </Badge>
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {resolvedDescription}
        </Text>
      </View>
      <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
    </Pressable>
  );
}

export default function JobPostingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  // 공고 데이터는 레이아웃(_layout.tsx)이 realtime 구독과 함께 한 번만 조회한다.
  // 이 화면이 같은 id 로 useJobDetail 을 또 부르면 subscribeToJobPosting 이 **두 번** 열린다 —
  // useJobDetail 의 구독 effect 는 인스턴스마다 돌고 디듀프가 없다. 같은 이유로 isFixed 판정도
  // 여기서 다시 계산하지 않는다(레이아웃의 isFixedJobPosting 과 같은 `schedule.kind === 'fixed'`).
  const { job: posting, isFixed, isLoading, error, refresh, handleShowQR } = useJobDetailContext();

  // PTR 스피너는 사용자가 당겼을 때만 — 조회 상태를 그대로 물리면 화면에 들어올 때마다
  // 배경 재조회로 스피너가 뜬다(useManualRefresh 주석 참고).
  const { refreshing: pullRefreshing, onRefresh: onPullRefresh } = useManualRefresh(() =>
    handleRefresh()
  );
  const { data: applicantData, refetch: refreshApplicants } = useApplicantsByJobPosting(
    id || '',
    undefined,
    {
      realtime: true,
    }
  );
  const { isOnline } = useNetworkStatus();
  const { mutate: deleteJobPosting, isPending: isDeleting } = useDeleteJobPosting();
  // 성공 토스트를 훅에서 끄고 아래에서 **되돌리기가 달린** 토스트를 직접 발행한다.
  // 켜 두면 "공고가 마감되었습니다."와 "마감했어요 [되돌리기]"가 동시에 뜬다.
  const { mutate: closeJobPosting } = useCloseJobPosting({ suppressSuccessToast: true });
  const { mutate: reopenJobPosting } = useReopenJobPosting({ suppressSuccessToast: true });
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  // action 토스트는 dedupe 면제라(toastStore.ts:58-68) 연타하면 되돌리기 어포던스가 쌓인다.
  // 이 화면은 공고 하나만 다루므로 단일 플래그로 충분한 per-id 가드다.
  const statusTogglingRef = useRef(false);
  const { shareJob, isSharing } = useShare();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // 기본 펼침 — 사장이 자기 공고의 일정·급여·위치를 보려고 접기를 푸는 동작이 매 진입마다
  // 반복될 이유가 없다. 접기는 화면을 짧게 만들고 싶은 사람을 위한 선택지로 남긴다.
  const [isInfoExpanded, setIsInfoExpanded] = useState(true);

  // 당일 운영 요약(출근/노쇼) — 정산 화면(settlements.tsx:191)에만 있던 신호를 허브로 올린다.
  //
  // 고정 공고는 제외한다: QR 진입점이 없어 checkInTime 이 영원히 비므로 "출근 0/N" 이 거짓말이 된다.
  // 빈 id 를 넘기면 useConfirmedStaff 가 쿼리(`enabled: !!jobPostingId`)와 realtime 구독을
  // 둘 다 끈다 — 별도 enabled 옵션을 shared 훅에 추가하지 않고 같은 효과를 낸다.
  const { grouped: staffGrouped } = useConfirmedStaff(isFixed ? '' : id || '', {
    realtime: true,
  });
  const todayGroup = useMemo(() => staffGrouped.find((group) => group.isToday), [staffGrouped]);

  // 정산 대기 건수 — 정산 화면과 **같은 셀렉터**를 쓴다. 종전에는 이 화면만 0 을 하드코딩해서
  // 정산 대기가 쌓여도 허브에서는 영원히 0건으로 보였다(당일 운영 스트립 배지가 안 뜸).
  // 고정 공고는 정산 화면 자체가 없으므로 빈 id 로 쿼리를 끈다(enabled: !!jobPostingId).
  const { data: workLogs } = useWorkLogsByJobPosting(isFixed ? '' : id || '');
  const pendingSettlementCount = useMemo(
    () => selectPendingSettlementCount(workLogs ?? []),
    [workLogs]
  );

  // 상태 뱃지에서 바로 걸 수 있는 전이 — 종전에는 목록 화면에만 있어서, 상세를 보다가
  // 마감하려면 뒤로 나갔다 들어와야 했다.
  const statusSheetOptions = useMemo<ActionSheetOption[]>(
    () =>
      (posting ? selectPostingStatusActions(posting.status) : []).map((action) => ({
        label: POSTING_STATUS_ACTION_TEXT[action].sheetLabel,
        value: action,
        destructive: action === 'close',
      })),
    [posting]
  );
  const statusHint = posting ? getPostingStatusActionHint(posting.status) : null;
  // 액션도 설명도 없는 상태(draft 등)에서는 아예 누를 수 없게 둔다 —
  // 눌러도 빈 시트만 열리는 버튼은 고장으로 읽힌다.
  const canOpenStatusSheet = statusSheetOptions.length > 0 || statusHint !== null;

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

  // 통계 숫자 → 그 숫자만 담긴 목록. 도착지가 filter 쿼리를 읽고 초기 탭을 맞춘다.
  const handleApplicantsFiltered = useCallback(
    (filter: string) => {
      router.push(`/(employer)/my-postings/${id}/applicants?filter=${filter}`);
    },
    [id, router]
  );

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
    // 진행 중 재진입 차단 — ConfirmModal 의 래치와 이중 방어. 여기까지 막아야
    // 모달 밖 경로(테스트·프로그램적 호출)로도 뮤테이션이 두 번 나가지 않는다.
    if (!id || isDeleting) {
      return;
    }

    deleteJobPosting(id, {
      onSuccess: () => {
        setShowDeleteModal(false);
        // 되돌아갈 화면이 없는 진입(웹 직접 URL 등)에서 back() 은 조용히 무시된다 —
        // 그러면 방금 삭제한 공고 화면에 그대로 남는다. 목록으로 내보낸다.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/(tabs)/employer');
        }
      },
    });
  }, [deleteJobPosting, id, isDeleting, router]);

  const handleToggleInfo = useCallback(() => {
    setIsInfoExpanded((prev) => !prev);
  }, []);

  // 재오픈 — 마감 되돌리기와 시트 선택이 같은 경로를 탄다.
  const runReopen = useCallback(() => {
    if (!id || statusTogglingRef.current) {
      return;
    }
    statusTogglingRef.current = true;
    reopenJobPosting(id, {
      onSuccess: () => {
        addToast({
          type: 'success',
          message: POSTING_STATUS_ACTION_TEXT.reopen.successToastMessage,
        });
      },
      onSettled: () => {
        statusTogglingRef.current = false;
      },
    });
  }, [addToast, id, reopenJobPosting]);

  // 마감은 **가역**이라 확인 모달로 앞을 막지 않고 되돌리기를 뒤에 붙인다.
  // (삭제는 되돌릴 수 없으므로 확인 모달을 그대로 유지한다.)
  // 재오픈 쪽에는 되돌리기를 달지 않는다 — 서로를 되돌리는 토스트가 물리면 무한 왕복이 된다.
  const runClose = useCallback(() => {
    if (!id || statusTogglingRef.current) {
      return;
    }
    statusTogglingRef.current = true;
    closeJobPosting(id, {
      onSuccess: () => {
        addToast({
          type: 'success',
          message: POSTING_STATUS_ACTION_TEXT.close.undoToastMessage,
          duration: UNDO_TOAST_DURATION_MS,
          action: { label: UNDO_TOAST_LABEL, onPress: runReopen },
        });
      },
      onSettled: () => {
        statusTogglingRef.current = false;
      },
    });
  }, [addToast, closeJobPosting, id, runReopen]);

  const handleStatusSelect = useCallback(
    (value: string) => {
      if (value === 'close') {
        runClose();
      } else if (value === 'reopen') {
        runReopen();
      }
    },
    [runClose, runReopen]
  );

  const handleShare = useCallback(() => {
    if (!posting) {
      return;
    }

    void shareJob(posting);
  }, [posting, shareJob]);

  const handlePreview = useCallback(() => {
    router.push(`/(app)/jobs/${id}`);
  }, [id, router]);

  // refreshApplicants(=refreshRealtimeData)는 조회 실패 시 실제로 throw 한다. try/catch 가
  // 없으면 onRetry·RefreshControl 두 호출부가 반환 Promise 를 버려 미처리 rejection 이 되고,
  // 사용자에겐 아무 피드백도 남지 않는다(ORDER-9).
  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([refresh(), refreshApplicants()]);
    } catch (refreshError) {
      logger.error('공고 상세 새로고침 실패', toError(refreshError), { jobPostingId: id });
      addToast({
        type: 'error',
        message: '새로고침하지 못했어요. 잠시 후 다시 시도해주세요.',
      });
    }
  }, [refresh, refreshApplicants, id, addToast]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)/employer" />
        <PostingSurfaceState mode="loading" scope="detail" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  // 공고가 손에 없을 때만 화면을 통째로 에러로 바꾼다.
  //
  // 옛 가드는 `error || !posting` 이라, 캐시된 공고를 정상 렌더하던 중에 신호가 한 번
  // 튀기만 해도 화면 전체가 "공고를 불러올 수 없습니다"로 교체됐다. 사장은 공고가
  // 사라진 줄 알고 같은 공고를 하나 더 만들고, 지원자가 두 공고로 쪼개진다.
  // 형제 화면(qr.tsx·collaborators.tsx)은 이미 (error && !data) 축을 쓰고 있었다.
  if (!posting || !managementView) {
    // 오프라인이면 원인이 다르다 — "찾을 수 없습니다"는 삭제됐다는 말로 읽힌다.
    // 재시도 버튼도 숨긴다. 눌러도 아무 일이 없는 버튼은 없느니만 못하다.
    const isOffline = !isOnline;
    const errorTitle = isOffline ? '오프라인 상태예요' : '공고를 불러올 수 없습니다';
    // error 가 있으면 message 를 넘기지 않는다 — ErrorState 가 AppError.userMessage /
    // extractUserMessage 로 sanitize 한 문구를 쓰게 둔다(원시 error.message 노출 금지).
    const errorMessage = isOffline
      ? '인터넷에 연결되면 공고 정보를 다시 불러옵니다.'
      : error
        ? undefined
        : '공고 정보를 찾을 수 없습니다.';

    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)/employer" />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          title={errorTitle}
          message={errorMessage}
          error={isOffline ? null : error}
          onRetry={isOffline ? undefined : handleRefresh}
        />
      </SafeAreaView>
    );
  }

  const totalApplicants = applicantData?.stats.total ?? managementView.totalApplicants;
  const confirmedApplicants = applicantData?.stats.confirmed ?? managementView.confirmedApplicants;
  const pendingApplicants = applicantData?.stats.applied ?? managementView.pendingApplicants;
  const cancellationPendingCount =
    applicantData?.stats.cancellationPending ?? posting.stats?.cancellationPendingApplicants ?? 0;
  const filledPositions = managementView.filledPositions;
  const totalPositions = managementView.totalPositions;
  // 삭제 가드는 **좌석(work_logs) 축**이다 — 서버(`deleteWithTransaction`)가 막는 축과 같아야
  // 버튼 상태와 실제 결과가 어긋나지 않는다. 종전엔 applications 축(confirmedApplicants)이라
  // 근무 종료로 확정이 completed 로 전이되면 좌석이 남아 있는데도 버튼이 열렸다(selectors.ts 주석).
  const canDelete = isPostingDeletable(filledPositions);
  const title = posting.title || '제목 없음';
  const locationLabel = managementView.locationLabel || posting.location?.name || '위치 미정';
  const allowanceItems = managementView.allowanceLabels ?? [];
  const questionCount = managementView.questions.length;

  // 오늘 근무자 중 아직 출근하지 않은 수 — 현장이 굴러가는 중이라 가장 시간에 민감한 신호다.
  const todayAbsentCount = todayGroup
    ? Math.max(0, todayGroup.stats.total - todayGroup.stats.checkedIn)
    : 0;
  const isLiveOpsVisible =
    posting.postingType === 'tournament' &&
    posting.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.APPROVED &&
    !(['draft', 'pending', 'rejected', 'cancelled', 'expired'] as string[]).includes(
      posting.status
    );

  // 고정 공고는 취소요청·정산·라이브 카드 자체가 없으므로 신호도 0으로 눌러 둔다 —
  // 없는 카드를 "지금 할 일"로 고르면 아무 데도 데려가지 못한다.
  const primaryActionKey = selectPrimaryAction({
    cancellationPendingCount: isFixed ? 0 : cancellationPendingCount,
    todayAbsentCount: isFixed ? 0 : todayAbsentCount,
    pendingApplicantCount: pendingApplicants,
    pendingSettlementCount: isFixed ? 0 : pendingSettlementCount,
    liveOpsCount: isLiveOpsVisible ? opsTournaments.length : 0,
  });

  /** "지금 할 일"이 가리키는 카드 — 미출근과 정산 대기는 둘 다 정산 화면으로 간다. */
  const primaryCardKey =
    primaryActionKey === 'todayAbsent' || primaryActionKey === 'pendingSettlement'
      ? 'settlements'
      : primaryActionKey === 'pendingApplicants'
        ? 'applicants'
        : primaryActionKey;

  /**
   * 같은 카드라도 무엇 때문에 올라왔는지에 따라 다른 말을 해야 한다 —
   * "스태프 관리/정산"이 미출근 때문에 올라왔는데 정산 얘기를 하면 사장은 다른 화면을 연다.
   * `displayTitle`/`displayDescription` 은 이 용도로 이미 준비돼 있던 확장점이다.
   */
  const primaryOverride: Partial<ActionCardProps> =
    primaryActionKey === 'todayAbsent'
      ? {
          displayTitle: '오늘 출근 확인',
          displayDescription: `아직 출근하지 않은 스태프가 ${todayAbsentCount}명이에요.`,
          actionLabel: '출근 현황 보기',
        }
      : primaryActionKey === 'pendingSettlement'
        ? {
            displayDescription: `정산할 근무가 ${pendingSettlementCount}건 남았어요.`,
            actionLabel: '정산하러 가기',
          }
        : primaryActionKey === 'cancellationRequests'
          ? { actionLabel: '취소 요청 검토하기' }
          : primaryActionKey === 'pendingApplicants'
            ? { actionLabel: '지원자 검토하기' }
            : { actionLabel: '운영 화면 열기' };

  interface PostingActionItem extends ActionCardProps {
    key: string;
    visible: boolean;
  }

  const allActionItems: PostingActionItem[] = [
    // 🚨 라이브 운영은 연결된 대회가 있으면 **항상 맨 위**다. 빈도로 강등하면
    //    대회 D-day 현장에서 사장이 이 진입점을 못 찾는다.
    {
      key: 'liveOps',
      visible: isLiveOpsVisible,
      icon: <UsersIcon size={20} color={STATUS_COLORS.info} />,
      title:
        opsTournaments.length > 0 ? `라이브 운영 (${opsTournaments.length})` : '라이브 운영 시작',
      description:
        opsTournaments.length > 0
          ? '진행 중인 라이브 운영 화면으로 이동합니다.'
          : '이 대회의 라이브 운영을 시작합니다.',
      badge:
        opsTournaments.length > 0
          ? {
              label: '진행 중',
              variant: opsTournaments.some((t) => t.status === 'active') ? 'success' : 'primary',
            }
          : undefined,
      onPress: handleLiveOps,
      testID: 'job-posting-live-ops',
    },
    {
      key: 'applicants',
      visible: true,
      icon: <UsersIcon size={20} color={SECONDARY_PALETTE[500]} />,
      title: '지원자 관리',
      description:
        pendingApplicants > 0
          ? `${pendingApplicants}명의 지원자가 대기중입니다.`
          : '지원자 목록을 확인합니다.',
      badge:
        pendingApplicants > 0 ? { label: `${pendingApplicants}명`, variant: 'warning' } : undefined,
      onPress: handleApplicants,
      testID: 'job-posting-manage-applicants',
    },
    {
      key: 'cancellationRequests',
      visible: !isFixed,
      icon: <XCircleIcon size={20} color={STATUS_COLORS.error} />,
      title: '취소 요청 관리',
      description: '스태프의 취소 요청을 검토합니다.',
      badge:
        cancellationPendingCount > 0
          ? { label: `${cancellationPendingCount}건`, variant: 'error' }
          : undefined,
      onPress: handleCancellationRequests,
      testID: 'job-posting-manage-cancellation-requests',
    },
    {
      key: 'settlements',
      visible: !isFixed,
      icon: <BanknotesIcon size={20} color={STATUS_COLORS.success} />,
      title: '스태프 관리/정산',
      description: '배정된 스태프 관리와 정산을 진행합니다.',
      badge:
        pendingSettlementCount > 0
          ? { label: `정산 ${pendingSettlementCount}건`, variant: 'warning' }
          : undefined,
      onPress: handleSettlements,
      testID: 'job-posting-manage-settlements',
    },
    {
      key: 'edit',
      visible: true,
      icon: <EditIcon size={20} color={SECONDARY_PALETTE[500]} />,
      title: '공고 수정',
      description: '공고 내용을 수정합니다.',
      badge:
        !isFixed && filledPositions > 0
          ? { label: '일정·역할 수정 제한', variant: 'warning' }
          : undefined,
      onPress: handleEdit,
      testID: 'job-posting-edit-button',
    },
    {
      key: 'collaborators',
      visible: true,
      icon: <UserPlusIcon size={20} color={SECONDARY_PALETTE[500]} />,
      title: '함께 관리할 사람',
      description: '이 공고를 함께 관리할 사람을 추가하거나 제거합니다.',
      onPress: handleCollaborators,
      testID: 'job-posting-manage-collaborators',
    },
  ];

  const actionItems = allActionItems.filter((item) => item.visible);

  const primaryItem = actionItems.find((item) => item.key === primaryCardKey);
  // 승격된 카드는 목록에서 뺀다 — 같은 testID 가 두 번 나오면 무엇을 누른 건지도 모호해진다.
  const rowItems = actionItems.filter((item) => item.key !== primaryItem?.key);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="공고 상세"
        titleSuffix={<JobTitleSuffix jobTitle={posting.title} />}
        fallbackHref="/(app)/(tabs)/employer"
        rightAction={
          <View className="flex-row items-center">
            {/* 구직자 시선 미리보기 — 내 공고가 어떻게 보이는지 확인할 길이 없었다.
                도착지 RPC 가 소유자 조회를 조회수에서 제외하므로 미리보기가 수치를 부풀리지 않는다. */}
            <Pressable
              onPress={handlePreview}
              hitSlop={8}
              className="p-2"
              accessibilityRole="button"
              accessibilityLabel="구직자에게 보이는 화면 미리보기"
              testID="job-posting-preview"
            >
              <EyeIcon size={22} color={getLayoutColor(isDark, 'headerTint')} />
            </Pressable>
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
            {/* 고정 공고는 QR 진입점을 노출하지 않는다 (work_log 행 수명 미해결 — _layout.tsx 주석 참고).
                판정은 컨텍스트 하나 — 형제 화면 4곳과 같은 값을 쓰므로 탭을 옮겨도 버튼이 깜빡이지 않는다. */}
            {!isFixed ? <HeaderQRAction onPress={handleShowQR} /> : null}
          </View>
        }
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={onPullRefresh}
            tintColor={getLayoutColor(isDark, 'refreshTint')}
          />
        }
      >
        {/* 공고는 손에 있는데 갱신만 실패한 상태 — 화면을 뺏지 않고 얇은 배너로만 알린다.
            여기 없으면 사용자는 화면이 최신인지 아닌지 알 방법이 없다. */}
        {error ? (
          <View className="pt-3">
            <PostingSurfaceState
              mode="partial"
              scope="detail"
              title="정보가 최신이 아닐 수 있어요"
              message="방금 불러오기에 실패했어요. 화면을 아래로 당겨 다시 시도해주세요."
            />
          </View>
        ) : null}

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
                {/* 상태 뱃지 = 상태를 바꾸는 자리. 표시 전용이던 뱃지에 전이를 붙였다. */}
                {canOpenStatusSheet ? (
                  <Pressable
                    onPress={() => setStatusSheetVisible(true)}
                    hitSlop={8}
                    className="mr-2 min-h-[44px] justify-center active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel="공고 상태 변경"
                    testID="job-posting-status-badge"
                  >
                    <PostingStatusBadge status={posting.status} size="sm" />
                  </Pressable>
                ) : (
                  <PostingStatusBadge status={posting.status} size="sm" className="mr-2" />
                )}
                <Pressable
                  onPress={handleToggleInfo}
                  className="min-h-[44px] flex-row items-center rounded-lg px-2 py-1 active:bg-secondary-100 dark:active:bg-secondary-700"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  // 라벨 없이 "접기"만 낭독되면 무엇을 접는지 알 수 없다. expanded 는 웹
                  // (react-native-web)에서 무효라 라벨에도 상태를 담는다.
                  accessibilityLabel={isInfoExpanded ? '근무 정보 접기' : '근무 정보 펼치기'}
                  accessibilityState={{ expanded: isInfoExpanded }}
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

            {/* 숫자는 목적지다 — 종전에는 "대기중 3"을 보고도 지원자 화면에 들어가 필터를
                다시 골라야 했다. 세 숫자가 각자 자기 목록으로 데려간다. */}
            <View className="rounded-lg bg-surface-page dark:bg-surface px-3 pb-2 pt-3">
              <View className="flex-row justify-around">
                <StatColumn
                  value={totalApplicants}
                  label="지원자"
                  valueClassName="text-primary-600 dark:text-primary-400"
                  onPress={() => handleApplicantsFiltered('all')}
                  testID="job-posting-stat-total"
                />
                {/* 다크에서 부모 배경(bg-surface)과 같은 색이라 구분선이 통째로 사라졌다. */}
                <View className="w-px bg-secondary-200 dark:bg-surface-overlay" />
                <StatColumn
                  value={confirmedApplicants}
                  label="확정"
                  valueClassName="text-success-600 dark:text-success-400"
                  onPress={() => handleApplicantsFiltered(STATUS.APPLICATION.CONFIRMED)}
                  testID="job-posting-stat-confirmed"
                />
                {/* 다크에서 부모 배경(bg-surface)과 같은 색이라 구분선이 통째로 사라졌다. */}
                <View className="w-px bg-secondary-200 dark:bg-surface-overlay" />
                <StatColumn
                  value={pendingApplicants}
                  label="대기중"
                  valueClassName="text-warning-600 dark:text-warning-400"
                  onPress={() => handleApplicantsFiltered(STATUS.APPLICATION.APPLIED)}
                  testID="job-posting-stat-pending"
                />
              </View>

              {/* 좌석(work_logs) 축 — 위 3숫자(applications 축)와 다른 축이라 표기를 분리한다.
                  지원자 화면도 같은 컴포넌트를 써서 같은 값이 같은 이름으로 보인다. */}
              <View className="mt-2">
                <SeatFillSummary filled={filledPositions} total={totalPositions} />
              </View>
            </View>
          </Card>
        </View>

        {/* 오늘 근무가 있을 때만 뜬다(TodayOpsStrip 자체 가드). 고정 공고는 위 훅에서 이미 제외. */}
        <View className="mt-3">
          <TodayOpsStrip
            todayGroup={todayGroup}
            pendingSettlementCount={pendingSettlementCount}
            onPressSettlement={handleSettlements}
          />
        </View>

        {/* 지원자 0명 — "0명이 대기중입니다"는 상태 보고일 뿐 다음 행동이 없다.
            사장이 여기서 할 수 있는 유일한 일(공유)을 실제 크기의 CTA 로 준다. */}
        {totalApplicants === 0 ? (
          <View className="px-4 pt-4">
            <Card variant="outlined" padding="md">
              <Text className="mb-1 text-base font-sans-semibold text-content-primary dark:text-off-white">
                아직 지원자가 없어요
              </Text>
              <Text className="mb-4 text-sm text-content-secondary font-sans">
                공고 링크를 단톡방이나 아는 분들께 보내면 지원이 훨씬 빨리 붙어요.
              </Text>
              <Pressable
                onPress={handleShare}
                disabled={isSharing}
                className={`min-h-[44px] flex-row items-center justify-center rounded-md bg-primary-600 py-3 active:bg-primary-700 ${
                  isSharing ? 'opacity-40' : ''
                }`}
                accessibilityRole="button"
                // 헤더 공유 아이콘과 라벨이 겹치면 보이스 컨트롤·E2E 셀렉터가 둘 중 무엇을
                // 가리키는지 알 수 없다(e2e/pages/app/job-detail.page.ts:28 이 같은 라벨을 쓴다).
                accessibilityLabel="공고 링크 공유하기"
                accessibilityState={{ disabled: isSharing }}
                testID="job-posting-empty-share"
              >
                <ShareIcon size={18} color={TEXT_COLORS.onGold} />
                <Text className="ml-2 text-base font-sans-semibold text-content-onGold">
                  공고 링크 공유하기
                </Text>
              </Pressable>
            </Card>
          </View>
        ) : null}

        {/* 지금 할 일 — 손해가 가장 큰 신호 하나만 크게 낸다. 처리할 일이 없으면 이 자리도 없다. */}
        {primaryItem ? (
          <View className="px-4 pt-4">
            <ActionCard
              icon={primaryItem.icon}
              title={primaryItem.title}
              description={primaryItem.description}
              badge={primaryItem.badge}
              onPress={primaryItem.onPress}
              testID={primaryItem.testID}
              emphasis="primary"
              {...primaryOverride}
            />
          </View>
        ) : null}

        {/* 관리 — 나머지는 행으로 강등한다. 섹션 사이를 넉넉히 띄워 덩어리를 구분한다. */}
        <View className="px-4 pb-4 pt-8">
          <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
            관리
          </Text>

          <View className="overflow-hidden rounded-lg bg-white dark:bg-surface">
            {rowItems.map((item, index) => (
              <React.Fragment key={item.key}>
                {index > 0 ? (
                  <View className="h-px bg-secondary-100 dark:bg-surface-overlay" />
                ) : null}
                <ActionCard
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  badge={item.badge}
                  onPress={item.onPress}
                  testID={item.testID}
                />
              </React.Fragment>
            ))}
          </View>
        </View>

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
          {/* 서버(`deleteWithTransaction`)가 막는 축과 같은 말을 쓴다 — 캡션이 "확정된 지원자"라고
              하면 사장은 지원자 화면에서 확정 0명을 확인하고도 삭제가 거부되는 이유를 알 수 없다. */}
          <Text className="mt-2 text-center text-xs text-content-placeholder font-sans">
            채워진 자리가 있는 공고는 삭제할 수 없습니다. 대신 마감해 주세요.
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
        confirmText="공고 삭제"
        cancelText="계속 보기"
        isDestructive
        // 삭제 결과를 보고 닫는다 — 실패하면 모달이 남아 그대로 다시 시도할 수 있다.
        // 자동으로 닫으면 사용자는 삭제됐는지 아닌지 모른 채 토스트만 보게 된다.
        isLoading={isDeleting}
        closeOnConfirm={false}
      />

      <ActionSheet
        visible={statusSheetVisible}
        onClose={() => setStatusSheetVisible(false)}
        title="공고 상태"
        // 액션이 없는 상태(정원 참·승인 대기 등)에서는 **왜 없는지**를 말한다.
        description={statusHint ?? undefined}
        options={statusSheetOptions}
        onSelect={handleStatusSelect}
      />
    </SafeAreaView>
  );
}
