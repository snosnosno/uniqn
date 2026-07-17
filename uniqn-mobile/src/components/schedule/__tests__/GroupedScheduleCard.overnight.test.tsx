import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupedScheduleCard } from '../GroupedScheduleCard';
import type { GroupedScheduleEvent } from '@/types';

// WorkTimeDisplay(SSOT)는 목킹하지 않는다 — "익일" 판정을 실제 로직으로 검증해야 한다.
// group 은 timeSlot 원문 문자열과 날짜 소스(dateRange.start)만으로 구성한다.
describe('GroupedScheduleCard — 심야(익일) 시간 표시', () => {
  it('자정을 넘기는 18:00 - 02:00 근무는 종료 시각에 "익일" 라벨을 병기한다', () => {
    const group = {
      id: 'grouped-overnight-1',
      type: 'applied',
      jobPostingId: 'jp-overnight',
      jobPostingName: '심야 홀덤펍',
      location: '',
      dateRange: {
        start: '2026-07-17',
        end: '2026-07-17',
        dates: ['2026-07-17'],
        totalDays: 1,
        isConsecutive: true,
      },
      roles: ['딜러'],
      timeSlot: '18:00 - 02:00',
      dateStatuses: [],
      originalEvents: [],
    } as unknown as GroupedScheduleEvent;

    const { getByText, queryByText } = render(<GroupedScheduleCard group={group} />);

    // SSOT 경유 라벨: 종료가 익일이면 "익일"을 병기(엔대시 "–").
    expect(getByText('18:00 – 익일 02:00')).toBeTruthy();
    // 원문 pass-through(하이픈 "-")는 더 이상 노출되지 않는다.
    expect(queryByText('18:00 - 02:00')).toBeNull();
  });

  it('파싱 불가한 timeSlot 은 원문을 그대로 표시한다(빈칸 방지)', () => {
    const group = {
      id: 'grouped-unparseable-1',
      type: 'applied',
      jobPostingId: 'jp-x',
      jobPostingName: '협의 공고',
      location: '',
      dateRange: {
        start: '2026-07-17',
        end: '2026-07-17',
        dates: ['2026-07-17'],
        totalDays: 1,
        isConsecutive: true,
      },
      roles: ['딜러'],
      timeSlot: '협의',
      dateStatuses: [],
      originalEvents: [],
    } as unknown as GroupedScheduleEvent;

    const { getByText } = render(<GroupedScheduleCard group={group} />);

    expect(getByText('협의')).toBeTruthy();
  });
});
