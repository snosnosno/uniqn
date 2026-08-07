/**
 * 회귀 테스트 — 구인자 신청 현황 조회 실패 처리 (감사 A4, 2026-08-07)
 *
 * 버그: 화면이 `isLoading` 다음 곧바로 `!application` 을 보고 "아직 구인자 신청 내역이
 * 없습니다"라며 신청하기 버튼을 띄웠다. 조회가 실패해도 data 는 undefined 라 같은 분기로
 * 떨어진다 — 이미 심사 중인 사용자가 "내역 없음"을 보고 **다시 신청**하게 된다.
 *
 * 이 테스트가 고정하는 것:
 *   1) 조회 실패는 "내역 없음"이 아니라 실패로 표시되고 재시도 경로가 있다
 *   2) 재시도는 실제로 조회를 다시 태운다
 *   3) 조회 성공 + 신청 없음(null)일 때는 기존 안내가 그대로 유지된다
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EmployerApplicationStatusScreen from '../employer-application-status';

const mockReplace = jest.fn();
const mockUseEmployerApplication = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks/auth/useEmployerApplication', () => ({
  useEmployerApplication: () => mockUseEmployerApplication(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { refreshProfile: jest.Mock }) => unknown) =>
    selector({ refreshProfile: jest.fn() }),
}));

jest.mock('@/components/headers', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    StackHeader: ({ title }: { title: string }) => (
      <ReactNative.View>
        <ReactNative.Text>{title}</ReactNative.Text>
      </ReactNative.View>
    ),
  };
});

describe('구인자 신청 현황 — 조회 실패와 "내역 없음" 분리', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('조회가 실패하면 "신청 내역이 없습니다" 대신 실패를 알린다', () => {
    mockUseEmployerApplication.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('조회 실패'),
      refetch: jest.fn(),
    });

    const { getByText, queryByText } = render(<EmployerApplicationStatusScreen />);

    expect(queryByText(/아직 구인자 신청 내역이 없습니다/)).toBeNull();
    expect(queryByText('구인자 신청하기')).toBeNull();
    expect(getByText('신청 현황을 불러오지 못했어요')).toBeTruthy();
  });

  it('재시도를 누르면 신청 현황 조회를 다시 태운다', () => {
    const refetch = jest.fn();
    mockUseEmployerApplication.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('조회 실패'),
      refetch,
    });

    const { getByText } = render(<EmployerApplicationStatusScreen />);
    fireEvent.press(getByText('다시 시도'));

    expect(refetch).toHaveBeenCalled();
  });

  it('조회에 성공했고 신청이 없으면 기존 안내를 그대로 보여준다', () => {
    mockUseEmployerApplication.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<EmployerApplicationStatusScreen />);

    expect(getByText(/아직 구인자 신청 내역이 없습니다/)).toBeTruthy();
  });
});
