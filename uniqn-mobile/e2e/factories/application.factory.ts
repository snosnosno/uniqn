/**
 * Application test data factory
 */

interface ApplicationFactoryOptions {
  jobPostingId?: string;
  applicantId?: string;
  applicantName?: string;
  status?:
    | 'applied'
    | 'confirmed'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'cancellation_pending';
  role?: string;
}

let applicationCounter = 0;

/**
 * Create a canonical application document for Firestore-backed E2E flows.
 */
export function createTestApplication(options: ApplicationFactoryOptions = {}) {
  applicationCounter++;
  const id = `test-application-${Date.now()}-${applicationCounter}`;
  const createdAt = new Date();
  const updatedAt = new Date(createdAt);
  const status = options.status ?? 'applied';
  const roleId = options.role ?? 'dealer';

  return {
    id,
    applicantId: options.applicantId ?? 'test-staff-uid-001',
    applicantName: options.applicantName ?? '테스트스태프',
    applicantPhone: '+82101234567',
    applicantEmail: 'staff@test.com',
    jobPostingId: options.jobPostingId ?? 'test-job-001',
    jobPostingTitle: `테스트공고 ${applicationCounter}`,
    jobPostingOwnerId: 'test-employer-uid-001',
    status,
    assignments: [
      {
        roleIds: [roleId],
        timeSlot: '18:00',
        dates: ['2026-04-01'],
        isGrouped: false,
      },
    ],
    message: `테스트 지원 메시지 ${applicationCounter}`,
    createdAt,
    updatedAt,
    ...(status === 'confirmed' || status === 'completed'
      ? {
          confirmedAt: createdAt,
          confirmedBy: 'test-employer-uid-001',
        }
      : {}),
    ...(status === 'rejected'
      ? {
          rejectedAt: updatedAt,
          rejectionReason: '다른 지원자를 먼저 선발했습니다.',
        }
      : {}),
    ...(status === 'cancelled'
      ? {
          cancelledAt: updatedAt,
          cancellationReason: '개인 일정으로 취소했습니다.',
        }
      : {}),
    ...(status === 'completed'
      ? {
          processedAt: updatedAt,
        }
      : {}),
  };
}

/**
 * Create a confirmed application.
 */
export function createConfirmedApplication(options: ApplicationFactoryOptions = {}) {
  return createTestApplication({
    ...options,
    status: 'confirmed',
  });
}

/**
 * Create a rejected application.
 */
export function createRejectedApplication(options: ApplicationFactoryOptions = {}) {
  return createTestApplication({
    ...options,
    status: 'rejected',
  });
}
