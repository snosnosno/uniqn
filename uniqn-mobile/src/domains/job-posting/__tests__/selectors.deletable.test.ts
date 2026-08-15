/**
 * isPostingDeletable — 공고 삭제 가능 여부 규칙 (EF-crud-4)
 *
 * 상세 화면의 삭제 버튼 활성 상태와 그 아래 캡션("채워진 자리가 있는 공고는 삭제할 수 없습니다")의
 * 단일 근거. 채워진 좌석이 하나라도 있으면 삭제 불가.
 *
 * 🚨 **축이 계약이다.** 이 함수가 받는 수는 좌석 수(`filledPositions`, work_logs 축)이지
 *    확정 지원자 수(applications 축)가 아니다. 서버(`deleteWithTransaction`)가 좌석으로 막으므로
 *    클라 버튼도 같은 축이어야 한다 — 축이 갈리면 버튼 상태와 실제 결과가 어긋난다.
 *    화면 쪽 회귀 가드는 `JobPostingDetailScreen.seatAxis.test.tsx`.
 */

import { isPostingDeletable } from '@/domains/job-posting';

describe('isPostingDeletable', () => {
  it('채워진 자리가 없으면 삭제 가능하다', () => {
    expect(isPostingDeletable(0)).toBe(true);
  });

  it('채워진 자리가 하나라도 있으면 삭제할 수 없다', () => {
    expect(isPostingDeletable(1)).toBe(false);
    expect(isPostingDeletable(5)).toBe(false);
  });

  // 좌석 카운터는 트리거가 유지하는 파생 컬럼이라 이론상 음수가 될 수 없지만,
  // `?? 0` 폴백이 여러 경로에 흩어져 있어 방어적으로 고정한다.
  it('음수(비정상 카운터)는 삭제 가능으로 본다', () => {
    expect(isPostingDeletable(-1)).toBe(true);
  });
});
