import { buildPostingScheduleModel } from '@/components/jobs/shared/postingSurfaceModel';

const datedSource = {
  workflow: { isFixed: false, usesGroupedDateRanges: false },
  scheduleDisplay: {
    fixed: undefined,
    dateGroups: [],
    dateRequirements: [
      {
        date: '2026-05-23',
        timeSlots: [
          {
            id: 's1',
            isTimeToBeAnnounced: true,
            roles: [{ id: 'r1', role: 'dealer', count: 1, filled: 0 }],
          },
        ],
      },
    ],
  },
} as any;

describe('buildPostingScheduleModel filled hydrate (H0)', () => {
  it('filledCounts 맵으로 role.filled 를 덮어쓴다 (dead counter 0 무시)', () => {
    const filledCounts = new Map<string, number>([['2026-05-23__미정__dealer', 1]]);
    const model = buildPostingScheduleModel(datedSource, filledCounts);
    expect(model.variant).toBe('dated');
    const role = (model as any).sections[0].timeSlots[0].roles[0];
    expect(role.filled).toBe(1);
    expect(role.isFilled).toBe(true);
  });

  it('맵 미적중 시 0 유지', () => {
    const model = buildPostingScheduleModel(datedSource, new Map());
    expect((model as any).sections[0].timeSlots[0].roles[0].filled).toBe(0);
  });
});
