/**
 * (S4) 채팅 메시지 신고
 *
 * 증거(신고 메시지 + 직전 10개)는 서버 RPC 가 DB 에서 채운다 — 클라는 메시지 id·사유·설명만 보낸다.
 * 결과는 boolean 으로 돌려준다(성공이면 시트를 닫고, 실패면 시트를 연 채 다시 시도하게 둔다).
 */
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { chatService, type ReportMessageInput } from '@/services/chat';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { useToastStore } from '@/stores/toastStore';
import { extractUserMessage } from '@/errors';
import { logger } from '@/utils/logger';

export const CHAT_REPORT_DONE_MESSAGE = '신고가 접수됐어요. 운영팀이 확인할게요.';

export function useReportChatMessage() {
  const mutation = useMutation({
    mutationFn: (input: ReportMessageInput) => {
      requireOnlineForMutation('채팅 신고');
      return chatService.reportMessage(input);
    },
    onSuccess: () => {
      useToastStore.getState().success(CHAT_REPORT_DONE_MESSAGE);
    },
    onError: (error) => {
      logger.warn('채팅 신고 실패', { component: 'useReportChatMessage' });
      useToastStore.getState().error(extractUserMessage(error) || '신고하지 못했어요');
    },
  });

  const { mutateAsync } = mutation;
  const report = useCallback(
    (input: ReportMessageInput) =>
      mutateAsync(input).then(
        () => true,
        () => false
      ),
    [mutateAsync]
  );

  return { report, isReporting: mutation.isPending };
}
