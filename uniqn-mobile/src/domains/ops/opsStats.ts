/**
 * STATUS 부분통계 계산 (순수, 1a). 참가자 목록 + 대회 비용설정에서 파생.
 * 1a 산출: playing / entries / totalChips / averageStack / prizePool.
 * (avg_stack_bb·좌석/테이블 수는 1b/1c — 여기서 계산하지 않음.)
 */
import type { OpsParticipant, OpsTournament, OpsPartialStats } from '@/types/ops';

type ParticipantStatsInput = Pick<OpsParticipant, 'status' | 'chips' | 'rebuys' | 'addOns'>;
type TournamentCostInput = Pick<OpsTournament, 'buyInCost' | 'rebuyCost' | 'addonCost'>;

export function computeOpsPartialStats(
  participants: readonly ParticipantStatsInput[],
  tournament: TournamentCostInput
): OpsPartialStats {
  const playing = participants.filter((p) => p.status === 'active').length;
  const entries = participants.length;
  const totalChips = participants.reduce((sum, p) => sum + p.chips, 0);
  const averageStack = playing > 0 ? Math.round(totalChips / playing) : 0;

  const totalRebuys = participants.reduce((sum, p) => sum + p.rebuys, 0);
  const totalAddOns = participants.reduce((sum, p) => sum + p.addOns, 0);
  const prizePool =
    entries * tournament.buyInCost +
    totalRebuys * tournament.rebuyCost +
    totalAddOns * tournament.addonCost;

  return { playing, entries, totalChips, averageStack, prizePool };
}
