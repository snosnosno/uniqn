/**
 * UNIQN Mobile - 확정 스태프 관리 훅
 *
 * @description 구인자용 확정 스태프 조회/관리 훅
 * @version 1.0.0
 *
 * 기능:
 * - 확정 스태프 목록 조회 (날짜별 그룹화)
 * - 역할 변경
 * - 근무 시간 수정
 * - 스태프 삭제
 * - 노쇼 처리
 * - 실시간 구독 (옵션)
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryKeys, invalidateQueries } from '@/lib/queryClient';
import {
  getConfirmedStaff,
  getConfirmedStaffByDate,
  updateStaffRole,
  updateConfirmedStaffWorkTime,
  deleteConfirmedStaff,
  markAsNoShow,
  updateStaffStatus,
  subscribeToConfirmedStaff,
  type GetConfirmedStaffResult,
} from '@/services';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore';
import type {
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
  ConfirmedStaffStatus,
  UpdateStaffRoleInput,
  UpdateWorkTimeInput,
  DeleteConfirmedStaffInput,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UseConfirmedStaffOptions {
  /** 실시간 구독 활성화 (기본: false) */
  realtime?: boolean;
  /** 특정 날짜만 조회 */
  date?: string;
}

export interface UseConfirmedStaffReturn {
  /** 확정 스태프 목록 */
  staff: ConfirmedStaff[];
  /** 날짜별 그룹 */
  grouped: ConfirmedStaffGroup[];
  /** 통계 */
  stats: ConfirmedStaffStats;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
  /** 새로고침 */
  refresh: () => void;
  /** 새로고침 중 */
  isRefreshing: boolean;

  // Actions
  /** 역할 변경 */
  changeRole: (input: UpdateStaffRoleInput) => void;
  /** 근무 시간 수정 */
  updateWorkTime: (input: UpdateWorkTimeInput) => void;
  /** 스태프 삭제 */
  removeStaff: (input: DeleteConfirmedStaffInput) => void;
  /** 노쇼 처리 */
  setNoShow: (workLogId: string, reason?: string) => void;
  /** 상태 변경 */
  changeStatus: (workLogId: string, status: ConfirmedStaffStatus) => void;

