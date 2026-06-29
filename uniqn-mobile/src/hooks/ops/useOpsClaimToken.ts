/**
 * ops claim 토큰 분리 훅 — Service 경유.
 * useIssuePlayerCredentials(운영자): view_token + PIN 발급/로테이트 → {viewToken, claimPin}.
 * useClaimParticipant(플레이어): view_token + PIN 으로 본인 계정 1회 바인딩 + 플레이어뷰 무효화.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsPlayerService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { OpsPlayerCredentials } from '@/types/ops';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function requireActor(actorId: string | undefined | null): string {
  if (!actorId) throw new Error('로그인이 필요합니다');
  return actorId;
}

/** 운영자: view_token + PIN 발급/로테이트. mutate(participantId) → {viewToken, claimPin}. 성공 피드백은 호출 컴포넌트. */
export function useIssuePlayerCredentials(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation<OpsPlayerCredentials, Error, string>({
    mutationFn: (participantId: string) =>
      opsPlayerService.issuePlayerCredentials(participantId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
    },
    onError: (e) => {
      logger.error('ops 플레이어 자격 발급 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || 'PIN 발급에 실패했습니다');
    },
  });
}

/** 플레이어: view_token + PIN 으로 본인 계정 바인딩. mutate(claimPin). */
export function useClaimParticipant(viewToken: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.uid);
  return useMutation<void, Error, string>({
    mutationFn: (claimPin: string) =>
      opsPlayerService.claimParticipant(viewToken, claimPin, requireActor(userId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.player(viewToken) });
      useToastStore.getState().success('내 계정에 연결했습니다');
    },
    onError: (e) => {
      logger.error('ops 참가자 클레임 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || '계정 연결에 실패했습니다');
    },
  });
}
