/**
 * ops Repository 배럴 — 싱글톤 + 타입 재노출. 소비자는 `@/repositories/ops` 에서 import.
 * (기존 중앙 배럴 대신 전용 모듈 — EmployerApplicationRepository 자가export 관행과 동일.)
 */
import { SupabaseOpsTournamentRepository } from './supabase/OpsTournamentRepository';
import { SupabaseOpsParticipantRepository } from './supabase/OpsParticipantRepository';

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

export { SupabaseOpsTournamentRepository } from './supabase/OpsTournamentRepository';
export { SupabaseOpsParticipantRepository } from './supabase/OpsParticipantRepository';

/** 프로덕션 싱글톤. */
export const opsTournamentRepository = new SupabaseOpsTournamentRepository();
export const opsParticipantRepository = new SupabaseOpsParticipantRepository();
