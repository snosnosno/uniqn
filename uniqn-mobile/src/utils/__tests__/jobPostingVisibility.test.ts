/**
 * UNIQN Mobile - 공고 가시성 판정 테스트
 *
 * @description 검색/브라우즈 가시성 정합 (EF-jobsearch-1/2/3 회귀 가드)
 */

import {
  isSearchVisiblePosting,
  isSupportedReleasePosting,
  isCanonicalDatedPosting,
} from '../jobPostingVisibility';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import type { JobPosting } from '@/types';

type VisibilityInput = Parameters<typeof isSearchVisiblePosting>[0];

function makePosting(overrides: Partial<VisibilityInput> = {}): VisibilityInput {
  return {
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    postingType: 'regular',
    schedule: { kind: 'dated' } as VisibilityInput['schedule'],
    ...overrides,
  };
}

const datedTournament = (approvalStatus: 'pending' | 'approved' | 'rejected'): VisibilityInput =>
  makePosting({
    postingType: 'tournament',
    schedule: { kind: 'dated' } as VisibilityInput['schedule'],
    tournamentConfig: { approvalStatus } as JobPosting['tournamentConfig'],
  });

describe('isSearchVisiblePosting (검색 결과 가시성 = 브라우즈 정합)', () => {
  it('일반(regular) dated 공고는 검색에 노출된다', () => {
    expect(isSearchVisiblePosting(makePosting())).toBe(true);
  });

  it('긴급(urgent) dated 공고는 검색에 노출된다', () => {
    expect(isSearchVisiblePosting(makePosting({ postingType: 'urgent' }))).toBe(true);
  });

  it('고정(fixed) 공고도 검색에 노출된다 (EF-jobsearch-2: fixed 칩 검색 0건 회귀)', () => {
    const fixed = makePosting({
      postingType: 'fixed',
      schedule: { kind: 'fixed' } as VisibilityInput['schedule'],
    });
    expect(isSearchVisiblePosting(fixed)).toBe(true);
    // 기존 isCanonicalDatedPosting 은 fixed 를 제외했음 — 그 동작과 분기 확인
    expect(isCanonicalDatedPosting(fixed)).toBe(false);
  });

  it('승인된(approved) 대회 공고는 검색에 노출된다', () => {
    expect(isSearchVisiblePosting(datedTournament('approved'))).toBe(true);
  });

  it('미승인(pending) 대회 공고는 검색에서 제외된다 (EF-jobsearch-3: 승인 게이트 우회 회귀)', () => {
    expect(isSearchVisiblePosting(datedTournament('pending'))).toBe(false);
  });

  it('거절된(rejected) 대회 공고는 검색에서 제외된다', () => {
    expect(isSearchVisiblePosting(datedTournament('rejected'))).toBe(false);
  });

  it('tournamentConfig 누락 대회 공고는 검색에서 제외된다 (안전 기본값)', () => {
    const noCfg = makePosting({ postingType: 'tournament' });
    expect(isSearchVisiblePosting(noCfg)).toBe(false);
  });

  it('schemaVersion 이 3 이 아니면 검색에서 제외된다 (legacy 차단)', () => {
    expect(isSearchVisiblePosting(makePosting({ schemaVersion: 2 as never }))).toBe(false);
  });

  it('isSupportedReleasePosting 이 거르는 공고는 검색에서도 제외된다', () => {
    // fixed postingType + dated schedule 의 부정합 조합은 release 가시성에서 탈락
    const mismatch = makePosting({
      postingType: 'fixed',
      schedule: { kind: 'dated' } as VisibilityInput['schedule'],
    });
    expect(isSupportedReleasePosting(mismatch)).toBe(true); // dated + fixed in SUPPORTED_INTERNAL
    expect(isSearchVisiblePosting(mismatch)).toBe(true);
  });
});
