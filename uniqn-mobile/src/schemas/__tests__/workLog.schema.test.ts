import { parseWorkLogDocument } from '../workLog.schema';
import { Constants } from '@/types/supabase';

const baseWorkLog = {
  id: 'wl-1',
  staffId: 'staff-1',
  jobPostingId: 'job-1',
  date: '2026-05-30',
  staffName: 'Alice',
  staffNickname: null,
  staffPhotoURL: null,
  checkInTime: null,
  checkOutTime: null,
  status: 'completed',
  role: 'dealer',
  customRole: null,
  notes: null,
  timeSlot: null,
  isFixedPosting: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('workLog.schema payroll_status read compatibility', () => {
  it('payroll_status="failed"(DB enum) 레코드를 drop하지 않고 보존한다', () => {
    const parsed = parseWorkLogDocument({ ...baseWorkLog, payrollStatus: 'failed' });

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(expect.objectContaining({ id: 'wl-1', payrollStatus: 'failed' }));
  });

  it('미지 enum 값도 레코드는 살아남고 payrollStatus는 undefined로 흡수된다', () => {
    const parsed = parseWorkLogDocument({ ...baseWorkLog, payrollStatus: 'weird' });

    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe('wl-1');
    expect(parsed?.payrollStatus).toBeUndefined();
  });

  it('payroll_status DB enum이 superset 스키마에 모두 포함된다 (drift 가드)', () => {
    for (const dbValue of Constants.public.Enums.payroll_status) {
      const parsed = parseWorkLogDocument({ ...baseWorkLog, payrollStatus: dbValue });
      expect(parsed?.payrollStatus).toBe(dbValue);
    }
  });
});

describe('workLog.schema fixed compatibility', () => {
  it('parses canonical fixed worklogs with null date/timeSlot and keeps the fixed flag', () => {
    const parsed = parseWorkLogDocument({
      id: 'wl-fixed',
      staffId: 'staff-1',
      jobPostingId: 'job-1',
      date: null,
      staffName: 'Alice',
      staffNickname: null,
      staffPhotoURL: null,
      checkInTime: null,
      checkOutTime: null,
      status: 'scheduled',
      role: 'dealer',
      customRole: null,
      notes: null,
      timeSlot: null,
      isFixedPosting: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        id: 'wl-fixed',
        date: '',
        timeSlot: undefined,
        isFixedPosting: true,
        customRole: undefined,
      })
    );
  });
});
