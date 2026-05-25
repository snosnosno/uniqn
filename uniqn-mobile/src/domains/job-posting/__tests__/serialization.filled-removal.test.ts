import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
} from '@/domains/job-posting/serialization';
import { jobPostingDocumentSchema } from '@/schemas/jobPosting.schema';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import type { CreateJobPostingInput, JobPostingDocumentV3 } from '@/types/jobPosting';

const createMockTimestamp = (seconds = 1700000000, nanoseconds = 0) => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000),
  toMillis: () => seconds * 1000,
});

const baseInput: Omit<CreateJobPostingInput, 'schedule'> = {
  postingType: 'regular',
  title: 'Dead counter removal',
  location: { name: 'Seoul' },
  roleCatalog: [{ role: 'dealer' }],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

describe('schedule dead counter filled 제거', () => {
  it('(a) serializeJobPostingV3 dated role 출력에 filled 가 없다', () => {
    const doc = serializeJobPostingV3(
      {
        ...baseInput,
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01'],
          requirements: [
            {
              date: '2026-04-01',
              timeSlots: [
                {
                  startTime: '18:00',
                  isTimeToBeAnnounced: false,
                  roles: [{ role: 'dealer', count: 3 }],
                },
              ],
            },
          ],
        },
      },
      { ownerId: 'owner-1', workspaceId: '00000000-0000-0000-0000-000000000000' }
    );

    const dated = doc.schedule as Extract<typeof doc.schedule, { kind: 'dated' }>;
    const role = dated.requirements[0].timeSlots[0].roles[0];
    expect(role).toEqual({ role: 'dealer', count: 3 });
    expect('filled' in role).toBe(false);
  });

  it('(b) deserializeJobPostingDocument 레거시 doc 의 role.filled 를 떨어뜨린다', () => {
    const legacyDoc = {
      id: 'job-legacy-dated',
      schemaVersion: 3,
      title: 'Legacy dated',
      status: 'active',
      ownerId: 'owner-1',
      postingType: 'regular',
      workDate: '2026-04-01',
      totalPositions: 3,
      filledPositions: 0,
      location: { name: 'Seoul' },
      schedule: {
        kind: 'dated',
        primaryDate: '2026-04-01',
        allDates: ['2026-04-01'],
        requirements: [
          {
            date: '2026-04-01',
            timeSlots: [
              {
                startTime: '18:00',
                roles: [{ role: 'dealer', count: 3, filled: 1 }],
              },
            ],
          },
        ],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    } as unknown as JobPostingDocumentV3;

    const posting = deserializeJobPostingDocument(legacyDoc);
    const dated = posting.schedule as Extract<typeof posting.schedule, { kind: 'dated' }>;
    const role = dated.requirements[0].timeSlots[0].roles[0];
    expect(role).toEqual({ role: 'dealer', count: 3 });
    expect('filled' in role).toBe(false);
  });

  it('(c) read-compat: filled 를 포함한 레거시 doc 도 schema 가 거부하지 않고 통과(strip)한다', () => {
    const legacyDocWithFilled = {
      id: 'job-1',
      schemaVersion: JOB_POSTING_SCHEMA_VERSION,
      title: 'Legacy doc with filled',
      status: 'active' as const,
      ownerId: 'user-1',
      workspaceId: '123e4567-e89b-42d3-a456-426614174000',
      postingType: 'regular' as const,
      workDate: '2026-04-01',
      workDates: ['2026-04-01'],
      totalPositions: 2,
      filledPositions: 0,
      createdAt: createMockTimestamp(),
      updatedAt: createMockTimestamp(),
      location: { name: 'Seoul' },
      schedule: {
        kind: 'dated' as const,
        primaryDate: '2026-04-01',
        allDates: ['2026-04-01'],
        requirements: [
          {
            date: '2026-04-01',
            timeSlots: [
              {
                startTime: '18:00',
                roles: [{ role: 'dealer' as const, count: 2, filled: 5 }],
              },
            ],
          },
        ],
      },
      roleCatalog: [{ role: 'dealer' as const }],
      compensation: { mode: 'shared' as const },
      questions: { items: [] },
    };

    const result = jobPostingDocumentSchema.safeParse(legacyDocWithFilled);
    expect(result.success).toBe(true);
    if (result.success) {
      const schedule = result.data.schedule as Extract<
        typeof result.data.schedule,
        { kind: 'dated' }
      >;
      const role = schedule.requirements[0].timeSlots[0].roles[0];
      expect('filled' in role).toBe(false);
    }
  });
});
