/**
 * EmployerMoreMenu — 내 공고 탭 ⋯ 메뉴 (구인자 IA S3)
 *
 * - 받은 초대·묶음 공유는 ⋯ 안으로 모은다.
 * - 팀 진입점은 사라지지 않는다: 팀이 나 혼자면 같은 자리에 `팀원 초대` 로, 2명 이상이면 `팀` 으로.
 *   (멤버 목록은 소유자를 포함하지 않는다 — 팀 화면이 소유자 프로필을 따로 그린다)
 * - 멤버 조회가 끝나기 전에는 `팀` 으로 둔다 — 이름이 로딩 중에 깜빡이지 않게.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import {
  useActiveWorkspace,
  useReceivedWorkspaceInvitations,
  useWorkspaceMembers,
} from '@/hooks/workspace';
import { EmployerMoreMenu } from '../EmployerMoreMenu';

// expo-router: 전역 setup 은 useRouter 만 목킹하므로, 컴포넌트가 쓰는 router 싱글턴을 이 파일에서 목킹한다.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/hooks/workspace', () => ({
  useReceivedWorkspaceInvitations: jest.fn(),
  useActiveWorkspace: jest.fn(),
  useWorkspaceMembers: jest.fn(),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector?: (state: { isDarkMode: boolean }) => unknown) => {
    const state = { isDarkMode: false };
    return selector ? selector(state) : state;
  },
}));

// ActionSheet 경량 스텁 — visible 을 존중하고, 옵션을 눌러 onSelect(value) 를 호출한다.
// (실제 ActionSheet 는 onSelect 후 onClose 를 부르므로 동일하게 재현)
jest.mock('@/components/ui', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    ActionSheet: ({
      visible,
      options,
      onSelect,
      onClose,
    }: {
      visible: boolean;
      options: { label: string; value: string }[];
      onSelect: (value: string) => void;
      onClose: () => void;
    }) => {
      if (!visible) {
        return null;
      }
      return (
        <ReactNative.View testID="employer-more-sheet">
          {options.map((option) => (
            <ReactNative.Pressable
              key={option.value}
              testID={`employer-more-option-${option.value}`}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <ReactNative.Text>{option.label}</ReactNative.Text>
            </ReactNative.Pressable>
          ))}
        </ReactNative.View>
      );
    },
  };
});

jest.mock('@/components/icons', () => ({ EllipsisHorizontalIcon: () => null }));

const mockInvitations = useReceivedWorkspaceInvitations as jest.Mock;
const mockActiveWorkspace = useActiveWorkspace as jest.Mock;
const mockMembers = useWorkspaceMembers as jest.Mock;

function membersResult(count: number, overrides: Record<string, unknown> = {}) {
  return {
    members: Array.from({ length: count }, (_, index) => ({ id: `m-${index}` })),
    isLoading: false,
    error: null,
    isOwner: true,
    ...overrides,
  };
}

describe('EmployerMoreMenu ⋯ 메뉴', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvitations.mockReturnValue({ invitations: [] });
    mockActiveWorkspace.mockReturnValue({
      activeWorkspace: { id: 'ws-1', ownerId: 'owner-1' },
    });
    mockMembers.mockReturnValue(membersResult(1));
  });

  it('열기 전에는 옵션이 없고, 열면 팀·받은 초대가 보인다', () => {
    const { getByLabelText, queryByText, getByText } = render(<EmployerMoreMenu />);

    expect(queryByText('받은 초대')).toBeNull();
    fireEvent.press(getByLabelText(/더보기/));

    expect(getByText('팀')).toBeTruthy();
    expect(getByText('받은 초대')).toBeTruthy();
  });

  it('팀이 나 혼자면 팀 자리에 팀원 초대를 두고, 누르면 팀 화면으로 간다', () => {
    mockMembers.mockReturnValue(membersResult(0));
    const { getByLabelText, getByText, queryByText } = render(<EmployerMoreMenu />);

    fireEvent.press(getByLabelText(/더보기/));

    expect(queryByText('팀')).toBeNull();
    fireEvent.press(getByText('팀원 초대'));
    expect(router.push).toHaveBeenCalledWith('/(employer)/workspace');
  });

  it('멤버 조회 중에는 팀으로 둔다', () => {
    mockMembers.mockReturnValue(membersResult(0, { isLoading: true }));
    const { getByLabelText, getByText } = render(<EmployerMoreMenu />);

    fireEvent.press(getByLabelText(/더보기/));

    expect(getByText('팀')).toBeTruthy();
  });

  it("'팀' 선택 시 팀 화면으로 push 한다", () => {
    const { getByLabelText, getByText } = render(<EmployerMoreMenu />);

    fireEvent.press(getByLabelText(/더보기/));
    fireEvent.press(getByText('팀'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/workspace');
  });

  it("'받은 초대' 선택 시 받은 초대 화면으로 push 한다", () => {
    const { getByLabelText, getByText } = render(<EmployerMoreMenu />);

    fireEvent.press(getByLabelText(/더보기/));
    fireEvent.press(getByText('받은 초대'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/workspace/invitations');
  });

  it('대기 중인 초대가 있으면 건수를 표시한다', () => {
    mockInvitations.mockReturnValue({ invitations: [{ id: 'a' }, { id: 'b' }] });
    const { getByLabelText, getByText } = render(<EmployerMoreMenu />);

    fireEvent.press(getByLabelText(/더보기/));

    expect(getByText('받은 초대 (2건)')).toBeTruthy();
  });

  it('묶음 공유를 넘기면 옵션으로 보이고, 누르면 호출한다', () => {
    const onBulkShare = jest.fn();
    const { getByLabelText, getByText } = render(<EmployerMoreMenu onBulkShare={onBulkShare} />);

    fireEvent.press(getByLabelText(/더보기/));
    fireEvent.press(getByText('여러 공고 묶어서 공유'));

    expect(onBulkShare).toHaveBeenCalled();
  });

  it('묶음 공유를 넘기지 않으면 옵션이 없다', () => {
    const { getByLabelText, queryByText } = render(<EmployerMoreMenu />);

    fireEvent.press(getByLabelText(/더보기/));

    expect(queryByText('여러 공고 묶어서 공유')).toBeNull();
  });
});
