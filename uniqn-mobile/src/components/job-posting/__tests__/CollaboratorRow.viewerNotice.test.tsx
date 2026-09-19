/**
 * CollaboratorRow — 보기 전용 지정 시 노쇼 횟수 열람 안내 (#478 후속, 구인자 IA S5)
 *
 * 보기 전용(viewer)도 get_applicant_no_show_counts 로 지원자 노쇼 횟수를 본다
 * (20260813150000_job_posting_collaborator_role.sql 결정 주석). 그 대가로 지정하는 사장이
 * 이 사실을 알아야 한다. 협업자는 manager 로 추가되므로 viewer 가 되는 길은 이 확인창뿐이다.
 * 대조군: 관리로 올리는 확인창에는 이 안내가 없다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { confirmAction } from '@/utils/confirmAction';
import { CollaboratorRow } from '../CollaboratorRow';
import type { JobPostingCollaboratorWithUser } from '@/types/jobPostingCollaborator';

jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@/components/ui/Avatar', () => ({ Avatar: () => null }));

const NOTICE = '이 사람도 지원자 노쇼 횟수를 봅니다';

function makeCollaborator(
  role: JobPostingCollaboratorWithUser['role']
): JobPostingCollaboratorWithUser {
  return {
    id: 'jpc-1',
    jobPostingId: 'jp-1',
    userId: 'user-2',
    addedBy: 'owner-1',
    addedAt: null,
    role,
    displayName: '박지훈',
    email: 'park@example.com',
    photoUrl: null,
  } as unknown as JobPostingCollaboratorWithUser;
}

function lastConfirmMessage(): string {
  const calls = (confirmAction as jest.Mock).mock.calls;
  return calls[calls.length - 1][0].message as string;
}

describe('CollaboratorRow 보기 전용 지정 안내', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('보기 전용으로 바꾸는 확인창은 노쇼 횟수 열람을 알린다', () => {
    const { getByLabelText } = render(
      <CollaboratorRow
        collaborator={makeCollaborator('manager')}
        isOwner
        currentUserId="owner-1"
        onChangeRole={jest.fn()}
      />
    );

    fireEvent.press(getByLabelText('박지훈 권한 관리, 눌러서 변경'));

    expect(confirmAction).toHaveBeenCalledTimes(1);
    expect((confirmAction as jest.Mock).mock.calls[0][0].title).toBe('보기 전용으로 바꿀까요?');
    expect(lastConfirmMessage()).toContain(NOTICE);
  });

  it('보기 전용→관리로 올리는 확인창에는 이 안내가 없다(대조군)', () => {
    const { getByLabelText } = render(
      <CollaboratorRow
        collaborator={makeCollaborator('viewer')}
        isOwner
        currentUserId="owner-1"
        onChangeRole={jest.fn()}
      />
    );

    fireEvent.press(getByLabelText('박지훈 권한 보기 전용, 눌러서 변경'));

    expect((confirmAction as jest.Mock).mock.calls[0][0].title).toBe('관리 권한을 줄까요?');
    expect(lastConfirmMessage()).not.toContain(NOTICE);
  });
});
