import { STATUS } from '@/constants';
import type { JobPosting } from '@/types';

import { BROWSABLE_POSTING_STATUSES } from './constants';

/**
 * 대회 공고 승인 게이트 — 상세·지원 경로 판정 헬퍼.
 *
 * 대회(tournament) 공고는 생성 시 status='active' 이지만 승인은 별도로
 * tournamentConfig.approvalStatus='pending' 상태에서 시작한다. 상세·지원 경로에는
 * 게이트가 없어 미승인 대회를 직링크로 열람·지원할 수 있었다(P0#4). 이 헬퍼가
 * 그 경로의 차단 여부를 판정한다.
 *
 * ⚠️ 단일 SSOT 아님: 승인 노출 규칙은 표면별로 4곳에 구현돼 있으니 함께 유지해야 한다.
 * - 상세·지원 게이트: 본 헬퍼 isTournamentApprovalBlocked
 * - fetch 후 가시성 필터: @/utils/jobPostingVisibility isPostingVisibleAfterFetch
 * - 리스트 조회 SQL: @/repositories/supabase/JobPostingRepository getList (tournament_config->>approvalStatus=approved)
 * - 타입/승인상태별 조회 SQL: 동 리포지토리 getByPostingTypeAndApprovalStatus·getByOwnerAndPostingType
 *
 * 판정 규칙:
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

/**
 * 공유 가능 여부 — 죽은 링크(승인 대기 대회·마감/취소류)를 카톡에 뿌리는 것을 차단.
 * 공유 가능 상태 = 브라우징 가능(active/capacity_full) AND 승인 게이트 통과.
 * useShare 진입부 한 곳에서 호출해 7개 진입점을 일괄 방어한다.
 */
export function canShareJob(
  posting: Pick<JobPosting, 'status' | 'postingType' | 'tournamentConfig'>
): boolean {
  if (!(BROWSABLE_POSTING_STATUSES as readonly string[]).includes(posting.status)) {
    return false;
  }
  return !isTournamentApprovalBlocked(posting);
}
