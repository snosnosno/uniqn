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

describe('serialization fixed — fixedConfig writer (자동 마감 계약)', () => {
  const fixedSchedule: CreateJobPostingInput['schedule'] = {
    kind: 'fixed',
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    requirements: [
      {
        date: null,
        timeSlots: [
          { startTime: '19:00', isTimeToBeAnnounced: false, roles: [{ role: 'dealer', count: 1 }] },
        ],
      },
    ],
  };

  // 이 fallback 이 없으면 fixed_config 가 NULL 로 저장되고, expiresAt IS NOT NULL 가드에
  // 걸려 크론·트리거 어느 쪽도 공고를 닫지 못한다(날짜 크론은 fixed 를 대상에서 제외).
  it('신규 고정 공고는 fixedConfig 를 생성한다 — expiresAt = createdAt + 7일', () => {
    const createdAt = '2026-07-01T00:00:00.000Z';
    const doc = serializeJobPostingV3(
      { ...baseInput, schedule: fixedSchedule },
      { ownerId: 'owner-1', createdAt }
    );

    expect(doc.fixedConfig).toBeDefined();
    expect(doc.fixedConfig?.durationDays).toBe(7);
    expect(new Date(doc.fixedConfig!.createdAt).toISOString()).toBe(createdAt);
    expect(new Date(doc.fixedConfig!.expiresAt).toISOString()).toBe('2026-07-08T00:00:00.000Z');
  });

  it('기존 fixedConfig 는 그대로 보존한다 (편집이 만료 시각을 밀지 않는다)', () => {
    const existing = {
      durationDays: 7 as const,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: new Date('2026-06-08T00:00:00.000Z'),
    };

    const doc = serializeJobPostingV3(
      { ...baseInput, schedule: fixedSchedule },
      {
        ownerId: 'owner-1',
        createdAt: '2026-07-01T00:00:00.000Z',
        current: { fixedConfig: existing },
      }
    );

    expect(new Date(doc.fixedConfig!.expiresAt).toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('고정 공고가 아니면 fixedConfig 를 만들지 않는다', () => {
    const doc = serializeJobPostingV3(
      {
        ...baseInput,
        postingType: 'regular',
        schedule: {
          kind: 'dated',
          primaryDate: '2026-07-01',
          allDates: ['2026-07-01'],
          requirements: [
            {
              date: '2026-07-01',
              timeSlots: [
                {
                  startTime: '19:00',
                  isTimeToBeAnnounced: false,
                  roles: [{ role: 'dealer', count: 1 }],
                },
              ],
            },
          ],
        },
      },
      { ownerId: 'owner-1' }
    );

    expect(doc.fixedConfig).toBeUndefined();
  });
});
