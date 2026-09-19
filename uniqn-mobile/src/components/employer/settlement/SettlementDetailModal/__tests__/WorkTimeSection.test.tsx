import React from 'react';
import { render } from '@testing-library/react-native';
import { WorkTimeSection } from '../WorkTimeSection';

describe('WorkTimeSection', () => {
  const scheduledStart = new Date('2026-03-30T09:00:00');
  const scheduledEnd = new Date('2026-03-30T18:00:00');
  // 심야 근무: 18:00 출근 / 익일 02:00 퇴근 (자정 넘김)
  const overnightStart = new Date('2026-03-30T18:00:00');
  const overnightEnd = new Date('2026-03-31T02:00:00');

  describe('출처 배지 (QR / 수정됨)', () => {
    it('QR 로 찍힌 퇴근 시각에 ✓QR 을 붙인다', () => {
      const { getByText } = render(
        <WorkTimeSection
          startTime={scheduledStart}
          endTime={scheduledEnd}
          hoursWorked={9}
          endProvenance="qr"
        />
      );

      expect(getByText('✓QR')).toBeTruthy();
    });

    it('수정된 시각에는 수정됨을 붙인다', () => {
      const { getByText } = render(
        <WorkTimeSection
          startTime={scheduledStart}
          endTime={scheduledEnd}
          hoursWorked={9}
          startProvenance="edited"
        />
      );

      expect(getByText('수정됨')).toBeTruthy();
    });

    it('근거가 없으면 아무 배지도 그리지 않는다', () => {
      const { queryByText } = render(
        <WorkTimeSection
          startTime={scheduledStart}
          endTime={scheduledEnd}
          hoursWorked={9}
          startProvenance="unknown"
          endProvenance="unknown"
        />
      );

      expect(queryByText('✓QR')).toBeNull();
      expect(queryByText('수정됨')).toBeNull();
    });

    // 예정시간에 "QR 로 찍힘" 을 붙이면 명백한 거짓말이 된다.
    it('실제 기록이 없는 예정시간에는 출처를 붙이지 않는다', () => {
      const { queryByText } = render(
        <WorkTimeSection
          startTime={null}
          endTime={null}
          scheduledStartTime={scheduledStart}
          scheduledEndTime={scheduledEnd}
          endProvenance="qr"
        />
      );

      expect(queryByText('✓QR')).toBeNull();
    });
  });

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

  it('shows the 익일 badge when checkout is on the next calendar day (18:00~익일 02:00)', () => {
    const { getByText } = render(
      <WorkTimeSection startTime={overnightStart} endTime={overnightEnd} hoursWorked={8} />
    );

    // 자정을 넘긴 심야 근무는 종료 라벨 옆에 "익일" 배지가 표시된다
    expect(getByText('익일')).toBeTruthy();
  });

  it('does not show the 익일 badge for same-day work (09:00~17:00)', () => {
    const dayStart = new Date('2026-03-30T09:00:00');
    const dayEnd = new Date('2026-03-30T17:00:00');
    const { queryByText } = render(
      <WorkTimeSection startTime={dayStart} endTime={dayEnd} hoursWorked={8} />
    );

    // 같은 날 근무는 "익일" 배지가 없어야 한다
    expect(queryByText('익일')).toBeNull();
  });
});
