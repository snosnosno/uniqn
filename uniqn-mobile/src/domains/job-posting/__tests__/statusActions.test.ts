/**
 * 공고 상태 전이 액션 — 어떤 상태에서 무엇을 할 수 있는지 (S2-3).
 *
 * 이 표가 흔들리면 상세 화면의 상태 뱃지가 "눌러도 아무 일 없는 버튼"이 되거나,
 * 반대로 트리거가 즉시 되돌릴 전이를 사장에게 제안하게 된다.
 */

import {
  getPostingStatusActionHint,
  isPostingRepostable,
  selectPostingStatusActions,
} from '@/domains/job-posting';
import type { JobPostingStatus } from '@/types';

describe('selectPostingStatusActions', () => {
  it('모집 중이면 마감할 수 있다', () => {
    expect(selectPostingStatusActions('active')).toEqual(['close']);
    expect(selectPostingStatusActions('approved')).toEqual(['close']);
  });

  it('마감된 공고는 다시 열 수 있다', () => {
    expect(selectPostingStatusActions('closed')).toEqual(['reopen']);
  });

  // 정원이 차서 트리거가 내린 상태다. 수동으로 열어도 좌석이 그대로면 트리거가 즉시 되돌린다 —
  // 되돌아가는 버튼을 제안하면 앱이 고장 난 것처럼 보인다.
  it('정원 참(capacity_full)은 수동 전이를 제안하지 않는다', () => {
    expect(selectPostingStatusActions('capacity_full')).toEqual([]);
  });

  it('심사 라인과 종료 상태에는 전이가 없다', () => {
    const noAction: JobPostingStatus[] = [
      'draft',
      'pending',
      'rejected',
      'cancelled',
      'expired',
      'container',
    ];
    noAction.forEach((status) => {
      expect(selectPostingStatusActions(status)).toEqual([]);
    });
  });
});

describe('isPostingRepostable', () => {
  it('끝난 공고(만료·마감)에는 다시 올리기를 제안한다', () => {
    expect(isPostingRepostable('expired')).toBe(true);
    expect(isPostingRepostable('closed')).toBe(true);
  });

  // 사장이 스스로 내린 공고를 되살리자는 제안은 무례하게 읽힌다.
  it('취소된 공고에는 제안하지 않는다', () => {
    expect(isPostingRepostable('cancelled')).toBe(false);
  });

  // 끝난 게 아니라 **찬** 것이고, 자리가 비면 자동으로 다시 열린다.
  it('정원 참에는 제안하지 않는다', () => {
    expect(isPostingRepostable('capacity_full')).toBe(false);
  });

  it('살아 있는 공고에는 제안하지 않는다', () => {
    expect(isPostingRepostable('active')).toBe(false);
    expect(isPostingRepostable('draft')).toBe(false);
    expect(isPostingRepostable('pending')).toBe(false);
  });
});

describe('getPostingStatusActionHint', () => {
  it('정원 참은 자동 마감이라는 사실과 회복 조건을 말한다', () => {
    const hint = getPostingStatusActionHint('capacity_full');
    expect(hint).toContain('정원이 차서');
    expect(hint).toContain('자리가 비면');
  });

  it('전이가 가능한 상태에는 사유 문구가 없다', () => {
    expect(getPostingStatusActionHint('active')).toBeNull();
    expect(getPostingStatusActionHint('closed')).toBeNull();
  });

  it('액션이 없는 상태는 힌트든 액션이든 최소 하나는 준다 — 둘 다 없으면 뱃지가 먹통이 된다', () => {
    const statuses: JobPostingStatus[] = [
      'draft',
      'pending',
      'approved',
      'active',
      'capacity_full',
      'closed',
      'cancelled',
      'expired',
      'rejected',
    ];

    statuses.forEach((status) => {
      const hasAction = selectPostingStatusActions(status).length > 0;
      const hasHint = getPostingStatusActionHint(status) !== null;
      // draft 만 예외 — 아직 게시 전이라 상태에 대해 할 말도 할 일도 없다(뱃지 비활성).
      if (status === 'draft') {
        expect(hasAction || hasHint).toBe(false);
        return;
      }
      expect(hasAction || hasHint).toBe(true);
    });
  });
});
