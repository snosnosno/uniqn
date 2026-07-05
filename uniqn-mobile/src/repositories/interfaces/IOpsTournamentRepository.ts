import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

/** 칩·정산 비용 설정 (생성 시 p_config 로 전달). */
export interface OpsTournamentCostConfig {
  buyInChips: number;
  rebuyChips: number;
  addonChips: number;
  buyInCost: number;
  feeCost: number;
  rebuyCost: number;
  addonCost: number;
  /** 바운티(선택) — null = 비-바운티 대회(0 과 구분). knockoutPool·bountyAccrued 게이트. */
  bountyCost: number | null;
}

export interface CreateOpsTournamentInput {
  name: string;
  venue?: string;
  eventDate?: string;
  gameType: string;
  jobPostingId?: string;
  startingChips: number;
  seatsPerTable: number;
  config: OpsTournamentCostConfig;
}

export interface UpdateOpsTournamentPatch {
  name?: string;
  venue?: string;
  eventDate?: string;
  gameType?: string;
  startingChips?: number;
  seatsPerTable?: number;
  color?: string;
  buyInChips?: number;
  rebuyChips?: number;
  addonChips?: number;
  buyInCost?: number;
  feeCost?: number;
  rebuyCost?: number;
  addonCost?: number;
}

/**
 * ops 대회 Repository.
 * 구현체: SupabaseOpsTournamentRepository (프로덕션). 읽기는 RLS 필터, 쓰기는 SECDEF RPC.
 */
export interface IOpsTournamentRepository {
  /** RLS 가시 대회 목록 (event_date desc nulls last, created_at desc). */
  listForUser(): Promise<OpsTournament[]>;
  getById(id: string): Promise<OpsTournament | null>;
  /** uniqn→ops 브릿지: 공고에 연결된 대회 1건. ops_* 미존재/실패 시 null (null-safe). */
  findByJobPostingId(jobPostingId: string): Promise<OpsTournament | null>;
  createWithEvent(
    input: CreateOpsTournamentInput,
    actorId: string
  ): Promise<{ tournamentId: string }>;
  updateTournament(id: string, actorId: string, patch: UpdateOpsTournamentPatch): Promise<void>;
  setStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void>;
  toggleRegistration(id: string, actorId: string, open: boolean): Promise<void>;
}
