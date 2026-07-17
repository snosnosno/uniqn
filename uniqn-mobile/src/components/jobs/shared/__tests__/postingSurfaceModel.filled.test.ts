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

const groupedSource = {
  workflow: { isFixed: false, usesGroupedDateRanges: true },
  scheduleDisplay: {
    fixed: undefined,
    dateRequirements: [],
    dateGroups: [
      {
        id: 'g1',
        startDate: '2026-07-14',
        endDate: '2026-07-15',
        timeSlots: [
          {
            id: 's1',
            startTime: '19:00',
            isTimeToBeAnnounced: false,
            roles: [{ id: 'r1', role: 'dealer', count: 3, filled: 0 }],
          },
        ],
      },
    ],
  },
} as any;

describe('buildPostingScheduleModel 그룹 날짜별 전개 (좌석 기준)', () => {
  it('그룹 섹션을 days 로 전개하고 일별 filled 를 각 날짜 키로 hydrate 한다', () => {
    const filledCounts = new Map<string, number>([
      ['2026-07-14__19:00__dealer', 3], // 14일 3명 확정
      // 15일은 0명
    ]);
    const model = buildPostingScheduleModel(groupedSource, filledCounts);
    expect(model.variant).toBe('dated');
    const section = (model as any).sections[0];

    // 일별 전개: 2일
    expect(section.days).toHaveLength(2);
    expect(section.days[0].date).toBe('2026-07-14');
    expect(section.days[0].timeSlots[0].roles[0]).toMatchObject({
      count: 3,
      filled: 3,
      isFilled: true,
    });
    expect(section.days[1].date).toBe('2026-07-15');
    expect(section.days[1].timeSlots[0].roles[0]).toMatchObject({
      count: 3,
      filled: 0,
      isFilled: false,
    });

    // 요약(접힘 표시용): count = 하루치3 × 2일 = 6, filled = 3+0
    expect(section.timeSlots[0].roles[0]).toMatchObject({
      count: 6,
      filled: 3,
      isFilled: false,
    });
    expect(section.totalCount).toBe(6);
    expect(section.filledCount).toBe(3);
  });

  it('비그룹 단일날짜 섹션에는 days 가 없다', () => {
    const model = buildPostingScheduleModel(datedSource, new Map());
    expect((model as any).sections[0].days).toBeUndefined();
  });
});
