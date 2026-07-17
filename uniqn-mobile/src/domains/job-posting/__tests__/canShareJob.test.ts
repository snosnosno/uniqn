import { canShareJob } from '../approvalGate';

// 실제 JobPosting.tournamentConfig 타입은 `TournamentConfig | undefined`(null 아님).
// 비-tournament 공고라 게이트가 조기 통과하므로 undefined 로 두어도 의미 동일.
const base = { status: 'active', postingType: 'regular', tournamentConfig: undefined } as const;

describe('canShareJob', () => {
  it('active 일반 공고는 공유 가능', () => {
    expect(canShareJob({ ...base })).toBe(true);
  });
  it('capacity_full 도 공유 가능(페이지 유효)', () => {
    expect(canShareJob({ ...base, status: 'capacity_full' })).toBe(true);
  });
  it('closed/cancelled/expired/pending/draft 는 공유 불가', () => {
    for (const status of ['closed', 'cancelled', 'expired', 'pending', 'draft'] as const) {
      expect(canShareJob({ ...base, status })).toBe(false);
    }
  });
  it('승인 대기 대회(pending tournament)는 active 여도 공유 불가', () => {
    expect(
      canShareJob({
        status: 'active',
        postingType: 'tournament',
        tournamentConfig: { approvalStatus: 'pending' } as never,
      })
    ).toBe(false);
  });
  it('승인 완료 대회는 공유 가능', () => {
    expect(
      canShareJob({
        status: 'active',
        postingType: 'tournament',
        tournamentConfig: { approvalStatus: 'approved' } as never,
      })
    ).toBe(true);
  });
});
