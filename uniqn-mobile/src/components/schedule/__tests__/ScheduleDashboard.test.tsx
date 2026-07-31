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

    // 🔴 Pressable 이 자식 텍스트를 삼키므로, 칩을 화면에 그리는 것만으로는 스크린리더에
    //    아무것도 전달되지 않는다. 라벨을 상태에서 합성해야 불변식이 음성에서도 성립한다.
    it('접힘 헤더의 접근성 라벨에 활성 필터와 미지급 건수를 담는다', () => {
      const { getByTestId } = renderDashboard({
        collapsed: true,
        activeFilterLabel: '미지급',
        unpaidCount: 3,
      });

      const label = getByTestId('schedule-dashboard-toggle').props.accessibilityLabel;

      expect(label).toContain('필터 미지급 적용 중');
      expect(label).toContain('미지급 3건');
    });

    it('필터도 미지급도 없으면 라벨은 펼치기 안내만 담는다', () => {
      const { getByTestId } = renderDashboard({ collapsed: true });

      expect(getByTestId('schedule-dashboard-toggle').props.accessibilityLabel).toBe(
        '이번 달 요약과 필터 펼치기'
      );
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
