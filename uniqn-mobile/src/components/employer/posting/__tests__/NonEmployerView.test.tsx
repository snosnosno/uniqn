import React from 'react';
import { render } from '@testing-library/react-native';
import { NonEmployerView } from '../NonEmployerView';
import { useEmployerApplication } from '@/hooks/auth/useEmployerApplication';

jest.mock('@/hooks/auth/useEmployerApplication');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const mockUseEmployerApplication = useEmployerApplication as jest.Mock;

const setApplication = (application: { status: string } | null) => {
  mockUseEmployerApplication.mockReturnValue({ data: application, isLoading: false });
};

describe('NonEmployerView', () => {
  it('신청 이력이 없으면 등록 유도 CTA를 보여준다', () => {
    setApplication(null);
    const { getByText } = render(<NonEmployerView />);

    expect(getByText('구인자 전용 기능입니다')).toBeTruthy();
    expect(getByText('구인자로 등록하기')).toBeTruthy();
  });

  it('pending이면 심사 중 안내와 현황 보기 CTA를 보여준다 (QW6)', () => {
    setApplication({ status: 'pending' });
    const { getByText, queryByText } = render(<NonEmployerView />);

    expect(getByText('구인자 신청 심사 중입니다')).toBeTruthy();
    expect(getByText('신청 현황 보기')).toBeTruthy();
    expect(queryByText('구인자로 등록하기')).toBeNull();
  });

  it('rejected면 거절 안내와 재신청 CTA를 보여준다 (QW6)', () => {
    setApplication({ status: 'rejected' });
    const { getByText, queryByText } = render(<NonEmployerView />);

    expect(getByText('구인자 신청이 거절되었습니다')).toBeTruthy();
    expect(getByText('거절 사유 확인·재신청')).toBeTruthy();
    expect(queryByText('구인자로 등록하기')).toBeNull();
  });
});
