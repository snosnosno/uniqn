import type { OpsLiveStats } from '@/types/ops';

/**
 * ops 파생 라이브 통계 Repository (1c). 읽기 전용 — 쓰기는 트리거 재계산(앱 경로 없음).
 */
export interface IOpsLiveStatsRepository {
  /** 대회 라이브 통계 단일행 (없으면 null). */
  get(tournamentId: string): Promise<OpsLiveStats | null>;
}
