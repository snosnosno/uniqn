/**
 * ApplicantConfirmModal — 입력값 이월 차단 (W1-11 리뷰 지적).
 *
 * @description 실패 시 사유를 보존하려고 제출 직후 초기화를 없앴는데, **성공 경로에도**
 *   초기화가 남지 않았다. 이 모달은 조건부 렌더가 아니라 상시 마운트라(`visible=false` 도
 *   `if (!applicant) return null` 도 언마운트가 아니다) `inputValue` 가 살아남는다.
 *   결과: 지원자 A 를 "일정이 안 맞아서" 로 거절 → 성공 → 지원자 B 확정 모달에 그 문장이
 *   메모로 미리 채워진다. TextInput 하나가 두 액션을 겸하므로 액션 축까지 넘어간다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ApplicantConfirmModal } from '../ConfirmModal';

import type { ApplicantWithDetails } from '@/services';

jest.mock('@/components/ui/Modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

const applicantA = {
  id: 'app-a',
  applicantName: '김스태프',
  assignments: [],
} as unknown as ApplicantWithDetails;

const applicantB = {
  id: 'app-b',
  applicantName: '이스태프',
  assignments: [],
} as unknown as ApplicantWithDetails;

function renderModal(overrides: Partial<React.ComponentProps<typeof ApplicantConfirmModal>> = {}) {
  const props = {
    visible: true,
    onClose: jest.fn(),
    applicant: applicantA,
    action: 'reject' as const,
    onConfirm: jest.fn(),
    onReject: jest.fn(),
    isLoading: false,
    ...overrides,
  };
  return { ...render(<ApplicantConfirmModal {...props} />), props };
}

describe('입력값 수명', () => {
  it('제출이 실패해도(모달이 열린 채면) 입력을 유지한다', () => {
    const { getByPlaceholderText, getByText } = renderModal();

    fireEvent.changeText(getByPlaceholderText('거절 사유를 입력하세요'), '일정이 안 맞아서');
    fireEvent.press(getByText('거절하기'));

    // 호출부가 닫지 않았으므로(=실패) 사유가 남아 있어야 한다.
    expect(getByPlaceholderText('거절 사유를 입력하세요').props.value).toBe('일정이 안 맞아서');
  });

  it('🔒 닫히면 비워진다 — 다음 지원자에게 이월되면 안 된다', () => {
    const { getByPlaceholderText, getByText, rerender, queryByPlaceholderText } = renderModal();

    fireEvent.changeText(getByPlaceholderText('거절 사유를 입력하세요'), '일정이 안 맞아서');
    fireEvent.press(getByText('거절하기'));

    // 성공 경로 — 호출부가 부모 state 만 내린다(모달의 handleClose 를 타지 않는다).
    rerender(
      <ApplicantConfirmModal
        visible={false}
        onClose={jest.fn()}
        applicant={applicantA}
        action="reject"
        onConfirm={jest.fn()}
        onReject={jest.fn()}
        isLoading={false}
      />
    );
    expect(queryByPlaceholderText('거절 사유를 입력하세요')).toBeNull();

    // 다음 지원자를 확정 모달로 연다.
    rerender(
      <ApplicantConfirmModal
        visible
        onClose={jest.fn()}
        applicant={applicantB}
        action="confirm"
        onConfirm={jest.fn()}
        onReject={jest.fn()}
        isLoading={false}
      />
    );

    expect(getByPlaceholderText('추가 메모를 입력하세요').props.value).toBe('');
  });
});

describe('서버 zod 한도와 정렬된 입력 상한', () => {
  it('거절 사유는 200자 (application.schema.ts reject reason)', () => {
    const { getByPlaceholderText } = renderModal({ action: 'reject' });

    expect(getByPlaceholderText('거절 사유를 입력하세요').props.maxLength).toBe(200);
  });

  it('확정 메모는 500자 (application.schema.ts notes)', () => {
    const { getByPlaceholderText } = renderModal({ action: 'confirm' });

    expect(getByPlaceholderText('추가 메모를 입력하세요').props.maxLength).toBe(500);
  });
});
