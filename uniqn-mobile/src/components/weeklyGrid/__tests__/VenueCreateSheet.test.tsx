/**
 * VenueCreateSheet — 운영처 생성 시트 테스트
 *
 * SheetModal(reanimated)은 가벼운 children+footer 렌더로 모킹하고, 변이 훅을 모킹해
 * (1) 이름 입력 후 제출이 trim 된 이름으로 mutate 호출, (2) 빈 이름은 제출 비활성을 검증한다.
 * (3) mutate 콜백 경로: onSuccess → onCreated + 성공 토스트, onError → 에러 토스트.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueCreateSheet } from '../VenueCreateSheet';
import { useCreateVenueContainer } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import type { VenueContainer } from '@/domains/weeklyGrid';

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

// 안정적인 토스트 스파이: 테스트 간 참조 가능하도록 모듈 스코프에 선언
const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();

beforeEach(() => {
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  // 셀렉터(s) 가 success/error/info 를 꺼내므로 안정적인 스파이를 반환
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: toastSuccessSpy, error: toastErrorSpy, info: jest.fn() })
  );
});

const FAKE_CONTAINER: VenueContainer = {
  id: 'venue-new',
  name: '강남 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: null,
  venueId: 'venue-new',
  kind: 'dated',
  softTargets: {},
  roleSalaries: [],
};

it('이름 입력 후 제출 시 trim 된 이름으로 mutate 호출', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.changeText(getByLabelText('지점 이름'), '  강남 홀덤펍  ');
  fireEvent.press(getByLabelText('지점 만들기'));

  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('강남 홀덤펍');
});

it('빈 이름이면 제출 버튼 비활성(미호출)', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.press(getByLabelText('지점 만들기'));
  expect(mutate).not.toHaveBeenCalled();
});

it('onSuccess 콜백: onCreated 호출 + 성공 토스트', () => {
  const mutate = jest.fn();
  const onCreated = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={onCreated} />
  );

  fireEvent.changeText(getByLabelText('지점 이름'), '강남 홀덤펍');
  fireEvent.press(getByLabelText('지점 만들기'));

  // mutate 의 2번째 인자(콜백 객체)를 직접 호출해 경로 검증
  const opts = mutate.mock.calls[0][1] as {
    onSuccess: (c: VenueContainer) => void;
    onError: (e: Error) => void;
  };
  opts.onSuccess(FAKE_CONTAINER);

  expect(onCreated).toHaveBeenCalledWith(FAKE_CONTAINER);
  expect(toastSuccessSpy).toHaveBeenCalled();
});

it('onError 콜백: 에러 토스트 호출', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.changeText(getByLabelText('지점 이름'), '강남 홀덤펍');
  fireEvent.press(getByLabelText('지점 만들기'));

  const opts = mutate.mock.calls[0][1] as {
    onSuccess: (c: VenueContainer) => void;
    onError: (e: Error) => void;
  };
  opts.onError(new Error('서버 오류'));

  expect(toastErrorSpy).toHaveBeenCalled();
});
