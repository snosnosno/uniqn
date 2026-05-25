import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
} from '@/domains/job-posting/serialization';
import type { CreateJobPostingInput, JobPostingDocumentV3 } from '@/types/jobPosting';

const baseInput: Omit<CreateJobPostingInput, 'schedule'> = {
  postingType: 'fixed',
  title: 'Fixed posting',
  location: { name: 'Seoul' },
  roleCatalog: [{ role: 'dealer' }, { role: 'other', customRole: 'VIP Host' }],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

describe('serialization fixed (통일 구조)', () => {
  it('normalizeSchedule(fixed) produces requirements[0] with date:null and synthetic slot', () => {
    const doc = serializeJobPostingV3(
      {
        ...baseInput,
        schedule: {
          kind: 'fixed',
          daysPerWeek: 5,
          startTime: '19:00',
          isStartTimeNegotiable: false,
          requirements: [
            {
              date: null,
              timeSlots: [
                {
                  startTime: '19:00',
                  isTimeToBeAnnounced: false,
                  roles: [
                    { role: 'dealer', count: 3 },
                    { role: 'other', customRole: 'VIP Host', count: 2 },
                  ],
                },
              ],
            },
          ],
        },
      },
      { ownerId: 'owner-1', workspaceId: '00000000-0000-0000-0000-000000000000' }
    );

    expect(doc.schedule.kind).toBe('fixed');
    const fixed = doc.schedule as Extract<typeof doc.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements).toHaveLength(1);
    expect(fixed.requirements[0].date).toBeNull();
    expect(fixed.requirements[0].timeSlots).toHaveLength(1);
    expect(fixed.requirements[0].timeSlots[0].startTime).toBe('19:00');
    expect(fixed.requirements[0].timeSlots[0].roles).toHaveLength(2);
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
    expect(doc.totalPositions).toBe(5);
  });

  it('deserialize reads legacy roleRequirements docs into synthetic requirements (역호환)', () => {
    const legacyDoc = {
      id: 'job-legacy',
      schemaVersion: 3,
      title: 'Legacy fixed',
      status: 'active',
      ownerId: 'owner-1',
      postingType: 'fixed',
      workDate: '',
      totalPositions: 3,
      filledPositions: 0,
      location: { name: 'Seoul' },
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '19:00',
        roleRequirements: [{ role: 'dealer', count: 3, filled: 0 }],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    } as unknown as JobPostingDocumentV3;

    const posting = deserializeJobPostingDocument(legacyDoc);
    expect(posting.schedule.kind).toBe('fixed');
    const fixed = posting.schedule as Extract<typeof posting.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements).toHaveLength(1);
    expect(fixed.requirements[0].date).toBeNull();
    expect(fixed.requirements[0].timeSlots[0].roles[0]).toMatchObject({ role: 'dealer', count: 3 });
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
  });
});
