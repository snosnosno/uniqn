import React from 'react';
import { render } from '@testing-library/react-native';
import CreateSuccessScreen from '../create-success';

// 모킹 스캐폴딩은 형제 테스트(CreateSuccessScreen.test.tsx)의 검증된 구성을 따른다.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJobById: jest.fn(), isSharing: false }),
}));

jest.mock('@/hooks/useTemplateManager', () => ({
  useTemplateManager: () => ({
    openTemplateModal: jest.fn(),
    closeTemplateModal: jest.fn(),
    isTemplateModalOpen: false,
    templateName: '',
    templateDescription: '',
    setTemplateName: jest.fn(),
    setTemplateDescription: jest.fn(),
    handleSaveTemplate: jest.fn(),
    isSavingTemplate: false,
  }),
}));

jest.mock('@/utils/order-sheet/lastSubmitted', () => ({
  getLastSubmittedDraft: () => null,
  clearLastSubmittedDraft: jest.fn(),
}));

jest.mock('@/components/employer/job-form/modals/TemplateModal', () => ({
  TemplateModal: () => null,
}));

describe('CreateSuccessScreen — 대회 승인 안내 (S1)', () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router') as {
    useLocalSearchParams: jest.Mock;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('pending=1이면 승인 안내 문구를 보여준다', () => {
    useLocalSearchParams.mockReturnValue({ id: 'p1', title: '대회 딜러', pending: '1' });
    const { getByText } = render(<CreateSuccessScreen />);
    expect(getByText('관리자 승인 후 게시돼요 (1~2 영업일)')).toBeTruthy();
  });

  it('pending이 없으면 기본 안내 문구를 보여준다', () => {
    useLocalSearchParams.mockReturnValue({ id: 'p1', title: '주말 딜러' });
    const { getByText } = render(<CreateSuccessScreen />);
    expect(getByText('지원자가 생기면 바로 알려드릴게요')).toBeTruthy();
  });

  // 전체리뷰 후속(2026-07-16) — 승인 대기 대회는 상세가 승인 게이트에 막혀 공유 링크가 죽은 화면(P5·P6).
  it('pending=1이면 공유 CTA 대신 승인 후 공유 안내를 보여준다', () => {
    useLocalSearchParams.mockReturnValue({ id: 'p1', title: '대회 딜러', pending: '1' });
    const { queryByTestId, getByTestId, getByText } = render(<CreateSuccessScreen />);
    expect(queryByTestId('create-success-share')).toBeNull();
    expect(getByTestId('create-success-share-pending')).toBeTruthy();
    expect(getByText('승인이 완료되면 공유할 수 있어요')).toBeTruthy();
  });

  it('pending이 없으면 공유 CTA가 노출된다', () => {
    useLocalSearchParams.mockReturnValue({ id: 'p1', title: '주말 딜러' });
    const { getByTestId, queryByTestId } = render(<CreateSuccessScreen />);
    expect(getByTestId('create-success-share')).toBeTruthy();
    expect(queryByTestId('create-success-share-pending')).toBeNull();
  });
});
