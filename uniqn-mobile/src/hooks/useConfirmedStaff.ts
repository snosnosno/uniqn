import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cachingPolicies, invalidateQueries, queryKeys } from '@/lib/queryClient';
import {
  cancelConfirmedStaffConfirmation,
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
import type { ConfirmedStaffStatus, WorkLogStatus } from '@/shared/status';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type {
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
  changeStatus: (workLogId: string, status: WorkLogStatus) => void;
  isChangingRole: boolean;
  isUpdatingTime: boolean;
  isRemoving: boolean;
  isSettingNoShow: boolean;
  isChangingStatus: boolean;
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
          message: '?ㅽ깭???곗씠???숆린??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.',
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
      addToast({ type: 'success', message: '??븷??蹂寃쎈릺?덉뒿?덈떎.' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to change confirmed staff role', mutationError, { jobPostingId });
      addToast({ type: 'error', message: '??븷 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎.' });
    },
  });

  const updateWorkTimeMutation = useMutation({
    mutationFn: updateConfirmedStaffWorkTime,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '洹쇰Т ?쒓컙???섏젙?섏뿀?듬땲??' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to update confirmed staff time', mutationError, { jobPostingId });
      addToast({ type: 'error', message: '洹쇰Т ?쒓컙 ?섏젙???ㅽ뙣?덉뒿?덈떎.' });
    },
  });

  const removeStaffMutation = useMutation({
    mutationFn: cancelConfirmedStaffConfirmation,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '?ㅽ깭?꾧? ??젣?섏뿀?듬땲??' });
    },
    onError: (mutationError: Error) => {
      logger.error('Failed to cancel confirmed staff confirmation', mutationError, {
        jobPostingId,
      });
      addToast({ type: 'error', message: '?ㅽ깭????젣???ㅽ뙣?덉뒿?덈떎.' });
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
      addToast({ type: 'success', message: '?몄눥 泥섎━?섏뿀?듬땲??' });
    },
    onError: (mutationError: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(staffQueryKey, context.previous);
      }

      logger.error('Failed to mark no-show', mutationError, { jobPostingId });
      addToast({ type: 'error', message: '?몄눥 泥섎━???ㅽ뙣?덉뒿?덈떎.' });
    },
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
      addToast({ type: 'success', message: 'Status updated.' });
    },
    onError: (mutationError: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(staffQueryKey, context.previous);
      }

      logger.error('Failed to change confirmed staff status', mutationError, { jobPostingId });
      addToast({ type: 'error', message: 'Failed to update status.' });
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

  const changeStatus = useCallback(
    (workLogId: string, status: WorkLogStatus) => {
      changeStatusMutation.mutate({ workLogId, status });
    },
    [changeStatusMutation]
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
    changeStatus,
    isChangingRole: changeRoleMutation.isPending,
    isUpdatingTime: updateWorkTimeMutation.isPending,
    isRemoving: removeStaffMutation.isPending,
    isSettingNoShow: setNoShowMutation.isPending,
    isChangingStatus: changeStatusMutation.isPending,
  };
}

export default useConfirmedStaff;
