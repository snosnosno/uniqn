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
const mockRoom = {
  meta: null as Record<string, unknown> | null,
  summary: null,
  mySide: null as string | null,
  readCursor: null,
  isLoading: false,
  error: null,
};
const mockSafety = {
  blockState: 'none' as 'none' | 'mine' | 'theirs',
  muted: false,
  isLoading: false,
  isMutating: false,
  setMuted: jest.fn(),
  block: jest.fn(),
  unblock: jest.fn(),
};
const mockUseChatSafety = jest.fn();
jest.mock('@/hooks/chat', () => ({
  useChatLookup: (...a: unknown[]) => mockLookup(...a),
  useChatRoom: () => mockRoom,
  useChatSafety: (...a: unknown[]) => {
    mockUseChatSafety(...a);
    return mockSafety;
  },
  useChatRoomActions: () => ({ hide: jest.fn(), isHiding: false, markRead: jest.fn() }),
  useTrackChatOpen: (...a: unknown[]) => mockTrack(...a),
}));
jest.mock('@/hooks/useJobDetail', () => ({ useJobDetail: () => ({ job: null }) }));
jest.mock('@/components/headers', () => ({
  StackHeader: ({ title, rightAction }: { title: string; rightAction?: React.ReactNode }) => {
    const { Text, View } = jest.requireActual('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {rightAction}
      </View>
    );
  },
}));
const mockRoomView = jest.fn();
jest.mock('../ChatRoomView', () => ({
  ChatRoomView: (props: Record<string, unknown>) => {
    mockRoomView(props);
    const { Text } = jest.requireActual('react-native');
    return <Text>ROOM_VIEW</Text>;
  },
}));

const POSTING = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

beforeEach(() => {
  jest.clearAllMocks();
  mockLookup.mockReturnValue({ conversationId: null, isLoading: false, error: null });
  mockRoom.meta = null;
  mockRoom.mySide = null;
  mockSafety.blockState = 'none';
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

describe('ChatRoomScreen — (S4) 헤더 메뉴·차단 상태', () => {
  const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';

  beforeEach(() => {
    mockRoom.meta = {
      id: CONV,
      jobPostingId: POSTING,
      seekerId: 'me',
      seekerDisplayName: '나',
      employerDisplayName: '홀덤펍',
      postingTitle: '공고',
      lastMessageAt: null,
    };
    mockRoom.mySide = 'seeker';
  });

  it('기존 방이면 헤더에 "나가기" 글자 대신 `⋯` 메뉴가 있다', () => {
    const { getByLabelText, queryByText } = render(<ChatRoomScreen conversationId={CONV} />);
    expect(getByLabelText('채팅방 메뉴')).toBeTruthy();
    expect(queryByText('나가기')).toBeNull();
    expect(mockUseChatSafety).toHaveBeenCalledWith(CONV, 'seeker');
  });

  it('차단 상태와 해제 동작을 방 본체로 넘긴다', () => {
    mockSafety.blockState = 'mine';
    render(<ChatRoomScreen conversationId={CONV} />);
    const props = mockRoomView.mock.calls.at(-1)?.[0] as {
      blockState: string;
      onUnblock: () => void;
    };
    expect(props.blockState).toBe('mine');
    props.onUnblock();
    expect(mockSafety.unblock).toHaveBeenCalledTimes(1);
  });

  it('새 방(아직 id 없음)에는 메뉴가 없다', () => {
    mockRoom.meta = null;
    const { queryByLabelText } = render(
      <ChatRoomScreen conversationId={null} postingId={POSTING} />
    );
    expect(queryByLabelText('채팅방 메뉴')).toBeNull();
  });
});
