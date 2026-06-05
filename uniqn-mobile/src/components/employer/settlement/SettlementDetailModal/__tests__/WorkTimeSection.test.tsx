import React from 'react';
import { render } from '@testing-library/react-native';
import { WorkTimeSection } from '../WorkTimeSection';

describe('WorkTimeSection', () => {
  const scheduledStart = new Date('2026-03-30T09:00:00');
  const scheduledEnd = new Date('2026-03-30T18:00:00');

  it('shows the scheduled time with a 예정 badge when there is no actual record', () => {
    const { getByText } = render(
      <WorkTimeSection
        startTime={null}
        endTime={null}
        scheduledStartTime={scheduledStart}
        scheduledEndTime={scheduledEnd}
      />
    );

    expect(getByText('예정')).toBeTruthy();
    expect(getByText('시작')).toBeTruthy();
    expect(getByText('종료')).toBeTruthy();
    expect(getByText(/아직 출퇴근 기록 전이에요/)).toBeTruthy();
  });

  it('shows actual labels (출근/퇴근) without 예정 when both actual times exist', () => {
    const { getByText, queryByText } = render(
      <WorkTimeSection
        startTime={scheduledStart}
        endTime={scheduledEnd}
        scheduledStartTime={scheduledStart}
        scheduledEndTime={scheduledEnd}
        hoursWorked={9}
      />
    );

    expect(getByText('출근')).toBeTruthy();
    expect(getByText('퇴근')).toBeTruthy();
    expect(queryByText('예정')).toBeNull();
    expect(queryByText(/아직 출퇴근 기록 전이에요/)).toBeNull();
  });

  it('does not mislabel as 예정 when checked in but not yet checked out', () => {
    const { getByText, queryByText } = render(
      <WorkTimeSection
        startTime={scheduledStart}
        endTime={null}
        scheduledStartTime={scheduledStart}
        scheduledEndTime={scheduledEnd}
      />
    );

    // 출근은 실제 기록, 종료는 예정 폴백 — 전체를 "예정"으로 오인하지 않는다
    expect(getByText('출근')).toBeTruthy();
    expect(getByText('종료')).toBeTruthy();
    expect(queryByText('예정')).toBeNull();
    expect(queryByText(/아직 출퇴근 기록 전이에요/)).toBeNull();
  });

  it('shows the empty state when there is neither actual nor scheduled time', () => {
    const { getByText } = render(<WorkTimeSection startTime={null} endTime={null} />);

    expect(getByText('근무 시간 정보가 없어요')).toBeTruthy();
  });
});
