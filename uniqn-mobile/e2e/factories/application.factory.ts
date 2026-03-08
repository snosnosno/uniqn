/**
 * Application(지원서) 테스트 데이터 팩토리
 */

interface ApplicationFactoryOptions {
  jobPostingId?: string;
  applicantId?: string;
  applicantName?: string;
  status?: 'applied' | 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  role?: string;
}

let applicationCounter = 0;

/**
 * 테스트용 지원서 Firestore 문서 데이터 생성
 */
export function createTestApplication(options: ApplicationFactoryOptions = {}) {
  applicationCounter++;
  const id = `test-application-${Date.now()}-${applicationCounter}`;

  return {
    id,
    applicantId: options.applicantId ?? 'test-staff-uid-001',
    applicantName: options.applicantName ?? '테스트스태프',
    applicantPhone: '+82101234567',
    applicantEmail: 'staff@test.com',
    jobPostingId: options.jobPostingId ?? 'test-job-001',
    jobPostingTitle: `테스트공고${applicationCounter}`,
    status: options.status ?? 'applied',
    assignments: [
      {
        role: options.role ?? 'dealer',
        date: '2026-04-01',
        timeSlot: { startTime: '18:00' },
      },
    ],
    message: `테스트 지원 메시지 ${applicationCounter}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 확정된 지원서 데이터 생성
 */
export function createConfirmedApplication(options: ApplicationFactoryOptions = {}) {
  return createTestApplication({
    ...options,
    status: 'confirmed',
  });
}

/**
 * 거절된 지원서 데이터 생성
 */
export function createRejectedApplication(options: ApplicationFactoryOptions = {}) {
  return {
    ...createTestApplication({
      ...options,
      status: 'rejected',
    }),
    rejectionReason: '다른 지원자가 선택되었습니다',
  };
}
