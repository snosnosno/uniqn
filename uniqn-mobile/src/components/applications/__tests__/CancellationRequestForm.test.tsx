/**
 * CancellationRequestForm — 대타 구인 글 자동 게시 기본 OFF + 고지·미리보기 (W1-10 / CANCEL-12).
 *
 * @description 이 게시판은 작성자 실명으로 전체 공개된다. 예전에는 체크박스가 기본 ON 이고
 *   재열림 때도 ON 으로 되돌아왔으며, 설명은 "게시판에 대타 구인 글이 자동으로 올라갑니다"
 *   한 줄뿐이라 **무엇이 실리는지**를 고지하지 않았다. 실제로는 취소 사유 원문이 본문
 *   첫 줄이었다 — 사용자는 사장에게만 말한다고 믿고 질병·가족 문제를 적는다.
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';

import { CancellationRequestForm } from '../CancellationRequestForm';

import type { Application } from '@/types';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn().mockResolvedValue(undefined) }));

const application = {
  id: 'app-1',
  jobPostingId: 'job-1',
  jobPostingTitle: '강남 홀덤펍 딜러',
  jobPostingDate: '2026-08-01',
  assignments: [{ roleIds: ['dealer'] }],
} as unknown as Application;

const preview = {
  title: '대타 구해요 · 강남 홀덤펍 딜러',
  body: '아래 일정에 함께할 대타를 구합니다.\n📅 2026-08-01\n📍 강남구',
};

function renderForm(overrides: Partial<React.ComponentProps<typeof CancellationRequestForm>> = {}) {
  const onSubmit = jest.fn();
  const utils = render(
    <CancellationRequestForm
      application={application}
      visible
      isSubmitting={false}
      onSubmit={onSubmit}
      onClose={jest.fn()}
      substitutePreview={preview}
      {...overrides}
    />
  );
  return { ...utils, onSubmit };
}

/** 사유 5자 이상이어야 제출 버튼이 열린다. */
function fillReason(getByPlaceholderText: ReturnType<typeof render>['getByPlaceholderText']) {
  fireEvent.changeText(
    getByPlaceholderText('취소하려는 이유를 상세히 입력해주세요'),
    '가족 상을 당해 참석이 어렵습니다'
  );
}

describe('대타 구인 글 자동 게시 — 기본 OFF', () => {
  it('처음 열면 체크가 꺼져 있다', () => {
    const { getByRole } = renderForm();

    expect(getByRole('checkbox').props.accessibilityState.checked).toBe(false);
  });

  it('켜지 않고 제출하면 게시하지 않는다', async () => {
    const { getByPlaceholderText, getByLabelText, onSubmit } = renderForm();

    fillReason(getByPlaceholderText);
    // 제출 핸들러가 await triggerHaptic 후 setState 하므로 act 로 감싼다.
    await act(async () => {
      fireEvent.press(getByLabelText('확정된 지원 취소 요청 제출'));
    });

    expect(onSubmit).toHaveBeenCalledWith('app-1', '가족 상을 당해 참석이 어렵습니다', false);
  });

  it('사용자가 켜면 그 의사가 그대로 전달된다', async () => {
    const { getByPlaceholderText, getByRole, getByLabelText, onSubmit } = renderForm();

    fillReason(getByPlaceholderText);
    fireEvent.press(getByRole('checkbox'));
    await act(async () => {
      fireEvent.press(getByLabelText('확정된 지원 취소 요청 제출'));
    });

    expect(onSubmit).toHaveBeenCalledWith('app-1', '가족 상을 당해 참석이 어렵습니다', true);
  });
});

describe('고지와 미리보기', () => {
  it('실명 공개라는 사실과 사유가 실리지 않는다는 사실을 고지한다', () => {
    const { getByText } = renderForm();

    expect(getByText(/내 이름으로 공개/)).toBeTruthy();
    expect(getByText(/구인자에게만 전달/)).toBeTruthy();
  });

  it('꺼져 있으면 미리보기를 노출하지 않는다', () => {
    const { queryByText } = renderForm();

    expect(queryByText('게시판에 이렇게 올라갑니다')).toBeNull();
  });

  it('켜면 실제로 올라갈 제목·본문을 그대로 보여준다', () => {
    const { getByRole, getByText } = renderForm();

    fireEvent.press(getByRole('checkbox'));

    expect(getByText('게시판에 이렇게 올라갑니다')).toBeTruthy();
    expect(getByText(preview.title)).toBeTruthy();
    expect(getByText(preview.body)).toBeTruthy();
  });

  it('미리보기 본문에 사용자가 입력한 취소 사유가 섞이지 않는다', () => {
    const { getByPlaceholderText, getByRole, queryByText } = renderForm();

    fillReason(getByPlaceholderText);
    fireEvent.press(getByRole('checkbox'));

    expect(queryByText(/가족 상을 당해/)).toBeNull();
  });
});
