import {
  allowancesSchema,
  basicInfoSchema,
  createJobPostingSchema,
  dateTimeSchema,
  isJobPostingDocument,
  jobFilterSchema,
  jobPostingDocumentSchema,
  parseJobPostingDocument,
  parseJobPostingDocuments,
  postingTypeSchema,
  roleRequirementSchema,
  roleSchema,
  salaryInfoSchema,
  salaryTypeSchema,
} from '../jobPosting.schema';
import { serializeJobPostingV3 } from '@/domains/job-posting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { Constants } from '@/types/supabase';

const createMockTimestamp = (seconds = 1700000000, nanoseconds = 0) => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000),
  toMillis: () => seconds * 1000,
});

function createValidDocument() {
  return {
    id: 'job-1',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: 'Dealer Hiring',
    description: 'Canonical job posting',
    status: 'active' as const,
    ownerId: 'user-1',
    ownerName: 'Owner',
    workspaceId: '123e4567-e89b-42d3-a456-426614174000',
    postingType: 'regular' as const,
    workDate: '2026-04-01',
    workDates: ['2026-04-01'],
    roleKeys: ['dealer'],
    totalPositions: 2,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: createMockTimestamp(),
    updatedAt: createMockTimestamp(),
    location: {
      name: 'Seoul',
      district: 'Gangnam-gu',
      detailedAddress: 'Teheran-ro 123',
    },
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
              roles: [{ role: 'dealer' as const, count: 2, filled: 0 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' as const, salary: { type: 'hourly' as const, amount: 15000 } }],
    compensation: {
      mode: 'shared' as const,
      defaultSalary: { type: 'hourly' as const, amount: 15000 },
      allowances: { meal: 10000 },
    },
    questions: {
      items: [],
    },
  };
}

describe('jobPosting schemas', () => {
  describe('primitive schemas', () => {
    it('accepts valid posting and salary types', () => {
      expect(postingTypeSchema.safeParse('regular').success).toBe(true);
      expect(salaryTypeSchema.safeParse('daily').success).toBe(true);
      expect(roleSchema.safeParse('dealer').success).toBe(true);
    });

    it('rejects invalid primitive values', () => {
      expect(postingTypeSchema.safeParse('part-time').success).toBe(false);
      expect(salaryTypeSchema.safeParse('yearly').success).toBe(false);
      expect(roleSchema.safeParse('invalid').success).toBe(false);
    });

    it('validates role requirements and salary payloads', () => {
      expect(roleRequirementSchema.safeParse({ role: 'dealer', count: 2 }).success).toBe(true);
      expect(roleRequirementSchema.safeParse({ role: 'dealer', count: 0 }).success).toBe(false);
      expect(salaryInfoSchema.safeParse({ type: 'hourly', amount: 15000 }).success).toBe(true);
      expect(salaryInfoSchema.safeParse({ type: 'hourly', amount: -1 }).success).toBe(false);
    });

    it('validates allowances', () => {
      expect(allowancesSchema.safeParse({ meal: 10000, accommodation: -1 }).success).toBe(true);
      expect(allowancesSchema.safeParse({ guaranteedHours: -1 }).success).toBe(false);
    });
  });

  describe('form helper schemas', () => {
    it('validates basic info and date/time helpers', () => {
      expect(
        basicInfoSchema.safeParse({
          title: 'Dealer Hiring',
          location: 'Seoul Gangnam',
          contactPhone: '010-1234-5678',
        }).success
      ).toBe(true);
      expect(
        dateTimeSchema.safeParse({
          workDate: '2026-04-01',
          timeSlot: '18:00-02:00',
        }).success
      ).toBe(true);
    });

    it('rejects invalid basic info and date/time helper payloads', () => {
      expect(
        basicInfoSchema.safeParse({
          title: '',
          location: 'Seoul',
          contactPhone: '010-1234-5678',
        }).success
      ).toBe(false);
      expect(dateTimeSchema.safeParse({ workDate: '04/01/2026', timeSlot: '' }).success).toBe(
        false
      );
    });
  });

  describe('createJobPostingSchema', () => {
    it('accepts canonical V3 create input', () => {
      const result = createJobPostingSchema.safeParse({
        postingType: 'regular',
        title: 'Dealer Hiring',
        description: 'Canonical create payload',
        location: {
          name: 'Seoul',
          district: 'Gangnam-gu',
          detailedAddress: 'Teheran-ro 123',
        },
        contactPhone: '010-1234-5678',
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
                  roles: [{ role: 'dealer', count: 2, filled: 0 }],
                },
              ],
            },
          ],
        },
        roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 15000 } }],
        compensation: {
          mode: 'shared',
          defaultSalary: { type: 'hourly', amount: 15000 },
        },
        questions: {
          items: [],
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects postingType and schedule.kind mismatches', () => {
      expect(
        createJobPostingSchema.safeParse({
          postingType: 'fixed',
          title: 'Fixed Hiring',
          location: { name: 'Seoul', district: 'Gangnam-gu' },
          schedule: {
            kind: 'dated',
            primaryDate: '2026-04-01',
            allDates: ['2026-04-01'],
            requirements: [],
          },
          roleCatalog: [{ role: 'dealer' }],
          compensation: { mode: 'shared' },
          questions: { items: [] },
        }).success
      ).toBe(false);

      expect(
        createJobPostingSchema.safeParse({
          postingType: 'regular',
          title: 'Regular Hiring',
          location: { name: 'Seoul', district: 'Gangnam-gu' },
          schedule: {
            kind: 'fixed',
            daysPerWeek: 5,
            roleRequirements: [{ role: 'dealer', count: 1 }],
          },
          roleCatalog: [{ role: 'dealer' }],
          compensation: { mode: 'shared' },
          questions: { items: [] },
        }).success
      ).toBe(false);
    });

    it('rejects urgent postings beyond the 7 day limit', () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 10);
      const dateStr = farFuture.toISOString().split('T')[0];

      const result = createJobPostingSchema.safeParse({
        postingType: 'urgent',
        title: 'Urgent Hiring',
        location: { name: 'Seoul' },
        schedule: {
          kind: 'dated',
          primaryDate: dateStr,
          allDates: [dateStr],
          requirements: [],
        },
        roleCatalog: [{ role: 'dealer' }],
        compensation: { mode: 'shared' },
        questions: { items: [] },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('jobFilterSchema', () => {
    it('accepts valid filters and rejects invalid role filters', () => {
      expect(jobFilterSchema.safeParse({ status: 'active', roles: ['dealer'] }).success).toBe(true);
      expect(jobFilterSchema.safeParse({ roles: ['invalid_role'] }).success).toBe(false);
    });

    it('region 필터를 보존한다(검증 시 누락 방지)', () => {
      const result = jobFilterSchema.safeParse({ region: '서울 강남구' });
      expect(result.success).toBe(true);
      expect(result.success && result.data.region).toBe('서울 강남구');
    });
  });

  describe('jobPostingDocumentSchema', () => {
    it('accepts strict V3 job posting documents', () => {
      expect(jobPostingDocumentSchema.safeParse(createValidDocument()).success).toBe(true);
    });

    it('location.region 을 읽기 파싱에서 보존한다 (read 증발 방지)', () => {
      const parsed = parseJobPostingDocument({
        ...createValidDocument(),
        location: {
          name: 'Seoul',
          district: '서울 강남구 역삼동',
          region: '서울 강남구',
          detailedAddress: 'Teheran-ro 123',
        },
      });
      expect(parsed?.location.region).toBe('서울 강남구');
    });

    it('알 수 없는 region 문자열도 read 를 깨뜨리지 않는다', () => {
      const parsed = parseJobPostingDocument({
        ...createValidDocument(),
        location: { name: 'Seoul', region: '미래신도시' },
      });
      expect(parsed).not.toBeNull();
      expect(parsed?.location.region).toBe('미래신도시');
    });

    it('rejects postingType and schedule.kind mismatches or stale derived date fields', () => {
      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          postingType: 'fixed',
        }).success
      ).toBe(false);

      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          workDate: '2026-04-02',
        }).success
      ).toBe(false);
    });

    it('rejects unknown fields and malformed role values', () => {
      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          customField: 'extra',
        }).success
      ).toBe(false);
      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          roleCatalog: [{ role: 'cashier', salary: { type: 'hourly', amount: 10000 } }],
        }).success
      ).toBe(false);
    });

    it('rejects non-canonical top-level fields that are outside the V3 contract', () => {
      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          unexpectedField: 3,
        }).success
      ).toBe(false);
    });

    it('rejects non-canonical tournamentConfig keys added by functions or clients', () => {
      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          postingType: 'tournament',
          tournamentConfig: {
            approvalStatus: 'pending',
            submittedAt: createMockTimestamp(),
            resubmittedAt: createMockTimestamp(1700000100),
            resubmittedBy: 'employer-1',
          },
        }).success
      ).toBe(false);

      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          postingType: 'tournament',
          tournamentConfig: {
            approvalStatus: 'pending',
            submittedAt: createMockTimestamp(),
            previousRejection: {
              reason: 'legacy',
            },
          },
        }).success
      ).toBe(false);
    });

    it('accepts valid fixed schedule postings and rejects unknown extra fields', () => {
      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          postingType: 'fixed',
          workDate: '',
          workDates: undefined,
          schedule: {
            kind: 'fixed',
            daysPerWeek: 5,
            requirements: [
              {
                date: null,
                timeSlots: [
                  { startTime: '19:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] },
                ],
              },
            ],
          },
        }).success
      ).toBe(true);

      expect(
        jobPostingDocumentSchema.safeParse({
          ...createValidDocument(),
          postingType: 'fixed',
          workDate: '',
          workDates: undefined,
          schedule: {
            kind: 'fixed',
            daysPerWeek: 5,
            requirements: [
              {
                date: null,
                timeSlots: [
                  { startTime: '19:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] },
                ],
              },
            ],
          },
          fixedConfig: {
            durationDays: 30,
            createdAt: createMockTimestamp(),
            expiresAt: createMockTimestamp(1700001000),
          },
        }).success
      ).toBe(false);
    });
  });

  describe('postingScheduleSchema fixed (통일 구조)', () => {
    const validFixed = {
      kind: 'fixed' as const,
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
              roles: [{ role: 'dealer', count: 3, filled: 1 }],
            },
          ],
        },
      ],
    };

    it('accepts fixed schedule with requirements[].timeSlots[].roles and date:null', () => {
      const result = createJobPostingSchema.safeParse({
        postingType: 'fixed',
        title: 'Fixed posting',
        location: { name: 'Seoul' },
        schedule: validFixed,
        roleCatalog: [{ role: 'dealer' }],
        compensation: { mode: 'shared' },
        questions: { items: [] },
      });
      expect(result.success).toBe(true);
    });

    it('rejects fixed schedule when requirements.length !== 1', () => {
      const result = createJobPostingSchema.safeParse({
        postingType: 'fixed',
        title: 'Fixed posting',
        location: { name: 'Seoul' },
        schedule: {
          ...validFixed,
          requirements: [...validFixed.requirements, ...validFixed.requirements],
        },
        roleCatalog: [{ role: 'dealer' }],
        compensation: { mode: 'shared' },
        questions: { items: [] },
      });
      expect(result.success).toBe(false);
    });

    it('rejects fixed schedule when requirements[0].date is not null', () => {
      const result = createJobPostingSchema.safeParse({
        postingType: 'fixed',
        title: 'Fixed posting',
        location: { name: 'Seoul' },
        schedule: {
          ...validFixed,
          requirements: [{ ...validFixed.requirements[0], date: '2025-05-01' }],
        },
        roleCatalog: [{ role: 'dealer' }],
        compensation: { mode: 'shared' },
        questions: { items: [] },
      });
      expect(result.success).toBe(false);
    });

    it('rejects legacy roleRequirements key (strict)', () => {
      const result = createJobPostingSchema.safeParse({
        postingType: 'fixed',
        title: 'Fixed posting',
        location: { name: 'Seoul' },
        schedule: {
          kind: 'fixed',
          daysPerWeek: 5,
          roleRequirements: [{ role: 'dealer', count: 3 }],
        },
        roleCatalog: [{ role: 'dealer' }],
        compensation: { mode: 'shared' },
        questions: { items: [] },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('parse helpers', () => {
    it('parses valid V3 documents and rejects legacy documents', () => {
      expect(parseJobPostingDocument(createValidDocument())?.id).toBe('job-1');
      expect(
        parseJobPostingDocument({
          ...createValidDocument(),
          postingType: undefined,
        })?.postingType
      ).toBe('regular');
      expect(
        parseJobPostingDocument({
          ...createValidDocument(),
          id: 'draft-posting',
          status: 'draft',
        })?.id
      ).toBe('draft-posting');
      expect(
        parseJobPostingDocument({
          id: 'legacy',
          title: 'Legacy posting',
          status: 'active',
          workDate: '2026-04-01',
          timeSlot: '18:00',
          roles: [{ role: 'dealer', count: 1 }],
          ownerId: 'user-1',
          totalPositions: 1,
          filledPositions: 0,
          createdAt: createMockTimestamp(),
          updatedAt: createMockTimestamp(),
          location: { name: 'Seoul' },
        })
      ).toBeNull();
    });

    it('parses arrays of documents and checks document type guards', () => {
      expect(parseJobPostingDocuments([createValidDocument(), { bad: true }])).toHaveLength(1);
      expect(isJobPostingDocument(createValidDocument())).toBe(true);
      expect(isJobPostingDocument({ bad: true })).toBe(false);
    });

    // SP1 역호환: 레거시 fixed 문서(roleRequirements[])는 strict 스키마가 거부하면 안 된다.
    // safeParse 이전 입력 정규화로 통일 구조(requirements[])로 흡수해 읽기 경로에서 살아남아야 함.
    // (fix 이전엔 .strict() + requirements 필수로 reject → parseJobPostingDocument 가 null 반환 = 공고 증발)
    it('absorbs legacy fixed schedule (roleRequirements) on read instead of dropping it', () => {
      const legacyFixedDocument = {
        ...createValidDocument(),
        id: 'legacy-fixed',
        postingType: 'fixed' as const,
        workDate: '',
        workDates: undefined,
        schedule: {
          kind: 'fixed' as const,
          daysPerWeek: 5,
          startTime: '19:00',
          roleRequirements: [
            { role: 'dealer', count: 3, filled: 1 },
            { role: 'floor', count: 2 },
          ],
        },
      };

      const parsed = parseJobPostingDocument(legacyFixedDocument);

      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBe('legacy-fixed');
      expect(parsed?.schedule.kind).toBe('fixed');
      expect(parsed?.schedule.requirements).toHaveLength(1);
      expect(parsed?.schedule.requirements[0]?.date).toBeNull();
      expect(parsed?.schedule.requirements[0]?.timeSlots).toHaveLength(1);

      const roles = parsed?.schedule.requirements[0]?.timeSlots[0]?.roles ?? [];
      expect(roles).toHaveLength(2);
      expect(roles.find((r) => r.role === 'dealer')?.count).toBe(3);
      expect(roles.find((r) => r.role === 'floor')?.count).toBe(2);
      // dead counter `filled`(SP3 제거)는 흡수 과정에서 복사되지 않는다.
      expect(roles.every((r) => !('filled' in r))).toBe(true);

      // type guard 도 동일하게 레거시 fixed 문서를 인정해야 한다.
      expect(isJobPostingDocument(legacyFixedDocument)).toBe(true);
    });

    it('rejects non-canonical top-level fields on read', () => {
      const parsed = parseJobPostingDocument({
        ...createValidDocument(),
        unexpectedField: 2,
      });

      expect(parsed).toBeNull();
    });

    it('parses canonical serializer output', () => {
      const serialized = serializeJobPostingV3(
        {
          postingType: 'regular',
          title: 'Canonical posting',
          description: 'serializer validation',
          location: {
            name: 'Seoul',
            district: 'Gangnam-gu',
            detailedAddress: 'Teheran-ro 123',
          },
          contactPhone: '010-1234-5678',
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
                    roles: [{ role: 'dealer', count: 1 }],
                  },
                ],
              },
            ],
          },
          roleCatalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
          compensation: {
            mode: 'shared',
            defaultSalary: { type: 'daily', amount: 150000 },
            allowances: {},
          },
          questions: {
            items: [],
          },
        },
        {
          ownerId: 'user-1',
          ownerName: 'Owner',
          workspaceId: '123e4567-e89b-42d3-a456-426614174000',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );

      const parsed = parseJobPostingDocument(serialized);

      expect(parsed).not.toBeNull();
      expect(serialized.location).toEqual({
        name: 'Seoul',
        district: 'Gangnam-gu',
        detailedAddress: 'Teheran-ro 123',
      });
      expect(parsed?.location).toEqual({
        name: 'Seoul',
        district: 'Gangnam-gu',
        address: 'Gangnam-gu',
        detailedAddress: 'Teheran-ro 123',
      });
    });
  });
});

describe('jobFilterSchema posting_status SSOT drift guard', () => {
  it('jobFilterSchema.status가 DB enum posting_status 전체 집합을 수용한다', () => {
    for (const status of Constants.public.Enums.posting_status) {
      const result = jobFilterSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('DB enum에 없는 status는 거부한다', () => {
    const result = jobFilterSchema.safeParse({ status: 'weird_status' });
    expect(result.success).toBe(false);
  });
});
