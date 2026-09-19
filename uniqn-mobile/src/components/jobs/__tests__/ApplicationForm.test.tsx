import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ApplicationForm } from '../ApplicationForm';

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

// 확정 집계 훅은 QueryClientProvider 를 요구하므로 목 처리(폼 자체 로직만 검증).
jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
  extractPostingFilledSubmap: () => undefined,
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
  // 실제 SheetModal 은 footer 를 렌더한다. 예전 목은 그 prop 을 통째로 버려서
  // 제출 버튼과 그 주변(안내 문구 포함)이 이 테스트에서 한 번도 렌더된 적이 없었다.
  SheetModal: ({
    visible,
    children,
    footer,
    onRequestClose,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    onRequestClose?: () => void;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return visible ? (
      <ReactNative.View>
        <ReactNative.Pressable onPress={onRequestClose} testID="sheet-request-close">
          <ReactNative.Text>close</ReactNative.Text>
        </ReactNative.Pressable>
        {children}
        {footer}
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
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Alert.alert 은 네이티브 호출 — 테스트에서는 spy 로 가로채 buttons 를 검사한다.
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
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
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('asks for confirmation (native Alert) before closing when the form is dirty', () => {
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

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      '작성을 그만할까요?',
      '입력한 지원 내용은 저장되지 않고 바로 닫힙니다.',
      expect.arrayContaining([
        expect.objectContaining({ text: '계속 편집' }),
        expect.objectContaining({ text: '닫기', onPress: expect.any(Function) }),
      ]),
      // 안드로이드 뒤로가기 dismiss 도 취소로 수렴시키는 옵션 (confirmAction)
      expect.objectContaining({ onDismiss: expect.any(Function) })
    );
    expect(onClose).not.toHaveBeenCalled();

    // '닫기' 버튼의 onPress 를 실행하면 실제로 닫힌다.
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === '닫기')?.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 감사 ux-02 — 예전에는 필수 항목이 비었을 때 '지원하기' 버튼이 그냥 회색으로 죽었다.
  // 무엇이 빠졌는지 알 방법이 없었고, disabled Pressable 은 onPress 조차 안 불려서
  // handleSubmit 안의 안내 분기는 도달 불가능한 죽은 코드였다.
  // staff 의 핵심 전환 퍼널을 침묵으로 막고 있던 자리다.
  it('무엇이 빠졌는지 화면에 말한다 (침묵하는 비활성 버튼 금지)', () => {
    const { getByText } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(getByText('지원할 날짜와 역할을 선택해 주세요.')).toBeTruthy();
  });

  it('동의만 체크해도 아직 남은 필수 항목을 계속 알린다', () => {
    const { getByTestId, getByText } = render(
      <ApplicationForm
        job={job}
        visible
        isSubmitting={false}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('provision-consent-checkbox'));

    // 동의를 채워도 역할 선택이 남아 있으므로 안내가 사라지면 안 된다 —
    // 하나 채울 때마다 다음 할 일이 보여야 한다.
    expect(getByText('지원할 날짜와 역할을 선택해 주세요.')).toBeTruthy();
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
