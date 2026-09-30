// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/interfaces/IOpsLiveStatsRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsLiveStats } from '@/core/types/ops';

/**
 * ops 파생 라이브 통계 Repository (1c). 읽기 전용 — 쓰기는 트리거 재계산(앱 경로 없음).
 */
export interface IOpsLiveStatsRepository {
  /** 대회 라이브 통계 단일행 (없으면 null). */
  get(tournamentId: string): Promise<OpsLiveStats | null>;
}
