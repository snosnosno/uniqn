import { buildPostingFacts } from '@/domains/job-posting';
import { deserializeJobPostingDocument } from '@/domains/job-posting/serialization';
import { normalizePostingAggregateStats } from '@/domains/job-posting/stats';
import type { JobPostingDocumentV3, PostingSchedule } from '@/types/jobPosting';

const datedSchedule: PostingSchedule = {
  kind: 'dated',
  primaryDate: '2025-05-01',
  allDates: ['2025-05-01'],
  requirements: [
    {
      date: '2025-05-01',
      timeSlots: [
        {
          startTime: '10:00',
          roles: [{ role: 'dealer', count: 2 }],
        },
      ],
    },
  ],
};

describe('filledPositions authority', () => {
  it('prefers top-level filledPositions over the legacy stats mirror when deserializing', () => {
    const document = {
      id: 'job-1',
      schemaVersion: 3,
      title: 'Filled positions test',
      status: 'active',
      ownerId: 'owner-1',
      postingType: 'tournament',
      workDate: '2025-05-01',
      workDates: ['2025-05-01'],
      roleKeys: ['dealer'],
      totalPositions: 2,
      filledPositions: 2,
      viewCount: 0,
      stats: {
        totalApplicants: 1,
        activeApplicants: 1,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
      location: {
        name: 'Seoul',
      },
      schedule: datedSchedule,
      roleCatalog: [{ role: 'dealer' }],
      compensation: {
        mode: 'shared',
        defaultSalary: { type: 'daily', amount: 100000 },
      },
      questions: {
        items: [],
      },
    } as JobPostingDocumentV3;

    const posting = deserializeJobPostingDocument(document);
    const facts = buildPostingFacts(posting);

    expect(posting.filledPositions).toBe(2);
    expect(posting.stats?.filledPositions).toBe(2);
    expect(facts.stats.filledPositions).toBe(2);
  });

  it('defaults filledPositions to 0 (not schedule-derived) when authoritative data is missing', () => {
    // SP3: schedule role.filled(dead counter) 제거 — schedule 파생 금지.
    // authoritativeFilledPositions 미지정 시 0 (표시 시점 hydrate RPC 가 덮어씀).
    const stats = normalizePostingAggregateStats(
      {
        totalApplicants: 1,
        activeApplicants: 1,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 99,
      },
      datedSchedule
    );

    expect(stats.filledPositions).toBe(0);
  });
});
