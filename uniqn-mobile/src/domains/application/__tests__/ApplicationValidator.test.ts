/**
 * ApplicationValidator 테스트
 *
 * @description 지원서 검증 로직 통합 테스트
 * - 역할 정원 확인 (checkRoleCapacity)
 * - 전체 정원 확인 (checkTotalCapacity)
 * - 공고 상태 확인 (isJobActive)
 * - Assignment 유효성 검증 (validateAssignments)
 * - 사전질문 답변 검증 (validatePreQuestionAnswers)
 * - 전체 검증 (validateApplication)
 */

import { ApplicationValidator, applicationValidator } from '../ApplicationValidator';
import type { JobPosting, Assignment, PreQuestionAnswer } from '@/types';

// ============================================================================
// Mocks
// ============================================================================

// getClosingStatus mock
jest.mock('@/utils/job-posting/dateUtils', () => ({
  getClosingStatus: jest.fn(),
}));

jest.mock('@/constants', () => ({
  STATUS: {
    JOB_POSTING: {
      ACTIVE: 'active',
      CLOSED: 'closed',
      CANCELLED: 'cancelled',
      DRAFT: 'draft',
    },
  },
}));

jest.mock('@/types', () => ({
  isValidAssignment: jest.fn(),
  validateRequiredAnswers: jest.fn(),
}));

import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { isValidAssignment, validateRequiredAnswers } from '@/types';

const mockGetClosingStatus = getClosingStatus as jest.MockedFunction<typeof getClosingStatus>;
const mockIsValidAssignment = isValidAssignment as jest.MockedFunction<typeof isValidAssignment>;
const mockValidateRequiredAnswers = validateRequiredAnswers as jest.MockedFunction<
  typeof validateRequiredAnswers
>;

// ============================================================================
// Helper: JobPosting 팩토리
// ============================================================================

function createJobPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    status: 'active',
    title: '테스트 공고',
    ...overrides,
  } as JobPosting;
}

function createAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    roleIds: ['dealer'],
    timeSlot: '19:00',
    dates: ['2025-01-10'],
    isGrouped: false,
    ...overrides,
  } as Assignment;
}

// ============================================================================
// Tests
// ============================================================================

