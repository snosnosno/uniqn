import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import { PortOneIdentityVerification } from '../PortOneIdentityVerification.web';

// PortOne 브라우저 SDK mock
const mockRequestIdentityVerification = jest.fn();
jest.mock('@portone/browser-sdk/v2', () => ({
  requestIdentityVerification: (...args: unknown[]) => mockRequestIdentityVerification(...args),
}));

// portOneIdentityService mock
// savePortOneIdentityVerificationResult는 이 컴포넌트에서 호출하지 않으므로 mock 제외
const mockBuildRequest = jest.fn();
const mockSavePending = jest.fn();
const mockClearPending = jest.fn();
const mockCallVerify = jest.fn();
const mockSaveBindingToken = jest.fn().mockResolvedValue(undefined);

jest.mock('@/services/auth/portOneIdentityService', () => ({
  buildPortOneInicisIdentityRequest: (...args: unknown[]) => mockBuildRequest(...args),
  savePendingPortOneIdentityRequest: (...args: unknown[]) => mockSavePending(...args),
  clearPendingPortOneIdentityRequest: (...args: unknown[]) => mockClearPending(...args),
  callVerifyPortOneIdentity: (...args: unknown[]) => mockCallVerify(...args),
  savePortOneIdentityBindingToken: (...args: unknown[]) => mockSaveBindingToken(...args),
  getPortOneInicisIdentityConfig: () => ({ isReady: true }),
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
  customer: { fullName: '홍길동' },
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
    mockBuildRequest.mockReturnValue({ request: mockRequest, bindingToken: 'binding-tok-test' });
    mockCallVerify.mockResolvedValue(mockVerification);
    mockRequestIdentityVerification.mockResolvedValue(mockSdkSuccess);
  });

  it('P0 #1 — 성공 시 bindingToken을 storage에 저장한다', async () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(mockSaveBindingToken).toHaveBeenCalledWith('binding-tok-test');
    });
  });

  it('P0 #1 — callVerifyPortOneIdentity 호출 시 expectedBindingToken 전달', async () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(mockCallVerify).toHaveBeenCalledWith({
        identityVerificationId: 'test-id-123',
        expectedBindingToken: 'binding-tok-test',
      });
    });
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
      customer: { fullName: '홍길동' },
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
      expect(getByText(/본인인증을 완료하지 못했어요/)).toBeTruthy();
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
      expect(getByText(/이미 가입된 번호예요/)).toBeTruthy();
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
      expect(getByText(/동일한 명의로 가입된 계정/)).toBeTruthy();
    });
  });

  it('initialIdentity 있을 때 완료 상태를 표시한다', () => {
    const { getByText } = render(
      <PortOneIdentityVerification {...defaultProps} initialIdentity={mockIdentity} />
    );
    expect(getByText('이니시스 본인인증 완료')).toBeTruthy();
    expect(getByText('홍길동')).toBeTruthy();
  });

  it('phoneVerified false 시 에러 메시지를 표시한다', async () => {
    mockCallVerify.mockResolvedValue({
      ...mockVerification,
      phoneVerified: false,
      identity: { ...mockIdentity, phoneNumber: undefined },
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/휴대폰 번호를 받지 못했어요/)).toBeTruthy();
    });
  });

  // 2026-05-16: PortOne 이니시스 통합인증에서 인증수단별로 gender 응답이 다름
  // (PASS/토스/카카오/네이버/신한/KB 등). 누락 시 차단하지 않고 후속 step
  // (SignupStepIdentity / profile-setup) 에서 사용자가 직접 선택하는 정책.
  it('gender 누락 시에도 인증을 통과시키고 성별 필드를 렌더링하지 않는다', async () => {
    const onVerified = jest.fn();
    mockCallVerify.mockResolvedValue({
      ...mockVerification,
      identity: { ...mockIdentity, gender: undefined },
    });
    const { getByText, queryByText } = render(
      <PortOneIdentityVerification {...defaultProps} onVerified={onVerified} />
    );
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledWith(expect.objectContaining({ gender: undefined }));
    });
    // 완료 화면 표시
    expect(getByText('이니시스 본인인증 완료')).toBeTruthy();
    // gender 필드는 conditional render → 누락 시 비표시
    expect(queryByText('성별')).toBeNull();
  });
});
