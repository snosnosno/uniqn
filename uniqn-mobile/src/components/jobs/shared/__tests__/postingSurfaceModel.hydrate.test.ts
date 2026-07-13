import { buildPostingScheduleModel } from '@/components/jobs/shared/postingSurfaceModel';

/**
 * SP3 Task 4 — fixed/grouped 역할별 표시를 work_logs hydrate 맵 단일 소스로 정합.
 * 키 형식: `${date}__${slotKey}__${roleKey}`
 *  - date: dated/grouped 는 실제 YYYY-MM-DD, fixed 는 'FIXED_SCHEDULE'
 *  - slotKey: 타임 슬롯 startTime(HH:MM) / TBA='미정' / fixed 협의='NEGOTIABLE'
 *  - roleKey: role (other 는 `other:${customRole}`; customRole 없는 bare-other 도 `other:`)
 */
describe('buildPostingScheduleModel hydrate — fixed/grouped/dated 단일 소스 (SP3 T4)', () => {
  // --- fixed: 합성 슬롯 startTime 없음 + TBA 아님 → slotKey='NEGOTIABLE' ---
  it('fixed: hydrate 맵으로 역할별 filled 를 표시한다 (dead counter 아님)', () => {
    const fixedSource = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed',
        fixed: {
          daysPerWeek: 5,
          isStartTimeNegotiable: true,
          roles: [{ role: 'dealer', count: 2, filled: 0 }],
        },
        dateGroups: [],
        dateRequirements: [],
        workDate: '',
        timeSlot: '',
      },
    } as any;

    const filledCounts = new Map<string, number>([['FIXED_SCHEDULE__NEGOTIABLE__dealer', 1]]);
    const model = buildPostingScheduleModel(fixedSource, filledCounts);

    expect(model.variant).toBe('fixed');
    const role = (model as any).fixed.roles[0];
    expect(role.count).toBe(2);
    expect(role.filled).toBe(1);
    expect((model as any).fixed.filledCount).toBe(1);
  });

  // --- bare-other(customRole 없음): roleKey 가 'other:' (SQL _posting_role_key 정합) ---
  it('bare-other(customRole 없음): hydrate 키 other: 로 filled 를 표시한다 (회귀 가드)', () => {
    const fixedSource = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed',
        fixed: {
          daysPerWeek: 5,
          isStartTimeNegotiable: true,
          roles: [{ role: 'other', count: 1, filled: 0 }], // customRole 없음
        },
        dateGroups: [],
        dateRequirements: [],
        workDate: '',
        timeSlot: '',
      },
    } as any;

    // 서버 _posting_role_key('other', NULL) = 'other:' (콜론 포함). 옛 코드는 'other'(콜론 없음)로 miss → 0/N.
    const filledCounts = new Map<string, number>([['FIXED_SCHEDULE__NEGOTIABLE__other:', 1]]);
    const model = buildPostingScheduleModel(fixedSource, filledCounts);

    const role = (model as any).fixed.roles[0];
    expect(role.filled).toBe(1);
  });

  // --- grouped 날짜범위: 범위 내 날짜 합산, 범위 밖 제외 ---
  it('grouped: 섹션 날짜 범위 내 hydrate 엔트리를 slot+role 별로 합산한다', () => {
    const groupedSource = {
      workflow: { isFixed: false, usesGroupedDateRanges: true },
      scheduleDisplay: {
        variant: 'grouped_dates',
        fixed: undefined,
        dateGroups: [
          {
            id: 'g1',
            startDate: '2026-06-01',
            endDate: '2026-06-03',
            timeSlots: [
              {
                id: 's1',
                startTime: '19:00',
                roles: [{ role: 'dealer', count: 3, filled: 0 }],
              },
            ],
          },
        ],
        dateRequirements: [],
        workDate: '',
        timeSlot: '',
      },
    } as any;

    const filledCounts = new Map<string, number>([
      ['2026-06-01__19:00__dealer', 1],
      ['2026-06-02__19:00__dealer', 1],
      ['2026-06-05__19:00__dealer', 1], // 범위 밖(06-05) → 제외
    ]);
    const model = buildPostingScheduleModel(groupedSource, filledCounts);

    expect(model.variant).toBe('dated');
    expect((model as any).usesGroupedRanges).toBe(true);
    const role = (model as any).sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(3);
    expect(role.filled).toBe(2); // 06-01 + 06-02, 06-05 제외
    expect((model as any).sections[0].filledCount).toBe(2);
  });

  // --- dated 회귀: 정확한 날짜 키로 hydrate 유지 ---
  it('dated: 정확한 날짜 키로 hydrate 가 유지된다 (회귀)', () => {
    const datedSource = {
      workflow: { isFixed: false, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'dated_requirements',
        fixed: undefined,
        dateGroups: [],
        dateRequirements: [
          {
            date: '2026-06-10',
            timeSlots: [
              {
                id: 's1',
                startTime: '18:00',
                roles: [{ role: 'dealer', count: 2, filled: 0 }],
              },
            ],
          },
        ],
        workDate: '',
        timeSlot: '',
      },
    } as any;

    const filledCounts = new Map<string, number>([['2026-06-10__18:00__dealer', 2]]);
    const model = buildPostingScheduleModel(datedSource, filledCounts);

    expect(model.variant).toBe('dated');
    const role = (model as any).sections[0].timeSlots[0].roles[0];
    expect(role.filled).toBe(2);
    expect(role.isFilled).toBe(true);
  });

  // 슬롯 startTime 이 range 문자열("18:00~22:00")이어도 hydrate 키는 서버 _posting_slot_key 와 동일하게
  // 시작시간(18:00)으로 정규화돼야 매칭된다. (정규화 누락 시 0/N 으로 영원히 표시되는 회귀)
  it('dated: range startTime 슬롯도 시작시간으로 정규화해 hydrate 매칭한다', () => {
    const datedSource = {
      workflow: { isFixed: false, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'dated_requirements',
        fixed: undefined,
        dateGroups: [],
        dateRequirements: [
          {
            date: '2026-06-10',
            timeSlots: [
              {
                id: 's1',
                startTime: '18:00~22:00',
                roles: [{ role: 'dealer', count: 2, filled: 0 }],
              },
            ],
          },
        ],
        workDate: '',
        timeSlot: '',
      },
    } as any;

    const filledCounts = new Map<string, number>([['2026-06-10__18:00__dealer', 2]]);
    const model = buildPostingScheduleModel(datedSource, filledCounts);

    const role = (model as any).sections[0].timeSlots[0].roles[0];
    expect(role.filled).toBe(2);
    expect(role.isFilled).toBe(true);
  });

  // 협의(negotiable) 플래그가 켜져 있어도 startTime 참고값이 있으면 그 값으로 hydrate 조회해야 한다.
  // 확정 경로(facts.ts fixedAssignmentTimeSlot)·DB(_posting_slot_key)는 startTime 우선인데
  // 옛 표시 코드는 negotiable 우선('NEGOTIABLE')으로 조회해 미스매치 → 영원히 0/N 이던 회귀.
  it('fixed: 협의 플래그가 켜져도 startTime 이 있으면 그 값으로 hydrate 매칭한다 (확정·DB 규칙과 통일, 회귀 가드)', () => {
    const fixedSource = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed',
        fixed: {
          daysPerWeek: 5,
          startTime: '19:00',
          isStartTimeNegotiable: true,
          roles: [{ role: 'dealer', count: 3, filled: 0 }],
        },
        dateGroups: [],
        dateRequirements: [],
        workDate: '',
        timeSlot: '',
      },
    } as any;

    const filledCounts = new Map<string, number>([['FIXED_SCHEDULE__19:00__dealer', 1]]);
    const model = buildPostingScheduleModel(fixedSource, filledCounts);

    const role = (model as any).fixed.roles[0];
    expect(role.filled).toBe(1);
  });
});