describe('ApplicationValidator', () => {
  let validator: ApplicationValidator;

  beforeEach(() => {
    validator = new ApplicationValidator();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Singleton
  // ==========================================================================

  describe('singleton instance', () => {
    it('applicationValidator는 ApplicationValidator 인스턴스여야 한다', () => {
      expect(applicationValidator).toBeInstanceOf(ApplicationValidator);
    });
  });

  // ==========================================================================
  // checkRoleCapacity
  // ==========================================================================

  describe('checkRoleCapacity', () => {
    it('dateSpecificRequirements에서 역할 정원이 남아있으면 available: true', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 3, filled: 1 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
      expect(result.currentFilled).toBe(1);
      expect(result.maxCapacity).toBe(3);
    });

    it('dateSpecificRequirements에서 역할 정원이 찼으면 available: false', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 2, filled: 2 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('해당 역할의 모집이 마감되었습니다');
    });

    it('dateSpecificRequirements에서 해당 역할이 없으면 available: false', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 3, filled: 0 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'floor');
      expect(result.available).toBe(false);
    });

    it('커스텀 역할 (other + customRole) 매칭이 동작해야 한다', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'other', customRole: '조명담당', headcount: 2, filled: 0 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, '조명담당');
      expect(result.available).toBe(true);
      expect(result.maxCapacity).toBe(2);
    });

    it('role 필드로 역할 매칭이 동작해야 한다', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 5, filled: 2 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
    });

    it('레거시 roles 배열에서 정원이 남아있으면 available: true', () => {
      const jobData = createJobPosting({
        roles: [{ role: 'dealer', count: 3, filled: 1 }],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
      expect(result.currentFilled).toBe(1);
      expect(result.maxCapacity).toBe(3);
    });

    it('레거시 roles 배열에서 정원이 찼으면 available: false', () => {
      const jobData = createJobPosting({
        roles: [{ role: 'dealer', count: 2, filled: 2 }],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(false);
    });

    it('레거시 roles에서 해당 역할이 없으면 available: false', () => {
      const jobData = createJobPosting({
        roles: [{ role: 'dealer', count: 3, filled: 0 }],
      });

      const result = validator.checkRoleCapacity(jobData, 'floor');
      expect(result.available).toBe(false);
    });

    it('역할 정보가 아예 없으면 available: true (레거시 호환)', () => {
      const jobData = createJobPosting({});

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
    });

    it('headcount가 0이면 해당 슬롯은 무시된다', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 0, filled: 0 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(false);
    });

    it('filled가 undefined이면 0으로 취급된다', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 3 }],
              },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
      expect(result.currentFilled).toBe(0);
    });

    it('여러 타임슬롯 중 하나에 자리가 있으면 available: true', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              { roles: [{ role: 'dealer', headcount: 2, filled: 2 }] },
              { roles: [{ role: 'dealer', headcount: 3, filled: 1 }] },
            ],
          },
        ],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
    });

    it('레거시 roles에서 커스텀 역할 매칭이 동작해야 한다', () => {
      const jobData = createJobPosting({
        roles: [{ role: 'other', customRole: '조명담당', count: 2, filled: 0 }],
      });

      const result = validator.checkRoleCapacity(jobData, '조명담당');
      expect(result.available).toBe(true);
    });
  });

  // ==========================================================================
  // checkTotalCapacity
  // ==========================================================================

  describe('checkTotalCapacity', () => {
    it('정원이 남아있으면 available: true', () => {
      mockGetClosingStatus.mockReturnValue({ total: 10, filled: 5, isClosed: false });

      const result = validator.checkTotalCapacity(createJobPosting());
      expect(result.available).toBe(true);
      expect(result.currentFilled).toBe(5);
      expect(result.maxCapacity).toBe(10);
    });

    it('정원이 가득 찼으면 available: false', () => {
      mockGetClosingStatus.mockReturnValue({ total: 10, filled: 10, isClosed: true });

      const result = validator.checkTotalCapacity(createJobPosting());
      expect(result.available).toBe(false);
      expect(result.reason).toBe('모집 인원이 마감되었습니다');
    });

    it('totalPositions가 0이면 available: true (제한 없음)', () => {
      mockGetClosingStatus.mockReturnValue({ total: 0, filled: 0, isClosed: false });

      const result = validator.checkTotalCapacity(createJobPosting());
      expect(result.available).toBe(true);
    });

    it('filled가 total을 초과해도 available: false', () => {
      mockGetClosingStatus.mockReturnValue({ total: 5, filled: 7, isClosed: true });

      const result = validator.checkTotalCapacity(createJobPosting());
      expect(result.available).toBe(false);
    });
  });

  // ==========================================================================
  // isJobActive
  // ==========================================================================

  describe('isJobActive', () => {
    it('status가 active이면 true', () => {
      expect(validator.isJobActive(createJobPosting({ status: 'active' }))).toBe(true);
    });

    it('status가 closed이면 false', () => {
      expect(validator.isJobActive(createJobPosting({ status: 'closed' }))).toBe(false);
    });

    it('status가 cancelled이면 false', () => {
      expect(validator.isJobActive(createJobPosting({ status: 'cancelled' }))).toBe(false);
    });
  });

  // ==========================================================================
  // validateAssignments
  // ==========================================================================

  describe('validateAssignments', () => {
    it('모든 assignment가 유효하면 isValid: true', () => {
      mockIsValidAssignment.mockReturnValue(true);

      const assignments = [createAssignment(), createAssignment()];
      const result = validator.validateAssignments(assignments);

      expect(result.isValid).toBe(true);
      expect(result.invalidIndices).toEqual([]);
    });

    it('유효하지 않은 assignment가 있으면 isValid: false + invalidIndices', () => {
      mockIsValidAssignment
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      const assignments = [createAssignment(), createAssignment(), createAssignment()];
      const result = validator.validateAssignments(assignments);

      expect(result.isValid).toBe(false);
      expect(result.invalidIndices).toEqual([1, 2]);
    });

    it('빈 배열이면 isValid: true', () => {
      const result = validator.validateAssignments([]);
      expect(result.isValid).toBe(true);
      expect(result.invalidIndices).toEqual([]);
    });
  });

  // ==========================================================================
  // validatePreQuestionAnswers
  // ==========================================================================

  describe('validatePreQuestionAnswers', () => {
    it('사전질문을 사용하지 않는 공고는 항상 유효', () => {
      const jobData = createJobPosting({ usesPreQuestions: false });
      const result = validator.validatePreQuestionAnswers(jobData);
      expect(result.isValid).toBe(true);
    });

    it('사전질문이 있지만 비활성화되었으면 유효', () => {
      const jobData = createJobPosting({
        usesPreQuestions: false,
        preQuestions: [{ id: 'q1', question: '질문1', required: true, type: 'text' }],
      });
      const result = validator.validatePreQuestionAnswers(jobData);
      expect(result.isValid).toBe(true);
    });

    it('사전질문이 활성화되었는데 답변이 없으면 무효', () => {
      const jobData = createJobPosting({
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문1', required: true, type: 'text' }],
      });
      const result = validator.validatePreQuestionAnswers(jobData, undefined);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('사전질문에 답변해주세요');
    });

    it('사전질문이 활성화되었는데 답변 배열이 비어있으면 무효', () => {
      const jobData = createJobPosting({
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문1', required: true, type: 'text' }],
      });
      const result = validator.validatePreQuestionAnswers(jobData, []);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('사전질문에 답변해주세요');
    });

    it('필수 답변이 모두 채워지면 유효', () => {
      mockValidateRequiredAnswers.mockReturnValue(true);
      const jobData = createJobPosting({
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문1', required: true, type: 'text' }],
      });
      const answers: PreQuestionAnswer[] = [
        { questionId: 'q1', question: '질문1', answer: '답변1', required: true },
      ];
      const result = validator.validatePreQuestionAnswers(jobData, answers);
      expect(result.isValid).toBe(true);
    });

    it('필수 답변이 비어있으면 무효', () => {
      mockValidateRequiredAnswers.mockReturnValue(false);
      const jobData = createJobPosting({
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문1', required: true, type: 'text' }],
      });
      const answers: PreQuestionAnswer[] = [
        { questionId: 'q1', question: '질문1', answer: '', required: true },
      ];
      const result = validator.validatePreQuestionAnswers(jobData, answers);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('필수 질문에 모두 답변해주세요');
    });

    it('preQuestions 배열이 비어있으면 유효', () => {
      const jobData = createJobPosting({
        usesPreQuestions: true,
        preQuestions: [],
      });
      const result = validator.validatePreQuestionAnswers(jobData);
      expect(result.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // validateApplication (통합 검증)
  // ==========================================================================

  describe('validateApplication', () => {
    beforeEach(() => {
      mockGetClosingStatus.mockReturnValue({ total: 10, filled: 3, isClosed: false });
      mockIsValidAssignment.mockReturnValue(true);
    });

    it('모든 조건이 유효하면 isValid: true, errors: []', () => {
      const jobData = createJobPosting({ status: 'active' });
      const assignments = [createAssignment()];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('공고가 비활성이면 JOB_NOT_ACTIVE 에러', () => {
      const jobData = createJobPosting({ status: 'closed' });
      const assignments = [createAssignment()];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'JOB_NOT_ACTIVE')).toBe(true);
    });

    it('전체 정원 초과 시 MAX_CAPACITY_REACHED 에러', () => {
      mockGetClosingStatus.mockReturnValue({ total: 5, filled: 5, isClosed: true });
      const jobData = createJobPosting({ status: 'active' });
      const assignments = [createAssignment()];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MAX_CAPACITY_REACHED')).toBe(true);
    });

    it('잘못된 Assignment가 있으면 INVALID_ASSIGNMENT 에러', () => {
      mockIsValidAssignment.mockReturnValue(false);
      const jobData = createJobPosting({ status: 'active' });
      const assignments = [createAssignment()];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_ASSIGNMENT')).toBe(true);
    });

    it('역할 정원 초과 시 ROLE_CAPACITY_REACHED 에러', () => {
      const jobData = createJobPosting({
        status: 'active',
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [{ roles: [{ role: 'dealer', headcount: 2, filled: 2 }] }],
          },
        ],
      });
      const assignments = [createAssignment({ roleIds: ['dealer'] })];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.errors.some((e) => e.code === 'ROLE_CAPACITY_REACHED')).toBe(true);
    });

    it('사전질문 미답변 시 MISSING_PRE_QUESTION_ANSWERS 에러', () => {
      const jobData = createJobPosting({
        status: 'active',
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문', required: true, type: 'text' }],
      });
      const assignments = [createAssignment()];

      const result = validator.validateApplication(jobData, assignments, undefined);
      expect(result.errors.some((e) => e.code === 'MISSING_PRE_QUESTION_ANSWERS')).toBe(true);
    });

    it('사전질문 답변이 불완전하면 INVALID_PRE_QUESTION_ANSWERS 에러', () => {
      mockValidateRequiredAnswers.mockReturnValue(false);
      const jobData = createJobPosting({
        status: 'active',
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문', required: true, type: 'text' }],
      });
      const assignments = [createAssignment()];
      const answers: PreQuestionAnswer[] = [
        { questionId: 'q1', question: '질문', answer: '', required: true },
      ];

      const result = validator.validateApplication(jobData, assignments, answers);
      expect(result.errors.some((e) => e.code === 'INVALID_PRE_QUESTION_ANSWERS')).toBe(true);
    });

    it('여러 에러가 동시에 발생할 수 있다', () => {
      mockGetClosingStatus.mockReturnValue({ total: 5, filled: 5, isClosed: true });
      mockIsValidAssignment.mockReturnValue(false);

      const jobData = createJobPosting({ status: 'closed' });
      const assignments = [createAssignment()];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('assignments가 비어있으면 roleCapacity 체크를 건너뛴다', () => {
      const jobData = createJobPosting({ status: 'active' });
      const result = validator.validateApplication(jobData, []);
      // roleIds[0]이 undefined이면 역할 정원 체크 건너뜀
      expect(result.errors.every((e) => e.code !== 'ROLE_CAPACITY_REACHED')).toBe(true);
    });

    it('INVALID_ASSIGNMENT 에러에 field 정보가 포함된다', () => {
      mockIsValidAssignment.mockReturnValueOnce(true).mockReturnValueOnce(false);
      const jobData = createJobPosting({ status: 'active' });
      const assignments = [createAssignment(), createAssignment()];

      const result = validator.validateApplication(jobData, assignments);
      const invalidErr = result.errors.find((e) => e.code === 'INVALID_ASSIGNMENT');
      expect(invalidErr?.field).toBe('assignments[1]');
    });
  });
});
