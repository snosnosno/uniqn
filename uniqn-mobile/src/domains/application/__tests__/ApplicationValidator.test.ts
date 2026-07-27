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

import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { isValidAssignment } from '@/types/assignment';
import { validateRequiredAnswers } from '@/domains/application';

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

jest.mock('@/types/assignment', () => ({
  isValidAssignment: jest.fn(),
}));

jest.mock('@/domains/application', () => ({
  validateRequiredAnswers: jest.fn(),
}));

const mockGetClosingStatus = getClosingStatus as jest.MockedFunction<typeof getClosingStatus>;
const mockIsValidAssignment = isValidAssignment as jest.MockedFunction<typeof isValidAssignment>;
const mockValidateRequiredAnswers = validateRequiredAnswers as jest.MockedFunction<
  typeof validateRequiredAnswers
>;

// ============================================================================
// Helper: JobPosting 팩토리
// ============================================================================

function createJobPostingLegacy(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    status: 'active',
    description: 'Test Posting',
    ownerId: 'owner-1',
    // legacy fixture fallback
    title: '테스트 공고',
    ...overrides,
  } as JobPosting;
}
void createJobPostingLegacy;

type LegacyDateSpecificRequirement = {
  date: string;
  timeSlots: {
    startTime?: string;
    roles: {
      role?: string;
      customRole?: string;
      headcount?: number;
      filled?: number;
    }[];
  }[];
};

type LegacyRoleRequirement = {
  role?: string;
  customRole?: string;
  count: number;
  filled?: number;
};

type TestJobPostingOverrides = Partial<JobPosting> & {
  dateSpecificRequirements?: LegacyDateSpecificRequirement[];
  roles?: LegacyRoleRequirement[];
  usesPreQuestions?: boolean;
  preQuestions?: {
    id: string;
    question: string;
    required?: boolean;
    type: string;
  }[];
};

