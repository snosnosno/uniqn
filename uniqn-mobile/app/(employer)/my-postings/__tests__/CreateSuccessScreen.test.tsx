import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CreateSuccessScreen from '../create-success';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

const mockReplace = jest.fn();
const mockShareJobById = jest.fn();
const mockOpenTemplateModal = jest.fn();
const mockHandleSaveTemplate = jest.fn();
const mockGetLastSubmittedDraft = jest.fn<JobPostingDraft | null, []>();
const mockClearLastSubmittedDraft = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    shareJobById: (...args: unknown[]) => mockShareJobById(...args),
    isSharing: false,
  }),
}));

jest.mock('@/hooks/useTemplateManager', () => ({
  useTemplateManager: () => ({
    openTemplateModal: (...args: unknown[]) => mockOpenTemplateModal(...args),
    closeTemplateModal: jest.fn(),
    isTemplateModalOpen: false,
    templateName: '',
    templateDescription: '',
    setTemplateName: jest.fn(),
    setTemplateDescription: jest.fn(),
    handleSaveTemplate: (...args: unknown[]) => mockHandleSaveTemplate(...args),
    isSavingTemplate: false,
  }),
}));

jest.mock('@/utils/order-sheet/lastSubmitted', () => ({
  getLastSubmittedDraft: () => mockGetLastSubmittedDraft(),
  clearLastSubmittedDraft: () => mockClearLastSubmittedDraft(),
}));

jest.mock('@/components/employer/job-form/modals/TemplateModal', () => ({
  TemplateModal: () => null,
}));

const fakeDraft = { title: '딜러 모집' } as unknown as JobPostingDraft;

describe('CreateSuccessScreen', () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router') as {
    useLocalSearchParams: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLastSubmittedDraft.mockReturnValue(fakeDraft);
    useLocalSearchParams.mockReturnValue({
      id: 'job-123',
      title: '딜러 모집',
      summary: '7월 20일 · 출근 18:00',
      suggestPreset: '1',
    });
  });

  it('확정 문구와 등록 요약(제목·요약)을 렌더한다', () => {
    const { getByText } = render(<CreateSuccessScreen />);
    expect(getByText('공고가 등록됐어요')).toBeTruthy();
    expect(getByText('딜러 모집')).toBeTruthy();
    expect(getByText('7월 20일 · 출근 18:00')).toBeTruthy();
  });

  it('공유 버튼 탭 시 shareJobById(id)를 호출한다', () => {
    const { getByTestId } = render(<CreateSuccessScreen />);
    fireEvent.press(getByTestId('create-success-share'));
    expect(mockShareJobById).toHaveBeenCalledWith('job-123');
  });

  it('공고 보기 탭 시 상세 라우트로 replace 한다', () => {
    const { getByTestId } = render(<CreateSuccessScreen />);
    fireEvent.press(getByTestId('create-success-view'));
    expect(mockReplace).toHaveBeenCalledWith('/(employer)/my-postings/job-123');
  });

  it('하나 더 등록 탭 시 작성 화면으로 replace 한다', () => {
    const { getByTestId } = render(<CreateSuccessScreen />);
    fireEvent.press(getByTestId('create-success-again'));
    expect(mockReplace).toHaveBeenCalledWith('/(employer)/my-postings/create');
  });

  it('suggestPreset=1 이고 draft 가 있으면 프리셋 저장 버튼을 노출하고 탭 시 모달을 연다', () => {
    const { getByTestId } = render(<CreateSuccessScreen />);
    fireEvent.press(getByTestId('create-success-save-preset'));
    expect(mockOpenTemplateModal).toHaveBeenCalledTimes(1);
  });

  it('suggestPreset=0 이면 프리셋 저장 버튼을 노출하지 않는다', () => {
    useLocalSearchParams.mockReturnValue({
      id: 'job-123',
      title: '딜러 모집',
      suggestPreset: '0',
    });
    const { queryByTestId } = render(<CreateSuccessScreen />);
    expect(queryByTestId('create-success-save-preset')).toBeNull();
  });

  it('마운트 시 캐시를 1회 소비한다 — snapshot 후 clear(1회성 계약, 딥링크 재노출 차단)', () => {
    const { getByTestId } = render(<CreateSuccessScreen />);
    // snapshot 이 clear 보다 먼저 실행되므로 draft 로 저장 배너가 렌더된다(순서 보장).
    expect(getByTestId('create-success-save-preset')).toBeTruthy();
    // 읽은 직후 모듈 캐시를 비워 앱 수명 잔류·재진입 재노출을 차단한다.
    expect(mockClearLastSubmittedDraft).toHaveBeenCalled();
  });

  it('전달된 draft 가 없으면 저장 제안 배너를 숨긴다(직접 딥링크 진입 방어)', () => {
    mockGetLastSubmittedDraft.mockReturnValue(null);
    const { queryByTestId } = render(<CreateSuccessScreen />);
    expect(queryByTestId('create-success-save-preset')).toBeNull();
  });

  it('id 파라미터가 없으면 공유·공고보기 액션이 no-op 이다', () => {
    useLocalSearchParams.mockReturnValue({ title: '딜러 모집', suggestPreset: '0' });
    const { getByTestId } = render(<CreateSuccessScreen />);
    fireEvent.press(getByTestId('create-success-share'));
    fireEvent.press(getByTestId('create-success-view'));
    expect(mockShareJobById).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
