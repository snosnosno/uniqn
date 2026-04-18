import React from 'react';
import { render } from '@testing-library/react-native';
import { getRoleDisplayName } from '@/types/unified';
import { PostingCompensationContent, PostingScheduleContent, PostingSurfaceState } from '../shared';
import { FOCUSED_GROUP_DATE_HINT } from '../shared/postingSurfaceModel';

describe('Posting shared content', () => {
  it('renders grouped detail schedules with every time slot and role count', () => {
    const dealerLabel = getRoleDisplayName('dealer');
    const floorLabel = getRoleDisplayName('floor');

    const { getByText } = render(
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
      />
    );

    expect(getByText(/09:00/)).toBeTruthy();
    expect(getByText(/13:00/)).toBeTruthy();
    expect(getByText(`${dealerLabel} 1명 (1/1)`)).toBeTruthy();
    expect(getByText(`${dealerLabel} 1명 (0/1)`)).toBeTruthy();
    expect(getByText(`${floorLabel} 2명 (1/2)`)).toBeTruthy();
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
});
