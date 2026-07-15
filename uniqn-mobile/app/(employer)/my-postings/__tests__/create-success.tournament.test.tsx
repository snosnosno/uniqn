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
});
