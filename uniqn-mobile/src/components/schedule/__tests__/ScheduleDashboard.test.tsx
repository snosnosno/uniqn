/**
 * ScheduleDashboard — 접힘 상태 표시 규칙 가드
 *
 * 🔴 핵심 불변식: 접어도 **활성 필터와 미지급 건수는 계속 보인다.**
 * `unpaid` 축은 미지급 근무를 찾는 유일한 경로이고, 필터가 걸린 채로 접히면 사용자는
 * 리스트가 왜 비었는지 알 수 없다. 접기가 상태를 숨기면 그건 접기가 아니라 실종이다.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ScheduleDashboard } from '../ScheduleDashboard';

const stats = {
  upcomingSchedules: 2,
  confirmedSchedules: 1,
  completedSchedules: 5,
  completedWorkDays: 4,
  settledEarnings: 320000,
  estimatedEarnings: 80000,
};

function renderDashboard(props: Partial<React.ComponentProps<typeof ScheduleDashboard>> = {}) {
  return render(
    <ScheduleDashboard
      stats={stats}
      isLoading={false}
      collapsed={false}
      onToggle={jest.fn()}
      activeFilterLabel={null}
      unpaidCount={0}
      {...props}
    >
      <Text>필터자리</Text>
    </ScheduleDashboard>
  );
}

describe('ScheduleDashboard', () => {
  describe('펼친 상태', () => {
    it('통계와 필터를 모두 그린다', () => {
      const { queryByText } = renderDashboard();

      expect(queryByText('정산 완료')).not.toBeNull();
      expect(queryByText('필터자리')).not.toBeNull();
    });

    it('접기 버튼을 누르면 onToggle 이 호출된다', () => {
      const onToggle = jest.fn();
      const { getByTestId } = renderDashboard({ onToggle });

      fireEvent.press(getByTestId('schedule-dashboard-toggle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('접힌 상태', () => {
    it('통계와 필터를 감춘다', () => {
      const { queryByText } = renderDashboard({ collapsed: true });

      expect(queryByText('정산 완료')).toBeNull();
      expect(queryByText('필터자리')).toBeNull();
    });

    // 🔴 필터가 걸린 채로 접히면 리스트가 왜 비었는지 알 수 없다.
    it('활성 필터 라벨은 접어도 계속 보인다', () => {
      const { queryByText } = renderDashboard({ collapsed: true, activeFilterLabel: '미지급' });

      expect(queryByText('미지급')).not.toBeNull();
    });

    it("필터가 '전체'면 라벨 칩을 그리지 않는다", () => {
      const { queryByText } = renderDashboard({ collapsed: true, activeFilterLabel: null });

      expect(queryByText('이번 달 요약')).not.toBeNull();
      expect(queryByText('전체')).toBeNull();
    });

    // 🔴 미지급은 접힌 상태에서도 발견 가능해야 한다 — 이게 유일한 발견 경로다.
    it('미지급 건수는 접어도 계속 보인다', () => {
      const { queryByText } = renderDashboard({ collapsed: true, unpaidCount: 3 });

      expect(queryByText('미지급 3건')).not.toBeNull();
    });

    it('미지급이 0건이면 칩을 그리지 않는다', () => {
      const { queryByText } = renderDashboard({ collapsed: true, unpaidCount: 0 });

      expect(queryByText(/미지급 \d+건/)).toBeNull();
    });

    it('펼치기 버튼을 누르면 onToggle 이 호출된다', () => {
      const onToggle = jest.fn();
      const { getByTestId } = renderDashboard({ collapsed: true, onToggle });

      fireEvent.press(getByTestId('schedule-dashboard-toggle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  it('로딩 중에는 스켈레톤을 그리고 통계 수치는 내보내지 않는다', () => {
    const { queryByText } = renderDashboard({ isLoading: true, stats: undefined });

    expect(queryByText('정산 완료')).toBeNull();
  });
});
