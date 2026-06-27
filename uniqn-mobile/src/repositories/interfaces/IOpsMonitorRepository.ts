import type { OpsMonitorSnapshot } from '@/types/ops';

/**
 * ops 공개 모니터(전광판) Repository (1c-3).
 * getSnapshot 은 anon SECDEF RPC(비-PII 투영) — 토큰만으로 접근(capability-URL).
 * rotateToken 은 운영자 전용 SECDEF RPC(멱등 발급/회전).
 */
export interface IOpsMonitorRepository {
  /** 공개 전광판 스냅샷. 토큰 무효/만료 시 AppError(OPS_MONITOR_TOKEN_INVALID). */
  getSnapshot(monitorToken: string): Promise<OpsMonitorSnapshot>;
  /** 모니터 토큰 발급/회전(멱등). force=true 면 강제 재발급. monitorToken 반환. */
  rotateToken(tournamentId: string, actorId: string, force?: boolean): Promise<string>;
}
