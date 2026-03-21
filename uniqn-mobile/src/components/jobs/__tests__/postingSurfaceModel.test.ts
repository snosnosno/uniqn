import {
  buildPostingCompensationModel,
  buildPostingScheduleModel,
  getPostingStatusMeta,
  shouldShowUrgentBadge,
} from '../shared';

describe('postingSurfaceModel', () => {
  it('keeps grouped schedules with every time slot and role stat', () => {
    const schedule = buildPostingScheduleModel({
      workflow: { isFixed: false, usesGroupedDateRanges: true },
      scheduleDisplay: {
        variant: 'grouped_dates',
        workDate: '2026-03-31',
        timeSlot: '',
        fixed: undefined,
        dateRequirements: [],
        dateGroups: [
          {
            id: 'group-1',
            startDate: '2026-03-31',
            endDate: '2026-04-01',
            timeSlots: [
              {
                startTime: '09:00',
                roles: [{ role: 'dealer', count: 1, filled: 0 }],
              },
              {
                startTime: '13:00',
                roles: [
                  { role: 'dealer', count: 1, filled: 1 },
                  { role: 'floor', count: 1, filled: 0 },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(schedule.variant).toBe('dated');
    if (schedule.variant !== 'dated') {
      throw new Error('Expected dated schedule');
    }

    expect(schedule.sections).toHaveLength(1);
    expect(schedule.sections[0]?.timeSlots.map((slot) => slot.timeLabel)).toEqual([
      '09:00',
      '13:00',
    ]);
    expect(schedule.sections[0]?.timeSlots[1]?.roles[0]?.filled).toBe(1);
    expect(schedule.sections[0]?.timeSlots[1]?.roles[0]?.isFilled).toBe(true);
  });

  it('uses preview salary rows on cards and full rows on detail', () => {
    const source = {
      defaultSalary: { type: 'daily' as const, amount: 150000 },
      allowanceLabels: ['식비 10,000원'],
      taxLabel: '세금 3.3%',
      salaryDisplay: {
        defaultSalary: { type: 'daily' as const, amount: 150000 },
        rows: [
          {
            key: 'dealer',
            role: 'dealer',
            roleLabel: '딜러',
            salary: { type: 'daily' as const, amount: 150000 },
            text: '일급 150,000원',
          },
          {
            key: 'floor',
            role: 'floor',
            roleLabel: '플로어',
            salary: { type: 'daily' as const, amount: 170000 },
            text: '일급 170,000원',
          },
        ],
        previewRows: [
          {
            key: 'dealer',
            role: 'dealer',
            roleLabel: '딜러',
            salary: { type: 'daily' as const, amount: 150000 },
            text: '일급 150,000원',
          },
        ],
        overflowCount: 1,
        useSameSalary: false,
        hasRoleSpecificSalary: true,
      },
    };

    const card = buildPostingCompensationModel(source, { display: 'card' });
    const detail = buildPostingCompensationModel(source, { display: 'detail' });

    expect(card.rows).toHaveLength(1);
    expect(card.overflowCount).toBe(1);
    expect(detail.rows).toHaveLength(2);
    expect(detail.overflowCount).toBe(0);
  });

  it('normalizes urgent and status display rules', () => {
    expect(shouldShowUrgentBadge('urgent', true)).toBe(false);
    expect(shouldShowUrgentBadge('tournament', true)).toBe(true);
    expect(getPostingStatusMeta('cancelled')).toEqual({
      label: '취소됨',
      variant: 'error',
    });
  });
});
