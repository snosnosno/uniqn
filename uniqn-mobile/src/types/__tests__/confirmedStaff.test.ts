import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { CONFIRMED_STAFF_STATUS_LABELS } from '@/shared/status';
import type { ConfirmedStaff } from '../confirmedStaff';
import {
  calculateStaffStats,
  groupStaffByDate,
  resolveNoShowRevertStatus,
  sortStaffByStatus,
  workLogToConfirmedStaff,
} from '@/domains/staff';

const createMockWorkLog = (overrides = {}) => ({
  id: 'wl-1',
  staffId: 'staff-1234',
  jobPostingId: 'job-1',
  date: '2025-03-01',
  role: 'dealer',
  status: 'scheduled',
  scheduledStartTime: undefined,
  scheduledEndTime: undefined,
  payrollStatus: undefined,
  payrollAmount: undefined,
  notes: undefined,
  ...overrides,
});

const createMockConfirmedStaff = (overrides: Partial<ConfirmedStaff> = {}): ConfirmedStaff => ({
  id: 'cs-1',
  staffId: 'staff-1',
  staffName: 'Staff One',
  role: 'dealer',
  date: '2025-03-01',
  status: 'scheduled',
  ...overrides,
});

describe('confirmedStaff', () => {
  it('exposes the canonical cancelled label and color config', () => {
    expect(CONFIRMED_STAFF_STATUS_LABELS.cancelled).toBe('취소');
    expect(CONFIRMED_STAFF_STATUS.cancelled).toEqual(
      expect.objectContaining({
        bgColor: expect.any(String),
        textColor: expect.any(String),
      })
    );
  });

  it('converts work logs with an explicit staff name', () => {
    const workLog = createMockWorkLog({
      timeSlot: '09:00~18:00',
      customRole: 'VIP Dealer',
      notes: 'Late arrival note',
      payrollStatus: 'pending',
      payrollAmount: 150000,
    });

    const result = workLogToConfirmedStaff(workLog as never, 'Alice');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'wl-1',
        staffId: 'staff-1234',
        staffName: 'Alice',
        role: 'dealer',
        timeSlot: '09:00~18:00',
        customRole: 'VIP Dealer',
        notes: 'Late arrival note',
        payrollStatus: 'pending',
        payrollAmount: 150000,
        workLog,
      })
    );
  });

  it('falls back to the last four staffId characters when no name is provided', () => {
    const result = workLogToConfirmedStaff(createMockWorkLog() as never);
    expect(result.staffName).toBe('1234');
  });

  it('maps no-show work logs to the no_show confirmed staff status', () => {
    const result = workLogToConfirmedStaff(
      createMockWorkLog({
        status: 'scheduled',
        noShowAt: new Date('2025-03-01T18:00:00Z'),
        noShowReason: 'No call',
      }) as never
    );

    expect(result.status).toBe('no_show');
    expect(result.isNoShow).toBe(true);
    expect(result.noShowReason).toBe('No call');
  });

  it('groups staff by date and keeps undated entries in a trailing placeholder group', () => {
    const groups = groupStaffByDate([
      createMockConfirmedStaff({ id: 'dated-1', date: '2025-03-01' }),
      createMockConfirmedStaff({ id: 'dated-2', date: '2025-03-01', status: 'checked_in' }),
      createMockConfirmedStaff({ id: 'undated', date: '' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual(
      expect.objectContaining({
        date: '2025-03-01',
        staff: expect.arrayContaining([
          expect.objectContaining({ id: 'dated-1' }),
          expect.objectContaining({ id: 'dated-2' }),
        ]),
      })
    );
    expect(groups[1]).toEqual(
      expect.objectContaining({
        date: '',
        formattedDate: '날짜 미정',
        staff: [expect.objectContaining({ id: 'undated' })],
      })
    );
  });

  it('counts checked-in, completed, cancelled, no-show, and settled staff correctly', () => {
    const stats = calculateStaffStats([
      createMockConfirmedStaff({ status: 'scheduled' }),
      createMockConfirmedStaff({ status: 'checked_in' }),
      createMockConfirmedStaff({ status: 'checked_out' }),
      createMockConfirmedStaff({ status: 'completed', payrollStatus: 'completed' }),
      createMockConfirmedStaff({ status: 'cancelled' }),
      createMockConfirmedStaff({ status: 'no_show' }),
    ]);

    expect(stats).toEqual({
      total: 6,
      scheduled: 1,
      checkedIn: 1,
      checkedOut: 1,
      completed: 1,
      cancelled: 1,
      noShow: 1,
      settled: 1,
    });
  });

  it('sorts staff by operational priority without mutating the original array', () => {
    const staff = [
      createMockConfirmedStaff({ id: 'cancelled', status: 'cancelled' }),
      createMockConfirmedStaff({ id: 'scheduled', status: 'scheduled' }),
      createMockConfirmedStaff({ id: 'checked_in', status: 'checked_in' }),
      createMockConfirmedStaff({ id: 'no_show', status: 'no_show' }),
      createMockConfirmedStaff({ id: 'checked_out', status: 'checked_out' }),
      createMockConfirmedStaff({ id: 'completed', status: 'completed' }),
    ];

    const original = [...staff];
    const sorted = sortStaffByStatus(staff);

    expect(sorted.map((item) => item.id)).toEqual([
      'checked_in',
      'scheduled',
      'checked_out',
      'completed',
      'no_show',
      'cancelled',
    ]);
    expect(staff).toEqual(original);
  });

  describe('resolveNoShowRevertStatus', () => {
    it('returns checked_out when both check-in and check-out timestamps exist', () => {
      expect(resolveNoShowRevertStatus('2025-03-01T09:00:00Z', '2025-03-01T18:00:00Z')).toBe(
        'checked_out'
      );
    });

    it('returns checked_in when only check-in exists', () => {
      expect(resolveNoShowRevertStatus('2025-03-01T09:00:00Z', undefined)).toBe('checked_in');
    });

    it('returns scheduled when neither timestamp exists', () => {
      expect(resolveNoShowRevertStatus(undefined, undefined)).toBe('scheduled');
    });

    it('returns scheduled when both timestamps are null', () => {
      expect(resolveNoShowRevertStatus(null, null)).toBe('scheduled');
    });
  });
});
