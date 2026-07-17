import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { getRoleDisplayName } from '@/types/unified';
import { PostingCompensationContent, PostingScheduleContent, PostingSurfaceState } from '../shared';
import { FOCUSED_GROUP_DATE_HINT } from '../shared/postingSurfaceModel';

// 좌석 기준 그룹 섹션 렌더 검증용 공용 fixture — detail/card 두 테스트가 동일 객체를 재사용해
// card 요약합(6)과 detail 일별합(3/3·0/3)이 같은 소스에서 나오는지 확인한다.
const GROUPED_SEAT_FILLED_COUNTS = new Map<string, number>([['2026-07-14__19:00__dealer', 3]]);
const groupedSeatScheduleDisplay = {
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
} as any;

describe('Posting shared content', () => {
  it('renders grouped detail schedules with every time slot and role count', () => {
    const dealerLabel = getRoleDisplayName('dealer');
    const floorLabel = getRoleDisplayName('floor');

    // 좌석 기준(Task 2·3): detail 은 그룹을 날짜별로 전개하고, 각 날짜 filled 는 그 날짜 키
    // (`date__slot__role`) hydrate 적중에서만 온다(범위 합산 아님). 03-31 09:00 dealer=1,
    // 04-01 13:00 floor=1 만 적중 → 나머지 날짜/슬롯은 0.
    const filledCounts = new Map<string, number>([
      ['2026-03-31__09:00__dealer', 1],
      ['2026-04-01__13:00__floor', 1],
    ]);

    const { getByText, getAllByText } = render(
      <PostingScheduleContent
        display="detail"
        workflow={{ isFixed: false, usesGroupedDateRanges: true }}
        scheduleDisplay={{
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
                  roles: [{ role: 'dealer', count: 1, filled: 1 }],
                },
                {
                  startTime: '13:00',
                  roles: [
                    { role: 'dealer', count: 1, filled: 0 },
                    { role: 'floor', count: 2, filled: 1 },
                  ],
                },
              ],
            },
          ],
        }}
        showFilledCount={true}
        filledCounts={filledCounts}
      />
    );

    // 2일 전개 — 각 시간대 라인은 날짜당 1회씩 총 2회 렌더된다.
    expect(getAllByText(/09:00/)).toHaveLength(2);
    expect(getAllByText(/13:00/)).toHaveLength(2);
    // 날짜별 좌석 카운트: 03-31 09:00 dealer 적중(1/1), 04-01 13:00 floor 적중(1/2).
    expect(getByText(`${dealerLabel} 1명 (1/1)`)).toBeTruthy();
    expect(getByText(`${floorLabel} 2명 (1/2)`)).toBeTruthy();
    // 미적중 좌석은 그 날짜에서 0 — dealer (0/1) 은 3개 슬롯(03-31 13:00, 04-01 09:00·13:00).
    expect(getAllByText(`${dealerLabel} 1명 (0/1)`)).toHaveLength(3);
    expect(getByText(`${floorLabel} 2명 (0/2)`)).toBeTruthy();
  });

  it('shows the focused group hint only on cards', () => {
    const card = render(
      <PostingScheduleContent
        display="card"
        workflow={{ isFixed: false, usesGroupedDateRanges: false }}
        scheduleDisplay={{
          variant: 'dated_requirements',
          workDate: '2026-04-02',
          timeSlot: '09:00',
          fixed: undefined,
          dateRequirements: [
            {
              date: '2026-04-02',
              timeSlots: [{ startTime: '09:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
            },
          ],
          dateGroups: [],
        }}
        displayContext={{ focusedDate: '2026-04-02', wasGroupedRange: true }}
      />
    );
    expect(card.getByText(FOCUSED_GROUP_DATE_HINT)).toBeTruthy();

    const detail = render(
      <PostingScheduleContent
        display="detail"
        workflow={{ isFixed: false, usesGroupedDateRanges: false }}
        scheduleDisplay={{
          variant: 'dated_requirements',
          workDate: '2026-04-02',
          timeSlot: '09:00',
          fixed: undefined,
          dateRequirements: [
            {
              date: '2026-04-02',
              timeSlots: [{ startTime: '09:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
            },
          ],
          dateGroups: [],
        }}
        displayContext={{ focusedDate: '2026-04-02', wasGroupedRange: true }}
      />
    );
    expect(detail.queryByText(FOCUSED_GROUP_DATE_HINT)).toBeNull();
  });

  it('renders shared compensation rows in detail and card modes', () => {
    const dealerLabel = getRoleDisplayName('dealer');
    const floorLabel = getRoleDisplayName('floor');

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
            roleLabel: dealerLabel,
            salary: { type: 'daily' as const, amount: 150000 },
            text: '일급 150,000원',
          },
          {
            key: 'floor',
            role: 'floor',
            roleLabel: floorLabel,
            salary: { type: 'daily' as const, amount: 170000 },
            text: '일급 170,000원',
          },
        ],
        previewRows: [
          {
            key: 'dealer',
            role: 'dealer',
            roleLabel: dealerLabel,
            salary: { type: 'daily' as const, amount: 150000 },
            text: '일급 150,000원',
          },
        ],
        overflowCount: 1,
        useSameSalary: false,
        hasRoleSpecificSalary: true,
      },
    };

    const detail = render(<PostingCompensationContent display="detail" {...source} />);
    expect(detail.getByText(dealerLabel)).toBeTruthy();
    expect(detail.getByText('일급 150,000원')).toBeTruthy();
    expect(detail.getByText(floorLabel)).toBeTruthy();
    expect(detail.getByText('일급 170,000원')).toBeTruthy();

    const card = render(<PostingCompensationContent display="card" {...source} />);
    expect(card.getByText(`${dealerLabel}: 일급 150,000원`)).toBeTruthy();
    expect(card.queryByText('식비 10,000원 · 세금 3.3%')).toBeNull();
    expect(card.getByText('+1개 역할 급여 더 있음')).toBeTruthy();
  });

  it('renders the shared partial-data state banner', () => {
    const { getByText } = render(
      <PostingSurfaceState
        mode="partial"
        scope="list"
        title="일부 정보만 표시 중입니다"
        message="최신 공고 상태를 모두 불러오지 못했습니다."
      />
    );

    expect(getByText('일부 정보만 표시 중입니다')).toBeTruthy();
    expect(getByText('최신 공고 상태를 모두 불러오지 못했습니다.')).toBeTruthy();
  });

  it('그룹 섹션 detail 렌더는 날짜별 카운트를 표시한다 (14일 3/3, 15일 0/3)', () => {
    render(
      <PostingScheduleContent
        display="detail"
        filledCounts={GROUPED_SEAT_FILLED_COUNTS}
        workflow={{ isFixed: false, usesGroupedDateRanges: true } as any}
        scheduleDisplay={groupedSeatScheduleDisplay}
      />
    );
    // 일별 라인 2개 — 요약 6/3 단일 표기가 아니라 날짜별 3/3, 0/3
    expect(screen.getByText(/딜러 3명 \(3\/3\)/)).toBeTruthy();
    expect(screen.getByText(/딜러 3명 \(0\/3\)/)).toBeTruthy();
  });

  it('그룹 섹션 card 렌더는 요약 좌석합을 표시한다 (딜러 6명 (3/6))', () => {
    render(
      <PostingScheduleContent
        display="card"
        filledCounts={GROUPED_SEAT_FILLED_COUNTS}
        workflow={{ isFixed: false, usesGroupedDateRanges: true } as any}
        scheduleDisplay={groupedSeatScheduleDisplay}
      />
    );
    expect(screen.getByText(/딜러 6명 \(3\/6\)/)).toBeTruthy();
  });
});
