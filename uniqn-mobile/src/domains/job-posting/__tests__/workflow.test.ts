import type { JobPosting } from '@/types';
import {
  buildPostingFacts,
  focusPostingCardToDate,
  matchesPostingDate,
  projectPostingCard,
  projectPostingDetail,
  projectPostingManagement,
  selectPostingApplicationEligibility,
  selectPostingRoleAvailability,
  selectPostingScheduleDisplay,
  selectPostingWorkflow,
} from '@/domains/job-posting';

function createBasePosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: 'Workflow test posting',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2025-01-15',
    workDates: ['2025-01-15'],
    totalPositions: 2,
    filledPositions: 0,
    location: {
      name: 'Seoul',
      district: 'Gangnam',
      detailedAddress: '101',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2025-01-15',
      allDates: ['2025-01-15'],
      requirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '09:00',
              roles: [{ id: 'dealer-1', role: 'dealer', count: 2, filled: 0 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
    },
    questions: {
      items: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('job-posting workflow selectors', () => {
  it('marks fixed postings as unsupported release workflow', () => {
    const posting = createBasePosting({
      postingType: 'fixed',
      totalPositions: 3,
      filledPositions: 2,
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '19:00',
        roleRequirements: [
          { role: 'dealer', count: 2, filled: 2 },
          { role: 'floor', count: 1, filled: 0 },
        ],
      },
      roleCatalog: [
        { role: 'dealer', salary: { type: 'hourly', amount: 12000 } },
        { role: 'floor', salary: { type: 'daily', amount: 150000 } },
      ],
    });

    const workflow = selectPostingWorkflow(posting);
    const roleAvailability = selectPostingRoleAvailability(posting);
    const application = selectPostingApplicationEligibility(posting);
    const scheduleDisplay = selectPostingScheduleDisplay(posting);

    expect(workflow).toMatchObject({
      isFixed: true,
      isTournament: false,
      isUrgent: false,
      recruitmentType: 'fixed',
    });
    expect(roleAvailability.availableItems.map((item) => item.role)).toEqual(['floor']);
    expect(application).toMatchObject({
      canApply: false,
      reason: 'unsupported_workflow',
      selectionMode: 'fixed_role',
      requiresRoleSelection: true,
      requiresAssignmentSelection: false,
      fixedAssignmentTimeSlot: '19:00',
    });
    expect(scheduleDisplay).toMatchObject({
      variant: 'fixed',
      fixed: expect.objectContaining({
        daysPerWeek: 5,
        startTime: '19:00',
      }),
    });
  });

  it('keeps tournament grouping consistent across facts and projections', () => {
    const posting = createBasePosting({
      postingType: 'tournament',
      totalPositions: 4,
      schedule: {
        kind: 'dated',
        primaryDate: '2025-02-01',
        allDates: ['2025-02-01', '2025-02-02'],
        requirements: [
          {
            date: '2025-02-01',
            isGrouped: true,
            timeSlots: [
              {
                id: 'slot-1',
                startTime: '10:00',
                roles: [{ id: 'dealer-1', role: 'dealer', count: 2, filled: 1 }],
              },
            ],
          },
          {
            date: '2025-02-02',
            isGrouped: true,
            timeSlots: [
              {
                id: 'slot-2',
                startTime: '10:00',
                roles: [{ id: 'dealer-2', role: 'dealer', count: 2, filled: 0 }],
              },
            ],
          },
        ],
      },
    });

    const facts = buildPostingFacts(posting);
    const card = projectPostingCard(facts);
    const detail = projectPostingDetail(facts);
    const management = projectPostingManagement(facts);

    expect(facts.workflow.usesGroupedDateRanges).toBe(true);
    expect(facts.schedule.display.variant).toBe('grouped_dates');
    expect(facts.schedule.display.dateGroups).toHaveLength(1);
    expect(card.workflow.isTournament).toBe(true);
    expect(card.scheduleDisplay.variant).toBe('grouped_dates');
    expect(detail.scheduleDisplay.dateGroups).toHaveLength(1);
    expect(management.scheduleDisplay.dateGroups).toHaveLength(1);
    expect(card.applicationEligibility.selectionMode).toBe('dated_assignment');
    expect(detail.applicationEligibility.selectionMode).toBe('dated_assignment');
  });

  it('marks urgent postings without changing dated application flow', () => {
    const posting = createBasePosting({
      postingType: 'urgent',
      totalPositions: 1,
      filledPositions: 1,
      questions: {
        items: [{ id: 'q-1', question: 'Can you start now?', type: 'text', required: true }],
      },
    });

    const facts = buildPostingFacts(posting);

    expect(facts.workflow).toMatchObject({
      isUrgent: true,
      isFixed: false,
      isTournament: false,
    });
    expect(facts.schedule.display.variant).toBe('dated_requirements');
    expect(facts.application).toMatchObject({
      canApply: false,
      reason: 'posting_full',
      selectionMode: 'dated_assignment',
      requiresPreQuestions: true,
    });
    expect(facts.compensation.display.useSameSalary).toBe(true);
  });

  it('treats grouped urgent postings like grouped dated displays', () => {
    const posting = createBasePosting({
      postingType: 'urgent',
      totalPositions: 4,
      schedule: {
        kind: 'dated',
        primaryDate: '2025-02-01',
        allDates: ['2025-02-01', '2025-02-02'],
        requirements: [
          {
            date: '2025-02-01',
            isGrouped: true,
            timeSlots: [
              {
                id: 'slot-1',
                startTime: '10:00',
                roles: [{ id: 'dealer-1', role: 'dealer', count: 2, filled: 1 }],
              },
            ],
          },
          {
            date: '2025-02-02',
            isGrouped: true,
            timeSlots: [
              {
                id: 'slot-2',
                startTime: '10:00',
                roles: [{ id: 'dealer-2', role: 'dealer', count: 2, filled: 0 }],
              },
            ],
          },
        ],
      },
    });

    const facts = buildPostingFacts(posting);

    expect(facts.workflow).toMatchObject({
      isUrgent: true,
      isTournament: false,
      usesGroupedDateRanges: true,
    });
    expect(facts.schedule.display.variant).toBe('grouped_dates');
    expect(facts.schedule.display.dateGroups).toHaveLength(1);
    expect(facts.application.selectionMode).toBe('dated_assignment');
  });

  it('focuses grouped cards to the selected date without changing canonical workDate', () => {
    const posting = createBasePosting({
      postingType: 'regular',
      workDate: '2025-02-01',
      workDates: ['2025-02-01', '2025-02-02'],
      schedule: {
        kind: 'dated',
        primaryDate: '2025-02-01',
        allDates: ['2025-02-01', '2025-02-02'],
        requirements: [
          {
            date: '2025-02-01',
            isGrouped: true,
            timeSlots: [
              {
                id: 'slot-1',
                startTime: '10:00',
                roles: [{ id: 'dealer-1', role: 'dealer', count: 2, filled: 1 }],
              },
            ],
          },
          {
            date: '2025-02-02',
            isGrouped: true,
            timeSlots: [
              {
                id: 'slot-2',
                startTime: '09:00',
                roles: [{ id: 'dealer-2', role: 'dealer', count: 2, filled: 0 }],
              },
            ],
          },
        ],
      },
    });

    const focused = focusPostingCardToDate(
      projectPostingCard(buildPostingFacts(posting)),
      '2025-02-02'
    );

    expect(matchesPostingDate(focused, '2025-02-02')).toBe(true);
    expect(focused.workDate).toBe('2025-02-01');
    expect(focused.workflow.usesGroupedDateRanges).toBe(false);
    expect(focused.scheduleDisplay.variant).toBe('dated_requirements');
    expect(focused.scheduleDisplay.dateGroups).toEqual([]);
    expect(focused.dateRequirements.map((requirement) => requirement.date)).toEqual(['2025-02-02']);
    expect(focused.displayContext).toEqual({
      focusedDate: '2025-02-02',
      wasGroupedRange: true,
    });
  });

  it('keeps ungrouped cards focusable and returns original cards for unsupported cases', () => {
    const card = projectPostingCard(
      buildPostingFacts(
        createBasePosting({
          workDate: '2025-03-01',
          workDates: ['2025-03-01', '2025-03-02'],
          schedule: {
            kind: 'dated',
            primaryDate: '2025-03-01',
            allDates: ['2025-03-01', '2025-03-02'],
            requirements: [
              {
                date: '2025-03-01',
                timeSlots: [
                  {
                    id: 'slot-1',
                    startTime: '11:00',
                    roles: [{ id: 'dealer-1', role: 'dealer', count: 1, filled: 0 }],
                  },
                ],
              },
              {
                date: '2025-03-02',
                timeSlots: [
                  {
                    id: 'slot-2',
                    startTime: '12:00',
                    roles: [{ id: 'dealer-2', role: 'dealer', count: 1, filled: 0 }],
                  },
                ],
              },
            ],
          },
        })
      )
    );
    const focused = focusPostingCardToDate(card, '2025-03-02');
    const fixedCard = projectPostingCard(
      buildPostingFacts(
        createBasePosting({
          postingType: 'fixed',
          schedule: {
            kind: 'fixed',
            daysPerWeek: 5,
            startTime: '19:00',
            roleRequirements: [{ role: 'dealer', count: 2, filled: 0 }],
          },
        })
      )
    );
    const legacyCard = {
      ...card,
      scheduleDisplay: {
        ...card.scheduleDisplay,
        variant: 'legacy' as const,
        dateRequirements: [],
        dateGroups: [],
      },
      dateRequirements: [],
    };

    expect(focused).not.toBe(card);
    expect(focused.displayContext).toEqual({
      focusedDate: '2025-03-02',
      wasGroupedRange: false,
    });
    expect(focusPostingCardToDate(card, '2025-03-05')).toBe(card);
    expect(focusPostingCardToDate(fixedCard, '2025-03-02')).toBe(fixedCard);
    expect(focusPostingCardToDate(legacyCard, '2025-03-02')).toBe(legacyCard);
  });
});
