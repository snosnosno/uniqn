import type { ConfirmedStaff, JobPosting } from '@/types';
import { TBA_TIME_MARKER } from '@/domains/application';
import { buildEventQRScopes, findPreferredEventQRScope } from '../eventQRScope';

function createDatedPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: 'Event staffing',
    status: 'active',
    ownerId: 'owner-1',
    workDate: '2026-04-01',
    workDates: ['2026-04-01', '2026-04-02'],
    totalPositions: 3,
    filledPositions: 0,
    location: {
      name: 'Gangnam',
      address: 'Teheran-ro',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-01',
      allDates: ['2026-04-01', '2026-04-02'],
      requirements: [
        {
          date: '2026-04-02',
          timeSlots: [
            {
              id: 'slot-b',
              startTime: '18:00',
              roles: [{ role: 'manager', count: 1 }],
            },
          ],
        },
        {
          date: '2026-04-01',
          timeSlots: [
            {
              id: 'slot-a',
              startTime: '09:00',
              roles: [
                { role: 'dealer', count: 2 },
                { role: 'other', customRole: 'Host', count: 1 },
              ],
            },
            {
              isTimeToBeAnnounced: true,
              tentativeDescription: 'Final table draw',
              roles: [{ role: 'dealer', count: 1 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [],
    compensation: {
      mode: 'shared',
    },
    questions: {
      items: [],
    },
    ...overrides,
  } as JobPosting;
}

function createConfirmedStaff(overrides: Partial<ConfirmedStaff> = {}): ConfirmedStaff {
  return {
    id: 'worklog-1',
    staffId: 'staff-1',
    staffName: 'Tester',
    role: 'dealer',
    date: '2026-04-01',
    status: 'scheduled',
    timeSlot: '09:00',
    ...overrides,
  };
}

describe('eventQRScope helpers', () => {
  it('builds dated QR scopes in date/time order and preserves slot metadata', () => {
    const scopes = buildEventQRScopes(createDatedPosting());

    expect(scopes).toEqual([
      {
        key: expect.stringContaining('2026-04-01::slot-a::09:00'),
        date: '2026-04-01',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00',
        timeLabel: '09:00',
        roleSummary: 'dealer, Host',
      },
      {
        key: expect.stringContaining(`2026-04-01::scope::${TBA_TIME_MARKER}`),
        date: '2026-04-01',
        assignmentGroupId: null,
        timeSlot: TBA_TIME_MARKER,
        timeLabel: 'TBD (Final table draw)',
        roleSummary: 'dealer',
      },
      {
        key: expect.stringContaining('2026-04-02::slot-b::18:00'),
        date: '2026-04-02',
        assignmentGroupId: 'slot-b',
        timeSlot: '18:00',
        timeLabel: '18:00',
        roleSummary: 'manager',
      },
    ]);
  });

  it('returns no scopes for non-dated postings', () => {
    const posting = createDatedPosting({
      schedule: {
        kind: 'fixed',
        daysPerWeek: 3,
        startTime: '18:00',
        requirements: [
          {
            date: null,
            timeSlots: [{ isTimeToBeAnnounced: false, roles: [{ role: 'dealer', count: 2 }] }],
          },
        ],
      },
    });

    expect(buildEventQRScopes(posting)).toEqual([]);
  });

  it('filters out slots without active confirmed staff after cancellation review', () => {
    const scopes = buildEventQRScopes(createDatedPosting(), [
      createConfirmedStaff({
        date: '2026-04-01',
        status: 'scheduled',
        workLog: {
          assignmentGroupId: 'slot-a',
          timeSlot: '09:00',
        } as ConfirmedStaff['workLog'],
      }),
      createConfirmedStaff({
        id: 'worklog-2',
        date: '2026-04-02',
        status: 'checked_in',
        timeSlot: '18:00',
        workLog: {
          assignmentGroupId: 'slot-b',
          timeSlot: '18:00',
        } as ConfirmedStaff['workLog'],
      }),
      createConfirmedStaff({
        id: 'worklog-3',
        date: '2026-04-01',
        status: 'cancelled',
        timeSlot: TBA_TIME_MARKER,
      }),
    ]);

    expect(scopes).toEqual([
      expect.objectContaining({
        assignmentGroupId: 'slot-a',
        date: '2026-04-01',
      }),
      expect.objectContaining({
        assignmentGroupId: 'slot-b',
        date: '2026-04-02',
      }),
    ]);
  });

  it('resolves only uniquely matching preferred scopes', () => {
    const scopes = buildEventQRScopes(createDatedPosting());

    expect(
      findPreferredEventQRScope(scopes, {
        eventDate: '2026-04-02',
        timeSlot: '18:00',
      })
    ).toEqual(
      expect.objectContaining({
        date: '2026-04-02',
        assignmentGroupId: 'slot-b',
        timeSlot: '18:00',
      })
    );

    expect(
      findPreferredEventQRScope(scopes, {
        eventDate: '2026-04-01',
      })
    ).toBeNull();
  });
});
