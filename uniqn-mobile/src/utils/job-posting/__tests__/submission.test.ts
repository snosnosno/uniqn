import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { JobPosting, JobPostingFormData } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import {
  buildUpdateJobPostingInput,
  shouldAllowLegacyScheduleFallback,
} from '@/utils/job-posting/submission';

function createFormData(overrides: Partial<JobPostingFormData> = {}): JobPostingFormData {
  return {
    ...INITIAL_JOB_POSTING_FORM_DATA,
    title: '테스트 공고',
    postingType: 'regular',
    location: {
      name: '강남구',
      address: '서울 강남구',
    },
    roles: [
      {
        name: '딜러',
        count: 2,
        salary: { type: 'hourly', amount: 12000 },
      },
    ],
    ...overrides,
  };
}

function createDateRequirement(date: string): DateSpecificRequirement {
  return {
    date,
    timeSlots: [
      {
        id: `slot-${date}`,
        startTime: '18:00',
        roles: [
          {
            id: `role-${date}`,
            role: 'dealer',
            headcount: 2,
            filled: 0,
          },
        ],
      },
    ],
  };
}

describe('job posting submission helpers', () => {
  describe('shouldAllowLegacyScheduleFallback', () => {
    it('returns true for dated postings without date-specific requirements', () => {
      const posting = {
        postingType: 'regular',
        dateSpecificRequirements: [],
      } as Pick<JobPosting, 'postingType' | 'dateSpecificRequirements'>;

      expect(shouldAllowLegacyScheduleFallback(posting)).toBe(true);
    });

    it('returns false for fixed postings and modern dated postings', () => {
      expect(
        shouldAllowLegacyScheduleFallback({
          postingType: 'fixed',
          dateSpecificRequirements: [],
        } as Pick<JobPosting, 'postingType' | 'dateSpecificRequirements'>)
      ).toBe(false);

      expect(
        shouldAllowLegacyScheduleFallback({
          postingType: 'regular',
          dateSpecificRequirements: [createDateRequirement('2026-03-21')],
        } as Pick<JobPosting, 'postingType' | 'dateSpecificRequirements'>)
      ).toBe(false);
    });
  });

  describe('buildUpdateJobPostingInput', () => {
    it('includes dated schedule updates, keeps primary workDate in sync, and persists questions', () => {
      const dateSpecificRequirements = [
        createDateRequirement('2026-03-25'),
        createDateRequirement('2026-03-26'),
      ];
      const formData = createFormData({
        workDate: '2026-03-20',
        dateSpecificRequirements,
        usesPreQuestions: true,
        preQuestions: [
          {
            id: 'q1',
            question: '경력은 몇 년인가요?',
            type: 'text',
            required: true,
          },
        ],
      });

      const result = buildUpdateJobPostingInput(formData, {
        hasConfirmedApplicants: false,
      });

      expect(result.workDate).toBe('2026-03-25');
      expect(result.dateSpecificRequirements).toEqual(dateSpecificRequirements);
      expect(result.roles).toEqual(formData.roles);
      expect(result.usesPreQuestions).toBe(true);
      expect(result.preQuestions).toEqual(formData.preQuestions);
    });

    it('keeps legacy fallback fields when dated requirements are still empty', () => {
      const formData = createFormData({
        workDate: '2026-03-22',
        startTime: '19:00',
        dateSpecificRequirements: [],
      });

      const result = buildUpdateJobPostingInput(formData, {
        hasConfirmedApplicants: false,
      });

      expect(result.workDate).toBe('2026-03-22');
      expect(result.startTime).toBe('19:00');
      expect(result.dateSpecificRequirements).toEqual([]);
    });

    it('omits schedule mutations when confirmed applicants already exist', () => {
      const formData = createFormData({
        workDate: '2026-03-22',
        startTime: '19:00',
        dateSpecificRequirements: [createDateRequirement('2026-03-22')],
        usesPreQuestions: true,
        preQuestions: [
          {
            id: 'q1',
            question: '자차 이동 가능하신가요?',
            type: 'text',
            required: false,
          },
        ],
      });

      const result = buildUpdateJobPostingInput(formData, {
        hasConfirmedApplicants: true,
      });

      expect(result.workDate).toBeUndefined();
      expect(result.dateSpecificRequirements).toBeUndefined();
      expect(result.roles).toBeUndefined();
      expect(result.usesPreQuestions).toBe(true);
      expect(result.preQuestions).toEqual(formData.preQuestions);
    });
  });
});
