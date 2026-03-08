/**
 * WorkLog(근무기록) 테스트 데이터 팩토리
 */

interface WorkLogFactoryOptions {
  jobPostingId?: string;
  staffId?: string;
  staffName?: string;
  role?: string;
  customRole?: string;
  payrollStatus?: 'pending' | 'completed';
  checkInTime?: string;
  checkOutTime?: string;
  workDate?: string;
}

let workLogCounter = 0;

/**
 * 테스트용 근무기록 Firestore 문서 데이터 생성
 */
export function createTestWorkLog(options: WorkLogFactoryOptions = {}) {
  workLogCounter++;
  const id = `test-worklog-${Date.now()}-${workLogCounter}`;
  const workDate = options.workDate ?? '2026-04-01';

  return {
    id,
    jobPostingId: options.jobPostingId ?? 'test-job-001',
    staffId: options.staffId ?? 'test-staff-uid-001',
    staffName: options.staffName ?? '테스트스태프',
    staffPhone: '+82101234567',
    role: options.role ?? 'dealer',
    customRole: options.customRole,
    workDate,
    checkInTime: options.checkInTime ?? `${workDate}T18:00:00+09:00`,
    checkOutTime: options.checkOutTime ?? `${workDate}T02:00:00+09:00`,
    payrollStatus: options.payrollStatus ?? 'pending',
    customSalaryInfo: null,
    customAllowances: null,
    customTaxSettings: null,
    settlementModificationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 정산 완료된 근무기록 데이터 생성
 */
export function createCompletedWorkLog(options: WorkLogFactoryOptions = {}) {
  return createTestWorkLog({
    ...options,
    payrollStatus: 'completed',
  });
}

/**
 * 체크인만 된 근무기록 데이터 생성 (체크아웃 미완료)
 */
export function createCheckedInWorkLog(options: WorkLogFactoryOptions = {}) {
  return {
    ...createTestWorkLog(options),
    checkOutTime: null,
  };
}
