/**
 * 칩 총량 검산(순수) — 발행된 칩(기대)과 참가자별로 기록된 칩의 합(기록)을 견준다.
 * 서버 규칙: 등록·재진입 = 시작 칩, 리바이·애드온 = 설정 칩만큼 더함, 탈락 = 0 으로 만든다(칩은 옮겨 적지 않는다).
 * 그래서 대회 중에는 칩 카운트를 다시 입력하기 전까지 차이가 나는 것이 정상이다 — 경고가 아니라 검산 값이다.
 * 노쇼는 테이블에 칩이 없으므로 양쪽에서 뺀다.
 */
import type { OpsParticipant, OpsTournament } from '@/core/types/ops';

export interface ChipAudit {
  /** 발행된 칩 합계 */
  expected: number;
  /** 탈락하지 않은 참가자에게 기록된 칩 합계 */
  recorded: number;
  /** 기록 − 기대. 0 이면 맞음, 음수면 기록이 모자람 */
  diff: number;
}

type ChipSettings = Pick<OpsTournament, 'startingChips' | 'rebuyChips' | 'addonChips'>;

export function computeChipAudit(
  participants: readonly OpsParticipant[],
  settings: ChipSettings
): ChipAudit {
  const counted = participants.filter((p) => p.status !== 'no_show');
  const expected = counted.reduce(
    (sum, p) =>
      sum +
      settings.startingChips * (1 + p.reentries) +
      settings.rebuyChips * p.rebuys +
      settings.addonChips * p.addOns,
    0
  );
  const recorded = counted
    .filter((p) => p.status !== 'busted')
    .reduce((sum, p) => sum + p.chips, 0);
  return { expected, recorded, diff: recorded - expected };
}
