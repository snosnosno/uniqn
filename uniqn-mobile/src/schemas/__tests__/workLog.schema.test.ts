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

  // 스키마에 명시되지 않은 신규 필드가 조용히 사라지면 출처 배지가 통째로 죽는다.
  // (에러 없이 표시만 없어지는 종류라 배지 부재로는 원인을 못 찾는다)
  it('endTimeSource 를 파싱 결과에 보존한다', () => {
    const parsed = parseWorkLogDocument({ ...baseWorkLog, endTimeSource: 'qr' });

    expect(parsed).toEqual(expect.objectContaining({ endTimeSource: 'qr' }));
  });
});
