import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cachingPolicies, invalidateQueries, queryKeys } from '@/lib/queryClient';
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
  updateStaffRole,
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
  UpdateStaffRoleInput,
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
  changeRole: (input: UpdateStaffRoleInput) => void;
  updateWorkTime: (input: UpdateWorkTimeInput) => void;
  removeStaff: (input: DeleteConfirmedStaffInput) => void;
  setNoShow: (workLogId: string, reason?: string) => void;
  cancelNoShow: (workLogId: string) => void;
  changeStatus: (workLogId: string, status: WorkLogStatus) => void;
  addStaff: (input: AddDirectStaffInput) => Promise<string[]>;
  isChangingRole: boolean;
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
  const staffQueryKey = date
    ? queryKeys.confirmedStaff.byDate(jobPostingId, date)
    : queryKeys.confirmedStaff.byJobPosting(jobPostingId);
  const [realtimeData, setRealtimeData] = useState<GetConfirmedStaffResult | null>(null);

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
    enabled: !!jobPostingId && !realtime,
    staleTime: cachingPolicies.frequent,
  });

  useEffect(() => {
    if (!realtime || !jobPostingId) {
      return;
    }

    logger.info('Confirmed staff realtime subscription started', { jobPostingId });

    const unsubscribe = subscribeToConfirmedStaff(jobPostingId, {
      onUpdate: (result) => {
        setRealtimeData(result);
      },
      onError: (subscriptionError) => {
        logger.error('Confirmed staff subscription failed', toError(subscriptionError), {
          jobPostingId,
        });
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
  }, [addToast, jobPostingId, realtime]);

  const changeRoleMutation = useMutation({
    mutationFn: updateStaffRole,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '역할이 변경되었습니다.' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to change confirmed staff role', mutationError, { jobPostingId });
      addToast({ type: 'error', message: '역할 변경에 실패했습니다.' });
    },
  });

  const updateWorkTimeMutation = useMutation({
    mutationFn: updateConfirmedStaffWorkTime,
    onSuccess: () => {
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
      // 정원/자동마감(capacity_full) 상태가 바뀌므로 공고 상세·목록 캐시도 무효화
      invalidateQueries.jobPostings();
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
      // 스태프탭 직접추가가 주간 배치 그리드(부족셀·하루 슬롯)에 즉시 반영되도록 무효화 (W-1).
      // AddSlotSheet(그리드) 경로도 같은 addStaff 를 쓰므로 단일 지점에서 그리드 캐시를 갱신한다.
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
      addToast({ type: 'success', message: '스태프가 추가되었습니다.' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to add direct staff', mutationError, { jobPostingId });
      const userMessage =
        (mutationError as { userMessage?: string }).userMessage ?? '스태프 추가에 실패했습니다.';
      addToast({ type: 'error', message: userMessage });
    },
  });

  const refresh = useCallback(() => {
    if (!realtime) {
      refetch();
    }
  }, [realtime, refetch]);

  const changeRole = useCallback(
    (input: Omit<UpdateStaffRoleInput, 'changedBy'> & { changedBy?: string }) => {
      changeRoleMutation.mutate({
        ...input,
        changedBy: input.changedBy ?? user?.uid ?? 'system',
      });
    },
    [changeRoleMutation, user?.uid]
  );

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

  const resultData = realtime ? realtimeData : data;

  return {
    staff: resultData?.staff ?? [],
    grouped: resultData?.grouped ?? [],
    stats: resultData?.stats ?? emptyStats,
    isLoading: realtime ? !realtimeData : isLoading,
    error: error ? toError(error) : null,
    refresh,
    isRefreshing: isRefetching,
    changeRole,
    updateWorkTime,
    removeStaff,
    setNoShow,
    cancelNoShow: cancelNoShowStaff,
    changeStatus,
    addStaff,
    isChangingRole: changeRoleMutation.isPending,
    isUpdatingTime: updateWorkTimeMutation.isPending,
    isRemoving: removeStaffMutation.isPending,
    isSettingNoShow: setNoShowMutation.isPending,
    isCancellingNoShow: cancelNoShowMutation.isPending,
    isChangingStatus: changeStatusMutation.isPending,
    isAddingStaff: addStaffMutation.isPending,
  };
}
