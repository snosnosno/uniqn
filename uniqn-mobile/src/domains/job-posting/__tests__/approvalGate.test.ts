/**
 * UNIQN Mobile - 대회 공고 승인 게이트 판정 테스트
 *
 * @description 미승인(pending/rejected/누락) 대회 공고 차단 판정 SSOT (P0#4 승인 게이트 우회 회귀 가드)
 */

import { isTournamentApprovalBlocked } from '../approvalGate';
import type { JobPosting } from '@/types';

type GateInput = Parameters<typeof isTournamentApprovalBlocked>[0];

const tournament = (approvalStatus?: 'pending' | 'approved' | 'rejected'): GateInput => ({
  postingType: 'tournament',
  tournamentConfig:
    approvalStatus === undefined
      ? undefined
      : ({ approvalStatus } as JobPosting['tournamentConfig']),
});

describe('isTournamentApprovalBlocked (대회 승인 게이트 SSOT)', () => {
  it('미승인(pending) 대회 공고는 차단된다', () => {
    expect(isTournamentApprovalBlocked(tournament('pending'))).toBe(true);
  });

  it('거절(rejected) 대회 공고는 차단된다', () => {
    expect(isTournamentApprovalBlocked(tournament('rejected'))).toBe(true);
  });

  it('승인(approved) 대회 공고는 통과한다', () => {
    expect(isTournamentApprovalBlocked(tournament('approved'))).toBe(false);
  });

  it('approvalStatus 누락 대회 공고는 fail-closed 로 차단된다', () => {
    expect(isTournamentApprovalBlocked(tournament(undefined))).toBe(true);
  });

  it('tournamentConfig 은 있으나 approvalStatus 필드만 없으면 차단된다', () => {
    const noStatus: GateInput = {
      postingType: 'tournament',
      tournamentConfig: {} as JobPosting['tournamentConfig'],
    };
    expect(isTournamentApprovalBlocked(noStatus)).toBe(true);
  });

  it('일반(regular) 공고는 승인 개념이 없어 항상 통과한다', () => {
    expect(isTournamentApprovalBlocked({ postingType: 'regular' })).toBe(false);
  });

  it('긴급(urgent) 공고는 통과한다', () => {
    expect(isTournamentApprovalBlocked({ postingType: 'urgent' })).toBe(false);
  });

  it('고정(fixed) 공고는 통과한다', () => {
    expect(isTournamentApprovalBlocked({ postingType: 'fixed' })).toBe(false);
  });

  it('postingType 누락 공고는 regular 로 간주해 통과한다', () => {
    expect(isTournamentApprovalBlocked({})).toBe(false);
  });
});
