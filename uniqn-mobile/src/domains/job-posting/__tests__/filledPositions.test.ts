import { buildPostingFacts } from '@/domains/job-posting';
import { deserializeJobPostingDocument } from '@/domains/job-posting/serialization';
import { normalizePostingAggregateStats } from '@/domains/job-posting/stats';
import type { JobPosting, JobPostingDocumentV3, PostingSchedule } from '@/types/jobPosting';
import { logger } from '@/utils/logger';

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

/**
 * resolveFilledPositions 단일 권위 해소 (U6)
 *
 * column(top-level filled_positions)이 권위, stats.filledPositions 는 부차 미러.
 * deserialize 는 미러를 column 에 맞춰 정규화하므로, 여기서는 facts 레이어의 해소 로직을
 * 검증하기 위해 deserialize 결과를 직접 override 하여 divergence/null 시나리오를 구성한다.
 */
describe('resolveFilledPositions authority (buildPostingFacts)', () => {
  const buildBasePosting = (): JobPosting => {
    const document = {
      id: 'job-resolve',
      schemaVersion: 3,
      title: 'Resolve filled positions',
      status: 'active',
      ownerId: 'owner-1',
      postingType: 'tournament',
      workDate: '2025-05-01',
      workDates: ['2025-05-01'],
      roleKeys: ['dealer'],
      totalPositions: 5,
      filledPositions: 0,
      viewCount: 0,
      stats: {
        totalApplicants: 0,
        activeApplicants: 0,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
      location: { name: 'Seoul' },
      schedule: datedSchedule,
      roleCatalog: [{ role: 'dealer' }],
      compensation: {
        mode: 'shared',
        defaultSalary: { type: 'daily', amount: 100000 },
      },
      questions: { items: [] },
    } as JobPostingDocumentV3;

    return deserializeJobPostingDocument(document);
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the top-level column as the authoritative source when both exist', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const base = buildBasePosting();
    const posting: JobPosting = {
      ...base,
      filledPositions: 3,
      stats: { ...base.stats!, filledPositions: 3 },
    };

    const facts = buildPostingFacts(posting);

    expect(facts.stats.filledPositions).toBe(3);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('falls back to the stats mirror when the column is null/undefined', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const base = buildBasePosting();
    // 권위 컬럼이 누락된 레거시/부분 데이터 시나리오 (타입은 number 지만 런타임 방어)
    const posting = {
      ...base,
      filledPositions: undefined,
      stats: { ...base.stats, filledPositions: 4 },
    } as unknown as JobPosting;

    const facts = buildPostingFacts(posting);

    expect(facts.stats.filledPositions).toBe(4);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('prefers the column and logs a divergence warning when column and mirror disagree', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const base = buildBasePosting();
    const posting: JobPosting = {
      ...base,
      filledPositions: 2,
      stats: { ...base.stats!, filledPositions: 5 },
    };

    const facts = buildPostingFacts(posting);

    expect(facts.stats.filledPositions).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'filledPositions divergence between column and stats mirror',
      expect.objectContaining({
        postingId: 'job-resolve',
        columnFilledPositions: 2,
        statsFilledPositions: 5,
      })
    );
  });
});
