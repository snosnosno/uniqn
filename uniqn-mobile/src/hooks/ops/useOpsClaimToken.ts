/**
 * ops 1c-4 claim 토큰 훅 — Service 경유.
 * useIssueClaimToken(운영자): 참가자 claim_token 발급(QR 슬립용) → 토큰 반환.
 * useClaimParticipant(플레이어): 본인 계정 1회 바인딩 + 플레이어뷰 무효화.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsPlayerService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function requireActor(actorId: string | undefined | null): string {
  if (!actorId) throw new Error('로그인이 필요합니다');
  return actorId;
}

/** 운영자: 참가자 claim_token 발급(멱등). mutate(participantId) → 토큰. 성공 피드백은 호출 컴포넌트가 담당. */
export function useIssueClaimToken(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation<string, Error, string>({
    mutationFn: (participantId: string) =>
      opsPlayerService.issueClaimToken(participantId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
    },
    onError: (e) => {
      logger.error('ops claim 토큰 발급 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || 'QR 발급에 실패했습니다');
    },
  });
}

/** 플레이어: claim_token 으로 본인 계정 바인딩. mutate(claimToken). */
export function useClaimParticipant(claimToken: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.uid);
  return useMutation<void, Error, void>({
    mutationFn: () => opsPlayerService.claimParticipant(claimToken, requireActor(userId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.player(claimToken) });
      useToastStore.getState().success('내 계정에 연결했습니다');
    },
    onError: (e) => {
      logger.error('ops 참가자 클레임 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || '계정 연결에 실패했습니다');
    },
  });
}
