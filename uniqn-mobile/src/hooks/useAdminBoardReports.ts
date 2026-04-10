import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  getBoardReportDetailForAdmin,
  getBoardReportsForAdmin,
  reviewBoardReport,
} from '@/services/boardService';
import { useToastStore } from '@/stores/toastStore';
import type { BoardReportFilterStatus, BoardReportResolutionStatus } from '@/types/board';

export function useAdminBoardReports(status: BoardReportFilterStatus = 'all') {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.boards.adminReports(status),
    queryFn: () => getBoardReportsForAdmin(user?.uid ?? '', { status }),
    enabled: Boolean(user?.uid),
    staleTime: 60 * 1000,
  });
}

export function useAdminBoardReportDetail(reportId: string, enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.boards.adminReportDetail(reportId),
    queryFn: () => getBoardReportDetailForAdmin(reportId, user?.uid ?? ''),
    enabled: enabled && Boolean(reportId) && Boolean(user?.uid),
    staleTime: 60 * 1000,
  });
}

export function useReviewBoardReport(reportId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (status: BoardReportResolutionStatus) =>
      reviewBoardReport(reportId, user?.uid ?? '', status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all });
      addToast({ type: 'success', message: '게시판 신고를 처리했습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '게시판 신고 처리에 실패했습니다.',
      });
    },
  });
}
