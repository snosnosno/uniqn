/**
 * ChatImageBubble — 사진 말풍선
 *
 * 🔑 expo-image cacheKey = image_path. 서명 URL 은 5분마다 바뀌지만 경로는 그대로라
 *    같은 사진을 다시 받지 않는다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatImageBubble } from '../ChatImageBubble';

const mockImageProps: Record<string, unknown>[] = [];
jest.mock('expo-image', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    Image: (props: Record<string, unknown>) => {
      mockImageProps.push(props);
      return <ReactNative.View testID={props.testID as string} />;
    },
  };
});

const mockUseUrl = jest.fn();
jest.mock('@/hooks/chat/useChatMediaUrl', () => ({
  useChatMediaUrl: (path: string | null) => mockUseUrl(path),
}));

beforeEach(() => {
  mockImageProps.length = 0;
  mockUseUrl.mockReset();
});

describe('ChatImageBubble', () => {
  it('서버 사진은 서명 URL 을 쓰되 cacheKey 는 경로다', () => {
    mockUseUrl.mockReturnValue({ url: 'https://x/signed?token=1', isError: false });
    render(<ChatImageBubble imagePath="c/u/m.jpg" width={1600} height={1200} isMine={false} />);

    const thumb = mockImageProps.find((p) => p.testID === 'chat-image');
    expect(thumb?.source).toEqual({ uri: 'https://x/signed?token=1', cacheKey: 'c/u/m.jpg' });
    expect(mockUseUrl).toHaveBeenCalledWith('c/u/m.jpg');
  });

  it('보내는 중인 사진은 로컬 uri 로 보이고 서명 URL 을 조회하지 않는다', () => {
    mockUseUrl.mockReturnValue({ url: null, isError: false });
    const { getByText } = render(
      <ChatImageBubble
        localUri="file:///local.jpg"
        width={400}
        height={300}
        isMine
        pendingLabel="사진 올리는 중"
      />
    );

    const thumb = mockImageProps.find((p) => p.testID === 'chat-image');
    expect(thumb?.source).toEqual({ uri: 'file:///local.jpg' });
    expect(mockUseUrl).toHaveBeenCalledWith(null);
    expect(getByText('사진 올리는 중')).toBeTruthy();
  });

  it('누르면 전체화면 뷰어가 열린다', () => {
    mockUseUrl.mockReturnValue({ url: 'https://x/s', isError: false });
    const { getByLabelText, getByTestId } = render(
      <ChatImageBubble imagePath="c/u/m.jpg" width={100} height={100} isMine={false} />
    );

    fireEvent.press(getByLabelText('사진 크게 보기'));
    expect(getByTestId('chat-image-viewer')).toBeTruthy();
  });

  it('서명 URL 을 못 받으면 대체 문구를 보인다', () => {
    mockUseUrl.mockReturnValue({ url: null, isError: true });
    const { getByText } = render(
      <ChatImageBubble imagePath="c/u/m.jpg" width={100} height={100} isMine={false} />
    );
    expect(getByText('사진을 불러오지 못했어요')).toBeTruthy();
  });
});
