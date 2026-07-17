import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OpsHubIntroCard } from '../OpsHubIntroCard';

const mockPush = jest.fn();
const mockUseOpsHubEnabled = jest.fn();
const mockGetString = jest.fn();
const mockSet = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/hooks/useOpsHubEnabled', () => ({
  useOpsHubEnabled: () => mockUseOpsHubEnabled(),
}));

jest.mock('@/lib/mmkvStorage', () => ({
  getMMKVInstance: () => ({
    getString: (...args: unknown[]) => mockGetString(...args),
    set: (...args: unknown[]) => mockSet(...args),
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const DISMISS_KEY = '@uniqn:ops_hub_intro_dismissed';
const CTA_LABEL = '라이브 운영 열기';

describe('OpsHubIntroCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOpsHubEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockGetString.mockReturnValue(undefined);
  });

  it('게이트 OFF 면 미노출', () => {
    mockUseOpsHubEnabled.mockReturnValue({ enabled: false, isLoading: false });
    const { queryByText } = render(<OpsHubIntroCard />);
    expect(queryByText(CTA_LABEL)).toBeNull();
  });

  it('게이트 ON + 미dismiss 면 CTA 를 노출', () => {
    const { getByText } = render(<OpsHubIntroCard />);
    expect(getByText(CTA_LABEL)).toBeTruthy();
    expect(getByText('라이브 대회 운영이 열렸어요')).toBeTruthy();
  });

  it('이미 dismiss(MMKV 키 존재) 면 미노출 — 앱 재시작 재노출 없음', () => {
    mockGetString.mockReturnValue('1700000000000');
    const { queryByText } = render(<OpsHubIntroCard />);
    expect(mockGetString).toHaveBeenCalledWith(DISMISS_KEY);
    expect(queryByText(CTA_LABEL)).toBeNull();
  });

  it('닫기 누르면 MMKV 에 dismiss 를 영속하고 숨긴다', () => {
    const { getByLabelText, queryByText } = render(<OpsHubIntroCard />);
    fireEvent.press(getByLabelText('안내 닫기'));
    expect(mockSet).toHaveBeenCalledWith(DISMISS_KEY, expect.any(String));
    expect(queryByText(CTA_LABEL)).toBeNull();
  });

  it('CTA 누르면 ops 허브로 이동하고 dismiss 를 영속한다', () => {
    const { getByText } = render(<OpsHubIntroCard />);
    fireEvent.press(getByText(CTA_LABEL));
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments');
    expect(mockSet).toHaveBeenCalledWith(DISMISS_KEY, expect.any(String));
  });
});
