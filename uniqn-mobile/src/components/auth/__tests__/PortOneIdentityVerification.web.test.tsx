import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import { PortOneIdentityVerification } from '../PortOneIdentityVerification.web';

// PortOne 브라우저 SDK mock
const mockRequestIdentityVerification = jest.fn();
jest.mock('@portone/browser-sdk/v2', () => ({
  requestIdentityVerification: (...args: unknown[]) => mockRequestIdentityVerification(...args),
}));

// portOneIdentityService mock
const mockBuildRequest = jest.fn();
const mockSavePending = jest.fn();
const mockClearPending = jest.fn();
const mockCallVerify = jest.fn();

jest.mock('@/services/auth/portOneIdentityService', () => ({
  buildPortOneInicisIdentityRequest: (...args: unknown[]) => mockBuildRequest(...args),
  savePendingPortOneIdentityRequest: (...args: unknown[]) => mockSavePending(...args),
  clearPendingPortOneIdentityRequest: (...args: unknown[]) => mockClearPending(...args),
  callVerifyPortOneIdentity: (...args: unknown[]) => mockCallVerify(...args),
}));

// NativeWind mock
jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
}));

const mockRequest = {
  storeId: 'store-id',
  channelKey: 'channel-key',
  identityVerificationId: 'test-id-123',
  bypass: { inicisUnified: { flgFixedUser: 'N' } },
  customData: undefined,
};

const mockIdentity = {
  provider: 'portone' as const,
  channel: 'inicis_unified' as const,
  identityVerificationId: 'test-id-123',
  verifiedAt: '2026-04-12T00:00:00.000Z',
  name: '홍길동',
  birthDate: '19900101',
  gender: 'male' as const,
  phoneNumber: '01012345678',
};

const mockVerification = {
  success: true,
  identityVerified: true,
  phoneVerified: true,
  hasDuplicatePhone: false,
  hasDuplicateIdentity: false,
  identity: mockIdentity,
};

const mockSdkSuccess = {
  transactionType: 'IDENTITY_VERIFICATION' as const,
  identityVerificationId: 'test-id-123',
  identityVerificationTxId: 'tx-id-123',
};

describe('PortOneIdentityVerification (web)', () => {
  const defaultProps = {
    onVerified: jest.fn(),
    onError: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildRequest.mockReturnValue(mockRequest);
    mockCallVerify.mockResolvedValue(mockVerification);
    mockRequestIdentityVerification.mockResolvedValue(mockSdkSuccess);
  });

  it('본인인증 시작 버튼이 렌더링된다', () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    expect(getByText('본인인증 시작')).toBeTruthy();
  });

  it('버튼 클릭 시 PortOne SDK를 호출한다', async () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    expect(mockRequestIdentityVerification).toHaveBeenCalledWith({
      storeId: 'store-id',
      channelKey: 'channel-key',
      identityVerificationId: 'test-id-123',
      bypass: { inicisUnified: { flgFixedUser: 'N' } },
      customData: undefined,
    });
  });

  it('인증 성공 시 onVerified가 identity와 함께 호출된다', async () => {
    const onVerified = jest.fn();
    const { getByText } = render(
      <PortOneIdentityVerification {...defaultProps} onVerified={onVerified} />
    );
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledWith(mockIdentity);
    });
  });

  it('SDK가 undefined 반환 시 에러 메시지를 표시한다', async () => {
    mockRequestIdentityVerification.mockResolvedValue(undefined);
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/본인인증 창이 닫혔습니다/)).toBeTruthy();
    });
  });

  it('SDK result.code 있을 때 에러 메시지를 표시한다 (사용자 취소)', async () => {
    mockRequestIdentityVerification.mockResolvedValue({
      ...mockSdkSuccess,
      code: 'CANCEL',
      message: '사용자가 인증을 취소했습니다.',
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/사용자가 인증을 취소했습니다/)).toBeTruthy();
    });
  });

  it('hasDuplicatePhone 시 에러 메시지를 표시한다', async () => {
    mockCallVerify.mockResolvedValue({
      ...mockVerification,
      hasDuplicatePhone: true,
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/이미 가입된 휴대폰 번호/)).toBeTruthy();
    });
  });

  it('hasDuplicateIdentity 시 에러 메시지를 표시한다', async () => {
    mockCallVerify.mockResolvedValue({
      ...mockVerification,
      hasDuplicateIdentity: true,
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/이미 가입된 본인인증 정보/)).toBeTruthy();
    });
  });

  it('initialIdentity 있을 때 완료 상태를 표시한다', () => {
    const { getByText } = render(
      <PortOneIdentityVerification {...defaultProps} initialIdentity={mockIdentity} />
    );
    expect(getByText('이니시스 본인인증 완료')).toBeTruthy();
    expect(getByText('홍길동')).toBeTruthy();
  });
});
