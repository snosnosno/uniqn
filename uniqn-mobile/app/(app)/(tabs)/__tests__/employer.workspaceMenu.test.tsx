import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useReceivedWorkspaceInvitations } from '@/hooks/workspace';
import { WorkspaceHeaderAction } from '../employer';

// expo-router: 전역 setup 은 useRouter 만 목킹하므로, 컴포넌트가 쓰는 router 싱글턴을 이 파일에서 목킹한다.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// 받은 초대 훅 — 테스트별로 invitations 개수를 제어한다.
jest.mock('@/hooks/workspace', () => ({
  useReceivedWorkspaceInvitations: jest.fn(() => ({ invitations: [] })),
}));

// themeStore — 셀렉터/비셀렉터 두 형태 모두 지원.
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
        <ReactNative.View testID="workspace-action-sheet">
          {options.map((option) => (
            <ReactNative.Pressable
              key={option.value}
              testID={`workspace-option-${option.value}`}
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

// 렌더되지 않는 형제 모듈들의 실제 로드(무거운 네이티브 의존성)를 차단한다.
jest.mock('@/components/ui/AppFlashList', () => ({ AppFlashList: () => null }));
jest.mock('@/components', () => ({
  Button: () => null,
  ConfirmModal: () => null,
  PostingSurfaceState: () => null,
}));
jest.mock('@/components/employer/qr/EventQRModal', () => ({ EventQRModal: () => null }));
jest.mock('@/components/employer', () => ({
  JobPostingCard: () => null,
  NonEmployerView: () => null,
}));
jest.mock('@/components/headers', () => ({ TabHeader: () => null }));
jest.mock('@/components/workspace', () => ({ WorkspaceContextBar: () => null }));
jest.mock('@/components/icons', () => ({
  BriefcaseIcon: () => null,
  CalendarDaysIcon: () => null,
  ChevronRightIcon: () => null,
  EllipsisHorizontalIcon: () => null,
  PlusIcon: () => null,
  UserPlusIcon: () => null,
  UsersIcon: () => null,
}));

const mockUseReceivedWorkspaceInvitations = useReceivedWorkspaceInvitations as jest.Mock;

describe('WorkspaceHeaderAction 더보기 메뉴', () => {
  beforeEach(() => {
    mockUseReceivedWorkspaceInvitations.mockReturnValue({ invitations: [] });
  });

  it('⋯ 트리거를 누르면 워크스페이스·받은 초대 옵션이 노출된다', () => {
    const { getByLabelText, queryByText, getByText } = render(<WorkspaceHeaderAction />);

    // 열기 전에는 옵션이 없다.
    expect(queryByText('워크스페이스')).toBeNull();
    expect(queryByText('받은 초대')).toBeNull();

    fireEvent.press(getByLabelText(/더보기/));

    expect(getByText('워크스페이스')).toBeTruthy();
    expect(getByText('받은 초대')).toBeTruthy();
  });

  it("'워크스페이스' 선택 시 워크스페이스 라우트로 push 한다", () => {
    const { getByLabelText, getByText } = render(<WorkspaceHeaderAction />);

    fireEvent.press(getByLabelText(/더보기/));
    fireEvent.press(getByText('워크스페이스'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/workspace');
  });

  it("'받은 초대' 선택 시 받은 초대 라우트로 push 한다", () => {
    const { getByLabelText, getByText } = render(<WorkspaceHeaderAction />);

    fireEvent.press(getByLabelText(/더보기/));
    fireEvent.press(getByText('받은 초대'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/workspace/invitations');
  });

  it('대기 중인 초대가 있으면 받은 초대 옵션에 건수를 표시한다', () => {
    mockUseReceivedWorkspaceInvitations.mockReturnValue({
      invitations: [{ id: 'a' }, { id: 'b' }],
    });

    const { getByLabelText, getByText } = render(<WorkspaceHeaderAction />);

    fireEvent.press(getByLabelText(/더보기/));

    expect(getByText('받은 초대 (2건)')).toBeTruthy();
  });
});
