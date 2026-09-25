/**
 * postingBadge — 채팅방 상단 공고 카드의 상태 배지
 *
 * 모집 중이면 배지를 달지 않는다(평상시엔 조용히). 구직자는 cancelled/expired 공고를 RLS 로 못 읽어
 * 둘을 구분해 보여 줄 수 없으므로 둘 다 "종료된 공고"로 묶는다(결정 D-g). 공고 행이 사라진(null)
 * 경우도 같다.
 */
export type ChatPostingBadgeTone = 'muted' | 'warning';

export interface ChatPostingBadge {
  label: string;
  tone: ChatPostingBadgeTone;
}

export function chatPostingBadge(
  status: string | null | undefined,
  known: boolean
): ChatPostingBadge | null {
  if (!known) return null;
  switch (status) {
    case 'active':
    case 'approved':
      return null;
    case 'capacity_full':
      return { label: '정원 마감', tone: 'muted' };
    case 'closed':
      return { label: '마감', tone: 'muted' };
    default:
      return { label: '종료된 공고', tone: 'warning' };
  }
}
