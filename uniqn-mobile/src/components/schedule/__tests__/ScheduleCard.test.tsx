import React from 'react';
import { render } from '@testing-library/react-native';
import { ScheduleCard } from '../ScheduleCard';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

describe('ScheduleCard', () => {
  it('renders a readable salary label for applied schedules', () => {
    const schedule = {
      ...createMockScheduleEvent({
        type: 'applied',
        role: 'staff',
      }),
      postingProjection: {
        ownerName: '테스트 구인자',
        settlement: {
          roles: [
            { role: 'staff', count: 1, filled: 0, salary: { type: 'hourly', amount: 12000 } },
          ],
          defaultSalary: { type: 'hourly', amount: 10000 },
        },
      },
    } as unknown as ScheduleEvent;

    const { getByText } = render(<ScheduleCard schedule={schedule} />);

    expect(getByText('시급 ₩12,000')).toBeTruthy();
  });

  it('shows a pending-cancellation notice for confirmed schedules under review', () => {
    const schedule = createMockScheduleEvent({
      type: 'confirmed',
      isCancellationPending: true,
    }) as unknown as ScheduleEvent;

    const { getByText } = render(<ScheduleCard schedule={schedule} />);

    expect(getByText('취소 요청 검토 중입니다.')).toBeTruthy();
  });

  // 카드 안에 인라인 "지원 취소" 버튼을 두면 카드 전체 Pressable(웹 <button>)
  // 안에 또 다른 Pressable(<button>)이 중첩되어 hydration 에러가 난다.
  // 취소 기능은 ScheduleDetailModal 로 일원화했으므로 카드에는 없어야 한다.
  it('does not render an inline cancel action inside the card', () => {
    const schedule = {
      ...createMockScheduleEvent({
        type: 'applied',
        applicationId: 'app-1',
      }),
    } as unknown as ScheduleEvent;

    const { queryByText } = render(<ScheduleCard schedule={schedule} onPress={() => {}} />);

    expect(queryByText('지원 취소')).toBeNull();
    expect(queryByText('취소 요청')).toBeNull();
  });

  // 정산 0원 확정(노쇼 차감·'협의' 급여)은 `shouldUseFrozenPayrollAmount` 가 Number.isFinite 로
  // 판정해 0 을 그대로 통과시킨다. 렌더 가드가 truthy(`amount && …`)면 두 가지가 동시에 깨진다:
  // ① 0 원이 화면에서 사라져 이의 제기 시점을 놓치고 ② 숫자 0 이 <View> 의 직접 자식으로 새어
  // RN 이 "Text strings must be rendered within a <Text> component" 로 죽는다.
  it('renders a settled amount of exactly zero instead of leaking a bare 0 node', () => {
    const schedule = {
      ...createMockScheduleEvent({ type: 'completed' }),
      payrollAmount: 0,
    } as unknown as ScheduleEvent;

    const { getByText, toJSON } = render(<ScheduleCard schedule={schedule} />);

    expect(getByText('₩0')).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain('"children":[0]');
  });

  it('drops the pending-cancellation notice once approval resolves to cancelled', () => {
    const schedule = createMockScheduleEvent({
      type: 'cancelled',
    }) as unknown as ScheduleEvent;

    const { getByText, queryByText } = render(<ScheduleCard schedule={schedule} />);

    expect(queryByText('취소 요청 검토 중입니다.')).toBeNull();
    expect(getByText('이 일정이 취소되었습니다.')).toBeTruthy();
  });
});
