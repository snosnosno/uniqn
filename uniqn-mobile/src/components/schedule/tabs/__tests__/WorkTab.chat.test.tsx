/**
 * WorkTab — 확정 근무의 채팅 진입(전화번호 유무와 무관)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { WorkTab } from '../WorkTab';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

const mockFlag = { enabled: true };
jest.mock('@/hooks/chat/useChatEnabled', () => ({
  useChatEnabled: () => ({ enabled: mockFlag.enabled, isLoading: false }),
}));

function schedule(patch: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    ...createMockScheduleEvent({ type: 'confirmed' }),
    status: 'not_started',
    workLogId: 'work-log-1',
    ...patch,
  } as ScheduleEvent;
}

describe('WorkTab 채팅 진입', () => {
  it('확정이면 구인자 전화번호가 없어도 채팅 버튼이 보인다', () => {
    mockFlag.enabled = true;
    const { getByText } = render(
      <WorkTab
        schedule={schedule({ type: 'confirmed', ownerPhone: undefined })}
        onQRScan={jest.fn()}
      />
    );
    expect(getByText('사장님과 채팅')).toBeTruthy();
  });

  it('확정 전(지원 중)에는 보이지 않는다', () => {
    mockFlag.enabled = true;
    const { queryByText } = render(
      <WorkTab schedule={schedule({ type: 'applied' })} onQRScan={jest.fn()} />
    );
    expect(queryByText('사장님과 채팅')).toBeNull();
  });

  it('플래그 OFF 면 확정이어도 보이지 않는다', () => {
    mockFlag.enabled = false;
    const { queryByText } = render(
      <WorkTab schedule={schedule({ type: 'confirmed' })} onQRScan={jest.fn()} />
    );
    expect(queryByText('사장님과 채팅')).toBeNull();
  });
});
