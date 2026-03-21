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
import { JOB_POSTING_SCHEMA_VERSION } from '@/types';

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
    postingType: 'regular' as const,
    workDate: '2026-04-01',
    workDates: ['2026-04-01'],
    roleKeys: ['dealer'],
    totalPositions: 2,
    filledPositions: 0,
    viewCount: 0,
    applicationCount: 0,
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
          address: 'Gangnam-gu',
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
  });

  describe('jobPostingDocumentSchema', () => {
    it('accepts strict V3 job posting documents', () => {
      expect(jobPostingDocumentSchema.safeParse(createValidDocument()).success).toBe(true);
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
  });

  describe('parse helpers', () => {
    it('parses valid V3 documents and rejects legacy documents', () => {
      expect(parseJobPostingDocument(createValidDocument())?.id).toBe('job-1');
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

    it('parses canonical serializer output', () => {
      const serialized = serializeJobPostingV3(
        {
          postingType: 'regular',
          title: 'Canonical posting',
          description: 'serializer validation',
          location: {
            name: 'Seoul',
            address: 'Gangnam-gu',
            coordinates: { latitude: 37.5, longitude: 127.0 },
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
                    roles: [{ role: 'dealer', count: 1, filled: 0 }],
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
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );

      expect(parseJobPostingDocument(serialized)).not.toBeNull();
      expect(serialized.location).toEqual({
        name: 'Seoul',
        district: 'Gangnam-gu',
        detailedAddress: 'Teheran-ro 123',
      });
    });
  });
});
