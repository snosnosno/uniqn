/**
 * ChatRoomScreen — 라우트 파라미터 경계 검증(보안 리뷰 L-1·L-2)
 *
 * 조작된 딥링크(/chat/new?postingId=<임의 문자열>)는 입력창을 그리지 않고, 방 조회·계측으로
 * 흘려보내지 않는다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatRoomScreen } from '../ChatRoomScreen';
import { notFound } from '@/constants/messages';

const mockLookup = jest.fn();
const mockTrack = jest.fn();
jest.mock('@/hooks/chat', () => ({
  useChatLookup: (...a: unknown[]) => mockLookup(...a),
  useChatRoom: () => ({
    meta: null,
    summary: null,
    mySide: null,
    readCursor: null,
    isLoading: false,
    error: null,
  }),
  useChatRoomActions: () => ({ hide: jest.fn(), isHiding: false, markRead: jest.fn() }),
  useTrackChatOpen: (...a: unknown[]) => mockTrack(...a),
}));
jest.mock('@/hooks/useJobDetail', () => ({ useJobDetail: () => ({ job: null }) }));
jest.mock('@/components/headers', () => ({
  StackHeader: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{title}</Text>;
  },
}));
jest.mock('../ChatRoomView', () => ({
  ChatRoomView: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>ROOM_VIEW</Text>;
  },
}));

const POSTING = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

beforeEach(() => {
  jest.clearAllMocks();
  mockLookup.mockReturnValue({ conversationId: null, isLoading: false, error: null });
});

describe('ChatRoomScreen 파라미터 검증', () => {
  it('postingId 가 uuid 가 아니면 공고 없음 — 조회·계측으로 흘려보내지 않는다', () => {
    const { getByText, queryByText } = render(
      <ChatRoomScreen conversationId={null} postingId="<script>x</script>" src="job_detail" />
    );
    expect(getByText(notFound('공고'))).toBeTruthy();
    expect(queryByText('ROOM_VIEW')).toBeNull();
    expect(mockLookup).toHaveBeenCalledWith(null, null);
    expect(mockTrack).toHaveBeenCalledWith(null, 'job_detail');
  });

  it('seekerId 가 조작됐으면 구직자 모드로 새지 않고 공고 없음', () => {
    const { getByText, queryByText } = render(
      <ChatRoomScreen conversationId={null} postingId={POSTING} seekerId="not-a-uuid" />
    );
    expect(getByText(notFound('공고'))).toBeTruthy();
    expect(queryByText('ROOM_VIEW')).toBeNull();
  });

  it('정상 postingId(대문자도 소문자로)면 빈 방을 그린다', () => {
    const { getByText } = render(
      <ChatRoomScreen conversationId={null} postingId={POSTING.toUpperCase()} />
    );
    expect(getByText('ROOM_VIEW')).toBeTruthy();
    expect(mockLookup).toHaveBeenCalledWith(POSTING, null);
  });
});
