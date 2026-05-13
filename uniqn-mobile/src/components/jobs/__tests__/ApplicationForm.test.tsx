import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ApplicationForm } from '../ApplicationForm';

const mockShowConfirm = jest.fn();

jest.mock('@/stores/modalStore', () => ({
  useModalStore: (selector: (state: { showConfirm: typeof mockShowConfirm }) => unknown) =>
    selector({
      showConfirm: mockShowConfirm,
    }),
}));

jest.mock('@/domains/job-posting', () => ({
  buildPostingFacts: () => ({
    workflow: { isFixed: false },
    questions: { items: [] },
    posting: { roles: [] },
    application: {
      fixedAssignmentTimeSlot: '',
      availableRoleOptions: [],
    },
    compensation: {
      display: { useSameSalary: false },
      defaultSalary: 0,
      allowanceLabels: [],
    },
  }),
}));

jest.mock('../AssignmentSelector', () => ({
  AssignmentSelector: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.View />;
  },
}));

jest.mock('../PostingTypeBadge', () => ({
  PostingTypeBadge: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.View />;
  },
}));

jest.mock('../PreQuestionForm', () => ({
  PreQuestionForm: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.View />;
  },
}));

jest.mock('../RoleSalaryDisplay', () => ({
  RoleSalaryDisplay: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.View />;
  },
}));

jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({
    visible,
    children,
    onRequestClose,
  }: {
    visible: boolean;
    children: React.ReactNode;
    onRequestClose?: () => void;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return visible ? (
      <ReactNative.View>
        <ReactNative.Pressable onPress={onRequestClose} testID="sheet-request-close">
          <ReactNative.Text>close</ReactNative.Text>
        </ReactNative.Pressable>
        {children}
      </ReactNative.View>
    ) : null;
  },
}));

const job = {
  id: 'job-1',
  title: '테스트 공고',
  postingType: 'urgent',
  location: { name: '서울' },
} as any;

describe('ApplicationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes immediately when there are no unsaved changes', () => {
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.press(getByTestId('sheet-request-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShowConfirm).not.toHaveBeenCalled();
  });

  it('asks for confirmation before closing when the form is dirty', () => {
    const onClose = jest.fn();

    const { getByPlaceholderText, getByTestId } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.changeText(
      getByPlaceholderText('간단한 자기소개나 경력을 입력해 주세요'),
      '지원 동기를 입력합니다.'
    );
    fireEvent.press(getByTestId('sheet-request-close'));

    expect(mockShowConfirm).toHaveBeenCalledTimes(1);
    expect(mockShowConfirm).toHaveBeenCalledWith(
      '작성을 그만할까요?',
      '입력한 지원 내용은 저장되지 않고 바로 닫힙니다.',
      expect.any(Function)
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  // T4 — P1 지원 시점 동의: 미체크 상태에서는 체크박스가 false 로 노출
  it('initially renders the provision consent checkbox unchecked', () => {
    const { getByTestId } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const checkbox = getByTestId('provision-consent-checkbox');
    expect(checkbox.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
  });

  // T5 — 체크 → 동의 상태가 true 로 전환되어 다음 액션을 막지 않음
  it('toggles provision consent when the checkbox is pressed', () => {
    const { getByTestId } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const checkbox = getByTestId('provision-consent-checkbox');
    fireEvent.press(checkbox);

    expect(checkbox.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  });

  // T6 (F3 회귀 방지) — 모달 닫았다가 다시 열면 동의 체크 상태 reset
  it('resets provision consent when the modal is reopened (F3 regression guard)', () => {
    const { getByTestId, rerender } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('provision-consent-checkbox'));
    expect(getByTestId('provision-consent-checkbox').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true })
    );

    // 모달 닫힘
    rerender(
      <ApplicationForm
        job={job}
        visible={false}
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // 모달 재오픈 — visible=true 진입 시 useEffect 가 false 로 reset
    rerender(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(getByTestId('provision-consent-checkbox').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false })
    );
  });
});
