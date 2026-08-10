import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cachingPolicies, invalidateQueries, queryKeys } from '@/lib/queryClient';
import { POSTING_FILLED_COUNTS_QUERY_KEY } from '@/hooks/postingFilledCountsKey';
import {
  addDirectStaff,
  cancelConfirmedStaffConfirmation,
  cancelNoShow,
  getConfirmedStaff,
  getConfirmedStaffByDate,
  markAsNoShow,
  subscribeToConfirmedStaff,
  type GetConfirmedStaffResult,
  updateConfirmedStaffWorkTime,
  updateStaffStatus,
} from '@/services';
import { toError } from '@/errors';
import { createMutationErrorHandler } from '@/shared/errors/hookErrorHandler';
import { resolveNoShowRevertStatus } from '@/domains/staff';
import type { ConfirmedStaffStatus, WorkLogStatus } from '@/shared/status';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type {
  AddDirectStaffInput,
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
  DeleteConfirmedStaffInput,
  UpdateWorkTimeInput,
} from '@/types';
import { logger } from '@/utils/logger';

export interface UseConfirmedStaffOptions {
  realtime?: boolean;
  date?: string;
}

export interface UseConfirmedStaffReturn {
  staff: ConfirmedStaff[];
  grouped: ConfirmedStaffGroup[];
  stats: ConfirmedStaffStats;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  isRefreshing: boolean;
  updateWorkTime: (input: UpdateWorkTimeInput) => void;
  removeStaff: (input: DeleteConfirmedStaffInput) => void;
  setNoShow: (workLogId: string, reason?: string) => void;
  cancelNoShow: (workLogId: string) => void;
  changeStatus: (workLogId: string, status: WorkLogStatus) => void;
  addStaff: (input: AddDirectStaffInput) => Promise<string[]>;
  isUpdatingTime: boolean;
  isRemoving: boolean;
  isSettingNoShow: boolean;
  isCancellingNoShow: boolean;
  isChangingStatus: boolean;
  isAddingStaff: boolean;
}

const emptyStats: ConfirmedStaffStats = {
  total: 0,
  scheduled: 0,
  checkedIn: 0,
  checkedOut: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  settled: 0,
};

