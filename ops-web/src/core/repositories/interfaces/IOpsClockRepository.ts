// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/interfaces/IOpsClockRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsClock } from '@/core/types/ops';

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
  /**
   * 끝난 레벨 따라잡기 (ops_clock_sync) — 시간이 0 이 된 레벨을 서버가 다음 레벨로 넘긴다.
   * 반환 = 넘어간 레벨 수(0 이면 넘어갈 것이 없었다: 아직 시간이 남았거나, 일시정지거나, 마지막 레벨).
   */
  sync(tournamentId: string, actorId: string): Promise<number>;
}
