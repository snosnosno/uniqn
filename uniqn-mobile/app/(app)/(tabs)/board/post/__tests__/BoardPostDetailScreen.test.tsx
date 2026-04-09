import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import BoardPostDetailScreen from '../[postId]';

const mockUseBoardPostDetail = jest.fn();
const mockCreateBoardComment = { isPending: false, mutateAsync: jest.fn() };
const mockUpdateComment = { isPending: false, mutateAsync: jest.fn(), mutate: jest.fn() };
const mockSetStatus = { mutateAsync: jest.fn(), mutate: jest.fn() };
const mockSetPinned = { mutate: jest.fn() };
const mockToggleReaction = { mutate: jest.fn() };
const mockToggleVote = { isPending: false, mutate: jest.fn() };
const mockLockMutation = { isPending: false, mutateAsync: jest.fn() };
const mockHideMutation = { isPending: false, mutateAsync: jest.fn() };
const mockIncrementViewCount = { mutate: jest.fn() };
const mockFlashListRenderItems: unknown[] = [];

jest.mock('expo-image', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Image: () => <ReactNative.View />,
  };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ postId: 'post-1' }),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    FlashList: React.forwardRef(
      (
        {
          data,
          renderItem,
          ListHeaderComponent,
        }: {
          data: any[];
          renderItem: ({ item, index }: { item: any; index: number }) => React.ReactNode;
          ListHeaderComponent?: React.ReactNode;
        },
        ref: React.Ref<{ scrollToIndex: () => void }>
      ) => {
        mockFlashListRenderItems.push(renderItem);

        React.useImperativeHandle(ref, () => ({
          scrollToIndex: jest.fn(),
        }));

        return (
          <ReactNative.ScrollView>
            {ListHeaderComponent}
            {data.map((item, index) => (
              <ReactNative.View key={item.key ?? index}>
                {renderItem({ item, index })}
              </ReactNative.View>
            ))}
          </ReactNative.ScrollView>
        );
      }
    ),
  };
});

jest.mock('@/components/headers', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    TabHeader: ({ title }: { title: string }) => <ReactNative.Text>{title}</ReactNative.Text>,
  };
});

jest.mock('@/components/icons', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  const Icon = () => <ReactNative.View />;

  return {
    CloseCircleOutlineIcon: Icon,
    FlagOutlineIcon: Icon,
    HeartIcon: Icon,
    LockIcon: Icon,
    PinIcon: Icon,
    ImageIcon: Icon,
    PaperPlaneOutlineIcon: Icon,
    XMarkIcon: Icon,
    AddIcon: Icon,
    ImagesOutlineIcon: Icon,
  };
});

jest.mock('@/components/board/BoardImageViewerOverlay', () => ({
  BoardImageViewerOverlay: () => null,
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'me' },
    isAdmin: false,
  }),
}));

jest.mock('@/hooks/useBoard', () => ({
  useBoardPostDetail: (...args: unknown[]) => mockUseBoardPostDetail(...args),
  useBoardMentionCandidates: () => ({
    data: [{ userId: 'other-1', displayName: 'Alice', role: 'staff', isAuthor: false }],
  }),
  useIncrementBoardViewCount: () => mockIncrementViewCount,
  useCreateBoardComment: () => mockCreateBoardComment,
  useBoardCommentMutations: () => ({
    updateComment: mockUpdateComment,
    setStatus: mockSetStatus,
    setPinned: mockSetPinned,
    toggleReaction: mockToggleReaction,
  }),
  useToggleBoardPostVote: () => mockToggleVote,
  useSetBoardPostLock: () => mockLockMutation,
  useHideBoardPost: () => mockHideMutation,
  useCreateBoardReport: () => ({
    isPending: false,
    mutateAsync: jest.fn(),
  }),
}));

jest.mock('@/services/auth', () => ({
  uploadMultipleBoardImages: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: jest.Mock }) => unknown) =>
    selector({ addToast: jest.fn() }),
}));

jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Badge: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.Text>{children}</ReactNative.Text>
    ),
    Button: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) => (
      <ReactNative.Pressable
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
        }
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
      >
        <ReactNative.Text>{children}</ReactNative.Text>
      </ReactNative.Pressable>
    ),
    Card: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
    EmptyState: ({ title, description }: { title?: string; description?: string }) => (
      <ReactNative.View>
        {title ? <ReactNative.Text>{title}</ReactNative.Text> : null}
        {description ? <ReactNative.Text>{description}</ReactNative.Text> : null}
      </ReactNative.View>
    ),
    ErrorState: ({ title, message }: { title?: string; message?: string }) => (
      <ReactNative.View>
        {title ? <ReactNative.Text>{title}</ReactNative.Text> : null}
        {message ? <ReactNative.Text>{message}</ReactNative.Text> : null}
      </ReactNative.View>
    ),
    Input: React.forwardRef(
      (
        {
          label,
          value,
          onChangeText,
          placeholder,
          onFocus,
        }: {
          label?: string;
          value?: string;
          onChangeText?: (value: string) => void;
          placeholder?: string;
          onFocus?: () => void;
        },
        ref: React.Ref<any>
      ) => (
        <ReactNative.TextInput
          ref={ref}
          accessibilityLabel={label ?? 'input'}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          onFocus={onFocus}
        />
      )
    ),
    Modal: ({
      visible,
      title,
      children,
    }: {
      visible: boolean;
      title?: string;
      children: React.ReactNode;
    }) =>
      visible ? (
        <ReactNative.View>
          {title ? <ReactNative.Text>{title}</ReactNative.Text> : null}
          {children}
        </ReactNative.View>
      ) : null,
  };
});

function createComment(id: string, authorId: string, authorName: string, body: string) {
  return {
    id,
    postId: 'post-1',
    body,
    authorId,
    authorName,
    authorRole: 'staff',
    mentionedUserIds: [],
    reactionCounts: {},
    isPinned: false,
    status: 'active' as const,
    imageAttachments: [],
    children: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function createBoardDetailData(commentTree: ReturnType<typeof createComment>[]) {
  return {
    post: {
      id: 'post-1',
      boardType: 'free',
      source: 'board',
      title: '게시글 제목',
      body: '게시글 본문',
      authorId: 'author-1',
      authorName: '글쓴이',
      authorRole: 'staff',
      visibility: 'public',
      status: 'active' as const,
      linkedJobPostingId: null,
      isAutoCreated: false,
      isLocked: false,
      likeCount: 1,
      dislikeCount: 0,
      commentCount: commentTree.length,
      viewCount: 3,
      imageAttachments: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    commentTree,
    myVote: null,
    myReactions: {},
    membership: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFlashListRenderItems.length = 0;

  mockUseBoardPostDetail.mockReturnValue({
    data: createBoardDetailData([
      createComment('comment-1', 'other-1', 'Alice', '다른 사람 댓글'),
      createComment('comment-2', 'me', '나', '내 댓글'),
    ]),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  });
});

describe('BoardPostDetailScreen', () => {
  it('switches from the root composer to an inline reply composer', () => {
    const { getAllByText, getByText, queryByText } = render(<BoardPostDetailScreen />);

    expect(getByText('댓글 작성')).toBeTruthy();

    fireEvent.press(getAllByText('답글')[0]);

    expect(getByText('답글 작성')).toBeTruthy();
    expect(queryByText('댓글 작성')).toBeNull();
  });

  it('opens inline edit mode with the existing body prefilled', () => {
    const { getByDisplayValue, getByText, queryByText } = render(<BoardPostDetailScreen />);

    fireEvent.press(getByText('수정'));

    expect(getByText('댓글 수정')).toBeTruthy();
    expect(getByDisplayValue('내 댓글')).toBeTruthy();
    expect(queryByText('댓글 작성')).toBeNull();
  });

  it('keeps FlashList renderItem stable while typing in the composer', () => {
    const { getByPlaceholderText } = render(<BoardPostDetailScreen />);

    const initialRenderItem = mockFlashListRenderItems.at(-1);

    fireEvent.changeText(getByPlaceholderText('댓글을 입력해 주세요.'), '새 댓글');

    expect(mockFlashListRenderItems.length).toBeGreaterThan(1);
    expect(mockFlashListRenderItems.at(-1)).toBe(initialRenderItem);
  });

  it('resets stale edit state when the target comment disappears', async () => {
    const { getByText, queryByDisplayValue, queryByText, rerender } = render(
      <BoardPostDetailScreen />
    );

    fireEvent.press(getByText('수정'));
    expect(getByText('댓글 수정')).toBeTruthy();

    mockUseBoardPostDetail.mockReturnValue({
      data: createBoardDetailData([
        createComment('comment-1', 'other-1', 'Alice', '다른 사람 댓글'),
      ]),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    rerender(<BoardPostDetailScreen />);

    await waitFor(() => {
      expect(getByText('댓글 작성')).toBeTruthy();
      expect(queryByText('댓글 수정')).toBeNull();
      expect(queryByDisplayValue('내 댓글')).toBeNull();
    });
  });
});
