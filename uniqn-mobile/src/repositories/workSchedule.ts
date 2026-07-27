/**
 * workSchedule Repository 배럴 — 싱글톤 + 타입 재노출. 소비자는 `@/repositories/workSchedule` 에서 import.
 * (ops.ts 전용 모듈 관행과 동일 — 중앙 배럴 비대화 회피.)
 *
 * 컨테이너(VenueContainer) 읽기는 jobPostingRepository(getVenueContainerById/getVenueContainers)에
 * 이미 존재하므로 여기서 중복하지 않는다. 본 레포는 그리드 집계 RPC 2개만 담당한다.
 */
import { SupabaseWorkScheduleRepository } from './supabase/WorkScheduleRepository';

export type {
  IWorkScheduleRepository,
  VenueDaySlot,
  SetVenueRoleSalaryInput,
} from './interfaces/IWorkScheduleRepository';
export { SupabaseWorkScheduleRepository } from './supabase/WorkScheduleRepository';

/** 프로덕션 싱글톤. */
export const workScheduleRepository = new SupabaseWorkScheduleRepository();
