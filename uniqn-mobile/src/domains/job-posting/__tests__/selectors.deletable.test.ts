/**
 * isPostingDeletable — 공고 삭제 가능 여부 규칙 (EF-crud-4)
 *
 * 상세 화면 캡션("확정된 지원자가 있는 공고는 삭제할 수 없습니다")의 단일 근거.
 * 확정 지원자가 1명이라도 있으면 삭제 불가.
 */

import { isPostingDeletable } from '@/domains/job-posting';

describe('isPostingDeletable', () => {
  it('확정 지원자가 0명이면 삭제 가능하다', () => {
    expect(isPostingDeletable(0)).toBe(true);
  });

  it('확정 지원자가 1명 이상이면 삭제할 수 없다', () => {
    expect(isPostingDeletable(1)).toBe(false);
    expect(isPostingDeletable(5)).toBe(false);
  });
});
