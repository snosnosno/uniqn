/**
 * VenueCreateSheet — 운영처 생성 시트 테스트
 *
 * SheetModal(reanimated)은 가벼운 children+footer 렌더로 모킹하고, 변이 훅을 모킹해
 * (1) 이름 입력 후 제출이 trim 된 이름으로 mutate 호출, (2) 빈 이름은 제출 비활성을 검증한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueCreateSheet } from '../VenueCreateSheet';
import { useCreateVenueContainer } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';

// 무거운 의존(SheetModal=RNModal+reanimated) 모킹: visible 일 때 children+footer 만 렌더
jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

jest.mock('@/hooks/weeklyGrid', () => ({ useCreateVenueContainer: jest.fn() }));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockUseCreate = useCreateVenueContainer as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;

beforeEach(() => {
  mockUseToast.mockImplementation((sel: any) =>
    sel({ success: jest.fn(), error: jest.fn(), info: jest.fn() })
  );
});

it('이름 입력 후 제출 시 trim 된 이름으로 mutate 호출', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.changeText(getByLabelText('운영처 이름'), '  강남 홀덤펍  ');
  fireEvent.press(getByLabelText('운영처 만들기'));

  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('강남 홀덤펍');
});

it('빈 이름이면 제출 버튼 비활성(미호출)', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.press(getByLabelText('운영처 만들기'));
  expect(mutate).not.toHaveBeenCalled();
});
