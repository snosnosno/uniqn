import { STATUS } from '@/constants';
import type { JobPosting } from '@/types';

/**
 * 대회 공고 승인 게이트 SSOT.
 *
 * 대회(tournament) 공고는 생성 시 status='active' 이지만 승인은 별도로
 * tournamentConfig.approvalStatus='pending' 상태에서 시작한다. 리스트/검색은
 * approvalStatus='approved' 만 노출하지만, 상세·지원 경로에는 게이트가 없어
 * 미승인 대회를 직링크로 열람·지원할 수 있었다(P0#4). 화면·서비스가 이 단일
 * 헬퍼로 차단 여부를 판정한다.
 *
 * - tournament + approvalStatus!=='approved' → 차단(true)
 * - approvalStatus 누락(config/필드 부재)도 차단(fail-closed)
 * - regular/urgent/fixed 등 비-tournament → 항상 통과(false)
 */
export function isTournamentApprovalBlocked(
  posting: Pick<JobPosting, 'postingType' | 'tournamentConfig'>
): boolean {
  if ((posting.postingType ?? 'regular') !== 'tournament') {
    return false;
  }

  return posting.tournamentConfig?.approvalStatus !== STATUS.TOURNAMENT.APPROVED;
}
