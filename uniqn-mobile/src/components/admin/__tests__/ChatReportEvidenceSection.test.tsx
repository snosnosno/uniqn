/**
 * ChatReportEvidenceSection — (S4) 관리자 신고 상세의 채팅 증거(스냅샷)
 *
 * 사유 라벨 · 공고 제목 · 메시지 타임라인(오래된→최신) · 신고 메시지 강조 · 증거 사진(서명 URL).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatReportEvidenceSection } from '../ChatReportEvidenceSection';
import type { ChatReportEvidence } from '@/types/report';

const mockMediaUrl = jest.fn();
jest.mock('@/hooks/chat/useChatMediaUrl', () => ({
  useChatMediaUrl: (path: string | null) => mockMediaUrl(path),
}));

const SNAPSHOT: ChatReportEvidence = {
  source: 'chat',
  version: 1,
  conversationId: 'conv',
  jobPostingId: 'job-1',
  postingTitle: '주말 딜러 구합니다',
  reason: 'scam',
  reportedMessageId: 'm3',
  messages: [
    {
      id: 'm1',
      senderSide: 'seeker',
      senderDisplayName: '구직자 a3bb',
      kind: 'text',
      body: '안녕하세요',
      imagePath: null,
      createdAt: '2026-09-25T09:00:00Z',
      reported: false,
    },
    {
      id: 'm2',
      senderSide: 'employer',
      senderDisplayName: '홀덤펍 담당자',
      kind: 'image',
      body: '',
      imagePath: 'conv/u/x.jpg',
      createdAt: '2026-09-25T09:01:00Z',
      reported: false,
    },
    {
      id: 'm3',
      senderSide: 'employer',
      senderDisplayName: '홀덤펍 담당자',
      kind: 'text',
      body: '선입금 10만원 보내세요',
      imagePath: null,
      createdAt: '2026-09-25T09:02:00Z',
      reported: true,
    },
  ],
  imagePaths: ['conv/u/x.jpg'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMediaUrl.mockReturnValue({ url: 'https://signed/x', isError: false });
});

describe('ChatReportEvidenceSection', () => {
  it('제목·사유 라벨·공고 제목을 보인다', () => {
    const { getByText } = render(<ChatReportEvidenceSection snapshot={SNAPSHOT} />);
    expect(getByText('채팅 신고 증거')).toBeTruthy();
    expect(getByText('사기·금전 요구')).toBeTruthy();
    expect(getByText('주말 딜러 구합니다')).toBeTruthy();
  });

  it('메시지를 순서대로 발신자와 함께 보인다', () => {
    const { getByText, getAllByText } = render(<ChatReportEvidenceSection snapshot={SNAPSHOT} />);
    expect(getByText('안녕하세요')).toBeTruthy();
    expect(getByText('선입금 10만원 보내세요')).toBeTruthy();
    expect(getAllByText('홀덤펍 담당자').length).toBe(2);
  });

  it('신고된 메시지는 강조 표시(라벨)로 구별된다', () => {
    const { getByTestId, getAllByText } = render(<ChatReportEvidenceSection snapshot={SNAPSHOT} />);
    expect(getAllByText('신고된 메시지')).toHaveLength(1);
    expect(getByTestId('chat-evidence-m3').props.accessibilityLabel).toContain('신고된 메시지');
  });

  it('증거 사진은 imagePaths 에 있는 경로만 chat-media 서명 URL 로 그린다', () => {
    const { getByTestId } = render(<ChatReportEvidenceSection snapshot={SNAPSHOT} />);
    expect(mockMediaUrl).toHaveBeenCalledWith('conv/u/x.jpg');
    // expo-image 는 source 를 배열로 정규화해 넘긴다
    expect(JSON.stringify(getByTestId('chat-evidence-image-m2').props.source)).toContain(
      'https://signed/x'
    );
  });

  it('imagePaths 에 없는 사진 경로는 요청하지 않는다', () => {
    const snapshot = { ...SNAPSHOT, imagePaths: [] };
    const { getByText } = render(<ChatReportEvidenceSection snapshot={snapshot} />);
    expect(mockMediaUrl).not.toHaveBeenCalledWith('conv/u/x.jpg');
    expect(getByText('사진을 볼 수 없어요')).toBeTruthy();
  });

  it('모르는 사유 코드는 원문으로 보인다(서버가 사유를 늘려도 깨지지 않는다)', () => {
    const { getByText } = render(
      <ChatReportEvidenceSection snapshot={{ ...SNAPSHOT, reason: 'hate' }} />
    );
    expect(getByText('hate')).toBeTruthy();
  });
});