  // Action 상태
  isChangingRole: boolean;
  isUpdatingTime: boolean;
  isRemoving: boolean;
  isSettingNoShow: boolean;
  isChangingStatus: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

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

// ============================================================================
// Hook
// ============================================================================

export function useConfirmedStaff(
  jobPostingId: string,
  options: UseConfirmedStaffOptions = {}
): UseConfirmedStaffReturn {
  const { realtime = false, date } = options;
  const { addToast } = useToastStore();

  // 실시간 데이터 (realtime 모드용)
  const [realtimeData, setRealtimeData] = useState<GetConfirmedStaffResult | null>(null);

  // ============================================================================
  // Query - 확정 스태프 조회
  // ============================================================================

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: date
      ? queryKeys.confirmedStaff.byDate(jobPostingId, date)
      : queryKeys.confirmedStaff.byJobPosting(jobPostingId),
    queryFn: async () => {
      if (date) {
        const staff = await getConfirmedStaffByDate(jobPostingId, date);
        // 날짜 지정 시 단순 목록 반환
        return {
          staff,
          grouped: [],
          stats: emptyStats,
        } as GetConfirmedStaffResult;
      }
      return getConfirmedStaff(jobPostingId);
    },
    enabled: !!jobPostingId && !realtime,
    staleTime: 2 * 60 * 1000, // 2분
  });

  // ============================================================================
  // 실시간 구독
  // ============================================================================

  useEffect(() => {
    if (!realtime || !jobPostingId) return;

    logger.info('확정 스태프 실시간 구독 시작', { jobPostingId });

    const unsubscribe = subscribeToConfirmedStaff(jobPostingId, {
      onUpdate: (result) => {
        setRealtimeData(result);
      },
      onError: (err) => {
        logger.error('확정 스태프 구독 에러', err, { jobPostingId });
        addToast({
          type: 'error',
          message: '스태프 데이터 동기화 중 오류가 발생했습니다.',
        });
      },
    });

    return () => {
      logger.info('확정 스태프 실시간 구독 해제', { jobPostingId });
      unsubscribe();
    };
  }, [realtime, jobPostingId, addToast]);

  // ============================================================================
  // Mutations
  // ============================================================================

  // 역할 변경
  const changeRoleMutation = useMutation({
    mutationFn: updateStaffRole,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '역할이 변경되었습니다.' });
    },
    onError: (error: Error) => {
      logger.error('역할 변경 실패', error, { jobPostingId });
      addToast({ type: 'error', message: '역할 변경에 실패했습니다.' });
    },
  });

  // 근무 시간 수정
  const updateWorkTimeMutation = useMutation({
    mutationFn: updateConfirmedStaffWorkTime,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '근무 시간이 수정되었습니다.' });
    },
    onError: (error: Error) => {
      logger.error('근무 시간 수정 실패', error, { jobPostingId });
      addToast({ type: 'error', message: '근무 시간 수정에 실패했습니다.' });
    },
  });

  // 스태프 삭제
  const removeStaffMutation = useMutation({
    mutationFn: deleteConfirmedStaff,
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '스태프가 삭제되었습니다.' });
    },
    onError: (error: Error) => {
      logger.error('스태프 삭제 실패', error, { jobPostingId });
      addToast({ type: 'error', message: '스태프 삭제에 실패했습니다.' });
    },
  });

  // 노쇼 처리
  const setNoShowMutation = useMutation({
    mutationFn: ({ workLogId, reason }: { workLogId: string; reason?: string }) =>
      markAsNoShow(workLogId, reason),
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '노쇼 처리되었습니다.' });
    },
    onError: (error: Error) => {
      logger.error('노쇼 처리 실패', error, { jobPostingId });
      addToast({ type: 'error', message: '노쇼 처리에 실패했습니다.' });
    },
  });

  // 상태 변경
  const changeStatusMutation = useMutation({
    mutationFn: ({ workLogId, status }: { workLogId: string; status: ConfirmedStaffStatus }) =>
      updateStaffStatus(workLogId, status),
    onSuccess: () => {
      invalidateQueries.staffManagement(jobPostingId);
      addToast({ type: 'success', message: '상태가 변경되었습니다.' });
    },
    onError: (error: Error) => {
      logger.error('상태 변경 실패', error, { jobPostingId });
      addToast({ type: 'error', message: '상태 변경에 실패했습니다.' });
    },
  });

  // ============================================================================
  // Callbacks
  // ============================================================================

  const refresh = useCallback(() => {
    if (realtime) {
      // 실시간 모드에서는 수동 리프레시 불필요
      return;
    }
    refetch();
  }, [realtime, refetch]);

  const changeRole = useCallback(
    (input: UpdateStaffRoleInput) => {
      changeRoleMutation.mutate(input);
    },
    [changeRoleMutation]
  );

  const updateWorkTime = useCallback(
    (input: UpdateWorkTimeInput) => {
      updateWorkTimeMutation.mutate(input);
    },
    [updateWorkTimeMutation]
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
    (workLogId: string, status: ConfirmedStaffStatus) => {
      changeStatusMutation.mutate({ workLogId, status });
    },
    [changeStatusMutation]
  );

  // ============================================================================
  // Return
  // ============================================================================

  // 실시간 모드일 때 realtimeData 사용, 아니면 query data 사용
  const resultData = realtime ? realtimeData : data;

  return {
    staff: resultData?.staff ?? [],
    grouped: resultData?.grouped ?? [],
    stats: resultData?.stats ?? emptyStats,
    isLoading: realtime ? !realtimeData : isLoading,
    error: error as Error | null,
    refresh,
    isRefreshing: isRefetching,

    // Actions
    changeRole,
    updateWorkTime,
    removeStaff,
    setNoShow,
    changeStatus,

    // Action 상태
    isChangingRole: changeRoleMutation.isPending,
    isUpdatingTime: updateWorkTimeMutation.isPending,
    isRemoving: removeStaffMutation.isPending,
    isSettingNoShow: setNoShowMutation.isPending,
    isChangingStatus: changeStatusMutation.isPending,
  };
}

export default useConfirmedStaff;
