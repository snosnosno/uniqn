/**
 * ops 모니터 토큰 발급/회전 훅 (1c-3, 운영자) — Service 경유.
 * 멱등 발급(force=false) 또는 강제 재발급(force=true, 유출 대응).
 * onSuccess: 대회 상세 무효화(monitorToken 갱신) + 토큰 반환(UI 가 링크/QR 생성).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsMonitorService } from '@/services/ops';
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

export function useRotateMonitorToken(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  // 제네릭 명시: 기본파라미터(force=false)는 변수타입을 void 로 추론시키므로 boolean 으로 고정.
  return useMutation<string, Error, boolean>({
    mutationFn: (force: boolean) =>
      opsMonitorService.rotateToken(tournamentId, requireActor(actorId), force),
    onSuccess: () => {
      // 성공 사용자 피드백(복사/공유 토스트)은 호출 컴포넌트가 담당 → 여기선 캐시 무효화만(중복 토스트 방지).
      qc.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
    },
    onError: (e) => {
      logger.error('ops 모니터 토큰 발급 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || '모니터 링크 발급에 실패했습니다');
    },
  });
}
