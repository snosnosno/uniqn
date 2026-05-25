/**
 * SP1 동작 동치 스냅샷 테스트
 *
 * fixed 스케줄의 roleRequirements → requirements 통일 구조 이후에도
 * 핵심 집계(totalPositions, filledPositions, roleStats)와
 * 표면 모델(variant)이 동일하게 동작함을 고정한다.
 *
 * 불변식:
 * - requirements[0].date === null (fixed sentinel)
 * - requirements[0].timeSlots[0].roles == 역할 배열
 * - fixed variant 표시 그대로
 */

import type { JobPosting, PostingSchedule } from '@/types/jobPosting';
import {
  calculateFilledPositionsFromSchedule,
  calculateTotalPositionsFromSchedule,
} from '@/domains/job-posting/stats';
import { getPostingRoleStats } from '@/domains/job-posting/core';
import { buildPostingFacts } from '@/domains/job-posting';

// ===========================================================================
// 헬퍼: SP1 fixed 통일 구조 공고 생성
// dealer x3 filled1 + VIP(other/customRole="VIP") x2 filled0
// ===========================================================================

function buildFixedPosting(): JobPosting {
  const schedule: PostingSchedule = {
    kind: 'fixed',
    daysPerWeek: 3,
    startTime: '18:00',
    requirements: [
      {
        date: null,
        timeSlots: [
          {
            startTime: '18:00',
            isTimeToBeAnnounced: false,
            roles: [
              { role: 'dealer', count: 3, filled: 1 },
              { role: 'other', customRole: 'VIP', count: 2, filled: 0 },
            ],
          },
        ],
      },
    ],
  };

  return {
    id: 'sp1-eq-fixed',
    schemaVersion: 3,
    title: 'SP1 동치 스냅샷 공고',
    status: 'active',
    ownerId: 'owner-1',
    postingType: 'fixed',
    workDate: '',
    workDates: undefined,
    totalPositions: 5,
    filledPositions: 1,
    viewCount: 0,
    location: { name: '서울 강남', district: '강남구' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    schedule,
    roleCatalog: [{ role: 'dealer' }, { role: 'other', customRole: 'VIP' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
  };
}

// ===========================================================================
// 동치 단언
// ===========================================================================

describe('SP1 fixed 통일 구조 동작 동치', () => {
  const posting = buildFixedPosting();

  it('totalPositions: dealer(3) + VIP(2) = 5', () => {
    expect(calculateTotalPositionsFromSchedule(posting.schedule)).toBe(5);
  });

  it('filledPositions: dealer filled(1) + VIP filled(0) = 1', () => {
    expect(calculateFilledPositionsFromSchedule(posting.schedule)).toBe(1);
  });

  it('getPostingRoleStats: 역할 2개, count 합이 [2,3]', () => {
    const stats = getPostingRoleStats(posting);
    const counts = stats.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual([2, 3]);
  });

  it('buildPostingFacts: schedule.display.variant === fixed', () => {
    const facts = buildPostingFacts(posting);
    expect(facts.schedule.display.variant).toBe('fixed');
  });

  it('buildPostingFacts: roleAvailability.totalCount === 5', () => {
    const facts = buildPostingFacts(posting);
    expect(facts.roleAvailability.totalCount).toBe(5);
  });

  it('requirements[0].date === null (fixed sentinel)', () => {
    if (posting.schedule.kind === 'fixed') {
      expect(posting.schedule.requirements[0]?.date).toBeNull();
    }
  });

  it('requirements 구조 불변식 — timeSlots[0].roles 2개', () => {
    if (posting.schedule.kind === 'fixed') {
      expect(posting.schedule.requirements[0]?.timeSlots[0]?.roles).toHaveLength(2);
    }
  });
});
