/**
 * ops Repository 배럴 — 싱글톤 + 타입 재노출. 소비자는 `@/repositories/ops` 에서 import.
 * (기존 중앙 배럴 대신 전용 모듈 — EmployerApplicationRepository 자가export 관행과 동일.)
 */
import { SupabaseOpsTournamentRepository } from './supabase/OpsTournamentRepository';
import { SupabaseOpsParticipantRepository } from './supabase/OpsParticipantRepository';
import { SupabaseOpsTableRepository } from './supabase/OpsTableRepository';
import { SupabaseOpsSeatRepository } from './supabase/OpsSeatRepository';
import { SupabaseOpsBlindLevelRepository } from './supabase/OpsBlindLevelRepository';
import { SupabaseOpsClockRepository } from './supabase/OpsClockRepository';
import { SupabaseOpsLiveStatsRepository } from './supabase/OpsLiveStatsRepository';
import { SupabaseOpsEventRepository } from './supabase/OpsEventRepository';
import { SupabaseOpsMonitorRepository } from './supabase/OpsMonitorRepository';

export type {
  IOpsTournamentRepository,
  CreateOpsTournamentInput,
  OpsTournamentCostConfig,
  UpdateOpsTournamentPatch,
} from './interfaces/IOpsTournamentRepository';
export type {
  IOpsParticipantRepository,
  RegisterParticipantInput,
} from './interfaces/IOpsParticipantRepository';
export type { IOpsTableRepository, AddTableInput } from './interfaces/IOpsTableRepository';
export type { IOpsSeatRepository } from './interfaces/IOpsSeatRepository';
export type { IOpsBlindLevelRepository } from './interfaces/IOpsBlindLevelRepository';
export type { IOpsClockRepository } from './interfaces/IOpsClockRepository';
export type { IOpsLiveStatsRepository } from './interfaces/IOpsLiveStatsRepository';
export type { IOpsEventRepository } from './interfaces/IOpsEventRepository';
export type { IOpsMonitorRepository } from './interfaces/IOpsMonitorRepository';

export { SupabaseOpsTournamentRepository } from './supabase/OpsTournamentRepository';
export { SupabaseOpsParticipantRepository } from './supabase/OpsParticipantRepository';
export { SupabaseOpsTableRepository } from './supabase/OpsTableRepository';
export { SupabaseOpsSeatRepository } from './supabase/OpsSeatRepository';
export { SupabaseOpsBlindLevelRepository } from './supabase/OpsBlindLevelRepository';
export { SupabaseOpsClockRepository } from './supabase/OpsClockRepository';
export { SupabaseOpsLiveStatsRepository } from './supabase/OpsLiveStatsRepository';
export { SupabaseOpsEventRepository } from './supabase/OpsEventRepository';
export { SupabaseOpsMonitorRepository } from './supabase/OpsMonitorRepository';

/** 프로덕션 싱글톤. */
export const opsTournamentRepository = new SupabaseOpsTournamentRepository();
export const opsParticipantRepository = new SupabaseOpsParticipantRepository();
export const opsTableRepository = new SupabaseOpsTableRepository();
export const opsSeatRepository = new SupabaseOpsSeatRepository();
export const opsBlindLevelRepository = new SupabaseOpsBlindLevelRepository();
export const opsClockRepository = new SupabaseOpsClockRepository();
export const opsLiveStatsRepository = new SupabaseOpsLiveStatsRepository();
export const opsEventRepository = new SupabaseOpsEventRepository();
export const opsMonitorRepository = new SupabaseOpsMonitorRepository();
