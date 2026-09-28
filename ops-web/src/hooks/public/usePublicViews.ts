/** 공개뷰 두 종 — 모바일 useMonitorSnapshot·usePlayerView 대응(같은 anon RPC 2개만 쓴다). */
import { useEffect } from 'react';
import { ERROR_CODES } from '@/core/errors/AppError';
import { opsMonitorRepository, opsPlayerRepository } from '@/core/repositories/ops';
import { trackOpsFunnel } from '@/repositories/analyticsRepository';
import { MIN_TOKEN_LENGTH, usePublicPoll } from './usePublicPoll';

export function useMonitorSnapshot(token: string | undefined) {
  return usePublicPoll(
    'monitor',
    token,
    (t) => opsMonitorRepository.getSnapshot(t),
    ERROR_CODES.OPS_MONITOR_TOKEN_INVALID
  );
}

export function usePlayerView(token: string | undefined) {
  return usePublicPoll(
    'player',
    token,
    (t) => opsPlayerRepository.getPlayerView(t),
    ERROR_CODES.OPS_VIEW_TOKEN_INVALID
  );
}

/** D1 퍼널: 공개뷰 열람 — 토큰 앞 8자만(capability 원문 전송 금지, 모바일과 같다). */
export function useTrackPublicView(kind: 'monitor' | 'player', token: string | undefined): void {
  useEffect(() => {
    if (token && token.length >= MIN_TOKEN_LENGTH) {
      trackOpsFunnel('ops_public_view_opened', { tk: token.slice(0, 8), kind });
    }
  }, [kind, token]);
}
