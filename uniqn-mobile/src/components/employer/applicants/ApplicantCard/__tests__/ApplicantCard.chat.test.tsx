/**
 * ApplicantCard — 펼친 카드에서 지원자에게 채팅 걸기(플래그 ON)
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApplicantCard } from '../ApplicantCard';
import { createMockApplication } from '@/__tests__/mocks/factories';
import type { ApplicantWithDetails } from '@/services';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ data: null, isLoading: false }),
}));
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));

const mockFlag = { enabled: true };
jest.mock('@/hooks/chat/useChatEnabled', () => ({
  useChatEnabled: () => ({ enabled: mockFlag.enabled, isLoading: false }),
}));

function applicant(): ApplicantWithDetails {
  return {
    ...createMockApplication({ status: 'applied' }),
    applicantId: 'seeker-1',
    jobPostingId: 'posting-1',
    assignments: [],
  } as unknown as ApplicantWithDetails;
}

describe('ApplicantCard 채팅', () => {
  beforeEach(() => jest.clearAllMocks());

  it('펼치면 지원자와 채팅 버튼이 있고, 누르면 지원자 uid 로 new 화면에 간다', () => {
    mockFlag.enabled = true;
    const { getByTestId } = render(<ApplicantCard applicant={applicant()} initialExpanded />);

    fireEvent.press(getByTestId('applicant-chat-seeker-1'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/chat/new',
      params: { postingId: 'posting-1', seekerId: 'seeker-1', src: 'applicants' },
    });
  });

  it('플래그 OFF 면 버튼이 없다', () => {
    mockFlag.enabled = false;
    const { queryByTestId } = render(<ApplicantCard applicant={applicant()} initialExpanded />);
    expect(queryByTestId('applicant-chat-seeker-1')).toBeNull();
  });
});