function createJobPosting(overrides: TestJobPostingOverrides = {}): JobPosting {
  const questions =
    overrides.usesPreQuestions === false
      ? []
      : ((overrides.preQuestions ?? overrides.questions?.items ?? []) as NonNullable<
          JobPosting['questions']
        >['items']);

  const datedRequirements = (overrides.dateSpecificRequirements ?? []).map((requirement) => ({
    date: requirement.date,
    timeSlots: requirement.timeSlots.map((slot, slotIndex) => ({
      id: `slot-${slotIndex}`,
      startTime: slot.startTime,
      roles: slot.roles.map((role, roleIndex) => ({
        id: `role-${roleIndex}`,
        role: role.role ?? 'dealer',
        customRole: role.customRole,
        count: role.headcount ?? 0,
        filled: role.filled ?? 0,
      })),
    })),
  }));

  const fixedRoles = (overrides.roles ?? []).map((role) => ({
    role: role.role ?? 'dealer',
    customRole: role.customRole,
    count: role.count,
    filled: role.filled ?? 0,
  }));

  const roleCatalogSource =
    overrides.roles ??
    overrides.dateSpecificRequirements?.flatMap((requirement) =>
      requirement.timeSlots.flatMap((slot) =>
        slot.roles.map((role) => ({
          role: role.role ?? 'dealer',
          customRole: role.customRole,
        }))
      )
    ) ??
    [];

  const workDate = overrides.workDate ?? datedRequirements[0]?.date ?? '2025-01-10';
  const schedule =
    overrides.schedule ??
    (datedRequirements.length > 0
      ? {
          kind: 'dated' as const,
          primaryDate: workDate,
          allDates: datedRequirements.map((requirement) => requirement.date),
          requirements: datedRequirements,
        }
      : {
          kind: 'fixed' as const,
          requirements: [
            {
              date: null,
              timeSlots: [
                {
                  isTimeToBeAnnounced: false,
                  roles: fixedRoles.length > 0 ? fixedRoles : [],
                },
              ],
            },
          ],
        });

  const totalPositions =
    overrides.totalPositions ??
    (schedule.kind === 'fixed'
      ? (schedule.requirements[0]?.timeSlots[0]?.roles ?? []).reduce(
          (sum: number, role: { count: number }) => sum + role.count,
          0
        )
      : schedule.requirements.reduce(
          (sum, requirement) =>
            sum +
            requirement.timeSlots.reduce(
              (slotSum, slot) =>
                slotSum + slot.roles.reduce((roleSum, role) => roleSum + role.count, 0),
              0
            ),
          0
        ));

  return {
    id: 'job-1',
    schemaVersion: 3,
    title: 'Test Posting',
    status: overrides.status ?? 'active',
    ownerId: overrides.ownerId ?? 'owner-1',
    workDate,
    totalPositions,
    filledPositions: overrides.filledPositions ?? 0,
    location: overrides.location ?? { name: 'Gangnam', district: 'Seoul' },
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    schedule,
    roleCatalog: roleCatalogSource.map((role) => ({
      role: role.role ?? 'dealer',
      customRole: role.customRole,
    })),
    compensation: overrides.compensation ?? { mode: 'shared' },
    questions: overrides.questions ?? { items: questions },
    /*
    status: 'active',
    title: '?뚯뒪??怨듦퀬',
    ownerId: 'owner-1',
    * legacy block continues
    workDate,
    totalPositions,
    filledPositions: overrides.filledPositions ?? 0,
    location: overrides.location ?? { name: '媛뺣궓援?, district: '媛뺣궓援? },
    schedule,
    roleCatalog: roleCatalogSource.map((role) => ({
      role: role.role ?? 'dealer',
      customRole: role.customRole,
    })),
    compensation: overrides.compensation ?? {
      mode: 'shared',
      defaultSalary: overrides.defaultSalary,
      allowances: overrides.allowances,
      taxSettings: overrides.taxSettings,
    },
    */
    postingType: overrides.postingType,
    description: overrides.description,
    ...(overrides.viewCount !== undefined ? { viewCount: overrides.viewCount } : {}),
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
    it('dateSpecificRequirements에서 역할 headcount가 양수면 available: true (currentFilled는 항상 0 — schedule filled 추적 제거)', () => {
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
      // 역할별 충원 추적은 클라이언트에서 제거됨(dead counter). 실제 정원은 confirm 시 서버(H1)에서 강제.
      expect(result.currentFilled).toBe(0);
      expect(result.maxCapacity).toBe(3);
    });

    it('dateSpecificRequirements에서 headcount가 양수면 클라이언트는 더 이상 역할 마감을 차단하지 않는다 (available: true)', () => {
      const jobData = createJobPosting({
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [{ role: 'dealer', headcount: 2 }],
              },
            ],
          },
        ],
      });

      // schedule role.filled dead counter 제거 후 역할별 사전 차단은 vacuous.
      // 실제 역할 정원은 confirm 시 서버(SP2 H1)에서 강제된다.
      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
      expect(result.currentFilled).toBe(0);
      expect(result.maxCapacity).toBe(2);
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

    it('레거시 roles 배열에서 count가 양수면 available: true (currentFilled는 항상 0 — schedule filled 추적 제거)', () => {
      const jobData = createJobPosting({
        roles: [{ role: 'dealer', count: 3 }],
      });

      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
      // 역할별 충원 추적은 클라이언트에서 제거됨(dead counter). 실제 정원은 confirm 시 서버(H1)에서 강제.
      expect(result.currentFilled).toBe(0);
      expect(result.maxCapacity).toBe(3);
    });

    it('레거시 roles 배열에서 count가 양수면 클라이언트는 더 이상 역할 마감을 차단하지 않는다 (available: true)', () => {
      const jobData = createJobPosting({
        roles: [{ role: 'dealer', count: 2 }],
      });

      // schedule role.filled dead counter 제거 후 역할별 사전 차단은 vacuous.
      const result = validator.checkRoleCapacity(jobData, 'dealer');
      expect(result.available).toBe(true);
      expect(result.currentFilled).toBe(0);
      expect(result.maxCapacity).toBe(2);
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

    it('headcount가 0이어도 역할 자체는 존재하므로 available: true (정원 판정은 슬롯 검사 담당)', () => {
      // checkRoleCapacity 는 "역할이 공고에 있는가"만 본다 — 좌석 수 판정은
      // validateAssignmentSlotCapacity(아래 대조군)가 맡는다.
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

      expect(validator.checkRoleCapacity(jobData, 'dealer').available).toBe(true);
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
      expect(result.reason).toBe('모집 인원이 마감되었습니다.');
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
      expect(result.reason).toBe('사전질문에 답변해 주세요');
    });

    it('사전질문이 활성화되었는데 답변 배열이 비어있으면 무효', () => {
      const jobData = createJobPosting({
        usesPreQuestions: true,
        preQuestions: [{ id: 'q1', question: '질문1', required: true, type: 'text' }],
      });
      const result = validator.validatePreQuestionAnswers(jobData, []);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('사전질문에 답변해 주세요');
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
      expect(result.reason).toBe('필수 질문에 모두 답변해 주세요');
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
      // dated 공고 + dealer 자리 여유 있음 — slotCapacity 검증이 통과해야 한다
      const jobData = createJobPosting({
        status: 'active',
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              { startTime: '19:00', roles: [{ role: 'dealer', headcount: 5, filled: 0 }] },
            ],
          },
        ],
      });
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

    it('좌석 0인 역할은 집계 검증에서 걸러진다 — checkRoleCapacity 완화의 대조군', () => {
      // checkRoleCapacity 는 좌석 수를 보지 않게 좁아졌다. 좌석 0 거부가 통째로 사라지지 않았음을
      // 이 대조군이 고정한다(실효 담당은 validateAssignmentSlotCapacity).
      const jobData = createJobPosting({
        status: 'active',
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [{ roles: [{ role: 'dealer', headcount: 0, filled: 0 }] }],
          },
        ],
      });

      const result = validator.validateApplication(jobData, [
        createAssignment({ roleIds: ['dealer'] }),
      ]);
      expect(result.errors.some((e) => e.code === 'ROLE_CAPACITY_REACHED')).toBe(true);
    });

    it('여러 assignment의 모든 roleId에 대해 정원을 검증한다', () => {
      const jobData = createJobPosting({
        status: 'active',
        dateSpecificRequirements: [
          {
            date: '2025-01-10',
            timeSlots: [
              {
                roles: [
                  { role: 'dealer', headcount: 3, filled: 1 },
                  { role: 'floor', headcount: 2, filled: 2 },
                ],
              },
            ],
          },
        ],
      });
      const assignments = [
        createAssignment({ roleIds: ['dealer'] }),
        createAssignment({ roleIds: ['floor'] }),
      ];

      const result = validator.validateApplication(jobData, assignments);
      expect(result.errors.some((e) => e.code === 'ROLE_CAPACITY_REACHED')).toBe(true);
      const roleErr = result.errors.find((e) => e.code === 'ROLE_CAPACITY_REACHED');
      expect(roleErr?.field).toBe('assignments:2025-01-10:19:00:dealer');
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
