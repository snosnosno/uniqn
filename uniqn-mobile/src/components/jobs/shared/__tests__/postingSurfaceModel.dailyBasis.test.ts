import {
  buildPostingScheduleModel,
  computeSeatTotals,
} from '@/components/jobs/shared/postingSurfaceModel';

/**
 * 하루 기준 표시 통일(C안) — 그룹 요약의 분모=하루 요구, 분자=날짜별 확정 max.
 * 근거 스펙: docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md §2.2·§5
 */
function makeGroupedSource(days: { date: string; filled: number }[], perDayCount = 5) {
  const startDate = days[0]!.date;
  const endDate = days[days.length - 1]!.date;
  const source = {
    workflow: { isFixed: false, usesGroupedDateRanges: true },
    scheduleDisplay: {
      variant: 'grouped_dates',
      fixed: undefined,
      dateGroups: [
        {
          id: 'g1',
          startDate,
          endDate,
          timeSlots: [
            {
              id: 's1',
              startTime: '18:00',
              roles: [{ role: 'dealer', count: perDayCount, filled: 0 }],
            },
          ],
        },
      ],
      dateRequirements: [],
      workDate: '',
      timeSlot: '',
    },
  } as any;
  const filledCounts = new Map<string, number>(
    days.filter((d) => d.filled > 0).map((d) => [`${d.date}__18:00__dealer`, d.filled])
  );
  return { source, filledCounts };
}

describe('그룹 요약 하루 기준 (분자=max)', () => {
  it('불균등(2,1): 요약 분모=하루 요구 5, 분자=max 2 — 곱셈 없음', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 2 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const role = model.sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(5); // 현행 10(=5×2)이므로 RED
    expect(role.filled).toBe(2); // 현행 3(=합)이므로 RED
    expect(role.isFilled).toBe(false);
  });

  it('한 날만 만석(5,1): 요약 (5/5) 마감 — 통지원 불가를 정직하게 표시', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 5 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const role = model.sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(5);
    expect(role.filled).toBe(5);
    expect(role.isFilled).toBe(true);
  });

  it('불변식: 요약 분자 == max(일별 분자), 자리 총계 == Σ(일별)', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 3 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const section = model.sections[0];
    const dailyFilled = section.days.map((day: any) => day.timeSlots[0].roles[0].filled as number);
    expect(section.timeSlots[0].roles[0].filled).toBe(Math.max(...dailyFilled));
    expect(section.filledCount).toBe(dailyFilled.reduce((a: number, b: number) => a + b, 0));
    expect(section.totalCount).toBe(5 * section.dayCount); // 자리 총계 분모 = Σ(일별 분모)
  });

  it('dayCount==1 회귀: 요약 == 일별 (기존 표시 불변)', () => {
    const { source, filledCounts } = makeGroupedSource([{ date: '2026-08-22', filled: 2 }]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const role = model.sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(5);
    expect(role.filled).toBe(2);
  });

  it('그룹 라벨은 한 행 — 날짜 범위와 일수가 같은 행에 표기된다', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 0 },
      { date: '2026-08-23', filled: 0 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    expect(model.sections[0].label).not.toContain('\n'); // 현행 "\n    (2일)" 이므로 RED
    expect(model.sections[0].label).toContain('· 2일');
  });

  it('요약·일별 타임슬롯이 시작시간 순으로 정렬된다 (10:00, 11:00, 10:30 입력)', () => {
    const source = {
      workflow: { isFixed: false, usesGroupedDateRanges: true },
      scheduleDisplay: {
        variant: 'grouped_dates',
        fixed: undefined,
        dateGroups: [
          {
            id: 'g1',
            startDate: '2026-09-10',
            endDate: '2026-09-11',
            timeSlots: [
              { id: 'a', startTime: '10:00', roles: [{ role: 'dealer', count: 5, filled: 0 }] },
              { id: 'b', startTime: '11:00', roles: [{ role: 'dealer', count: 5, filled: 0 }] },
              { id: 'c', startTime: '10:30', roles: [{ role: 'dealer', count: 1, filled: 0 }] },
            ],
          },
        ],
        dateRequirements: [],
        workDate: '',
        timeSlot: '',
      },
    } as any;
    const model = buildPostingScheduleModel(source, undefined) as any;
    expect(model.sections[0].timeSlots.map((s: any) => s.timeLabel)).toEqual([
      '10:00',
      '10:30',
      '11:00',
    ]);
    expect(model.sections[0].days[0].timeSlots.map((s: any) => s.timeLabel)).toEqual([
      '10:00',
      '10:30',
      '11:00',
    ]);
  });
});

describe('computeSeatTotals — 구인자 자리 총계 병기', () => {
  it('그룹(2일, 5명/일, 확정 2+1): 자리 3/10', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 2 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts);
    expect(computeSeatTotals(model)).toEqual({ filled: 3, total: 10 });
  });

  it('한 날만 만석(5,1): 자리 6/10 — 요약 (5/5) 마감과 함께 8/23 공백이 드러난다', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 5 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts);
    expect(computeSeatTotals(model)).toEqual({ filled: 6, total: 10 });
  });

  it('단일 날짜(dayCount==1)뿐이면 null — 요약과 동일해 병기 생략', () => {
    const { source, filledCounts } = makeGroupedSource([{ date: '2026-08-22', filled: 2 }]);
    const model = buildPostingScheduleModel(source, filledCounts);
    expect(computeSeatTotals(model)).toBeNull();
  });
});
