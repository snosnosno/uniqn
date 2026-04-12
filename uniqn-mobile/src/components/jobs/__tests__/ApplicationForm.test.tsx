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
});