export function useConfirmedStaff(
  jobPostingId: string,
  options: UseConfirmedStaffOptions = {}
): UseConfirmedStaffReturn {
  const { realtime = false, date } = options;
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const user = useAuthStore((state) => state.user);
  // 구독 useEffect 의 의존성으로 들어가므로 참조가 매 렌더 바뀌면 안 된다 —
  // 배열 리터럴을 그대로 쓰면 렌더마다 구독을 끊고 다시 맺는다.
  const staffQueryKey = useMemo(
    () =>
      date
        ? queryKeys.confirmedStaff.byDate(jobPostingId, date)
        : queryKeys.confirmedStaff.byJobPosting(jobPostingId),
    [jobPostingId, date]
  );
  // 구독 장애 전용 상태 — fetch 실패(useQuery.error)와는 별개 신호다.
  // 이게 없으면 구독이 죽어도 error=null 로 굳어 화면의 ErrorState 가 도달 불가해진다(STAFF-1).
  const [realtimeError, setRealtimeError] = useState<Error | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: staffQueryKey,
    queryFn: async () => {
      if (date) {
        const staff = await getConfirmedStaffByDate(jobPostingId, date);
        return {
          staff,
          grouped: [],
          stats: emptyStats,
        } as GetConfirmedStaffResult;
      }

      return getConfirmedStaff(jobPostingId);
    },
    // realtime 여부와 무관하게 항상 돈다 — 렌더 소스를 useQuery 캐시 하나로 단일화하기
    // 위한 전제다. 예전엔 `&& !realtime` 라 구독 모드에서 캐시가 비었고, 그 결과
    // setQueryData 로 쓰던 낙관적 업데이트 3벌이 화면에 도달하지 못하는 죽은 코드였다(realtime-01).
    enabled: !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });

  useEffect(() => {
    if (!realtime || !jobPostingId) {
      return;
    }

    logger.info('Confirmed staff realtime subscription started', { jobPostingId });

    const unsubscribe = subscribeToConfirmedStaff(jobPostingId, {
      onUpdate: (result) => {
        // 별도 state 가 아니라 쿼리 캐시에 직접 기록한다(useJobDetail 과 같은 패턴).
        // 그래야 구독 데이터와 낙관적 업데이트가 같은 소스를 공유한다.
        queryClient.setQueryData<GetConfirmedStaffResult>(staffQueryKey, result);
        setRealtimeError(null);
      },
      onError: (subscriptionError) => {
        logger.error('Confirmed staff subscription failed', toError(subscriptionError), {
          jobPostingId,
        });
        // 토스트로 끝내지 않고 상태로 보존한다 — 토스트는 사라지고 화면은 스피너에 남는다.
        setRealtimeError(toError(subscriptionError));
        addToast({
          type: 'error',
          message: '실시간 스태프 정보를 불러오지 못했습니다.',
        });
      },
    });

    return () => {
      logger.info('Confirmed staff realtime subscription stopped', { jobPostingId });
      unsubscribe();
    };
  }, [addToast, jobPostingId, realtime, queryClient, staffQueryKey]);

  const updateWorkTimeMutation = useMutation({
    mutationFn: updateConfirmedStaffWorkTime,
    onSuccess: () => {
      // invalidateQueries.staffManagement 가 workSchedule.all 까지 무효화하므로(근무표 출근 수정 #3
      // 후 카드 상태/시간 자동 갱신) 별도 호출은 불필요하다.
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '근무 시간이 수정되었습니다.' });
    },
    // 서버 구체 사유(예: '이미 정산이 완료된 근무 기록은 수정할 수 없습니다.')를
    // 고정 문구로 삼키지 않도록 appError.userMessage를 그대로 노출한다.
    onError: createMutationErrorHandler('근무 시간 수정', addToast, {
      context: { jobPostingId },
    }),
  });

  const removeStaffMutation = useMutation({
    mutationFn: cancelConfirmedStaffConfirmation,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      // 정원/자동마감(capacity_full) 상태가 바뀌므로 공고 상세·목록·확정분포 캐시도 무효화
      invalidateQueries.jobPostings();
      queryClient.invalidateQueries({ queryKey: [POSTING_FILLED_COUNTS_QUERY_KEY] });
      addToast({ type: 'success', message: '확정 스태프가 해제되었습니다.' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to cancel confirmed staff confirmation', mutationError, {
        jobPostingId,
      });
      addToast({ type: 'error', message: '확정 스태프 해제에 실패했습니다.' });
    },
  });

  const setNoShowMutation = useMutation({
    mutationFn: ({ workLogId, reason }: { workLogId: string; reason?: string }) =>
      markAsNoShow(workLogId, reason),
    onMutate: async ({ workLogId }) => {
      await queryClient.cancelQueries({ queryKey: staffQueryKey });
      const previous = queryClient.getQueryData<GetConfirmedStaffResult>(staffQueryKey);

      if (previous) {
        queryClient.setQueryData<GetConfirmedStaffResult>(staffQueryKey, {
          ...previous,
          staff: previous.staff.map((staff) =>
            staff.id === workLogId
              ? { ...staff, status: 'no_show' as ConfirmedStaffStatus, isNoShow: true }
              : staff
          ),
        });
      }

      return { previous };
    },
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '노쇼 처리되었습니다.' });
    },
    onError: (mutationError: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(staffQueryKey, context.previous);
      }

      logger.error('Failed to mark no-show', mutationError, { jobPostingId });
      addToast({ type: 'error', message: '노쇼 처리에 실패했습니다.' });
    },
  });

  const cancelNoShowMutation = useMutation({
    mutationFn: (workLogId: string) => cancelNoShow(workLogId),
    onMutate: async (workLogId: string) => {
      await queryClient.cancelQueries({ queryKey: staffQueryKey });
      const previous = queryClient.getQueryData<GetConfirmedStaffResult>(staffQueryKey);

      if (previous) {
        queryClient.setQueryData<GetConfirmedStaffResult>(staffQueryKey, {
          ...previous,
          staff: previous.staff.map((staff) =>
            staff.id === workLogId
              ? {
                  ...staff,
                  status: resolveNoShowRevertStatus(
                    staff.checkInTime,
                    staff.checkOutTime
                  ) as ConfirmedStaffStatus,
                  isNoShow: false,
                  noShowAt: undefined,
                  noShowReason: undefined,
                }
              : staff
          ),
        });
      }

      return { previous };
    },
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '노쇼가 취소되었습니다.' });
    },
    // 서버 구체 사유(예: '이미 정산이 완료된 근무 기록은 노쇼를 취소할 수 없습니다.')를
    // 고정 문구로 삼키지 않도록 appError.userMessage를 그대로 노출한다.
    onError: createMutationErrorHandler('노쇼 취소', addToast, {
      context: { jobPostingId },
      onRollback: (ctx) => {
        const { previous } = ctx as { previous?: GetConfirmedStaffResult };
        if (previous) {
          queryClient.setQueryData(staffQueryKey, previous);
        }
      },
    }),
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ workLogId, status }: { workLogId: string; status: WorkLogStatus }) =>
      updateStaffStatus(workLogId, status),
    onMutate: async ({ workLogId, status }) => {
      await queryClient.cancelQueries({ queryKey: staffQueryKey });
      const previous = queryClient.getQueryData<GetConfirmedStaffResult>(staffQueryKey);

      if (previous) {
        queryClient.setQueryData<GetConfirmedStaffResult>(staffQueryKey, {
          ...previous,
          staff: previous.staff.map((staff) =>
            staff.id === workLogId ? { ...staff, status: status as ConfirmedStaffStatus } : staff
          ),
        });
      }

      return { previous };
    },
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '상태가 변경되었습니다.' });
    },
    onError: (mutationError: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(staffQueryKey, context.previous);
      }

      logger.error('Failed to change confirmed staff status', mutationError, { jobPostingId });
      addToast({ type: 'error', message: '상태 변경에 실패했습니다.' });
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: addDirectStaff,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      // 정원/자동마감(capacity_full) 상태가 바뀌므로 공고 상세·목록 캐시도 무효화
      invalidateQueries.jobPostings();
      // 스태프탭 직접추가가 근무표(부족셀·하루 슬롯)에 즉시 반영되도록 무효화 (W-1).
      // AddSlotSheet(그리드) 경로도 같은 addStaff 를 쓰므로 단일 지점에서 그리드 캐시를 갱신한다.
      queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
      addToast({ type: 'success', message: '스태프가 추가되었습니다.' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to add direct staff', mutationError, { jobPostingId });
      const userMessage =
        (mutationError as { userMessage?: string }).userMessage ?? '스태프 추가에 실패했습니다.';
      addToast({ type: 'error', message: userMessage });
    },
  });

  /**
   * 수동 새로고침 — realtime 모드에서도 동작한다.
   *
   * 예전엔 `if (!realtime) refetch()` 라 realtime 소비자에게는 문자 그대로 빈 함수였고,
   * 새로고침 버튼과 pull-to-refresh 가 시각 피드백조차 없이 아무 일도 안 했다(STAFF-11).
   * 이제 useQuery 가 항상 enabled 라 refetch 결과가 곧 렌더 소스(캐시)를 갱신한다 —
   * 모드별 분기 자체가 필요 없어졌고, STAFF-11 은 구조적으로 재발할 수 없다.
   *
   * 반환 타입은 `void` 로 유지한다 — Promise 를 흘리면 호출부 두 곳(RefreshControl·
   * QuickActions)이 그대로 미처리 rejection 을 만든다.
   */
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const updateWorkTime = useCallback(
    (input: Omit<UpdateWorkTimeInput, 'modifiedBy'> & { modifiedBy?: string }) => {
      updateWorkTimeMutation.mutate({
        ...input,
        modifiedBy: input.modifiedBy ?? user?.uid,
      });
    },
    [updateWorkTimeMutation, user?.uid]
  );

  const removeStaff = useCallback(
    (input: DeleteConfirmedStaffInput) => {
      removeStaffMutation.mutate(input);
    },
    [removeStaffMutation]
  );

  const setNoShow = useCallback(
    (workLogId: string, reason?: string) => {
      setNoShowMutation.mutate({ workLogId, reason });
    },
    [setNoShowMutation]
  );

  const cancelNoShowStaff = useCallback(
    (workLogId: string) => {
      cancelNoShowMutation.mutate(workLogId);
    },
    [cancelNoShowMutation]
  );

  const changeStatus = useCallback(
    (workLogId: string, status: WorkLogStatus) => {
      changeStatusMutation.mutate({ workLogId, status });
    },
    [changeStatusMutation]
  );

  const addStaff = useCallback(
    (input: AddDirectStaffInput) => addStaffMutation.mutateAsync(input),
    [addStaffMutation]
  );

  // 렌더 소스는 useQuery 캐시 하나뿐이다 — 구독 갱신·낙관적 업데이트·수동 새로고침이
  // 모두 같은 키에 쓰므로 어느 경로로 들어와도 화면에 도달한다(realtime-01).
  const resultData = data;

  return {
    staff: resultData?.staff ?? [],
    grouped: resultData?.grouped ?? [],
    stats: resultData?.stats ?? emptyStats,
    // realtime 계약: 구독 실패를 error 로 승격하고, 실패한 뒤에는 로딩을 끝낸다.
    // (예전엔 error 가 항상 null 이라 화면의 ErrorState 가 도달 불가한 죽은 코드였다.)
    isLoading: realtimeError ? false : isLoading,
    error: realtimeError ?? (error ? toError(error) : null),
    refresh,
    isRefreshing: isRefetching,
    updateWorkTime,
    removeStaff,
    setNoShow,
    cancelNoShow: cancelNoShowStaff,
    changeStatus,
    addStaff,
    isUpdatingTime: updateWorkTimeMutation.isPending,
    isRemoving: removeStaffMutation.isPending,
    isSettingNoShow: setNoShowMutation.isPending,
    isCancellingNoShow: cancelNoShowMutation.isPending,
    isChangingStatus: changeStatusMutation.isPending,
    isAddingStaff: addStaffMutation.isPending,
  };
}
