import type { OpsClock } from '@/types/ops';

/**
 * ops 서버동기 클럭 Repository (1c).
 * 읽기는 RLS 필터(is_ops_member), 쓰기는 클럭 SECDEF RPC(ops_clock_*).
 */
export interface IOpsClockRepository {
  /** 대회 클럭 단일행 (없으면 null). */
  get(tournamentId: string): Promise<OpsClock | null>;
  /** 시작/재개 (ops_clock_start). */
  start(tournamentId: string, actorId: string): Promise<void>;
  /** 일시정지 (ops_clock_pause). */
  pause(tournamentId: string, actorId: string): Promise<void>;
  /** 특정 레벨로 이동 (ops_clock_set_level). */
  setLevel(tournamentId: string, actorId: string, sort: number): Promise<void>;
  /** ±N초 보정 — deltaSec>0 = 잔여시간 증가 (ops_clock_adjust). */
  adjust(tournamentId: string, actorId: string, deltaSec: number): Promise<void>;
}
